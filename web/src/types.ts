/**
 * A normalized, non-empty source exercise type.
 *
 * The non-empty invariant is enforced when data crosses an application
 * boundary; the domain type deliberately does not constrain source values to
 * a fixed catalogue of categories.
 */
export type ExerciseType = string

/**
 * Ordered exercise types. Import and storage boundaries must trim values and
 * remove duplicates while preserving the first occurrence.
 */
export type ExerciseTypes = ExerciseType[]

export type ExerciseCommonError = {
  error: string
  correction: string
}

export type Exercise = {
  id: string
  name: string
  group: string
  type: ExerciseType
  /** Canonical ordered type values; optional for legacy scalar records. */
  types?: ExerciseTypes
  muscles: string[]
  purpose: string
  specificMuscles: string[]
  equipmentAndEnvironment: string
  startingPosition: string
  rangeAndDirection: string
  breathing: string
  beginnerDoseAndRest: string
  expectedSensation: string
  regression: string
  progression: string
  /** Compatibility alias retained for existing filters and saved data. */
  category: string
  /** Compatibility alias retained for existing callers. */
  description: string
  /** Retained for compatibility with exercises saved before structured steps. */
  instructions: string[]
  steps: string[]
  commonErrors: ExerciseCommonError[]
  tags: string[]
  isFavorite: boolean
  duration: string
}

export type ExerciseDraft = {
  name: string
  group: string
  type: ExerciseType
  /** Preferred multi-valued input; `type` remains for existing draft callers. */
  types?: ExerciseTypes
  muscles: string
  purpose?: string
  /** Textarea input is newline-delimited; arrays remain accepted for compatibility. */
  specificMuscles?: string | string[]
  equipmentAndEnvironment?: string
  startingPosition?: string
  rangeAndDirection?: string
  breathing?: string
  beginnerDoseAndRest?: string
  expectedSensation?: string
  regression?: string
  progression?: string
  /** Legacy aliases remain accepted for callers that still build old drafts. */
  category?: string
  description?: string
  steps: string
  commonErrors: string
  tags?: string
  duration?: string
}

export type RoutineGroup = {
  id: string
  label: string
  detail: string
  /** Primary type retained for compatibility with older saved routines. */
  type: ExerciseType
  /** Selected exercise types; omitted legacy values fall back to `type`. */
  types?: ExerciseTypes
  /** Optional goal filter sourced from Exercise.group; omitted means all goals. */
  goal?: string
  /** Primary muscle retained for compatibility with older saved routines. */
  muscle: string
  /** Selected muscle groups; omitted legacy values fall back to `muscle`. */
  muscles?: string[]
  /** Optional individual-muscle filter; omitted means all specific muscles. */
  specificMuscle?: string
  /** Selected individual muscles; omitted legacy values fall back to `specificMuscle`. */
  specificMuscles?: string[]
  count: number
}

export type RoutineSelection = RoutineGroup & {
  exercises: Exercise[]
}

export type SavedRoutine = {
  id: string
  name: string
  selections: RoutineSelection[]
}

export type GeneratedWorkoutSession = {
  scheduleEntryId: string
  occurrenceDate: string
  routineId: string
  selections: RoutineSelection[]
}

export type NamedRoutine = SavedRoutine
export type Routine = SavedRoutine

export type Weekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'

export type WeeklyScheduleEntry = {
  id: string
  day: Weekday
  time: string
  routineId: string
}

export type ScheduleEntry = WeeklyScheduleEntry

export type NotificationCapability = 'unsupported' | 'default' | 'granted' | 'denied' | 'error'
export type NotificationCapabilityState = NotificationCapability

export type ReminderSettings = {
  enabled: boolean
  time: string
  notificationCapability: NotificationCapability
}

export type FitnessStorageState = {
  exercises: Exercise[]
  routines: SavedRoutine[]
  schedule: WeeklyScheduleEntry[]
  reminders: ReminderSettings
  /** Concrete sessions are occurrence snapshots; saved routines remain templates. */
  generatedSessions?: GeneratedWorkoutSession[]
}

export type StorageState = FitnessStorageState
export type AppState = FitnessStorageState

export type StorageEnvelope = {
  version: number
  data: FitnessStorageState
  /** Internal marker written after the one-time library purge. */
  exerciseLibraryPurged?: boolean
}
