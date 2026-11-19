import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createExercise, createRoutineGroup, createUniqueExerciseId, filterExercises, generateWorkoutSession, getGoals, getMuscles, getSpecificMuscles, getTags, regenerateRoutineGroups, toggleExerciseFavorite, updateRoutineGroup, updateRoutineSelectionsFavorite, validateExerciseDraft, type RoutineGroupChanges } from './routine'
import { createStorageAdapter, getOrCreateWorkoutSession, type StorageAdapter } from './storage'
import { checkAndDisplayDueReminder, getNotificationApi, type ForegroundReminderState } from './notifications'
import { getNextScheduleOccurrence } from './schedule'
import RoutineManager from './components/RoutineManager'
import ScheduleEditor from './components/ScheduleEditor'
import ReminderSettings from './components/ReminderSettings'
import RoutineBuilder from './components/RoutineBuilder'
import { EXERCISE_TYPE_OPTIONS, exerciseCatalogueExercises } from './exerciseCatalogueData'
import type { Exercise, ExerciseDraft, ExerciseTypes, FitnessStorageState, GeneratedWorkoutSession, RoutineSelection, SavedRoutine, WeeklyScheduleEntry } from './types'
import './App.css'

type View = 'Dashboard' | 'Exercise Library' | 'Routine Builder' | 'Saved Routines' | 'Schedule' | 'Reminders'
type AppProps = { now?: Date }

const views: View[] = ['Dashboard', 'Exercise Library', 'Routine Builder', 'Saved Routines', 'Schedule', 'Reminders']
const navIcons: Record<View, string> = {
  Dashboard: '⌂',
  'Exercise Library': '◈',
  'Routine Builder': '✦',
  'Saved Routines': '▣',
  Schedule: '◷',
  Reminders: '◌',
}

