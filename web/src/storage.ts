import { starterExercises, starterRoutineGroups } from './data'
import type {
  Exercise,
  ExerciseTypes,
  FitnessStorageState,
  GeneratedWorkoutSession,
  ReminderSettings,
  RoutineSelection,
  SavedRoutine,
  StorageEnvelope,
  Weekday,
  WeeklyScheduleEntry,
} from './types'

export const STORAGE_KEY = 'move-well-storage'
export const STORAGE_BACKUP_KEY = 'move-well-storage-backup'
export const LEGACY_EXERCISES_KEY = 'move-well-exercises'
export const LEGACY_ROUTINE_KEY = 'move-well-routine'
export const CURRENT_STORAGE_VERSION = 5
export const LEGACY_STORAGE_VERSION = 1
export const PREVIOUS_STORAGE_VERSION = 4
const EARLIER_STORAGE_VERSION = 3
const OLDEST_SUPPORTED_STORAGE_VERSION = 2

const WEEKDAYS: Weekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]
const NOTIFICATION_CAPABILITIES = ['unsupported', 'default', 'granted', 'denied', 'error'] as const

export type StorageLike = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
)

const isNonEmptyString = (value: unknown): value is string => (
  typeof value === 'string' && value.trim().length > 0
)

const normalizeText = (value: unknown, fallback = ''): string => (
  typeof value === 'string' ? value.trim() : fallback
)

const isExerciseType = (value: unknown): value is Exercise['type'] => isNonEmptyString(value)

const normalizeExerciseTypes = (
  value: unknown,
  fallback: unknown = undefined,
): ExerciseTypes | null => {
  const normalize = (source: readonly unknown[]): ExerciseTypes | null => {
    const types = source.reduce<string[]>((normalized, item) => {
      if (!isExerciseType(item)) return normalized
      const type = item.trim()
      return normalized.includes(type) ? normalized : [...normalized, type]
    }, [])
    return types.length > 0 ? [types[0]!, ...types.slice(1)] : null
  }
  const types = normalize(Array.isArray(value) ? value : [value])
  if (types) return types
  return normalize(Array.isArray(fallback) ? fallback : [fallback])
}

const normalizeStringList = (value: unknown, fallback: readonly string[] = []): string[] => {
  const source = Array.isArray(value) ? value : fallback
  return Array.isArray(source)
    ? source
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim())
    : []
}

const isExerciseCommonError = (value: unknown): value is Exercise['commonErrors'][number] => (
  isRecord(value)
    && isNonEmptyString(value.error)
    && isNonEmptyString(value.correction)
)

const normalizeCommonErrors = (value: unknown): Exercise['commonErrors'] => (
  Array.isArray(value)
    ? value
      .filter(isExerciseCommonError)
      .map((pair) => ({ error: pair.error.trim(), correction: pair.correction.trim() }))
    : []
)

export const isExercise = (value: unknown): value is Exercise => {
  if (!isRecord(value)) return false
  return isNonEmptyString(value.id)
    && isNonEmptyString(value.name)
    && isNonEmptyString(value.group)
    && isExerciseType(value.type)
    && (value.types === undefined
      || (Array.isArray(value.types) && value.types.length > 0 && value.types.every(isExerciseType)))
    && Array.isArray(value.muscles)
    && value.muscles.every((muscle) => typeof muscle === 'string')
    && value.muscles.some((muscle) => muscle.trim().length > 0)
    && typeof value.purpose === 'string'
    && Array.isArray(value.specificMuscles)
    && value.specificMuscles.every((muscle) => typeof muscle === 'string')
    && typeof value.equipmentAndEnvironment === 'string'
    && typeof value.startingPosition === 'string'
    && typeof value.rangeAndDirection === 'string'
    && typeof value.breathing === 'string'
    && typeof value.beginnerDoseAndRest === 'string'
    && typeof value.expectedSensation === 'string'
    && typeof value.regression === 'string'
    && typeof value.progression === 'string'
    && isNonEmptyString(value.category)
     && typeof value.description === 'string'
    && Array.isArray(value.instructions)
    && value.instructions.every((instruction) => typeof instruction === 'string')
    && value.instructions.some((instruction) => instruction.trim().length > 0)
    && Array.isArray(value.steps)
    && value.steps.every((step) => typeof step === 'string')
    && value.steps.some((step) => step.trim().length > 0)
    && Array.isArray(value.commonErrors)
    && value.commonErrors.every(isExerciseCommonError)
    && Array.isArray(value.tags)
    && value.tags.every((tag) => typeof tag === 'string')
    && typeof value.isFavorite === 'boolean'
     && typeof value.duration === 'string'
}

