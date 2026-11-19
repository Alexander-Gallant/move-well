import { describe, expect, it } from 'vitest'
import { starterExercises, starterRoutineGroups } from './data'
import type { Exercise, ExerciseDraft } from './types'
import {
  createExercise,
  createRoutine,
  createRoutineGroup,
  createUniqueExerciseId,
  filterExercises,
  generateWorkoutSession,
  getGoals,
  getSpecificMuscles,
  getTags,
  getTargetMuscles,
  regenerateRoutineGroups,
  selectRandomExercises,
  toggleExerciseFavorite,
  updateExerciseFavorite,
  updateRoutineGroup,
  validateExerciseDraft,
} from './routine'

const completeDraft = (overrides: Partial<ExerciseDraft> = {}): ExerciseDraft => ({
  name: '  Shoulder press  ',
  group: 'Upper body',
  type: 'Strength',
  muscles: ' Shoulders, Arms, , ',
  steps: ' Set up tall\n Press overhead \n',
  commonErrors: 'Arching the back | Brace the core\nGrip too wide | Keep hands stacked',
  tags: ' upper body, press, , ',
  purpose: 'Build overhead pressing strength.',
  specificMuscles: [' musculus deltoideus ', 'musculus triceps brachii'],
  equipmentAndEnvironment: 'Use a stable bench or standing space.',
  startingPosition: 'Stand tall with the weight at shoulder height.',
  rangeAndDirection: 'Press upward without leaning back.',
  breathing: 'Exhale as the weight rises.',
  beginnerDoseAndRest: '1–2 sets of 5 repetitions; rest 60 seconds.',
  expectedSensation: 'Manageable effort in the shoulders and arms.',
  regression: 'Use a lighter weight.',
  progression: 'Add repetitions after control is consistent.',
  ...overrides,
})

const multiTypeExercise = (overrides: Partial<Exercise> = {}): Exercise => ({
  ...starterExercises[0]!,
  id: 'multi-type-exercise',
  name: 'Multi-type exercise',
  type: 'Mobility',
  types: ['Mobility', 'Coordination', 'Stretch'],
  ...overrides,
})

