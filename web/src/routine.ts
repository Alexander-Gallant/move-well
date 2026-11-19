import type {
  Exercise,
  ExerciseCommonError,
  ExerciseDraft,
  ExerciseType,
  ExerciseTypes,
  FitnessStorageState,
  GeneratedWorkoutSession,
  RoutineGroup,
  RoutineSelection,
  SavedRoutine,
} from './types'

let exerciseIdCounter = 0

const createExerciseId = (): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `custom-${globalThis.crypto.randomUUID()}`
  }

  exerciseIdCounter += 1
  return `custom-${Date.now()}-${exerciseIdCounter}`
}

const normalizeExerciseTypes = (
  types: readonly string[] | undefined,
  fallback: string,
): [string, ...string[]] => {
  const source = types && types.length > 0 ? types : [fallback]
  const normalized = source.reduce<string[]>((result, value) => {
    const type = value.trim()
    return type && !result.includes(type) ? [...result, type] : result
  }, [])
  const first = normalized[0] ?? fallback.trim()
  return [first, ...normalized.slice(1)]
}

const getExerciseTypes = (exercise: Exercise): readonly string[] => (
  exercise.types && exercise.types.length > 0 ? exercise.types : [exercise.type]
)

const normalizeFilterValues = (
  values: readonly string[] | undefined,
  fallback = 'All',
): string[] => {
  const normalized = (values ?? [])
    .map((value) => value.trim())
    .filter((value, index, source) => value.length > 0 && source.indexOf(value) === index)
  if (normalized.includes('All')) return ['All']
  return normalized.length > 0 ? normalized : [fallback]
}

const getRoutineTypes = (group: RoutineGroup): ExerciseTypes => normalizeFilterValues(group.types, group.type)
const getRoutineMuscles = (group: RoutineGroup): string[] => normalizeFilterValues(group.muscles, group.muscle)
const getRoutineSpecificMuscles = (group: RoutineGroup): string[] => normalizeFilterValues(group.specificMuscles, group.specificMuscle)

export const getSelectedRoutineTypes = (group: RoutineGroup): ExerciseTypes => getRoutineTypes(group)
export const getSelectedRoutineMuscles = (group: RoutineGroup): string[] => getRoutineMuscles(group)
export const getSelectedRoutineSpecificMuscles = (group: RoutineGroup): string[] => getRoutineSpecificMuscles(group)

const exerciseMatchesType = (exercise: Exercise, type: ExerciseType): boolean => (
  type === 'All' || getExerciseTypes(exercise).includes(type)
)

const exerciseMatchesTypes = (exercise: Exercise, types: readonly ExerciseType[]): boolean => (
  types.includes('All') || types.some((type) => exerciseMatchesType(exercise, type))
)

const exerciseMatchesGoal = (exercise: Exercise, goal?: string): boolean => (
  !goal || goal === 'All' || exercise.group === goal
)

const exerciseMatchesMuscle = (exercise: Exercise, muscle?: string): boolean => (
  !muscle || muscle === 'All' || exercise.muscles.includes(muscle)
)

const exerciseMatchesMuscles = (exercise: Exercise, muscles: readonly string[]): boolean => (
  muscles.includes('All') || muscles.some((muscle) => exerciseMatchesMuscle(exercise, muscle))
)

const exerciseMatchesSpecificMuscle = (exercise: Exercise, specificMuscle?: string): boolean => (
  !specificMuscle || specificMuscle === 'All' || exercise.specificMuscles.includes(specificMuscle)
)

const exerciseMatchesSpecificMuscles = (exercise: Exercise, specificMuscles: readonly string[]): boolean => (
  specificMuscles.includes('All') || specificMuscles.some((muscle) => exerciseMatchesSpecificMuscle(exercise, muscle))
)

type ExerciseTypeFilter = ExerciseType | readonly ExerciseType[]

const exerciseMatchesTypeFilter = (exercise: Exercise, type?: ExerciseTypeFilter): boolean => (
  !type || (typeof type === 'string' ? exerciseMatchesType(exercise, type) : exerciseMatchesTypes(exercise, type))
)