const cloneExercise = (exercise: Exercise): Exercise => {
  const clone: Exercise = {
    ...exercise,
    muscles: [...exercise.muscles],
    specificMuscles: [...exercise.specificMuscles],
    instructions: [...exercise.instructions],
    steps: [...exercise.steps],
    commonErrors: exercise.commonErrors.map((pair) => ({ ...pair })),
    tags: [...exercise.tags],
  }
  return exercise.types
    ? { ...clone, types: [exercise.types[0], ...exercise.types.slice(1)] }
    : clone
}

const mergeSeedExercises = (
  exercises: readonly Exercise[],
  seedExercises: readonly Exercise[],
  excludedExerciseGoals: ReadonlySet<string>,
): Exercise[] => {
  const activeExercises = exercises.filter((exercise) => !excludedExerciseGoals.has(exercise.group))
  const seedById = new Map(seedExercises.map((exercise) => [exercise.id, exercise]))
  const existingIds = new Set(activeExercises.map((exercise) => exercise.id))
  const refreshedExercises = activeExercises.map((exercise) => {
    const seed = seedById.get(exercise.id)
    return seed ? { ...cloneExercise(seed), isFavorite: exercise.isFavorite } : cloneExercise(exercise)
  })
  const missingExercises = seedExercises
    .filter((exercise) => !existingIds.has(exercise.id))
    .map(cloneExercise)
  return [...refreshedExercises, ...missingExercises]
}

const hasSeedChanges = (
  exercises: readonly Exercise[],
  seedExercises: readonly Exercise[],
  excludedExerciseGoals: ReadonlySet<string>,
): boolean => seedExercises.some((seed) => {
  if (exercises.some((exercise) => excludedExerciseGoals.has(exercise.group))) return true
  const existing = exercises.find((exercise) => exercise.id === seed.id)
  if (!existing) return true
  return JSON.stringify({ ...existing, isFavorite: false }) !== JSON.stringify({ ...seed, isFavorite: false })
})

const normalizeExercise = (value: unknown): Exercise | null => {
  if (!isRecord(value)) return null
  const starter = typeof value.id === 'string'
    ? starterExercises.find((exercise) => exercise.id === value.id)
    : undefined
  const legacyInstructions = normalizeStringList(value.instructions, starter?.instructions ?? [])
  const steps = normalizeStringList(value.steps, legacyInstructions)
  const purpose = normalizeText(value.purpose)
  const group = normalizeText(value.group ?? value.Group) || 'General'
  const category = normalizeText(value.category, group)
  const types = normalizeExerciseTypes(value.types, value.type)
  const candidate = {
    id: normalizeText(value.id),
    name: normalizeText(value.name),
    group,
    type: types?.[0] ?? '',
    types,
    muscles: normalizeStringList(value.muscles),
    purpose,
    specificMuscles: normalizeStringList(value.specificMuscles),
    equipmentAndEnvironment: normalizeText(value.equipmentAndEnvironment),
    startingPosition: normalizeText(value.startingPosition),
    rangeAndDirection: normalizeText(value.rangeAndDirection),
    breathing: normalizeText(value.breathing),
    beginnerDoseAndRest: normalizeText(value.beginnerDoseAndRest),
    expectedSensation: normalizeText(value.expectedSensation),
    regression: normalizeText(value.regression),
    progression: normalizeText(value.progression),
    instructions: normalizeStringList(value.instructions, steps),
    steps,
    commonErrors: normalizeCommonErrors(value.commonErrors),
    tags: normalizeStringList(value.tags),
    isFavorite: typeof value.isFavorite === 'boolean' ? value.isFavorite : false,
    category,
    description: normalizeText(value.description, purpose),
    duration: normalizeText(value.duration),
  }
  return isExercise(candidate) ? cloneExercise(candidate) : null
}