describe('exercise metadata', () => {
  it('creates trimmed list metadata and paired common errors', () => {
    // Arrange
    const draft = completeDraft()

    // Act
    const result = createExercise(draft, 'custom-1')

    // Assert
    expect(result).toMatchObject({
      id: 'custom-1',
      name: 'Shoulder press',
      muscles: ['Shoulders', 'Arms'],
      steps: ['Set up tall', 'Press overhead'],
      instructions: ['Set up tall', 'Press overhead'],
      commonErrors: [
        { error: 'Arching the back', correction: 'Brace the core' },
        { error: 'Grip too wide', correction: 'Keep hands stacked' },
      ],
       tags: ['upper body', 'press'],
       isFavorite: false,
       group: 'Upper body',
       purpose: 'Build overhead pressing strength.',
       specificMuscles: ['musculus deltoideus', 'musculus triceps brachii'],
     })
  })

  it('returns no errors for an empty optional metadata input', () => {
    // Arrange
    const draft = completeDraft({ commonErrors: '', tags: '' })

    // Act
    const errors = validateExerciseDraft(draft)

    // Assert
    expect(errors).toEqual([])
  })

  it('reports missing required metadata and malformed error pairs deterministically', () => {
    // Arrange
    const draft = completeDraft({
      name: ' ',
      group: '',
      muscles: ' , ',
      steps: '\n',
      commonErrors: 'Missing correction |\nMissing separator',
    })

    // Act
    const errors = validateExerciseDraft(draft)

    // Assert
    expect(errors).toEqual([
      'Add an exercise name.',
      'Add an exercise group.',
      'Add at least one target muscle.',
      'Add at least one execution step.',
      'Use "error | correction" for each common error.',
    ])
  })

  it('filters text, type, muscle, tag, and favorites independently', () => {
    // Arrange
    const exercises = [
      { ...starterExercises[0]!, tags: ['stability', 'core'], isFavorite: true },
      { ...starterExercises[4]!, tags: ['strength'], isFavorite: true },
      { ...starterExercises[11]!, tags: ['mobility'], isFavorite: true },
    ]

    // Act
    const result = filterExercises(exercises, 'squat', 'Strength', 'Quads', 'strength', true)

    // Assert
    expect(result.map((exercise) => exercise.id)).toEqual(['goblet-squat'])
    expect(filterExercises(exercises, '', '', '', '', false)).toEqual(exercises)
    expect(filterExercises(exercises, '', 'All', 'All', 'All', true).map((exercise) => exercise.id))
      .toEqual(['dead-bug', 'goblet-squat', 'doorway-chest'])
  })

  it('combines goal and specific-muscle filters without applying either when set to All', () => {
    // Arrange
    const exercises = [
      { ...starterExercises[0]!, id: 'posture-core', group: 'Posture', specificMuscles: ['musculus rectus abdominis'] },
      { ...starterExercises[1]!, id: 'general-core', group: 'General', specificMuscles: ['musculus gluteus maximus'] },
    ]

    // Act
    const filtered = filterExercises(exercises, '', 'All', 'All', 'All', false, 'musculus rectus abdominis', 'Posture')
    const unfiltered = filterExercises(exercises, '', 'All', 'All', 'All', false, 'All', 'All')

    // Assert
    expect(filtered.map((exercise) => exercise.id)).toEqual(['posture-core'])
    expect(unfiltered.map((exercise) => exercise.id)).toEqual(['posture-core', 'general-core'])
  })

  it('gives each favorite exercise twice the random-selection weight', () => {
    // Arrange
    const favorite = { ...starterExercises[0]!, id: 'favorite-candidate', isFavorite: true }
    const nonFavorite = { ...starterExercises[1]!, id: 'nonfavorite-candidate', isFavorite: false }
    const group = {
      ...starterRoutineGroups[0]!,
      goal: 'All',
      muscle: 'All',
      specificMuscle: 'All',
      count: 1,
    }

    // Act
    const selections = [0.1, 0.5, 0.7].map((randomValue) => (
      selectRandomExercises([favorite, nonFavorite], group, () => randomValue)[0]?.id
    ))

    // Assert — favorite occupies the first two thirds of the weighted interval.
    expect(selections).toEqual(['favorite-candidate', 'favorite-candidate', 'nonfavorite-candidate'])
  })

  it('selects and filters one exercise for every arbitrary value in its type array', () => {
    // Arrange — the exercise deliberately uses values outside the original two-type model.
    const exercise = multiTypeExercise()
    const exercises = [exercise, { ...starterExercises[1]!, id: 'strength-only-decoy' }]
    const groups = (['Mobility', 'Coordination', 'Stretch'] as const).map((type) => ({
      ...starterRoutineGroups[0]!,
      id: `group-${type}`,
      type,
      count: 1,
    }))

    // Act — use each type as both a routine-group selector and a library filter.
    const selected = groups.map((group) => selectRandomExercises(exercises, group, () => 0))
    const filtered = groups.map((group) => filterExercises(exercises, '', group.type, 'All', 'All', false))
    const unmatchedSelection = selectRandomExercises(exercises, {
      ...groups[0]!,
      type: 'Balance',
    }, () => 0)
    const unmatchedFilter = filterExercises(exercises, '', 'Balance', 'All', 'All', false)

    // Assert — every declared type matches, while an undeclared type matches neither operation.
    expect(selected.map((matches) => matches.map((candidate) => candidate.id))).toEqual([
      ['multi-type-exercise'],
      ['multi-type-exercise'],
      ['multi-type-exercise'],
    ])
    expect(filtered.map((matches) => matches.map((candidate) => candidate.id))).toEqual([
      ['multi-type-exercise'],
      ['multi-type-exercise'],
      ['multi-type-exercise'],
    ])
    expect(unmatchedSelection).toEqual([])
    expect(unmatchedFilter).toEqual([])
  })

  it('matches any selected type, muscle group, or specific muscle', () => {
    // Arrange
    const strengthCandidate = {
      ...starterExercises[0]!,
      id: 'strength-candidate',
      types: ['Strength'],
      muscles: ['Core'],
      specificMuscles: ['specific-core'],
    }
    const stretchCandidate = {
      ...starterExercises[10]!,
      id: 'stretch-candidate',
      type: 'Stretch',
      types: ['Stretch'],
      muscles: ['Chest'],
      specificMuscles: ['specific-chest'],
    }
    const decoy = {
      ...starterExercises[1]!,
      id: 'decoy-candidate',
      muscles: ['Back'],
      specificMuscles: ['specific-back'],
    }
    const group = {
      ...starterRoutineGroups[0]!,
      types: ['Strength', 'Stretch'] as [string, ...string[]],
      muscles: ['Core', 'Chest'],
      specificMuscles: ['specific-core', 'specific-chest'],
      count: 2,
    }

    // Act
    const selected = selectRandomExercises([strengthCandidate, stretchCandidate, decoy], group, () => 0)

    // Assert
    expect(selected).toHaveLength(2)
    expect(selected.map((exercise) => exercise.id)).toEqual(expect.arrayContaining([
      'strength-candidate',
      'stretch-candidate',
    ]))
  })

  it('filters routine exercises and target muscles by goal as well as type', () => {
    // Arrange
    const exercises = [
      { ...starterExercises[0]!, id: 'kyphosis-exercise', group: 'Hunched shoulders / thoracic kyphosis', muscles: ['Thoracic extensors'] },
      { ...starterExercises[1]!, id: 'general-exercise', group: 'General', muscles: ['Core'] },
    ]
    const group = {
      ...starterRoutineGroups[0]!,
      goal: 'Hunched shoulders / thoracic kyphosis',
      muscle: 'Thoracic extensors',
      count: 1,
    }

    // Act
    const selected = selectRandomExercises(exercises, group, () => 0)

    // Assert
    expect(getGoals(exercises, 'Strength')).toEqual(['General', 'Hunched shoulders / thoracic kyphosis'])
    expect(getTargetMuscles(exercises, 'Strength', group.goal)).toEqual(['Thoracic extensors'])
    expect(selected.map((exercise) => exercise.id)).toEqual(['kyphosis-exercise'])
  })

  it('returns sorted unique muscles and tags, including an empty result', () => {
    // Arrange
    const exercises = [
      { ...starterExercises[0]!, muscles: ['Core', 'Arms'], tags: ['stability', 'core'] },
      { ...starterExercises[1]!, muscles: ['Core', 'Back'], tags: ['core', 'strength'] },
    ]

    // Act and Assert
    expect(getTargetMuscles(exercises)).toEqual(['Arms', 'Back', 'Core'])
    expect(getTags(exercises)).toEqual(['core', 'stability', 'strength'])
    expect(getTags([])).toEqual([])
  })

  it('filters and lists specific muscles independently from muscle groups', () => {
    const exercises = [
      { ...starterExercises[0]!, specificMuscles: ['musculus rectus abdominis'] },
      { ...starterExercises[1]!, specificMuscles: ['musculus gluteus maximus'] },
    ]

    expect(getSpecificMuscles(exercises)).toEqual([
      'musculus gluteus maximus',
      'musculus rectus abdominis',
    ])
    expect(filterExercises(exercises, '', 'All', 'Core', 'All', false, 'musculus rectus abdominis'))
      .toEqual([exercises[0]])
  })

  it('synchronizes favorite state across canonical and duplicated snapshots immutably', () => {
    // Arrange
    const favoriteExercise = starterExercises.find((exercise) => exercise.id === 'dead-bug')!
    const unrelatedExercise = starterExercises.find((exercise) => exercise.id === 'plank')!
    const routine = {
      id: 'routine-1',
      name: 'Saved routine',
      selections: [
        { ...starterRoutineGroups[0]!, count: 1, exercises: [favoriteExercise] },
        { ...starterRoutineGroups[1]!, count: 1, exercises: [unrelatedExercise] },
      ],
    }
    const session = {
      scheduleEntryId: 'schedule-1',
      occurrenceDate: '2026-10-21',
      routineId: routine.id,
      selections: routine.selections.map((selection) => ({
        ...selection,
        exercises: selection.exercises.map((exercise) => ({
          ...exercise,
          muscles: [...exercise.muscles],
          instructions: [...exercise.instructions],
          steps: [...exercise.steps],
          commonErrors: exercise.commonErrors.map((pair) => ({ ...pair })),
          tags: [...exercise.tags],
        })),
      })),
    }
    const state = {
      exercises: starterExercises,
      routines: [routine],
      schedule: [],
      reminders: { enabled: false, time: '09:00', notificationCapability: 'unsupported' as const },
      generatedSessions: [session],
    }

    // Act
    const next = updateExerciseFavorite(state, 'dead-bug', true)

    // Assert
    expect(next.exercises.find((exercise) => exercise.id === 'dead-bug')?.isFavorite).toBe(true)
    expect(next.routines[0]?.selections[0]?.exercises.find((exercise) => exercise.id === 'dead-bug')?.isFavorite).toBe(true)
    expect(next.generatedSessions?.[0]?.selections[0]?.exercises.find((exercise) => exercise.id === 'dead-bug')?.isFavorite).toBe(true)
    expect(state.exercises.find((exercise) => exercise.id === 'dead-bug')?.isFavorite).toBe(false)
    expect(next).not.toBe(state)
    expect(next.exercises[1]).toBe(state.exercises[1])
    expect(next.routines[0]?.selections[1]).toBe(state.routines[0]?.selections[1])
    expect(next.generatedSessions?.[0]?.selections[1]).toBe(state.generatedSessions?.[0]?.selections[1])
    expect(toggleExerciseFavorite(next, 'dead-bug').exercises.find((exercise) => exercise.id === 'dead-bug')?.isFavorite).toBe(false)
  })

  it('synchronizes favorites without dropping arbitrary type values from snapshots', () => {
    // Arrange — canonical, saved-routine, and generated-session copies share a multi-type exercise.
    const favoriteExercise = multiTypeExercise({ isFavorite: false })
    const routine = {
      id: 'multi-type-routine',
      name: 'Multi-type routine',
      selections: [{ ...starterRoutineGroups[0]!, count: 1, exercises: [favoriteExercise] }],
    }
    const session = {
      scheduleEntryId: 'multi-type-schedule',
      occurrenceDate: '2026-10-21',
      routineId: routine.id,
      selections: routine.selections.map((selection) => ({
        ...selection,
        exercises: selection.exercises.map((exercise) => ({
          ...exercise,
          types: [...exercise.types!],
        })),
      })),
    }
    const state = {
      exercises: [favoriteExercise],
      routines: [routine],
      schedule: [],
      reminders: { enabled: false, time: '09:00', notificationCapability: 'unsupported' as const },
      generatedSessions: [session],
    }

    // Act
    const next = updateExerciseFavorite(state, favoriteExercise.id, true)

    // Assert — favorite propagation preserves all type values and leaves the input unchanged.
    expect(next.exercises[0]).toMatchObject({ isFavorite: true, types: ['Mobility', 'Coordination', 'Stretch'] })
    expect(next.routines[0]?.selections[0]?.exercises[0])
      .toMatchObject({ isFavorite: true, types: ['Mobility', 'Coordination', 'Stretch'] })
    expect(next.generatedSessions?.[0]?.selections[0]?.exercises[0])
      .toMatchObject({ isFavorite: true, types: ['Mobility', 'Coordination', 'Stretch'] })
    expect(state.exercises[0]?.isFavorite).toBe(false)
    expect(state.exercises[0]?.types).toEqual(['Mobility', 'Coordination', 'Stretch'])
  })
})