export const createUniqueExerciseId = (
  existingIds: ReadonlySet<string>,
  createId: () => string = createExerciseId,
): string => {
  const baseId = createId()
  if (!existingIds.has(baseId)) return baseId

  let suffix = 2
  while (existingIds.has(`${baseId}-${suffix}`)) suffix += 1
  return `${baseId}-${suffix}`
}

export const validateExerciseDraft = (draft: ExerciseDraft): string[] => {
  const errors: string[] = []
  if (!draft.name.trim()) errors.push('Add an exercise name.')
  if (!draft.group.trim()) errors.push('Add an exercise group.')
  if (parseList(draft.muscles, ',').length === 0) errors.push('Add at least one target muscle.')
  if (parseList(draft.steps, '\n').length === 0) errors.push('Add at least one execution step.')
  if (hasMalformedCommonError(draft.commonErrors)) {
    errors.push('Use "error | correction" for each common error.')
  }
  return errors
}

export const createExercise = (draft: ExerciseDraft, id: string): Exercise => {
  const types = normalizeExerciseTypes(draft.types, draft.type)
  return {
    ...createExerciseMetadata(draft),
    id,
    name: draft.name.trim(),
    group: draft.group.trim(),
    type: types[0],
    types,
    muscles: parseList(draft.muscles, ','),
    category: draft.category?.trim() || draft.group.trim(),
    description: draft.description?.trim() || draftText(draft.purpose),
    duration: draft.duration?.trim() ?? '',
  }
}

const parseList = (value: string, separator: string): string[] => value
  .split(separator)
  .map((item) => item.trim())
  .filter(Boolean)

const parseDraftList = (
  value: string | readonly string[] | undefined,
  separator: string,
): string[] => {
  if (typeof value === 'string') return parseList(value, separator)
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
}

const draftText = (value: string | undefined): string => value?.trim() ?? ''

const parseCommonErrorLine = (line: string): ExerciseCommonError | null => {
  const parts = line.split('|').map((part) => part.trim())
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null
  return { error: parts[0], correction: parts[1] }
}

const parseCommonErrors = (value: string): ExerciseCommonError[] => value
  .split('\n')
  .map((line) => parseCommonErrorLine(line.trim()))
  .filter((entry): entry is ExerciseCommonError => entry !== null)

const hasMalformedCommonError = (value: string): boolean => value
  .split('\n')
  .some((line) => line.trim() !== '' && parseCommonErrorLine(line.trim()) === null)

const createExerciseMetadata = (draft: ExerciseDraft) => {
  const steps = parseList(draft.steps, '\n')
  return {
    instructions: [...steps],
    steps,
    commonErrors: parseCommonErrors(draft.commonErrors),
    tags: parseList(draft.tags ?? '', ','),
    isFavorite: false,
    purpose: draftText(draft.purpose),
    specificMuscles: parseDraftList(draft.specificMuscles, '\n'),
    equipmentAndEnvironment: draftText(draft.equipmentAndEnvironment),
    startingPosition: draftText(draft.startingPosition),
    rangeAndDirection: draftText(draft.rangeAndDirection),
    breathing: draftText(draft.breathing),
    beginnerDoseAndRest: draftText(draft.beginnerDoseAndRest),
    expectedSensation: draftText(draft.expectedSensation),
    regression: draftText(draft.regression),
    progression: draftText(draft.progression),
  }
}