const normalizeExerciseList = (value: unknown): Exercise[] | null => (
  Array.isArray(value)
    ? value.map(normalizeExercise).filter((exercise): exercise is Exercise => exercise !== null)
    : null
)

const isWeekday = (value: unknown): value is Weekday => (
  WEEKDAYS.includes(value as Weekday)
)

const isValidTime = (value: unknown): value is string => (
  typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)
)

const isRoutineSelection = (value: unknown): value is RoutineSelection => {
  if (!isRecord(value)) return false
  return isNonEmptyString(value.id)
    && isNonEmptyString(value.label)
    && isNonEmptyString(value.detail)
    && isExerciseType(value.type)
    && (value.types === undefined
      || (Array.isArray(value.types) && value.types.length > 0 && value.types.every(isExerciseType)))
    && isNonEmptyString(value.muscle)
    && (value.muscles === undefined
      || (Array.isArray(value.muscles) && value.muscles.length > 0 && value.muscles.every(isNonEmptyString)))
    && (value.specificMuscle === undefined || isNonEmptyString(value.specificMuscle))
    && (value.specificMuscles === undefined
      || (Array.isArray(value.specificMuscles)
        && value.specificMuscles.length > 0
        && value.specificMuscles.every(isNonEmptyString)))
    && typeof value.count === 'number'
    && Number.isInteger(value.count)
    && value.count > 0
    && Array.isArray(value.exercises)
    && value.exercises.every(isExercise)
}

const cloneRoutineSelection = (selection: RoutineSelection): RoutineSelection => ({
  ...selection,
  ...(selection.types ? { types: [...selection.types] } : {}),
  ...(selection.muscles ? { muscles: [...selection.muscles] } : {}),
  ...(selection.specificMuscles ? { specificMuscles: [...selection.specificMuscles] } : {}),
  exercises: selection.exercises.map(cloneExercise),
})

const normalizeRoutineSelection = (
  value: unknown,
  clearExerciseSnapshots = false,
): RoutineSelection | null => {
  if (!isRecord(value)) return null
  const exercises = clearExerciseSnapshots
    ? []
    : Array.isArray(value.exercises)
      ? value.exercises.map(normalizeExercise).filter((exercise): exercise is Exercise => exercise !== null)
      : null
  const types = Array.isArray(value.types) ? normalizeStringList(value.types) : undefined
  const muscles = Array.isArray(value.muscles) ? normalizeStringList(value.muscles) : undefined
  const specificMuscles = Array.isArray(value.specificMuscles) ? normalizeStringList(value.specificMuscles) : undefined
  const candidate = {
    ...value,
    type: types?.[0] ?? normalizeText(value.type, 'Strength'),
    muscle: muscles?.[0] ?? normalizeText(value.muscle, 'All'),
    specificMuscle: specificMuscles?.[0] ?? normalizeText(value.specificMuscle, 'All'),
    ...(types && types.length > 0 ? { types } : {}),
    ...(muscles && muscles.length > 0 ? { muscles } : {}),
    ...(specificMuscles && specificMuscles.length > 0 ? { specificMuscles } : {}),
    exercises,
  }
  return exercises && isRoutineSelection(candidate) ? cloneRoutineSelection(candidate) : null
}

const isSavedRoutine = (value: unknown): value is SavedRoutine => (
  isRecord(value)
    && isNonEmptyString(value.id)
    && isNonEmptyString(value.name)
    && Array.isArray(value.selections)
    && value.selections.every(isRoutineSelection)
)

