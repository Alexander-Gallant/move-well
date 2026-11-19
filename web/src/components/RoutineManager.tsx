import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './RoutineManager.css'
import { createDefaultStorageState, createStorageAdapter } from '../storage'
import { removeScheduleEntriesByRoutineId } from '../schedule'
import type { Exercise, FitnessStorageState, RoutineSelection, SavedRoutine } from '../types'
import type { StorageAdapter } from '../storage'

export type RoutineManagerProps = {
  /** The routine currently shown in the builder. */
  currentRoutine?: RoutineSelection[]
  /** Alias for integrations that call the current builder value `routine`. */
  routine?: RoutineSelection[]
  /** The versioned adapter used to read and persist the complete app state. */
  storageAdapter?: StorageAdapter
  /** The builder name to prefill when saving the current routine. */
  initialName?: string
  /** Called after a user selects or saves a routine. */
  onRoutineSelect?: (routine: SavedRoutine) => void
  /** An optional externally selected routine ID. */
  selectedRoutineId?: string
  /** Injectable for deterministic consumers and tests. */
  createRoutineId?: () => string
}

type Feedback = {
  tone: 'success' | 'error'
  message: string
}

let fallbackIdCounter = 0

const createStableRoutineId = (): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `routine-${globalThis.crypto.randomUUID()}`
  }

  fallbackIdCounter += 1
  return `routine-${Date.now()}-${fallbackIdCounter}`
}

const cloneExercise = (exercise: Exercise): Exercise => ({
  ...exercise,
  muscles: [...exercise.muscles],
  instructions: [...exercise.instructions],
})

const cloneSelection = (selection: RoutineSelection): RoutineSelection => ({
  ...selection,
  exercises: selection.exercises.map(cloneExercise),
})

const cloneRoutine = (routine: SavedRoutine): SavedRoutine => ({
  id: routine.id,
  name: routine.name,
  selections: routine.selections.map(cloneSelection),
})

const readStateSafely = (adapter: StorageAdapter): FitnessStorageState => {
  try {
    return adapter.read()
  } catch {
    return createDefaultStorageState()
  }
}

const countExercises = (routine: SavedRoutine): number => (
  routine.selections.reduce((total, selection) => total + selection.exercises.length, 0)
)