export function filterExercises(
  exercises: Exercise[],
  query: string,
  type: string,
  muscle: string,
  tag?: string,
  favoritesOnly?: boolean,
  specificMuscle?: string,
  goal?: string,
): Exercise[]
export function filterExercises(
  exercises: Exercise[],
  query: string,
  type: string,
  muscle: string,
  specificMuscle?: string,
  tag?: string,
  favoritesOnly?: boolean,
  goal?: string,
): Exercise[]
export function filterExercises(
  exercises: Exercise[],
  query: string,
  type: string,
  muscle: string,
  fifth = 'All',
  sixth: string | boolean = false,
  seventh: string | boolean = 'All',
  eighth = 'All',
): Exercise[] {
  const usesSpecificMuscleFirst = typeof sixth === 'string'
  const tag = usesSpecificMuscleFirst ? sixth : fifth
  const favoritesOnly = usesSpecificMuscleFirst
    ? typeof seventh === 'boolean' && seventh
    : typeof sixth === 'boolean' && sixth
  const specificMuscle = usesSpecificMuscleFirst ? fifth : seventh
  const goal = eighth
  const normalizedQuery = query.trim().toLowerCase()

  return exercises.filter((exercise) => {
    const matchesQuery = [exercise.name, exercise.group, exercise.category, ...exercise.muscles, ...exercise.specificMuscles]
      .join(' ')
      .toLowerCase()
      .includes(normalizedQuery)
    const matchesType = !type || type === 'All' || exerciseMatchesType(exercise, type)
    const matchesMuscle = !muscle || muscle === 'All' || exercise.muscles.includes(muscle)
    const matchesGoal = !goal || goal === 'All' || exercise.group === goal
    const matchesTag = !tag || tag === 'All' || (typeof tag === 'string' && exercise.tags.includes(tag))
    const matchesSpecificMuscle = !specificMuscle
      || specificMuscle === 'All'
      || (typeof specificMuscle === 'string' && exercise.specificMuscles.includes(specificMuscle))
    const matchesFavorites = !favoritesOnly || exercise.isFavorite
    return matchesQuery && matchesType && matchesGoal && matchesMuscle && matchesTag && matchesSpecificMuscle && matchesFavorites
  })
}

const updateExerciseListFavorite = (
  exercises: readonly Exercise[],
  exerciseId: string,
  isFavorite: boolean,
): { exercises: Exercise[]; changed: boolean } => {
  let changed = false
  const nextExercises = exercises.map((exercise) => {
    if (exercise.id !== exerciseId || exercise.isFavorite === isFavorite) return exercise
    changed = true
    return { ...exercise, isFavorite }
  })

  return { exercises: changed ? nextExercises : [...exercises], changed }
}

export const updateRoutineSelectionsFavorite = (
  selections: readonly RoutineSelection[],
  exerciseId: string,
  isFavorite: boolean,
): RoutineSelection[] => {
  let changed = false
  const nextSelections = selections.map((selection) => {
    const result = updateExerciseListFavorite(selection.exercises, exerciseId, isFavorite)
    if (!result.changed) return selection
    changed = true
    return { ...selection, exercises: result.exercises }
  })

  return changed ? nextSelections : [...selections]
}

/** Update one canonical exercise and all matching saved snapshots immutably. */
export const updateExerciseFavorite = (
  state: FitnessStorageState,
  exerciseId: string,
  isFavorite: boolean,
): FitnessStorageState => {
  const canonical = state.exercises.find((exercise) => exercise.id === exerciseId)
  if (!canonical) return state

  const canonicalResult = updateExerciseListFavorite(state.exercises, exerciseId, isFavorite)
  let routinesChanged = false
  const routines = state.routines.map((routine) => {
    const selections = updateRoutineSelectionsFavorite(routine.selections, exerciseId, isFavorite)
    if (selections.every((selection, index) => selection === routine.selections[index])) return routine
    routinesChanged = true
    return { ...routine, selections }
  })

  let sessionsChanged = false
  const generatedSessions = state.generatedSessions?.map((session) => {
    const selections = updateRoutineSelectionsFavorite(session.selections, exerciseId, isFavorite)
    if (selections.every((selection, index) => selection === session.selections[index])) return session
    sessionsChanged = true
    return { ...session, selections }
  })

  if (!canonicalResult.changed && !routinesChanged && !sessionsChanged) return state
  return {
    ...state,
    exercises: canonicalResult.changed ? canonicalResult.exercises : state.exercises,
    routines: routinesChanged ? routines : state.routines,
    generatedSessions: sessionsChanged ? generatedSessions : state.generatedSessions,
  }
}

export const toggleExerciseFavorite = (
  state: FitnessStorageState,
  exerciseId: string,
): FitnessStorageState => {
  const exercise = state.exercises.find((candidate) => candidate.id === exerciseId)
  return exercise ? updateExerciseFavorite(state, exerciseId, !exercise.isFavorite) : state
}