const normalizeSavedRoutine = (
  value: unknown,
  clearExerciseSnapshots = false,
): SavedRoutine | null => {
  if (!isRecord(value)) return null
  const selections = Array.isArray(value.selections)
    ? value.selections
      .map((selection) => normalizeRoutineSelection(selection, clearExerciseSnapshots))
      .filter((selection): selection is RoutineSelection => selection !== null)
    : null
  const candidate = { ...value, selections }
  return selections && isSavedRoutine(candidate)
    ? { id: candidate.id, name: candidate.name.trim(), selections: selections.map(cloneRoutineSelection) }
    : null
}

const normalizeRoutineList = (value: unknown, clearExerciseSnapshots = false): SavedRoutine[] | null => (
  Array.isArray(value)
    ? value
      .map((routine) => normalizeSavedRoutine(routine, clearExerciseSnapshots))
      .filter((routine): routine is SavedRoutine => routine !== null)
    : null
)

const isScheduleEntry = (value: unknown): value is WeeklyScheduleEntry => (
  isRecord(value)
    && isNonEmptyString(value.id)
    && isWeekday(value.day)
    && isValidTime(value.time)
    && isNonEmptyString(value.routineId)
)

const normalizeScheduleEntry = (value: unknown): WeeklyScheduleEntry | null => (
  isScheduleEntry(value)
    ? { id: value.id, day: value.day, time: value.time, routineId: value.routineId }
    : null
)

const normalizeScheduleList = (
  value: unknown,
  routineIds: ReadonlySet<string>,
): WeeklyScheduleEntry[] | null => (
  Array.isArray(value)
    ? value
      .map(normalizeScheduleEntry)
      .filter((entry): entry is WeeklyScheduleEntry => entry !== null && routineIds.has(entry.routineId))
    : null
)

const isValidOccurrenceDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export const isGeneratedWorkoutSession = (value: unknown): value is GeneratedWorkoutSession => (
  isRecord(value)
    && isNonEmptyString(value.scheduleEntryId)
    && isValidOccurrenceDate(value.occurrenceDate)
    && isNonEmptyString(value.routineId)
    && Array.isArray(value.selections)
    && value.selections.every(isRoutineSelection)
)

const cloneGeneratedWorkoutSession = (session: GeneratedWorkoutSession): GeneratedWorkoutSession => ({
  scheduleEntryId: session.scheduleEntryId,
  occurrenceDate: session.occurrenceDate,
  routineId: session.routineId,
  selections: session.selections.map(cloneRoutineSelection),
})

const normalizeGeneratedWorkoutSession = (
  value: unknown,
  clearExerciseSnapshots = false,
): GeneratedWorkoutSession | null => {
  if (!isRecord(value)
    || !isNonEmptyString(value.scheduleEntryId)
    || !isValidOccurrenceDate(value.occurrenceDate)
    || !isNonEmptyString(value.routineId)
    || !Array.isArray(value.selections)) {
    return null
  }

  const selections = value.selections
    .map((selection) => normalizeRoutineSelection(selection, clearExerciseSnapshots))
    .filter((selection): selection is RoutineSelection => selection !== null)
  return cloneGeneratedWorkoutSession({
    scheduleEntryId: value.scheduleEntryId,
    occurrenceDate: value.occurrenceDate,
    routineId: value.routineId,
    selections,
  })
}

const normalizeGeneratedWorkoutSessionList = (
  value: unknown,
  clearExerciseSnapshots = false,
): GeneratedWorkoutSession[] | null => (
  Array.isArray(value)
    ? value
      .map((session) => normalizeGeneratedWorkoutSession(session, clearExerciseSnapshots))
      .filter((session): session is GeneratedWorkoutSession => session !== null)
    : null
)

const isReminderSettings = (value: unknown): value is ReminderSettings => (
  isRecord(value)
    && typeof value.enabled === 'boolean'
    && isValidTime(value.time)
    && NOTIFICATION_CAPABILITIES.includes(value.notificationCapability as ReminderSettings['notificationCapability'])
)

const normalizeReminderSettings = (value: unknown): ReminderSettings | null => (
  isReminderSettings(value)
    ? { enabled: value.enabled, time: value.time, notificationCapability: value.notificationCapability }
    : null
)