function App({ now: initialDate }: AppProps = {}) {
  const [storageAdapter] = useState<StorageAdapter>(() => createStorageAdapter(undefined, exerciseCatalogueExercises))
  const [storageState, setStorageState] = useState<FitnessStorageState>(() => storageAdapter.read())
  const sharedStorageAdapter = useMemo<StorageAdapter>(() => ({
    read: () => storageState,
    write: (nextState) => {
      const didWrite = storageAdapter.write(nextState)
      if (didWrite) {
        setStorageState(nextState)
      }
      return didWrite
    },
  }), [storageAdapter, storageState])

  const [activeView, setActiveView] = useState<View>('Dashboard')
  const [currentDate] = useState(() => initialDate ?? new Date())
  const [selectedRoutineId, setSelectedRoutineId] = useState(storageState.routines[0]?.id ?? '')
  const [routine, setRoutine] = useState<RoutineSelection[]>(storageState.routines[0]?.selections ?? [])
  const [routineName, setRoutineName] = useState(storageState.routines[0]?.name ?? 'New routine')
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [goalFilter, setGoalFilter] = useState('All')
  const [muscleFilter, setMuscleFilter] = useState('All')
  const [specificMuscleFilter, setSpecificMuscleFilter] = useState('All')
  const [tagFilter, setTagFilter] = useState('All')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [foregroundReminderError, setForegroundReminderError] = useState('')
  const [workoutFeedback, setWorkoutFeedback] = useState<{ kind: 'error' | 'success'; message: string } | null>(null)
  const foregroundReminderState = useRef<ForegroundReminderState>({ lastHandledMinute: null })
  const routineGroupIdCounter = useRef(0)
  const notificationApi = useMemo(() => getNotificationApi(), [])

  const exercises = storageState.exercises
  const selectedRoutine = storageState.routines.find((savedRoutine) => savedRoutine.id === selectedRoutineId)
    ?? storageState.routines[0]
  const hasSelectedRoutine = storageState.routines.some((savedRoutine) => savedRoutine.id === selectedRoutineId)
  const builderRoutine = hasSelectedRoutine ? routine : selectedRoutine?.selections ?? []

  const checkForegroundReminder = useCallback(() => {
    const result = checkAndDisplayDueReminder(
      storageState.schedule,
      storageState.reminders,
      new Date(),
      notificationApi,
      foregroundReminderState.current,
    )
    foregroundReminderState.current = result.state
    if (result.feedback) setForegroundReminderError(result.feedback)
    else if (result.displayed) setForegroundReminderError('')
  }, [notificationApi, storageState.reminders, storageState.schedule])

  useEffect(() => {
    checkForegroundReminder()
    const intervalId = window.setInterval(checkForegroundReminder, 15_000)
    return () => window.clearInterval(intervalId)
  }, [checkForegroundReminder])

  const muscles = useMemo(() => getMuscles(exercises), [exercises])
  const goals = useMemo(() => Array.from(new Set(['All', ...getGoals(exercises)])), [exercises])
  const specificMuscles = useMemo(() => ['All', ...getSpecificMuscles(exercises)], [exercises])
  const tags = useMemo(() => getTags(exercises), [exercises])
  const exerciseTypes = useMemo(() => getAvailableExerciseTypes(exercises), [exercises])
  const filteredExercises = useMemo(
    () => filterExercises(exercises, query, typeFilter, muscleFilter, tagFilter, favoritesOnly, specificMuscleFilter, goalFilter),
    [exercises, favoritesOnly, goalFilter, muscleFilter, query, specificMuscleFilter, tagFilter, typeFilter],
  )

  const regenerateRoutine = (groupId?: string) => {
    setRoutine((currentRoutine) => regenerateRoutineGroups(currentRoutine, exercises, groupId))
  }

  const updateRoutine = (groupId: string, changes: RoutineGroupChanges) => {
    setRoutine((currentRoutine) => updateRoutineGroup(currentRoutine, exercises, groupId, changes))
  }

  const addRoutineGroup = () => {
    setRoutine((currentRoutine) => {
      routineGroupIdCounter.current += 1
      const id = `focus-${Date.now()}-${routineGroupIdCounter.current}`
      return [...currentRoutine, createRoutineGroup(id, exercises, currentRoutine)]
    })
  }

  const removeRoutineGroup = (groupId: string) => {
    setRoutine((currentRoutine) => currentRoutine.length === 1
      ? currentRoutine
      : currentRoutine.filter((group) => group.id !== groupId))
  }

  const selectRoutine = (savedRoutine: SavedRoutine) => {
    setSelectedRoutineId(savedRoutine.id)
    setRoutine(savedRoutine.selections)
    setRoutineName(savedRoutine.name)
  }

  const addExercise = (draft: ExerciseDraft): boolean => {
    try {
      const exercise = createExercise(
        draft,
        createUniqueExerciseId(new Set(storageState.exercises.map((item) => item.id))),
      )
      return sharedStorageAdapter.write({
        ...storageState,
        exercises: [...storageState.exercises, exercise],
      })
    } catch {
      return false
    }
  }

  const toggleFavorite = (exerciseId: string): boolean => {
    const nextState = toggleExerciseFavorite(storageState, exerciseId)
    if (nextState === storageState) return false

    const didWrite = sharedStorageAdapter.write(nextState)
    if (didWrite) {
      setRoutine((currentRoutine) => updateRoutineSelectionsFavorite(
        currentRoutine,
        exerciseId,
        nextState.exercises.find((exercise) => exercise.id === exerciseId)?.isFavorite ?? false,
      ))
    }
    return didWrite
  }

  const startWorkout = () => {
    try {
      const occurrence = getNextScheduleOccurrence(storageState.schedule, currentDate)
      if (!occurrence) {
        setWorkoutFeedback({ kind: 'error', message: 'There is no upcoming workout scheduled.' })
        return
      }

      const scheduledRoutine = storageState.routines.find((savedRoutine) => savedRoutine.id === occurrence.entry.routineId)
      if (!scheduledRoutine) {
        setWorkoutFeedback({ kind: 'error', message: 'The next workout routine is unavailable.' })
        return
      }
      if (storageState.exercises.length === 0) {
        setWorkoutFeedback({ kind: 'error', message: 'Add an exercise before starting a workout. No session was started.' })
        return
      }

      const session = getOrCreateWorkoutSession(
        sharedStorageAdapter,
        { scheduleEntryId: occurrence.entry.id, occurrenceDate: occurrence.occurrenceDate },
        () => generateWorkoutSession(
          storageState.exercises,
          scheduledRoutine,
          occurrence.entry.id,
          occurrence.occurrenceDate,
        ),
      )
      if (!session) {
        setWorkoutFeedback({ kind: 'error', message: 'This workout could not be saved on your device. No session was started.' })
        return
      }

      setWorkoutFeedback({ kind: 'success', message: `Your workout for ${occurrence.occurrenceDate} is ready.` })
    } catch {
      setWorkoutFeedback({ kind: 'error', message: 'This workout is temporarily unavailable. No session was started.' })
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">MW</span>
          <span>Move well</span>
        </div>
        <p className="sidebar-label">Workspace</p>
        <nav className="main-nav" aria-label="Main navigation">
          {views.map((view) => (
            <button
              className={activeView === view ? 'nav-item active' : 'nav-item'}
              aria-current={activeView === view ? 'page' : undefined}
              key={view}
              onClick={() => setActiveView(view)}
              type="button"
            >
              <span aria-hidden="true" className="nav-icon">{navIcons[view]}</span>
              {view}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="status-dot" />
          <div>
            <strong>Offline ready</strong>
            <small>Your library is saved locally</small>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <span className="eyebrow">{formatHeaderDate(currentDate)}</span>
            <h1>{activeView}</h1>
          </div>
          <button className="profile-button" type="button" aria-label="Open profile">
            AG
          </button>
        </header>

        {activeView === 'Dashboard' && (
          <Dashboard
            activeRoutine={selectedRoutine}
            onBuild={() => setActiveView('Routine Builder')}
            onSelectRoutine={selectRoutine}
            onStartWorkout={startWorkout}
            onToggleFavorite={toggleFavorite}
            routines={storageState.routines}
            schedule={storageState.schedule}
            generatedSessions={storageState.generatedSessions ?? []}
            workoutFeedback={workoutFeedback}
            now={currentDate}
          />
        )}
        {activeView === 'Exercise Library' && (
          <Library
            allExercises={exercises}
            exercises={filteredExercises}
            query={query}
            typeFilter={typeFilter}
            goalFilter={goalFilter}
            muscleFilter={muscleFilter}
             specificMuscleFilter={specificMuscleFilter}
             tagFilter={tagFilter}
             favoritesOnly={favoritesOnly}
            types={exerciseTypes}
            goals={goals}
            muscles={muscles}
             specificMuscles={specificMuscles}
             tags={tags}
            onQueryChange={setQuery}
            onTypeChange={setTypeFilter}
            onGoalChange={setGoalFilter}
            onMuscleChange={setMuscleFilter}
             onSpecificMuscleChange={setSpecificMuscleFilter}
            onTagChange={setTagFilter}
            onFavoritesOnlyChange={setFavoritesOnly}
            onToggleFavorite={toggleFavorite}
            onAdd={addExercise}
          />
        )}
        {activeView === 'Routine Builder' && (
            <RoutineBuilder
            exercises={exercises}
            onAddGroup={addRoutineGroup}
            onManage={() => setActiveView('Saved Routines')}
            onRegenerate={regenerateRoutine}
            onRemoveGroup={removeRoutineGroup}
            onRoutineNameChange={setRoutineName}
            onUpdateGroup={updateRoutine}
            routine={builderRoutine}
            routineName={routineName}
          />
        )}
        {activeView === 'Saved Routines' && (
          <RoutineManager
            currentRoutine={builderRoutine}
            initialName={routineName}
            onRoutineSelect={selectRoutine}
            selectedRoutineId={selectedRoutineId}
            storageAdapter={sharedStorageAdapter}
          />
        )}
        {activeView === 'Schedule' && (
          <ScheduleEditor routines={storageState.routines} storageAdapter={sharedStorageAdapter} />
        )}
        {activeView === 'Reminders' && (
          <ReminderSettings foregroundError={foregroundReminderError} storageAdapter={sharedStorageAdapter} />
        )}
      </main>
    </div>
  )
}

function Dashboard({ activeRoutine, onBuild, onSelectRoutine, onStartWorkout, onToggleFavorite, routines, schedule, generatedSessions, workoutFeedback, now }: {
  activeRoutine?: SavedRoutine
  onBuild: () => void
  onSelectRoutine: (routine: SavedRoutine) => void
  onStartWorkout: () => void
  onToggleFavorite: (exerciseId: string) => boolean
  routines: SavedRoutine[]
  schedule: WeeklyScheduleEntry[]
  generatedSessions: GeneratedWorkoutSession[]
  workoutFeedback: { kind: 'error' | 'success'; message: string } | null
  now: Date
}) {
  const [selectedGeneratedExerciseId, setSelectedGeneratedExerciseId] = useState<string | null>(null)
  const nextOccurrence = getNextScheduleOccurrence(schedule, now)
  const nextAssignment = nextOccurrence?.entry
  const nextRoutine = routines.find((savedRoutine) => savedRoutine.id === nextAssignment?.routineId)
  const generatedSession = nextOccurrence
    ? generatedSessions.find((session) => (
      session.scheduleEntryId === nextOccurrence.entry.id
        && session.occurrenceDate === nextOccurrence.occurrenceDate
    ))
    : undefined
  const selectedGeneratedExercise = generatedSession?.selections
    .flatMap((group) => group.exercises)
    .find((exercise) => exercise.id === selectedGeneratedExerciseId) ?? null
  const routine = activeRoutine?.selections ?? []

  return (
    <div className="page-stack">
        <section className="stats-grid" aria-label="Your activity">
         <div className="stat-card"><span className="stat-icon orange">◒</span><strong>{routine.reduce((total, group) => total + group.exercises.length, 0)}</strong><span>Exercises in focus</span></div>
         <div className="stat-card"><span className="stat-icon purple">✦</span><strong>{routines.length}</strong><span>Saved routines</span></div>
          <div className="stat-card"><span className="stat-icon green">◷</span><strong>{nextRoutine?.name ?? 'None'}</strong><span>{nextAssignment ? `Next at ${nextAssignment.time}` : 'No session planned'}</span></div>
        </section>
        <section aria-labelledby="next-workout-title" className="next-workout-card">
          <div className="next-workout-header">
            <div>
              <span className="eyebrow">Next scheduled workout</span>
              <h2 id="next-workout-title">{nextRoutine?.name ?? 'No workout scheduled'}</h2>
              {nextOccurrence && <p>{formatOccurrence(nextOccurrence.occurrenceDate)} at {nextOccurrence.entry.time}</p>}
            </div>
            {nextOccurrence && nextRoutine && (
              <button
                aria-label="Start workout"
                className="primary-button"
                onClick={onStartWorkout}
                type="button"
              >
                Start workout <span>→</span>
              </button>
            )}
          </div>
          {!nextOccurrence && <p className="next-workout-message">Add an assignment to your schedule when you are ready to plan your next session.</p>}
          {nextOccurrence && nextRoutine && !generatedSession && <p className="next-workout-message">Your concrete exercises will be selected when you start this workout.</p>}
          {generatedSession && <GeneratedSessionView onSelectExercise={(exercise) => setSelectedGeneratedExerciseId(exercise.id)} session={generatedSession} />}
          {workoutFeedback && <p aria-live="polite" className={`workout-feedback ${workoutFeedback.kind}`} role={workoutFeedback.kind === 'error' ? 'alert' : 'status'}>{workoutFeedback.message}</p>}
        </section>
        <section className="section-heading"><div><span className="eyebrow">Ready when you are</span><h2>{activeRoutine?.name ?? 'Choose a routine'}</h2></div><button className="text-button" onClick={onBuild} type="button">Edit routine <span>→</span></button></section>
       <label className="dashboard-routine-select">Active routine<select aria-label="Active routine" onChange={(event) => { const next = routines.find((savedRoutine) => savedRoutine.id === event.target.value); if (next) onSelectRoutine(next) }} value={activeRoutine?.id ?? ''}>{routines.map((savedRoutine) => <option key={savedRoutine.id} value={savedRoutine.id}>{savedRoutine.name}</option>)}</select></label>
        <div className="routine-preview">
          {routine.length > 0 ? routine.map((group) => <div className="preview-item" key={group.id}><span className="number-badge">{group.exercises.length}</span><div><strong>{group.label}</strong><small>{group.exercises.map((exercise) => exercise.name).join(' · ')}</small></div><span className="arrow">↗</span></div>) : <p className="empty-state">Save a routine to see its focus areas here.</p>}
        </div>
        <ExerciseDialog
          exercise={selectedGeneratedExercise}
          onClose={() => setSelectedGeneratedExerciseId(null)}
          onToggleFavorite={onToggleFavorite}
        />
     </div>
  )
}

function GeneratedSessionView({ onSelectExercise, session }: {
  onSelectExercise: (exercise: Exercise) => void
  session: GeneratedWorkoutSession
}) {
  return (
    <div aria-label="Generated workout session" className="workout-session">
      <div className="workout-session-heading">
        <strong>Your concrete exercise selections</strong>
        <span>Saved for this occurrence</span>
      </div>
      <div className="workout-session-grid">
        {session.selections.map((group) => (
          <section className="workout-group" key={group.id}>
            <h3>{group.label}</h3>
            <ul>
              {group.exercises.map((exercise) => (
                <li key={exercise.id}>
                  <button
                    aria-haspopup="dialog"
                    aria-label={`Open ${exercise.name} details`}
                    className="generated-exercise-button"
                    onClick={() => onSelectExercise(exercise)}
                    type="button"
                  >
                    {exercise.name}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}

const formatOccurrence = (occurrenceDate: string): string => new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
}).format(new Date(`${occurrenceDate}T00:00:00`))

const formatHeaderDate = (date: Date): string => new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'long',
  weekday: 'long',
  year: 'numeric',
}).format(date)

const getExerciseTypes = (exercise: Exercise): string[] => (
  exercise.types && exercise.types.length > 0 ? [...exercise.types] : [exercise.type]
)

const getAvailableExerciseTypes = (_exercises: Exercise[]): string[] => [
  'All',
  ...EXERCISE_TYPE_OPTIONS,
]

const parseExerciseTypes = (value: string): ExerciseTypes | null => {
  const types = Array.from(new Set(value.split(';').map((type) => type.trim()).filter(Boolean)))
  return types.length > 0 ? [types[0]!, ...types.slice(1)] : null
}

function Library({ allExercises, exercises, query, typeFilter, goalFilter, muscleFilter, specificMuscleFilter, tagFilter, favoritesOnly, types, goals, muscles, specificMuscles, tags, onQueryChange, onTypeChange, onGoalChange, onMuscleChange, onSpecificMuscleChange, onTagChange, onFavoritesOnlyChange, onToggleFavorite, onAdd }: {
  allExercises: Exercise[]; exercises: Exercise[]; query: string; typeFilter: string; goalFilter: string; muscleFilter: string; specificMuscleFilter: string; tagFilter: string; favoritesOnly: boolean; types: string[]; goals: string[]; muscles: string[]; specificMuscles: string[]; tags: string[];
  onQueryChange: (value: string) => void; onTypeChange: (value: string) => void; onGoalChange: (value: string) => void; onMuscleChange: (value: string) => void; onSpecificMuscleChange: (value: string) => void; onTagChange: (value: string) => void; onFavoritesOnlyChange: (value: boolean) => void;
  onToggleFavorite: (exerciseId: string) => boolean;
  onAdd: (draft: ExerciseDraft) => boolean;
}) {
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const selectedExercise = allExercises.find((exercise) => exercise.id === selectedExerciseId) ?? null

  return (
    <div className="page-stack">
      <section className="section-heading">
        <div><span className="eyebrow">Your movement menu</span><h2>Exercise library <span className="count-pill">{exercises.length}</span></h2></div>
        <button className="outline-button" onClick={() => setShowAddForm(true)} type="button">+ Add exercise</button>
      </section>
       {showAddForm && <AddExerciseForm availableTypes={types.filter((type) => type !== 'All')} onCancel={() => setShowAddForm(false)} onSave={onAdd} />}
      <div aria-label="Exercise filters" className="filters" role="group">
        <label className="search-field"><span aria-hidden="true">⌕</span><input aria-label="Search exercises or muscles" onChange={(event) => onQueryChange(event.target.value)} placeholder="Search exercises or muscles" value={query} /></label>
         <label className="filter-control">Type<select aria-label="Filter by type" onChange={(event) => onTypeChange(event.target.value)} value={typeFilter}>{types.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
         <label className="filter-control">Goal<select aria-label="Filter by goal" onChange={(event) => onGoalChange(event.target.value)} value={goalFilter}>{goals.map((goal) => <option key={goal} value={goal}>{goal}</option>)}</select></label>
         <label className="filter-control">Muscle group<select aria-label="Filter by muscle" onChange={(event) => onMuscleChange(event.target.value)} value={muscleFilter}>{muscles.map((muscle) => <option key={muscle}>{muscle}</option>)}</select></label>
        <label className="filter-control">Specific muscle<select aria-label="Filter by specific muscle" onChange={(event) => onSpecificMuscleChange(event.target.value)} value={specificMuscleFilter}>{specificMuscles.map((muscle) => <option key={muscle}>{muscle}</option>)}</select></label>
        <label className="filter-control">Tag<select aria-label="Filter by tag" onChange={(event) => onTagChange(event.target.value)} value={tagFilter}><option>All</option>{tags.map((tag) => <option key={tag}>{tag}</option>)}</select></label>
        <label className="favorite-filter"><input aria-label="Show favorites only" checked={favoritesOnly} onChange={(event) => onFavoritesOnlyChange(event.target.checked)} type="checkbox" /><span>Favorites only</span></label>
      </div>
      <div className="exercise-grid">
        {exercises.map((exercise) => <ExerciseCard exercise={exercise} key={exercise.id} onSelect={(selected) => setSelectedExerciseId(selected.id)} onToggleFavorite={onToggleFavorite} />)}
      </div>
      {exercises.length === 0 && <div className="empty-state">No exercises match these filters.</div>}
      <ExerciseDialog exercise={selectedExercise} onClose={() => setSelectedExerciseId(null)} onToggleFavorite={onToggleFavorite} />
    </div>
  )
}

const emptyExerciseDraft: ExerciseDraft = {
  name: '', group: '', type: '', muscles: '', purpose: '', specificMuscles: '', equipmentAndEnvironment: '',
  startingPosition: '', rangeAndDirection: '', breathing: '', beginnerDoseAndRest: '', expectedSensation: '',
  regression: '', progression: '', steps: '', commonErrors: '',
}

const draftTextValue = (value: string | string[] | undefined): string => (
  Array.isArray(value) ? value.join('\n') : value ?? ''
)

 function AddExerciseForm({ availableTypes, onCancel, onSave }: { availableTypes: string[]; onCancel: () => void; onSave: (draft: ExerciseDraft) => boolean }) {
  return <ExpandedAddExerciseForm availableTypes={availableTypes} onCancel={onCancel} onSave={onSave} />

  /*
  const [draft, setDraft] = useState<ExerciseDraft>(emptyExerciseDraft)
  const [errors, setErrors] = useState<string[]>([])

  const updateField = (field: keyof ExerciseDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }))
    setErrors([])
  }

  const submitForm = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationErrors = validateExerciseDraft(draft)
    if (validationErrors.length > 0) {
      setErrors(validationErrors)
      return
    }
    if (onSave(draft)) {
      onCancel()
      return
    }

    setErrors(['This exercise could not be saved on this device. Your draft is still here.'])
  }

  return <section aria-labelledby="add-exercise-title" className="add-exercise-panel"><div className="form-heading"><div><span className="eyebrow">Grow your library</span><h3 id="add-exercise-title">Add an exercise</h3></div><button aria-label="Close add exercise form" className="dialog-close" onClick={onCancel} type="button">×</button></div><form className="exercise-form" onSubmit={submitForm}>{errors.length > 0 && <div aria-live="polite" className="form-errors" role="alert"><strong>Please check the form:</strong><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul></div>}<label>Exercise name<input onChange={(event) => updateField('name', event.target.value)} placeholder="e.g. Romanian deadlift" value={draft.name} /></label><div className="form-row"><label>Type<select onChange={(event) => updateField('type', event.target.value)} value={draft.type}><option>Strength</option><option>Stretch</option></select></label><label>Suggested time<input onChange={(event) => updateField('duration', event.target.value)} placeholder="e.g. 4 min" value={draft.duration} /></label></div><div className="form-row"><label>Target muscles <span className="field-hint">comma separated</span><input onChange={(event) => updateField('muscles', event.target.value)} placeholder="e.g. Hamstrings, Glutes" value={draft.muscles} /></label><label>Category<input onChange={(event) => updateField('category', event.target.value)} placeholder="e.g. Posterior chain" value={draft.category} /></label></div><label>Tags <span className="field-hint">comma separated</span><input onChange={(event) => updateField('tags', event.target.value)} placeholder="e.g. stability, beginner" value={draft.tags} /></label><label>Description<textarea onChange={(event) => updateField('description', event.target.value)} placeholder="What does this exercise help with?" rows={2} value={draft.description} /></label><label>How to perform <span className="field-hint">one step per line</span><textarea onChange={(event) => updateField('steps', event.target.value)} placeholder={'Set your stance...\nMove slowly...\nReturn with control...'} rows={4} value={draft.steps} /></label><label>Common errors and corrections <span className="field-hint">one error | correction pair per line</span><textarea onChange={(event) => updateField('commonErrors', event.target.value)} placeholder={'Arching your back | Brace your core...'} rows={3} value={draft.commonErrors} /></label><div className="form-actions"><button className="outline-button" onClick={onCancel} type="button">Cancel</button><button className="primary-button" type="submit">Save exercise <span>→</span></button></div></form></section>
  */
}

function ExpandedAddExerciseForm({ availableTypes, onCancel, onSave }: { availableTypes: string[]; onCancel: () => void; onSave: (draft: ExerciseDraft) => boolean }) {
  const [draft, setDraft] = useState<ExerciseDraft>(() => ({ ...emptyExerciseDraft, type: availableTypes[0] ?? '' }))
  const [typeInput, setTypeInput] = useState(() => availableTypes[0] ?? '')
  const [errors, setErrors] = useState<string[]>([])

  const updateField = (field: keyof ExerciseDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }))
    setErrors([])
  }

  const submitForm = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const types = parseExerciseTypes(typeInput)
    const validationErrors = [
      ...validateExerciseDraft(draft),
      ...(types ? [] : ['Add at least one exercise type.']),
    ]
    if (validationErrors.length > 0) {
      setErrors(validationErrors)
      return
    }
    if (!types) return
    const draftWithTypes: ExerciseDraft = { ...draft, type: types[0], types }
    if (onSave(draftWithTypes)) {
      onCancel()
      return
    }
    setErrors(['This exercise could not be saved on this device. Your draft is still here.'])
  }

  return (
    <section aria-labelledby="add-exercise-title" className="add-exercise-panel">
      <div className="form-heading">
        <div><span className="eyebrow">Grow your library</span><h3 id="add-exercise-title">Add an exercise</h3></div>
        <button aria-label="Close add exercise form" className="dialog-close" onClick={onCancel} type="button">×</button>
      </div>
      <form className="exercise-form" onSubmit={submitForm}>
        {errors.length > 0 && <div aria-live="polite" className="form-errors" role="alert"><strong>Please check the form:</strong><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul></div>}
        <label>Exercise name<input onChange={(event) => updateField('name', event.target.value)} placeholder="e.g. Romanian deadlift" value={draft.name} /></label>
        <label>Group<input aria-required="true" onChange={(event) => updateField('group', event.target.value)} placeholder="e.g. Core control" value={draft.group} /></label>
        <div className="form-row">
           <label>Exercise type <span className="field-hint">semicolon separated for multiple values</span><input aria-label="Exercise type" list="exercise-type-options" onChange={(event) => { setTypeInput(event.target.value); setErrors([]) }} placeholder="e.g. Mobility; Balance" value={typeInput} /><datalist id="exercise-type-options">{availableTypes.map((type) => <option key={type} value={type} />)}</datalist></label>
          <label>Targeted musclegroups <span className="field-hint">comma separated</span><input onChange={(event) => updateField('muscles', event.target.value)} placeholder="e.g. Trunk, hips" value={draft.muscles} /></label>
        </div>
        <label>Purpose<textarea onChange={(event) => updateField('purpose', event.target.value)} placeholder="What capacity does this exercise train?" rows={2} value={draft.purpose ?? ''} /></label>
        <label>Targeted specific muscles <span className="field-hint">one per line</span><textarea onChange={(event) => updateField('specificMuscles', event.target.value)} placeholder="musculus gluteus maximus" rows={3} value={draftTextValue(draft.specificMuscles)} /></label>
        <label>Equipment and environment<textarea onChange={(event) => updateField('equipmentAndEnvironment', event.target.value)} placeholder="Equipment, surface, support and space needed" rows={2} value={draft.equipmentAndEnvironment ?? ''} /></label>
        <label>Starting position and set-up<textarea onChange={(event) => updateField('startingPosition', event.target.value)} placeholder="Describe the starting position and set-up checks" rows={3} value={draft.startingPosition ?? ''} /></label>
        <label>Step-by-step movement <span className="field-hint">one step per line</span><textarea aria-label="Step-by-step movement" onChange={(event) => updateField('steps', event.target.value)} placeholder="One movement step per line" rows={4} value={draft.steps} /></label>
        <label>Range and direction<textarea onChange={(event) => updateField('rangeAndDirection', event.target.value)} placeholder="Describe what moves and the comfortable range" rows={2} value={draft.rangeAndDirection ?? ''} /></label>
        <label>Breathing<textarea onChange={(event) => updateField('breathing', event.target.value)} placeholder="When to inhale and exhale" rows={2} value={draft.breathing ?? ''} /></label>
        <label>Beginner dose and rest<textarea onChange={(event) => updateField('beginnerDoseAndRest', event.target.value)} placeholder="Sets, repetitions or hold time, and rest" rows={2} value={draft.beginnerDoseAndRest ?? ''} /></label>
        <label>Expected sensation<textarea onChange={(event) => updateField('expectedSensation', event.target.value)} placeholder="Expected effort or stretch and warning symptoms" rows={2} value={draft.expectedSensation ?? ''} /></label>
        <div className="form-row">
          <label>Regression<textarea onChange={(event) => updateField('regression', event.target.value)} placeholder="The easiest safe version" rows={3} value={draft.regression ?? ''} /></label>
          <label>Progression<textarea onChange={(event) => updateField('progression', event.target.value)} placeholder="How to increase demand" rows={3} value={draft.progression ?? ''} /></label>
        </div>
        <label>Common errors and corrections <span className="field-hint">one pair per line, use error | correction</span><textarea onChange={(event) => updateField('commonErrors', event.target.value)} placeholder="Knees cave in | Track knees over toes" rows={3} value={draft.commonErrors} /></label>
        <div className="form-actions"><button className="text-button" onClick={onCancel} type="button">Cancel</button><button className="primary-button" type="submit">Save exercise <span>→</span></button></div>
      </form>
    </section>
  )
}

function ExerciseCard({ exercise, onSelect, onToggleFavorite }: { exercise: Exercise; onSelect: (exercise: Exercise) => void; onToggleFavorite: (exerciseId: string) => boolean }) {
  const titleId = `exercise-card-title-${exercise.id}`
  const types = getExerciseTypes(exercise)

  return (
    <article aria-label={exercise.name} aria-labelledby={titleId} className="exercise-card">
      <button
        aria-label={exercise.name}
        aria-haspopup="dialog"
        className="exercise-card-button"
        onClick={() => onSelect(exercise)}
        type="button"
      >
         <span className="exercise-card-top"><span aria-label={`Exercise types: ${types.join(', ')}`} className="exercise-card-types">{types.map((type) => <span className="type-tag" key={type}>{type}</span>)}</span><span className="exercise-card-group">{exercise.group}</span></span>
        <span className="exercise-card-title" id={titleId} role="heading" aria-level={3}>{exercise.name}</span>
        <span className="card-field-label">Targeted musclegroups</span>
        <span className="muscle-list">{exercise.muscles.map((muscle) => <span key={muscle}>{muscle}</span>)}</span>
      </button>
      <button
        aria-label={exercise.isFavorite ? `Remove ${exercise.name} from favorites` : `Add ${exercise.name} to favorites`}
        aria-pressed={exercise.isFavorite}
        className={exercise.isFavorite ? 'favorite-button active' : 'favorite-button'}
        onClick={(event) => {
          event.stopPropagation()
          onToggleFavorite(exercise.id)
        }}
        type="button"
      >
        <span aria-hidden="true">{exercise.isFavorite ? '♥' : '♡'}</span>
      </button>
    </article>
  )
}

function MetadataList({ values, emptyLabel }: { values: string[]; emptyLabel: string }) {
  return values.length > 0
    ? <ul className="dialog-value-list">{values.map((value, index) => <li key={`${value}-${index}`}>{value}</li>)}</ul>
    : <span className="metadata-empty">{emptyLabel}</span>
}

function ExerciseDialog({ exercise, onClose, onToggleFavorite }: { exercise: Exercise | null; onClose: () => void; onToggleFavorite: (exerciseId: string) => boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const titleId = exercise ? `exercise-dialog-title-${exercise.id}` : undefined
  const descriptionId = exercise ? `exercise-dialog-description-${exercise.id}` : undefined
  const exerciseId = exercise?.id
  const steps = exercise?.steps?.length ? exercise.steps : exercise?.instructions ?? []
  const types = exercise ? getExerciseTypes(exercise) : []

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) {
      return
    }
    if (!exerciseId) {
      if (dialog.open) dialog.close()
      return
    }

    if (!dialog.open) {
      dialog.showModal()
    }
    closeButtonRef.current?.focus()
  }, [exerciseId])

  const closeDialog = () => {
    dialogRef.current?.close()
    onClose()
  }

  return (
    <dialog
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      className="exercise-dialog"
      onCancel={(event) => {
        event.preventDefault()
        closeDialog()
      }}
      ref={dialogRef}
    >
      {exercise && (
        <div className="dialog-content">
          <div className="dialog-header">
            <div>
               <div aria-label={`Exercise types: ${types.join(', ')}`} className="exercise-card-types">{types.map((type) => <span className="type-tag" key={type}>{type}</span>)}</div>
              <h2 id={titleId}>{exercise.name}</h2>
            </div>
             <div className="dialog-actions">
               <button
                 aria-label={exercise.isFavorite ? `Remove ${exercise.name} from favorites` : `Add ${exercise.name} to favorites`}
                 aria-pressed={exercise.isFavorite}
                 className={exercise.isFavorite ? 'favorite-button active' : 'favorite-button'}
                 onClick={(event) => {
                   event.stopPropagation()
                   onToggleFavorite(exercise.id)
                 }}
                 type="button"
               >
                 <span aria-hidden="true">{exercise.isFavorite ? '♥' : '♡'}</span>
               </button>
               <button aria-label={`Close ${exercise.name} details`} className="dialog-close" onClick={closeDialog} ref={closeButtonRef} type="button">×</button>
             </div>
          </div>
           <div className="dialog-meta">
             <div><span>Group</span><strong>{exercise.group}</strong></div>
              <div><span>Exercise type</span><strong>{types.join(' · ')}</strong></div>
             <div><span>Targeted musclegroups</span><strong>{exercise.muscles.join(' · ')}</strong></div>
           </div>
           <p className="dialog-description" id={descriptionId}>{exercise.purpose || exercise.description || 'No purpose added.'}</p>
           <details className="specific-muscle-disclosure">
             <summary>Targeted specific muscles</summary>
             <MetadataList values={exercise.specificMuscles} emptyLabel="No specific muscles added." />
           </details>
           <section aria-labelledby={`${exercise.id}-core-title`} className="dialog-details core-instructions">
             <h3 id={`${exercise.id}-core-title`}>Core instructions</h3>
             <dl>
               <div><dt>Equipment and environment</dt><dd>{exercise.equipmentAndEnvironment || 'Not added'}</dd></div>
               <div><dt>Starting position and set-up</dt><dd>{exercise.startingPosition || 'Not added'}</dd></div>
               <div><dt>Step-by-step movement</dt><dd><ol>{steps.map((step, index) => <li key={`${step}-${index}`}>{step}</li>)}</ol></dd></div>
               <div><dt>Range and direction</dt><dd>{exercise.rangeAndDirection || 'Not added'}</dd></div>
               <div><dt>Breathing</dt><dd>{exercise.breathing || 'Not added'}</dd></div>
               <div><dt>Beginner dose and rest</dt><dd>{exercise.beginnerDoseAndRest || 'Not added'}</dd></div>
               <div><dt>Expected sensation</dt><dd>{exercise.expectedSensation || 'Not added'}</dd></div>
               <div><dt>Regression</dt><dd>{exercise.regression || 'Not added'}</dd></div>
               <div><dt>Progression</dt><dd>{exercise.progression || 'Not added'}</dd></div>
               <div><dt>Common errors and corrections</dt><dd>{exercise.commonErrors.length > 0 ? <ol>{exercise.commonErrors.map((pair, index) => <li key={`${pair.error}-${index}`}><strong>{pair.error}</strong><span>{pair.correction}</span></li>)}</ol> : 'No common errors added.'}</dd></div>
             </dl>
           </section>
         </div>
      )}
    </dialog>
  )
}

export default App
