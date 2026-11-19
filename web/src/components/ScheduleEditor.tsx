import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  addScheduleEntry,
  groupScheduleEntries,
  isValidTime,
  removeScheduleEntry,
  ScheduleValidationError,
  updateScheduleEntry,
  WEEKDAYS,
} from '../schedule'
import {
  createDefaultStorageState,
  createStorageAdapter,
  type StorageAdapter,
} from '../storage'
import type { FitnessStorageState, SavedRoutine, Weekday, WeeklyScheduleEntry } from '../types'
import type { PushApiClient, PushApiError } from '../pushApi'
import { createPushCredentialStore, type PushCredentialStore } from '../pushCredentials'
import { getRemoteScheduleFeedback, remoteScheduleSuccessFeedback, uploadRemoteSchedule, type RemoteScheduleFeedback } from '../remoteSchedule'
import type { ReminderSettings } from '../types'
import './ScheduleEditor.css'

export type ScheduleEditorProps = {
  storageAdapter?: StorageAdapter
  /** Backward-compatible alias for integrations that call the dependency `storage`. */
  storage?: StorageAdapter
  routines?: SavedRoutine[]
  onScheduleChange?: (schedule: WeeklyScheduleEntry[]) => void
  /** Alias for consumers that use the shorter change-handler name. */
  onChange?: (schedule: WeeklyScheduleEntry[]) => void
  createEntryId?: () => string
  pushApi?: PushApiClient | null
  pushApiError?: PushApiError | null
  pushCredentialStore?: PushCredentialStore
  reminderSettings?: ReminderSettings
}

type AssignmentForm = {
  day: Weekday
  time: string
  routineId: string
}

type Feedback = {
  tone: 'success' | 'error'
  message: string
}

const DAY_LABELS: Record<Weekday, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
}

let fallbackIdCounter = 0

const createStableEntryId = (): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `schedule-${globalThis.crypto.randomUUID()}`
  }

  fallbackIdCounter += 1
  return `schedule-${Date.now()}-${fallbackIdCounter}`
}

const readStateSafely = (adapter: StorageAdapter): FitnessStorageState => {
  try {
    return adapter.read()
  } catch {
    return createDefaultStorageState()
  }
}

const emptyForm = (routineId = ''): AssignmentForm => ({ day: 'monday', time: '09:00', routineId })

const createUniqueEntryId = (entries: readonly WeeklyScheduleEntry[], createId: () => string): string => {
  const requestedId = createId()
  if (!entries.some((entry) => entry.id === requestedId)) return requestedId

  let fallbackId = createStableEntryId()
  while (entries.some((entry) => entry.id === fallbackId)) fallbackId = createStableEntryId()
  return fallbackId
}

const getRoutineExerciseCount = (routine: SavedRoutine): number => (
  routine.selections.reduce((total, selection) => total + selection.exercises.length, 0)
)