const cloneState = (state: FitnessStorageState): FitnessStorageState => ({
  exercises: state.exercises.map(cloneExercise),
  routines: state.routines.map((routine) => ({
    id: routine.id,
    name: routine.name,
    selections: routine.selections.map(cloneRoutineSelection),
  })),
  schedule: state.schedule.map((entry) => ({ ...entry })),
  reminders: { ...state.reminders },
  generatedSessions: (state.generatedSessions ?? []).map(cloneGeneratedWorkoutSession),
})

const createDefaultRoutine = (): SavedRoutine => ({
  id: 'default-routine',
  name: 'Wednesday reset',
  selections: starterRoutineGroups.map((group) => ({
    ...group,
    exercises: [],
  })),
})

export const createDefaultStorageState = (): FitnessStorageState => ({
  exercises: [],
  routines: [createDefaultRoutine()],
  schedule: [],
  reminders: { enabled: false, time: '09:00', notificationCapability: 'unsupported' },
  generatedSessions: [],
})

const normalizeState = (
  value: unknown,
  clearExerciseSnapshots = false,
): FitnessStorageState | null => {
  if (!isRecord(value)) return null
  const exercises = normalizeExerciseList(value.exercises)
  const routines = normalizeRoutineList(value.routines, clearExerciseSnapshots)
  const routineIds = routines ? new Set(routines.map((routine) => routine.id)) : null
  const schedule = routineIds ? normalizeScheduleList(value.schedule, routineIds) : null
  const reminders = normalizeReminderSettings(value.reminders)
  const generatedSessions = value.generatedSessions === undefined
    ? []
    : normalizeGeneratedWorkoutSessionList(value.generatedSessions, clearExerciseSnapshots)

  return exercises && routines && schedule && reminders && generatedSessions
    ? {
      exercises: clearExerciseSnapshots ? [] : exercises,
      routines,
      schedule,
      reminders,
      generatedSessions,
    }
    : null
}

const isCompleteRoutineSelection = (value: unknown): boolean => (
  isRecord(value)
    && Array.isArray(value.exercises)
    && value.exercises.every((exercise) => normalizeExercise(exercise) !== null)
    && normalizeRoutineSelection(value) !== null
)

const isCompleteSavedRoutine = (value: unknown): boolean => (
  isRecord(value)
    && Array.isArray(value.selections)
    && value.selections.every(isCompleteRoutineSelection)
    && normalizeSavedRoutine(value) !== null
)

const isCompleteState = (value: unknown): boolean => {
  if (!isRecord(value)) return false
  if (!Array.isArray(value.exercises) || !value.exercises.every((exercise) => normalizeExercise(exercise) !== null)) {
    return false
  }
  if (!Array.isArray(value.routines) || !value.routines.every(isCompleteSavedRoutine)) return false
  if (!Array.isArray(value.schedule)) return false
  if (value.generatedSessions !== undefined && !Array.isArray(value.generatedSessions)) return false

  const routineIds = new Set(
    value.routines
      .map((routine) => normalizeSavedRoutine(routine))
      .filter((routine): routine is SavedRoutine => routine !== null)
      .map((routine) => routine.id),
  )
  return value.schedule.every((entry) => {
    const normalized = normalizeScheduleEntry(entry)
    return normalized !== null && routineIds.has(normalized.routineId)
  }) && normalizeReminderSettings(value.reminders) !== null
}

const createEnvelope = (
  state: FitnessStorageState,
  exerciseLibraryPurged = true,
): StorageEnvelope => ({
  version: CURRENT_STORAGE_VERSION,
  data: cloneState(state),
  exerciseLibraryPurged,
})

const parseJson = (value: string): unknown => {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return null
  }
}

const isSupportedStorageVersion = (value: unknown): value is number => (
  value === CURRENT_STORAGE_VERSION
    || value === PREVIOUS_STORAGE_VERSION
    || value === EARLIER_STORAGE_VERSION
    || value === OLDEST_SUPPORTED_STORAGE_VERSION
    || value === LEGACY_STORAGE_VERSION
)