describe('routine regeneration', () => {
  it('regenerates only the requested group and preserves the others', () => {
    // Arrange
    const current = createRoutine(starterExercises, starterRoutineGroups, () => 0)
    const random = () => 1
    const requestedGroup = starterRoutineGroups[1]!

    // Act
    const result = regenerateRoutineGroups(current, starterExercises, 'squats', random)

    // Assert
    expect(result[1]?.exercises).toEqual(selectRandomExercises(starterExercises, requestedGroup, random))
    expect(result).not.toBe(current)
    expect(result[0]).toBe(current[0])
    expect(result[2]).toBe(current[2])
    expect(result[1]).not.toBe(current[1])
  })

  it('regenerates every group when no group ID is supplied', () => {
    // Arrange
    const current = createRoutine(starterExercises, starterRoutineGroups, () => 0)

    // Act
    const result = regenerateRoutineGroups(current, starterExercises, undefined, () => 1)

    // Assert
    expect(result).toHaveLength(current.length)
    result.forEach((group, index) => expect(group).not.toBe(current[index]))
  })

  it('updates one group configuration and regenerates only that group', () => {
    // Arrange
    const current = createRoutine(starterExercises, starterRoutineGroups, () => 0)

    // Act
    const result = updateRoutineGroup(current, starterExercises, 'core', { muscle: 'Shoulders', count: 1 }, () => 0)

    // Assert
    expect(result[0]).toMatchObject({ muscle: 'Shoulders', count: 1 })
    expect(result[0]?.exercises).toHaveLength(1)
    expect(result[1]).toBe(current[1])
    expect(result[2]).toBe(current[2])
  })

  it('renames a group without replacing its selected exercises', () => {
    // Arrange
    const current = createRoutine(starterExercises, starterRoutineGroups, () => 0)

    // Act
    const result = updateRoutineGroup(current, starterExercises, 'core', { label: 'Core reset' })

    // Assert
    expect(result[0]?.label).toBe('Core reset')
    expect(result[0]?.exercises).toBe(current[0]?.exercises)
  })

  it('falls back to a valid target muscle when the exercise type changes', () => {
    // Arrange
    const current = createRoutine(starterExercises, starterRoutineGroups, () => 0)

    // Act
    const result = updateRoutineGroup(current, starterExercises, 'core', { type: 'Stretch' }, () => 0)

    // Assert
    expect(result[0]?.muscle).toBe('All')
    expect(result[0]?.type).toBe('Stretch')
    expect(result[0]?.exercises.every((exercise) => exercise.type === 'Stretch')).toBe(true)
  })

  it('updates the target muscle when the selected goal changes', () => {
    // Arrange
    const exercises = [
      { ...starterExercises[0]!, id: 'upper-goal', group: 'Upper body', muscles: ['Shoulders'] },
      { ...starterExercises[1]!, id: 'lower-goal', group: 'Lower body', muscles: ['Hips'] },
    ]
    const current = createRoutine(exercises, [{ ...starterRoutineGroups[0]!, muscle: 'Shoulders' }], () => 0)

    // Act
    const result = updateRoutineGroup(current, exercises, current[0]!.id, {
      goal: 'Lower body',
    }, () => 0)

    // Assert
    expect(result[0]).toMatchObject({ goal: 'Lower body', muscle: 'All' })
    expect(result[0]?.exercises.map((exercise) => exercise.id)).toEqual(['lower-goal'])
  })

  it('creates new focus areas with no goal or muscle filters applied', () => {
    // Arrange
    const exercises = starterExercises

    // Act
    const result = createRoutineGroup('new-focus', exercises, [], () => 0)

    // Assert
    expect(result).toMatchObject({ goal: 'All', muscle: 'All', specificMuscle: 'All' })
    expect(result.exercises).toHaveLength(3)
  })
})