const selectWeightedExercises = (
  exercises: Exercise[],
  count: number,
  random: () => number,
): Exercise[] => {
  const remaining = [...exercises]
  const selected: Exercise[] = []

  while (remaining.length > 0 && selected.length < count) {
    const totalWeight = remaining.reduce((total, exercise) => total + (exercise.isFavorite ? 2 : 1), 0)
    const randomValue = random()
    const normalizedRandom = Number.isFinite(randomValue)
      ? Math.min(Math.max(randomValue, 0), 0.999999999999)
      : 0
    let cursor = normalizedRandom * totalWeight
    const selectedIndex = remaining.findIndex((exercise) => {
      cursor -= exercise.isFavorite ? 2 : 1
      return cursor < 0
    })
    const index = selectedIndex >= 0 ? selectedIndex : remaining.length - 1
    const [exercise] = remaining.splice(index, 1)
    if (exercise) selected.push(exercise)
  }

  return selected
}

export const selectRandomExercises = (
  exercises: Exercise[],
  group: RoutineGroup,
  random: () => number = Math.random,
): Exercise[] => {
  const matchingExercises = exercises.filter(
    (exercise) => exerciseMatchesTypes(exercise, getRoutineTypes(group))
      && exerciseMatchesGoal(exercise, group.goal)
      && exerciseMatchesMuscles(exercise, getRoutineMuscles(group))
      && exerciseMatchesSpecificMuscles(exercise, getRoutineSpecificMuscles(group)),
  )

  if (!matchingExercises.some((exercise) => exercise.isFavorite)) {
    return [...matchingExercises]
      .sort(() => random() - 0.5)
      .slice(0, group.count)
  }

  return selectWeightedExercises(matchingExercises, group.count, random)
}

export const createRoutine = (
  exercises: Exercise[],
  groups: RoutineGroup[],
  random: () => number = Math.random,
): RoutineSelection[] => groups.map((group) => ({
  ...group,
  exercises: selectRandomExercises(exercises, group, random),
}))

export const generateWorkoutSession = (
  exercises: Exercise[],
  routine: SavedRoutine,
  scheduleEntryId: string,
  occurrenceDate: string,
  random: () => number = Math.random,
): GeneratedWorkoutSession => ({
  scheduleEntryId,
  occurrenceDate,
  routineId: routine.id,
  selections: routine.selections.map((group) => ({
    ...group,
    exercises: selectRandomExercises(exercises, group, random),
  })),
})

export const regenerateRoutineGroups = (
  routine: readonly RoutineSelection[],
  exercises: Exercise[],
  groupId?: string,
  random: () => number = Math.random,
): RoutineSelection[] => routine.map((group) => (
  groupId === undefined || group.id === groupId
    ? { ...group, exercises: selectRandomExercises(exercises, group, random) }
    : group
))

export type RoutineGroupChanges = Partial<Pick<RoutineGroup, 'label' | 'type' | 'types' | 'goal' | 'muscle' | 'muscles' | 'specificMuscle' | 'specificMuscles' | 'count'>>

export const getGoals = (exercises: Exercise[], type?: ExerciseTypeFilter): string[] => Array.from(
  new Set(
    exercises
      .filter((exercise) => exerciseMatchesTypeFilter(exercise, type))
      .map((exercise) => exercise.group)
      .filter(Boolean),
  ),
).sort()

export const getTargetMuscles = (exercises: Exercise[], type?: ExerciseTypeFilter, goal?: string): string[] => Array.from(
  new Set(
    exercises
      .filter((exercise) => exerciseMatchesTypeFilter(exercise, type))
      .filter((exercise) => exerciseMatchesGoal(exercise, goal))
      .flatMap((exercise) => exercise.muscles),
  ),
).sort()

export const getTags = (exercises: Exercise[], type?: ExerciseType): string[] => Array.from(
  new Set(
    exercises
      .filter((exercise) => type === undefined || exerciseMatchesType(exercise, type))
      .flatMap((exercise) => exercise.tags),
  ),
).sort()

export const getSpecificMuscles = (
  exercises: Exercise[],
  type?: ExerciseTypeFilter,
  goal?: string,
  muscle?: string | readonly string[],
): string[] => Array.from(
  new Set(
    exercises
      .filter((exercise) => exerciseMatchesTypeFilter(exercise, type))
      .filter((exercise) => exerciseMatchesGoal(exercise, goal))
      .filter((exercise) => !muscle
        || (typeof muscle === 'string'
          ? exerciseMatchesMuscle(exercise, muscle)
          : exerciseMatchesMuscles(exercise, muscle)))
      .flatMap((exercise) => exercise.specificMuscles),
  ),
).sort()