export const parseStorageEnvelope = (value: unknown): StorageEnvelope | null => {
  const parsed = typeof value === 'string' ? parseJson(value) : value
  if (!isRecord(parsed)
    || !isSupportedStorageVersion(parsed.version)
    || !isCompleteState(parsed.data)) return null
  const data = normalizeState(parsed.data, parsed.exerciseLibraryPurged !== true)
  return data ? createEnvelope(data) : null
}

const readLegacyRoutine = (storage: StorageLike): SavedRoutine | null => {
  const raw = safeGetItem(storage, LEGACY_ROUTINE_KEY)
  if (raw === null) return null
  const parsed = parseJson(raw)
  if (!Array.isArray(parsed)) return null
  const selections = parsed
    .map((selection) => normalizeRoutineSelection(selection, true))
    .filter((selection): selection is RoutineSelection => selection !== null)
  return selections.length > 0
    ? { id: 'legacy-routine', name: 'Wednesday reset', selections }
    : null
}

const migrateLegacyState = (storage: StorageLike): FitnessStorageState => {
  const defaults = createDefaultStorageState()
  const legacyRoutine = readLegacyRoutine(storage)
  return {
    ...defaults,
    routines: legacyRoutine ? [legacyRoutine] : defaults.routines,
  }
}

const repairCurrentState = (storage: StorageLike, value: unknown): FitnessStorageState => {
  const defaults = createDefaultStorageState()
  const migrated = migrateLegacyState(storage)
  if (!isRecord(value) || !isRecord(value.data)) return migrated

  const routines = normalizeRoutineList(value.data.routines, true) ?? migrated.routines
  const routineIds = new Set(routines.map((routine) => routine.id))
  const schedule = normalizeScheduleList(value.data.schedule, routineIds) ?? defaults.schedule
  const reminders = normalizeReminderSettings(value.data.reminders) ?? defaults.reminders
  const generatedSessions = value.data.generatedSessions === undefined
    ? migrated.generatedSessions ?? []
    : normalizeGeneratedWorkoutSessionList(value.data.generatedSessions, true) ?? []

  return { exercises: [], routines, schedule, reminders, generatedSessions }
}