function ScheduleEditor({
  storage,
  storageAdapter,
  routines: suppliedRoutines,
  onScheduleChange,
  onChange,
  createEntryId = createStableEntryId,
  pushApi = null,
  pushCredentialStore,
  reminderSettings,
}: ScheduleEditorProps) {
  const adapter = useMemo(
    () => storageAdapter ?? storage ?? createStorageAdapter(),
    [storage, storageAdapter],
  )
  const [storageState, setStorageState] = useState<FitnessStorageState>(() => readStateSafely(adapter))
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<AssignmentForm>(() => emptyForm(storageState.routines[0]?.id))
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [remoteFeedback, setRemoteFeedback] = useState<RemoteScheduleFeedback | null>(null)
  const [remoteBusy, setRemoteBusy] = useState(false)
  const credentials = useMemo(() => pushCredentialStore ?? createPushCredentialStore(), [pushCredentialStore])

  const routines = suppliedRoutines ?? storageState.routines
  const entriesByDay = useMemo(
    () => groupScheduleEntries(storageState.schedule, routines),
    [routines, storageState.schedule],
  )

  const closeForm = () => {
    setIsFormOpen(false)
    setEditingId(null)
  }

  const openAddForm = (day: Weekday = 'monday') => {
    setEditingId(null)
    setForm({ ...emptyForm(routines[0]?.id), day })
    setFeedback(null)
    setIsFormOpen(true)
  }

  const openEditForm = (entry: WeeklyScheduleEntry) => {
    setEditingId(entry.id)
    setForm({ day: entry.day, time: entry.time, routineId: entry.routineId })
    setFeedback(null)
    setIsFormOpen(true)
  }

  const persistSchedule = (schedule: WeeklyScheduleEntry[]): boolean => {
    const nextState = { ...storageState, schedule }
    try {
      if (!adapter.write(nextState)) {
        setFeedback({ tone: 'error', message: 'This schedule change could not be saved on this device.' })
        return false
      }
    } catch {
      setFeedback({ tone: 'error', message: 'This schedule change could not be saved on this device.' })
      return false
    }

    setStorageState(nextState)
    onScheduleChange?.(schedule)
    onChange?.(schedule)
    if (pushApi && credentials.read() && reminderSettings) {
      setRemoteBusy(true)
      void uploadRemoteSchedule(pushApi, reminderSettings, schedule)
        .then(() => setRemoteFeedback(remoteScheduleSuccessFeedback))
        .catch((error) => {
          const nextFeedback = getRemoteScheduleFeedback(error)
          if (nextFeedback.status === 'unauthorized') credentials.clear()
          setRemoteFeedback(nextFeedback)
        })
        .finally(() => setRemoteBusy(false))
    }
    return true
  }

  const saveAssignment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isValidTime(form.time)) {
      setFeedback({ tone: 'error', message: 'Enter a valid time in HH:MM 24-hour format.' })
      return
    }
    if (!form.routineId) {
      setFeedback({ tone: 'error', message: 'Choose a saved routine before saving this assignment.' })
      return
    }

    const entry: WeeklyScheduleEntry = {
      id: editingId ?? createUniqueEntryId(storageState.schedule, createEntryId),
      day: form.day,
      time: form.time,
      routineId: form.routineId,
    }

    try {
      const nextSchedule = editingId
        ? updateScheduleEntry(storageState.schedule, entry, routines)
        : addScheduleEntry(storageState.schedule, entry, routines)
      if (!persistSchedule(nextSchedule)) return
      setFeedback({ tone: 'success', message: `${DAY_LABELS[entry.day]} assignment saved.` })
      closeForm()
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: error instanceof ScheduleValidationError
          ? error.message
          : 'This assignment is not valid and was not saved.',
      })
    }
  }

  const removeAssignment = (entry: WeeklyScheduleEntry) => {
    try {
      const nextSchedule = removeScheduleEntry(storageState.schedule, entry.id)
      if (!persistSchedule(nextSchedule)) return
      if (editingId === entry.id) closeForm()
      setFeedback({ tone: 'success', message: `${DAY_LABELS[entry.day]} assignment removed.` })
    } catch {
      setFeedback({ tone: 'error', message: 'This assignment could not be removed.' })
    }
  }

  return (
    <section className="schedule-editor" aria-labelledby="schedule-editor-title">
      <header className="schedule-editor__header">
        <div>
          <p className="schedule-editor__eyebrow">Keep the rhythm</p>
          <h2 id="schedule-editor-title">Weekly schedule</h2>
          <p className="schedule-editor__intro">Plan one or more saved routines for each day of the week.</p>
        </div>
        <button className="schedule-editor__button schedule-editor__button--primary" onClick={() => openAddForm()} type="button">
          Add assignment
        </button>
      </header>

      {feedback && <p className={`schedule-editor__feedback schedule-editor__feedback--${feedback.tone}`} role={feedback.tone === 'error' ? 'alert' : 'status'}>{feedback.message}</p>}
      {remoteFeedback && <p className="schedule-editor__remote-feedback" aria-live="polite" role="status">{remoteBusy ? 'Updating remote reminder schedule…' : remoteFeedback.message}</p>}

      {isFormOpen && (
        <form className="schedule-editor__form" noValidate onSubmit={saveAssignment} aria-labelledby="schedule-form-title">
          <div className="schedule-editor__form-heading">
            <div>
              <p className="schedule-editor__eyebrow">{editingId ? 'Update a session' : 'Add to your week'}</p>
              <h3 id="schedule-form-title">{editingId ? 'Edit assignment' : 'New assignment'}</h3>
            </div>
            <button aria-label="Close assignment form" className="schedule-editor__close" onClick={closeForm} type="button">×</button>
          </div>
          <div className="schedule-editor__form-grid">
            <label>
              Weekday
              <select aria-label="Weekday" onChange={(event) => setForm((current) => ({ ...current, day: event.target.value as Weekday }))} value={form.day}>
                {WEEKDAYS.map((day) => <option key={day} value={day}>{DAY_LABELS[day]}</option>)}
              </select>
            </label>
            <label>
              Time
              <input aria-label="Time" onChange={(event) => setForm((current) => ({ ...current, time: event.target.value }))} required type="time" value={form.time} />
            </label>
            <label>
              Saved routine
              <select aria-label="Saved routine" onChange={(event) => setForm((current) => ({ ...current, routineId: event.target.value }))} required value={form.routineId}>
                <option value="">Choose a routine</option>
                {routines.map((routine) => <option key={routine.id} value={routine.id}>{routine.name}</option>)}
              </select>
            </label>
          </div>
          {routines.length === 0 && <p className="schedule-editor__form-hint">Create a saved routine before adding a schedule assignment.</p>}
          <div className="schedule-editor__form-actions">
            <button className="schedule-editor__button schedule-editor__button--quiet" onClick={closeForm} type="button">Cancel</button>
            <button className="schedule-editor__button schedule-editor__button--primary" type="submit">{editingId ? 'Save changes' : 'Save assignment'}</button>
          </div>
        </form>
      )}

      <div className="schedule-editor__week" aria-label="Weekly schedule days">
        {WEEKDAYS.map((day) => {
          const entries = entriesByDay[day]
          return (
            <article aria-label={`${DAY_LABELS[day]} schedule`} className={entries.length > 0 ? 'schedule-editor__day schedule-editor__day--scheduled' : 'schedule-editor__day'} key={day}>
              <header className="schedule-editor__day-header">
                <div>
                  <p className="schedule-editor__day-name">{DAY_LABELS[day]}</p>
                  <p className="schedule-editor__day-count">{entries.length === 0 ? 'No sessions' : `${entries.length} ${entries.length === 1 ? 'session' : 'sessions'}`}</p>
                </div>
                <button aria-label={`Add assignment for ${DAY_LABELS[day]}`} className="schedule-editor__add-day" onClick={() => openAddForm(day)} type="button">+</button>
              </header>
              {entries.length === 0 ? (
                <p className="schedule-editor__rest-day"><span aria-hidden="true">○</span> Rest day</p>
              ) : (
                <ul className="schedule-editor__assignments">
                  {entries.map((entry) => {
                    const routine = routines.find((candidate) => candidate.id === entry.routineId)
                    return (
                      <li className="schedule-editor__assignment" key={entry.id}>
                        <div className="schedule-editor__assignment-main">
                          <time dateTime={entry.time}>{entry.time}</time>
                          <div>
                            <strong>{routine?.name ?? 'Unavailable routine'}</strong>
                            {routine && <small>{getRoutineExerciseCount(routine)} exercises</small>}
                          </div>
                        </div>
                        <div className="schedule-editor__assignment-actions">
                          <button aria-label={`Edit ${DAY_LABELS[day]} assignment`} className="schedule-editor__text-button" onClick={() => openEditForm(entry)} type="button">Edit</button>
                          <button aria-label={`Remove ${DAY_LABELS[day]} assignment`} className="schedule-editor__text-button schedule-editor__text-button--danger" onClick={() => removeAssignment(entry)} type="button">Remove</button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}

export default ScheduleEditor