export const getTargetSpecificMuscles = getSpecificMuscles

export const updateRoutineGroup = (
  routine: readonly RoutineSelection[],
  exercises: Exercise[],
  groupId: string,
  changes: RoutineGroupChanges,
  random: () => number = Math.random,
): RoutineSelection[] => routine.map((group) => {
  if (group.id !== groupId) return group

  const requestedTypes = changes.types ?? (changes.type === undefined ? getRoutineTypes(group) : [changes.type])
  const nextTypes = normalizeFilterValues(requestedTypes, group.type) as ExerciseTypes
  const nextType = nextTypes[0]!
  const availableGoals = getGoals(exercises, nextTypes)
  const requestedGoal = changes.goal ?? group.goal ?? 'All'
  const nextGoal = requestedGoal === 'All' || availableGoals.includes(requestedGoal) ? requestedGoal : 'All'
  const availableMuscles = getTargetMuscles(exercises, nextTypes, nextGoal)
  const requestedMuscles = changes.muscles ?? (changes.muscle === undefined ? getRoutineMuscles(group) : [changes.muscle])
  const validMuscles = normalizeFilterValues(requestedMuscles)
    .filter((muscle) => muscle === 'All' || availableMuscles.includes(muscle))
  const nextMuscles = validMuscles.length > 0 ? validMuscles : ['All']
  const nextMuscle = nextMuscles[0]!
  const availableSpecificMuscles = getSpecificMuscles(exercises, nextTypes, nextGoal, nextMuscles)
  const requestedSpecificMuscles = changes.specificMuscles
    ?? (changes.specificMuscle === undefined ? getRoutineSpecificMuscles(group) : [changes.specificMuscle])
  const validSpecificMuscles = normalizeFilterValues(requestedSpecificMuscles)
    .filter((muscle) => muscle === 'All' || availableSpecificMuscles.includes(muscle))
  const nextSpecificMuscles = validSpecificMuscles.length > 0 ? validSpecificMuscles : ['All']
  const nextSpecificMuscle = nextSpecificMuscles[0]!
  const nextGroup = {
    ...group,
    ...changes,
    type: nextType,
    types: nextTypes,
    goal: nextGoal,
    muscle: nextMuscle,
    muscles: nextMuscles,
    specificMuscle: nextSpecificMuscle,
    specificMuscles: nextSpecificMuscles,
  }
  const configurationChanged = changes.type !== undefined
    || changes.types !== undefined
    || changes.goal !== undefined
    || changes.muscle !== undefined
    || changes.muscles !== undefined
    || changes.specificMuscle !== undefined
    || changes.specificMuscles !== undefined
    || changes.count !== undefined

  return configurationChanged
    ? { ...nextGroup, exercises: selectRandomExercises(exercises, nextGroup, random) }
    : { ...nextGroup, exercises: group.exercises }
})

export const createRoutineGroup = (
  id: string,
  exercises: Exercise[],
  existingGroups: readonly RoutineGroup[] = [],
  random: () => number = Math.random,
): RoutineSelection => {
  const type: ExerciseType = 'Strength'
  const group: RoutineGroup = {
    id,
    label: `Focus area ${existingGroups.length + 1}`,
    detail: 'Build a balanced routine',
    type,
    types: [type],
    goal: 'All',
    muscle: 'All',
    muscles: ['All'],
    specificMuscle: 'All',
    specificMuscles: ['All'],
    count: 3,
  }

  return { ...group, exercises: selectRandomExercises(exercises, group, random) }
}

export const isRoutineSelection = (value: unknown): value is RoutineSelection => {
  if (!value || typeof value !== 'object') return false
  const selection = value as Partial<RoutineSelection>
  return typeof selection.id === 'string'
    && typeof selection.label === 'string'
    && typeof selection.detail === 'string'
    && Array.isArray(selection.exercises)
}

export const getMuscles = (exercises: Exercise[]) => [
  'All',
  ...getTargetMuscles(exercises),
]