function RoutineManager({
  currentRoutine,
  routine,
  storageAdapter,
  initialName = '',
  onRoutineSelect,
  selectedRoutineId,
  createRoutineId = createStableRoutineId,
}: RoutineManagerProps) {
  const adapter = useMemo(
    () => storageAdapter ?? createStorageAdapter(),
    [storageAdapter],
  )
  const builderRoutine = currentRoutine ?? routine ?? []
  const [storageState, setStorageState] = useState<FitnessStorageState>(() => readStateSafely(adapter))
  const [activeRoutineId, setActiveRoutineId] = useState<string | null>(
    () => selectedRoutineId ?? null,
  )
  const [name, setName] = useState(initialName)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const routines = storageState.routines
  const preferredActiveRoutineId = selectedRoutineId ?? activeRoutineId
  const activeRoutine = routines.find((savedRoutine) => savedRoutine.id === preferredActiveRoutineId) ?? routines[0]

  const persistState = (nextState: FitnessStorageState): boolean => {
    if (!adapter.write(nextState)) {
      setFeedback({ tone: 'error', message: 'Your routines could not be saved. Try again.' })
      return false
    }

    setStorageState(nextState)
    return true
  }

  const persistRoutines = (nextRoutines: SavedRoutine[]): boolean => persistState({
    ...storageState,
    routines: nextRoutines.map(cloneRoutine),
  })

  const selectRoutine = (savedRoutine: SavedRoutine) => {
    const selected = cloneRoutine(savedRoutine)
    setActiveRoutineId(selected.id)
    setPendingDeleteId(null)
    setRenamingId(null)
    setFeedback({ tone: 'success', message: `${selected.name} is now active.` })
    onRoutineSelect?.(selected)
  }

  const saveRoutine = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      setFeedback({ tone: 'error', message: 'Enter a name for this routine.' })
      return
    }

    const requestedId = createRoutineId()
    const id = routines.some((savedRoutine) => savedRoutine.id === requestedId)
      ? createStableRoutineId()
      : requestedId
    const savedRoutine: SavedRoutine = {
      id,
      name: trimmedName,
      selections: builderRoutine.map(cloneSelection),
    }
    if (!persistRoutines([...routines, savedRoutine])) return

    setName('')
    setActiveRoutineId(id)
    setFeedback({ tone: 'success', message: `${trimmedName} was saved.` })
    onRoutineSelect?.(cloneRoutine(savedRoutine))
  }

  const startRename = (savedRoutine: SavedRoutine) => {
    setRenamingId(savedRoutine.id)
    setRenameValue(savedRoutine.name)
    setPendingDeleteId(null)
    setFeedback(null)
  }

  const saveRename = (event: FormEvent<HTMLFormElement>, routineId: string) => {
    event.preventDefault()
    const trimmedName = renameValue.trim()
    if (!trimmedName) {
      setFeedback({ tone: 'error', message: 'Enter a name for this routine.' })
      return
    }

    const nextRoutines = routines.map((savedRoutine) => (
      savedRoutine.id === routineId
        ? { ...savedRoutine, name: trimmedName }
        : savedRoutine
    ))
    if (!persistRoutines(nextRoutines)) return

    const renamedRoutine = nextRoutines.find((savedRoutine) => savedRoutine.id === routineId)
    setRenamingId(null)
    setRenameValue('')
    setFeedback({ tone: 'success', message: `${trimmedName} was renamed.` })
    if (renamedRoutine && activeRoutineId === routineId) onRoutineSelect?.(cloneRoutine(renamedRoutine))
  }

  const requestDelete = (routineId: string) => {
    if (routines.length === 1) {
      setFeedback({ tone: 'error', message: 'Keep at least one routine. Your last routine was not deleted.' })
      return
    }
    setPendingDeleteId(routineId)
    setRenamingId(null)
    setFeedback(null)
  }

  const confirmDelete = (routineId: string) => {
    const deletedRoutine = routines.find((savedRoutine) => savedRoutine.id === routineId)
    if (!deletedRoutine || routines.length === 1) {
      setFeedback({ tone: 'error', message: 'Keep at least one routine. Your last routine was not deleted.' })
      setPendingDeleteId(null)
      return
    }

    const nextRoutines = routines.filter((savedRoutine) => savedRoutine.id !== routineId)
    const nextSchedule = removeScheduleEntriesByRoutineId(storageState.schedule, routineId)
    if (!persistState({
      ...storageState,
      routines: nextRoutines.map(cloneRoutine),
      schedule: nextSchedule,
    })) return

    const wasActive = routineId === preferredActiveRoutineId
    setPendingDeleteId(null)
    setFeedback({ tone: 'success', message: `${deletedRoutine.name} was deleted.` })
    if (wasActive || deletedRoutine.id === activeRoutine?.id) {
      const nextActiveRoutine = nextRoutines[0]
      setActiveRoutineId(nextActiveRoutine?.id ?? null)
      if (nextActiveRoutine) onRoutineSelect?.(cloneRoutine(nextActiveRoutine))
    }
  }

  return (
    <section className="routine-manager" aria-labelledby="routine-manager-title">
      <header className="routine-manager__header">
        <div>
          <p className="routine-manager__eyebrow">Your movement menu</p>
          <h2 id="routine-manager-title">Saved routines</h2>
          <p className="routine-manager__intro">Keep a few ready-to-go plans for different kinds of movement.</p>
        </div>
        <span className="routine-manager__count" aria-label={`${routines.length} saved routines`}>
          {routines.length} {routines.length === 1 ? 'routine' : 'routines'}
        </span>
      </header>

      {activeRoutine && (
        <aside className="routine-manager__active" aria-labelledby="active-routine-title">
          <div>
            <p className="routine-manager__eyebrow">Active in your builder</p>
            <h3 id="active-routine-title">{activeRoutine.name}</h3>
            <p>{activeRoutine.selections.length} focus areas · {countExercises(activeRoutine)} exercises</p>
          </div>
          <span className="routine-manager__active-mark" aria-hidden="true">Active</span>
        </aside>
      )}

      <form className="routine-manager__save" onSubmit={saveRoutine}>
        <div>
          <label htmlFor="new-routine-name">Save the current routine</label>
          <p id="new-routine-help">Give this generated routine a name you will recognise later.</p>
        </div>
        <div className="routine-manager__save-controls">
          <input
            aria-describedby="new-routine-help"
            id="new-routine-name"
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Morning strength"
            value={name}
          />
          <button className="routine-manager__button routine-manager__button--primary" type="submit">
            Save routine
          </button>
        </div>
      </form>

      {feedback && (
        <p className={`routine-manager__feedback routine-manager__feedback--${feedback.tone}`} role={feedback.tone === 'error' ? 'alert' : 'status'}>
          {feedback.message}
        </p>
      )}

      <ul className="routine-manager__list" aria-label="Saved routines list">
        {routines.map((savedRoutine) => {
          const isActive = savedRoutine.id === activeRoutine?.id
          const isRenaming = savedRoutine.id === renamingId
          const isPendingDelete = savedRoutine.id === pendingDeleteId

          return (
            <li aria-label={savedRoutine.name} className={isActive ? 'routine-manager__item routine-manager__item--active' : 'routine-manager__item'} key={savedRoutine.id}>
              <div className="routine-manager__item-main">
                <button
                  aria-label={`Select ${savedRoutine.name}`}
                  aria-pressed={isActive}
                  className="routine-manager__select"
                  onClick={() => selectRoutine(savedRoutine)}
                  type="button"
                >
                  <span className="routine-manager__select-name">{savedRoutine.name}</span>
                  <span className="routine-manager__select-meta">
                    {savedRoutine.selections.length} focus areas · {countExercises(savedRoutine)} exercises
                  </span>
                </button>
                {isActive && <span className="routine-manager__selected-label">Selected</span>}
              </div>

              {isRenaming ? (
                <form className="routine-manager__rename" onSubmit={(event) => saveRename(event, savedRoutine.id)}>
                  <label htmlFor={`rename-routine-${savedRoutine.id}`}>Rename {savedRoutine.name}</label>
                  <div className="routine-manager__rename-controls">
                    <input
                      aria-describedby="routine-name-help"
                      id={`rename-routine-${savedRoutine.id}`}
                      maxLength={80}
                      onChange={(event) => setRenameValue(event.target.value)}
                      value={renameValue}
                    />
                    <button className="routine-manager__button routine-manager__button--primary" type="submit">Save name</button>
                    <button className="routine-manager__button routine-manager__button--quiet" onClick={() => setRenamingId(null)} type="button">Cancel</button>
                  </div>
                </form>
              ) : isPendingDelete ? (
                <div aria-label={`Delete ${savedRoutine.name}`} className="routine-manager__confirmation" role="group">
                  <span>Delete this routine? This cannot be undone.</span>
                  <div>
                    <button className="routine-manager__button routine-manager__button--danger" onClick={() => confirmDelete(savedRoutine.id)} type="button">Confirm delete</button>
                    <button className="routine-manager__button routine-manager__button--quiet" onClick={() => setPendingDeleteId(null)} type="button">Keep routine</button>
                  </div>
                </div>
              ) : (
                <div className="routine-manager__actions">
                  <button aria-label={`Rename ${savedRoutine.name}`} className="routine-manager__button routine-manager__button--quiet" onClick={() => startRename(savedRoutine)} type="button">Rename</button>
                  <button aria-label={`Delete ${savedRoutine.name}`} className="routine-manager__button routine-manager__button--danger-quiet" onClick={() => requestDelete(savedRoutine.id)} type="button">Delete</button>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <p className="routine-manager__hint" id="routine-name-help">Routine names are saved on this device. At least one routine is always kept.</p>
    </section>
  )
}

export default RoutineManager