describe('custom exercise IDs', () => {
  it('adds a suffix when an injected ID collides with an existing exercise', () => {
    expect(createUniqueExerciseId(new Set(['custom-fixed', 'custom-fixed-2']), () => 'custom-fixed'))
      .toBe('custom-fixed-3')
  })
})

describe('generated workout sessions', () => {
  it('generates concrete selections from saved group configuration', () => {
    // Arrange
    const routine = {
      id: 'routine-1',
      name: 'Saved routine',
      selections: [
        {
          ...starterRoutineGroups[0]!,
          exercises: [starterExercises.find((exercise) => exercise.id === 'doorway-chest')!],
        },
        {
          ...starterRoutineGroups[1]!,
          type: 'Stretch' as const,
          muscle: 'Chest',
          count: 1,
          exercises: [],
        },
      ],
    }

    // Act
    const result = generateWorkoutSession(
      starterExercises,
      routine,
      'schedule-1',
      '2026-10-21',
      () => 0.5,
    )

    // Assert
    expect(result).toMatchObject({
      scheduleEntryId: 'schedule-1',
      occurrenceDate: '2026-10-21',
      routineId: 'routine-1',
    })
    expect(result.selections[0]?.exercises.map((exercise) => exercise.id))
      .toEqual(['dead-bug', 'plank', 'hollow-hold'])
    expect(result.selections[1]?.exercises.map((exercise) => exercise.id)).toEqual(['doorway-chest'])
    expect(result.selections[0]).toMatchObject({
      label: starterRoutineGroups[0]!.label,
      detail: starterRoutineGroups[0]!.detail,
      type: 'Strength',
      muscle: 'All',
      count: 3,
    })
  })

  it('is deterministic with injected randomness and does not mutate its inputs', () => {
    // Arrange
    const routine = {
      id: 'routine-1',
      name: 'Saved routine',
      selections: createRoutine(starterExercises, starterRoutineGroups, () => 0),
    }
    const exercisesBefore = structuredClone(starterExercises)
    const routineBefore = structuredClone(routine)
    const random = () => 0.5

    // Act
    const first = generateWorkoutSession(starterExercises, routine, 'schedule-1', '2026-10-21', random)
    const second = generateWorkoutSession(starterExercises, routine, 'schedule-1', '2026-10-21', random)

    // Assert
    expect(second).toEqual(first)
    expect(starterExercises).toEqual(exercisesBefore)
    expect(routine).toEqual(routineBefore)
    expect(first.selections).not.toBe(routine.selections)
    expect(first.selections[0]).not.toBe(routine.selections[0])
    expect(first.selections[0]?.exercises).not.toBe(routine.selections[0]?.exercises)
  })

  it('returns no invalid exercise references when a group has no matches', () => {
    // Arrange
    const routine = {
      id: 'routine-1',
      name: 'Saved routine',
      selections: [{
        ...starterRoutineGroups[0]!,
        muscle: 'Unknown muscle',
        exercises: [starterExercises[0]!],
      }],
    }

    // Act
    const result = generateWorkoutSession(starterExercises, routine, 'schedule-1', '2026-10-21', () => 0)

    // Assert
    expect(result.selections[0]?.exercises).toEqual([])
    expect(result.selections[0]).toMatchObject({
      id: routine.selections[0]!.id,
      type: routine.selections[0]!.type,
      muscle: 'Unknown muscle',
      count: routine.selections[0]!.count,
    })
  })

  it('keeps every arbitrary type when cloning routine selections into a workout snapshot', () => {
    // Arrange — the saved group selects a non-primary type from a multi-valued exercise.
    const exercise = multiTypeExercise()
    const routine = {
      id: 'multi-type-workout',
      name: 'Multi-type workout',
      selections: [{
        ...starterRoutineGroups[0]!,
        type: 'Coordination',
        count: 1,
        exercises: [],
      }],
    }

    // Act — generate the concrete selection from the canonical exercise collection.
    const snapshot = generateWorkoutSession(
      [exercise],
      routine,
      'multi-type-schedule',
      '2026-10-21',
      () => 0,
    )

    // Assert — the snapshot contains the full ordered type list and fresh selection containers.
    expect(snapshot.selections[0]?.exercises[0]?.types)
      .toEqual(['Mobility', 'Coordination', 'Stretch'])
    expect(snapshot.selections).not.toBe(routine.selections)
    expect(snapshot.selections[0]).not.toBe(routine.selections[0])
    expect(snapshot.selections[0]?.exercises).not.toBe(routine.selections[0]?.exercises)
  })
})