const safeGetItem = (storage: StorageLike | null, key: string): string | null => {
  if (!storage) return null
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

const safeSetItem = (storage: StorageLike | null, key: string, value: string): boolean => {
  if (!storage) return false
  try {
    storage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

const getBrowserStorage = (): StorageLike | null => {
  try {
    if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) return null
    return globalThis.localStorage
  } catch {
    return null
  }
}

export const migrateStorage = (storage: StorageLike | null = getBrowserStorage()): StorageEnvelope => {
  const rawCurrent = safeGetItem(storage, STORAGE_KEY)
  const current = parseStorageEnvelope(rawCurrent)
  if (current) {
    const serializedCurrent = JSON.stringify(current)
    if (rawCurrent !== serializedCurrent) safeSetItem(storage, STORAGE_KEY, serializedCurrent)
    return current
  }

  // Keep the original value recoverable before replacing an unreadable envelope.
  if (rawCurrent !== null) safeSetItem(storage, STORAGE_BACKUP_KEY, rawCurrent)
  const parsedCurrent = rawCurrent === null ? null : parseJson(rawCurrent)
  const migrated = createEnvelope(storage
    ? repairCurrentState(storage, parsedCurrent)
    : createDefaultStorageState())
  safeSetItem(storage, STORAGE_KEY, JSON.stringify(migrated))
  return migrated
}

export const readStorage = (storage: StorageLike | null = getBrowserStorage()): FitnessStorageState => (
  migrateStorage(storage).data
)

export const writeStorage = (
  state: FitnessStorageState,
  storage: StorageLike | null = getBrowserStorage(),
): boolean => {
  const normalized = normalizeState(state)
  if (!normalized) return false
  return safeSetItem(storage, STORAGE_KEY, JSON.stringify(createEnvelope(normalized)))
}

export type StorageAdapter = {
  read: () => FitnessStorageState
  write: (state: FitnessStorageState) => boolean
}

export const createStorageAdapter = (
  storage: StorageLike | null = getBrowserStorage(),
  seedExercises: readonly Exercise[] = [],
  withdrawnExerciseGoals: readonly string[] = [],
): StorageAdapter => ({
  read: () => {
    const state = readStorage(storage)
    const hasLegacyExercises = safeGetItem(storage, LEGACY_EXERCISES_KEY) !== null
      || safeGetItem(storage, LEGACY_ROUTINE_KEY) !== null
    if (seedExercises.length === 0 || hasLegacyExercises) return state

    const excludedExerciseGoals = new Set(withdrawnExerciseGoals)
    const seededState = {
      ...state,
      exercises: mergeSeedExercises(state.exercises, seedExercises, excludedExerciseGoals),
    }
    const normalizedSeededState = normalizeState(seededState) ?? state
    if (state.exercises.length !== normalizedSeededState.exercises.length
      || hasSeedChanges(state.exercises, seedExercises, excludedExerciseGoals)) {
      writeStorage(normalizedSeededState, storage)
    }
    return normalizedSeededState
  },
  write: (state) => writeStorage(state, storage),
})

export type WorkoutSessionKey = Pick<GeneratedWorkoutSession, 'scheduleEntryId' | 'occurrenceDate'>
export type WorkoutSessionGenerator = () => GeneratedWorkoutSession

const isWorkoutSessionKey = (value: WorkoutSessionKey): boolean => (
  isNonEmptyString(value.scheduleEntryId) && isValidOccurrenceDate(value.occurrenceDate)
)

/** Load an occurrence snapshot or generate and persist it once when absent. */
export function getOrCreateWorkoutSession(
  adapter: StorageAdapter,
  key: WorkoutSessionKey,
  generate: WorkoutSessionGenerator,
): GeneratedWorkoutSession | null
export function getOrCreateWorkoutSession(
  adapter: StorageAdapter,
  scheduleEntryId: string,
  occurrenceDate: string,
  generate: WorkoutSessionGenerator,
): GeneratedWorkoutSession | null
export function getOrCreateWorkoutSession(
  adapter: StorageAdapter,
  keyOrScheduleEntryId: WorkoutSessionKey | string,
  occurrenceDateOrGenerate: string | WorkoutSessionGenerator,
  maybeGenerate?: WorkoutSessionGenerator,
): GeneratedWorkoutSession | null {
  const key: WorkoutSessionKey = typeof keyOrScheduleEntryId === 'string'
    ? { scheduleEntryId: keyOrScheduleEntryId, occurrenceDate: occurrenceDateOrGenerate as string }
    : keyOrScheduleEntryId
  const generate = typeof occurrenceDateOrGenerate === 'function' ? occurrenceDateOrGenerate : maybeGenerate
  if (!generate || !isWorkoutSessionKey(key)) return null

  let state: FitnessStorageState
  try {
    state = adapter.read()
  } catch {
    return null
  }

  const existing = (state.generatedSessions ?? []).find((session) => (
    session.scheduleEntryId === key.scheduleEntryId
      && session.occurrenceDate === key.occurrenceDate
  ))
  if (existing) return existing

  let generated: GeneratedWorkoutSession
  try {
    generated = generate()
  } catch {
    return null
  }
  const normalized = normalizeGeneratedWorkoutSession(generated)
  if (!normalized
    || normalized.scheduleEntryId !== key.scheduleEntryId
    || normalized.occurrenceDate !== key.occurrenceDate) return null

  const nextState: FitnessStorageState = {
    ...state,
    generatedSessions: [...(state.generatedSessions ?? []), normalized],
  }
  try {
    return adapter.write(nextState) ? normalized : null
  } catch {
    return null
  }
}

export const getOrCreateGeneratedWorkoutSession = getOrCreateWorkoutSession
export const getOrCreateSession = getOrCreateWorkoutSession
