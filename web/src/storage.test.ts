import { describe, expect, it } from 'vitest'
import { allExercises, exerciseLibrary, starterExercises, starterRoutineGroups } from './data'
import {
  CURRENT_STORAGE_VERSION,
  LEGACY_EXERCISES_KEY,
  LEGACY_ROUTINE_KEY,
  PREVIOUS_STORAGE_VERSION,
  STORAGE_KEY,
  STORAGE_BACKUP_KEY,
  createDefaultStorageState,
  createStorageAdapter,
  getOrCreateWorkoutSession,
  isExercise,
  migrateStorage,
  readStorage,
  writeStorage,
  type StorageLike,
} from './storage'
import type { Exercise, FitnessStorageState, GeneratedWorkoutSession } from './types'

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

const createSession = (
  state: FitnessStorageState,
  scheduleEntryId: string,
  occurrenceDate: string,
): GeneratedWorkoutSession => ({
  scheduleEntryId,
  occurrenceDate,
  routineId: state.routines[0]!.id,
  selections: state.routines[0]!.selections.map((selection) => ({
    ...selection,
    exercises: selection.exercises.map((exercise) => ({
      ...exercise,
      muscles: [...exercise.muscles],
      instructions: [...exercise.instructions],
    })),
  })),
})

describe('versioned storage', () => {
  it('starts with an empty app library and exercise-free default routine selections', () => {
    const state = createDefaultStorageState()

    expect(exerciseLibrary).toEqual([])
    expect(allExercises).toEqual([])
    expect(state.exercises).toEqual([])
    expect(state.routines[0]?.selections.every((selection) => selection.exercises.length === 0)).toBe(true)
  })

  it('ships starter exercises with complete descriptive metadata', () => {
    expect(starterExercises.length).toBeGreaterThan(0)
    starterExercises.forEach((exercise) => {
      expect(exercise.purpose).not.toBe('')
      expect(exercise.specificMuscles.length).toBeGreaterThan(0)
      expect(exercise.equipmentAndEnvironment).not.toBe('')
      expect(exercise.startingPosition).not.toBe('')
      expect(exercise.rangeAndDirection).not.toBe('')
      expect(exercise.breathing).not.toBe('')
      expect(exercise.beginnerDoseAndRest).not.toBe('')
      expect(exercise.expectedSensation).not.toBe('')
      expect(exercise.regression).not.toBe('')
      expect(exercise.progression).not.toBe('')
      expect(exercise.group).toBe('General')
      expect(exercise).not.toHaveProperty('evidenceCategory')
      expect(exercise).not.toHaveProperty('evidenceStrength')
      expect(exercise).not.toHaveProperty('sources')
    })
  })

  it('drops legacy exercises while retaining the legacy routine groups', () => {
    const storage = new MemoryStorage()
    const legacyExercise = { ...starterExercises[0], instructions: [...starterExercises[0].instructions] }
    const legacySelection = {
      ...starterRoutineGroups[0],
      exercises: [legacyExercise],
    }
    storage.setItem(LEGACY_EXERCISES_KEY, JSON.stringify([legacyExercise]))
    storage.setItem(LEGACY_ROUTINE_KEY, JSON.stringify([legacySelection]))

    const envelope = migrateStorage(storage)
    const persisted = JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}') as Record<string, unknown>

    expect(envelope.version).toBe(CURRENT_STORAGE_VERSION)
    expect(envelope.data.exercises).toEqual([])
    expect(envelope.data.routines[0]?.selections[0]?.exercises).toEqual([])
    expect(persisted.version).toBe(CURRENT_STORAGE_VERSION)
  })

  it('migrates a version-1 envelope to an empty generated-session collection', () => {
    const storage = new MemoryStorage()
    const state = createDefaultStorageState()
    state.generatedSessions = undefined
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, data: state }))

    const migrated = migrateStorage(storage)

    expect(migrated.version).toBe(CURRENT_STORAGE_VERSION)
    expect(migrated.data.generatedSessions).toEqual([])
    expect(migrated.data.routines).toEqual(state.routines)
    expect(migrated.data.schedule).toEqual(state.schedule)
  })

  it('does not restore exercises from legacy records', () => {
    const storage = new MemoryStorage()
    const legacyExercise = {
      ...starterExercises[0],
      instructions: ['Brace your core.', 'Move slowly.'],
    }
    delete (legacyExercise as Partial<typeof legacyExercise>).steps
    delete (legacyExercise as Partial<typeof legacyExercise>).commonErrors
    delete (legacyExercise as Partial<typeof legacyExercise>).tags
    delete (legacyExercise as Partial<typeof legacyExercise>).isFavorite
    storage.setItem(LEGACY_EXERCISES_KEY, JSON.stringify([legacyExercise]))

    const state = readStorage(storage)

    expect(state.exercises).toEqual([])
  })

  it('does not restore legacy records missing descriptive fields', () => {
    const storage = new MemoryStorage()
    const legacyExercise = { ...starterExercises[0] }
    delete (legacyExercise as Partial<typeof legacyExercise>).purpose
    delete (legacyExercise as Partial<typeof legacyExercise>).specificMuscles
    delete (legacyExercise as Partial<typeof legacyExercise>).equipmentAndEnvironment
    delete (legacyExercise as Partial<typeof legacyExercise>).startingPosition
    delete (legacyExercise as Partial<typeof legacyExercise>).rangeAndDirection
    delete (legacyExercise as Partial<typeof legacyExercise>).breathing
    delete (legacyExercise as Partial<typeof legacyExercise>).beginnerDoseAndRest
    delete (legacyExercise as Partial<typeof legacyExercise>).expectedSensation
    delete (legacyExercise as Partial<typeof legacyExercise>).regression
    delete (legacyExercise as Partial<typeof legacyExercise>).progression
    storage.setItem(LEGACY_EXERCISES_KEY, JSON.stringify([legacyExercise]))

    expect(readStorage(storage).exercises).toEqual([])
  })

  it('clears routine and generated-session exercise snapshots during migration', () => {
    // Arrange
    const storage = new MemoryStorage()
    const state = createDefaultStorageState()
    const legacyExercise = { ...starterExercises[0]!, instructions: ['Brace your core.', 'Move slowly.'] }
    delete (legacyExercise as Partial<typeof legacyExercise>).steps
    delete (legacyExercise as Partial<typeof legacyExercise>).commonErrors
    delete (legacyExercise as Partial<typeof legacyExercise>).tags
    delete (legacyExercise as Partial<typeof legacyExercise>).isFavorite
    const selection = { ...state.routines[0]!.selections[0]!, exercises: [legacyExercise] }
    const legacyState = {
      ...state,
      exercises: [legacyExercise],
      routines: [{ ...state.routines[0]!, selections: [selection] }],
      generatedSessions: [{
        scheduleEntryId: 'schedule-1',
        occurrenceDate: '2026-11-15',
        routineId: state.routines[0]!.id,
        selections: [selection],
      }],
    }
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: PREVIOUS_STORAGE_VERSION, data: legacyState }))

    // Act
    const migrated = readStorage(storage)

    // Assert
    expect(migrated.exercises).toEqual([])
    expect(migrated.routines[0]?.selections[0]?.exercises).toEqual([])
    expect(migrated.generatedSessions?.[0]?.selections[0]?.exercises).toEqual([])
  })

  it('repairs malformed metadata entries to an empty exercise library', () => {
    const storage = new MemoryStorage()
    const exercise = {
      ...starterExercises[0],
      muscles: ['Core', 42],
      steps: ['Brace your core.', false],
      instructions: ['Brace your core.'],
      commonErrors: [
        { error: 'Rounded back', correction: 42 },
        { error: 'Holding breath', correction: 'Breathe steadily.' },
      ],
      tags: ['stability', null],
      isFavorite: 'yes',
    }
    storage.setItem(LEGACY_EXERCISES_KEY, JSON.stringify([exercise]))

    const state = readStorage(storage)

    expect(state.exercises).toEqual([])
  })

  it('filters malformed legacy records without restoring exercise data', () => {
    const storage = new MemoryStorage()
    const validExercise = { ...starterExercises[1], muscles: [...starterExercises[1].muscles] }
    storage.setItem(LEGACY_EXERCISES_KEY, JSON.stringify([
      { id: 'broken', name: 12 },
      validExercise,
    ]))

    const state = readStorage(storage)

    expect(state.exercises).toEqual([])
  })

  it('uses defaults for malformed and unsupported envelopes', () => {
    const storage = new MemoryStorage()
    const malformedEnvelope = '{not-json'
    storage.setItem(STORAGE_KEY, malformedEnvelope)

    const malformedState = readStorage(storage)
    expect(malformedState).toEqual(createDefaultStorageState())
    expect(storage.getItem(STORAGE_BACKUP_KEY)).toBe(malformedEnvelope)

    const unsupportedEnvelope = JSON.stringify({ version: 99, data: createDefaultStorageState() })
    storage.setItem(STORAGE_KEY, unsupportedEnvelope)
    const unsupportedState = readStorage(storage)
    expect(unsupportedState).toEqual(createDefaultStorageState())
    expect(storage.getItem(STORAGE_BACKUP_KEY)).toBe(unsupportedEnvelope)
  })

  it('backs up a future envelope while preserving compatible sections', () => {
    const storage = new MemoryStorage()
    const futureState = createDefaultStorageState()
    futureState.exercises = [{ ...starterExercises[1], muscles: [...starterExercises[1].muscles] }]
    futureState.schedule = [{
      id: 'future-schedule',
      day: 'friday',
      time: '07:15',
      routineId: futureState.routines[0].id,
    }]
    futureState.reminders = { enabled: true, time: '07:15', notificationCapability: 'default' }
    const futureEnvelope = JSON.stringify({ version: CURRENT_STORAGE_VERSION + 1, data: futureState })
    storage.setItem(STORAGE_KEY, futureEnvelope)

    const repaired = migrateStorage(storage)

    expect(repaired.data.exercises).toEqual([])
    expect(repaired.data.routines).toEqual(futureState.routines)
    expect(repaired.data.schedule).toEqual(futureState.schedule)
    expect(repaired.data.reminders).toEqual(futureState.reminders)
    expect(storage.getItem(STORAGE_BACKUP_KEY)).toBe(futureEnvelope)
    expect(JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}')).toEqual({
      version: CURRENT_STORAGE_VERSION,
      data: repaired.data,
      exerciseLibraryPurged: true,
    })
  })

  it('preserves valid records independently when current sections are partially malformed', () => {
    const storage = new MemoryStorage()
    const defaults = createDefaultStorageState()
    const preservedExercise = { ...starterExercises[0], instructions: [...starterExercises[0].instructions] }
    const preservedRoutine = {
      ...defaults.routines[0],
      selections: defaults.routines[0].selections.map((selection) => ({
        ...selection,
        exercises: selection.exercises.map((exercise) => ({
          ...exercise,
          muscles: [...exercise.muscles],
          instructions: [...exercise.instructions],
        })),
      })),
    }
    const preservedSchedule = {
      id: 'preserved-schedule',
      day: 'monday' as const,
      time: '08:00',
      routineId: preservedRoutine.id,
    }
    const partialEnvelope = JSON.stringify({
      version: CURRENT_STORAGE_VERSION,
      data: {
        exercises: [preservedExercise, { id: 'broken-exercise' }],
        routines: [preservedRoutine, { id: 'broken-routine' }],
        schedule: [preservedSchedule, { id: 'broken-schedule' }],
        reminders: { enabled: 'yes', time: 'not-a-time', notificationCapability: 'unknown' },
      },
    })
    storage.setItem(STORAGE_KEY, partialEnvelope)

    const repaired = migrateStorage(storage)

    expect(repaired.data.exercises).toEqual([])
    expect(repaired.data.routines).toEqual([preservedRoutine])
    expect(repaired.data.schedule).toEqual([preservedSchedule])
    expect(repaired.data.reminders).toEqual(defaults.reminders)
    expect(storage.getItem(STORAGE_BACKUP_KEY)).toBe(partialEnvelope)
  })

  it('clears built-in and user-added exercises from an existing envelope', () => {
    // Arrange
    const storage = new MemoryStorage()
    const defaults = createDefaultStorageState()
    const preservedStarter = {
      ...starterExercises[0],
      isFavorite: true,
      muscles: [...starterExercises[0].muscles],
      instructions: [...starterExercises[0].instructions],
      steps: [...starterExercises[0].steps],
      tags: [...starterExercises[0].tags],
    }
    const customExercise = {
      ...starterExercises[1],
      id: 'custom-user-exercise',
      name: 'My custom exercise',
      muscles: [...starterExercises[1].muscles],
      instructions: [...starterExercises[1].instructions],
      steps: [...starterExercises[1].steps],
      tags: [...starterExercises[1].tags],
    }
    const storedState = {
      ...defaults,
      exercises: [preservedStarter, customExercise],
    }
    storage.setItem(STORAGE_KEY, JSON.stringify({
      version: CURRENT_STORAGE_VERSION,
      data: storedState,
    }))

    // Act
    const migrated = migrateStorage(storage)

    // Assert
    expect(migrated.data.exercises).toEqual([])
    expect(JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}').data.exercises).toEqual([])
  })

  it('clears nested routine and generated-session snapshots while preserving metadata', () => {
    const storage = new MemoryStorage()
    const exercise = starterExercises[0]!
    const defaults = createDefaultStorageState()
    const selection = { ...defaults.routines[0]!.selections[0]!, exercises: [exercise] }
    const state: FitnessStorageState = {
      ...defaults,
      exercises: [exercise, { ...exercise, id: 'custom-user-exercise' }],
      routines: [{
        ...defaults.routines[0]!,
        name: 'Preserved routine',
        selections: [selection],
      }],
      schedule: [{ id: 'assignment', day: 'monday', time: '08:00', routineId: defaults.routines[0]!.id }],
      reminders: { enabled: true, time: '07:30', notificationCapability: 'default' },
      generatedSessions: [{
        scheduleEntryId: 'assignment',
        occurrenceDate: '2026-11-16',
        routineId: defaults.routines[0]!.id,
        selections: [selection],
      }],
    }
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: CURRENT_STORAGE_VERSION, data: state }))

    const migrated = migrateStorage(storage).data

    expect(migrated.exercises).toEqual([])
    expect(migrated.routines[0]).toMatchObject({ name: 'Preserved routine' })
    expect(migrated.routines[0]?.selections[0]?.exercises).toEqual([])
    expect(migrated.schedule).toEqual(state.schedule)
    expect(migrated.reminders).toEqual(state.reminders)
    expect(migrated.generatedSessions?.[0]?.selections[0]?.exercises).toEqual([])
  })

  it('filters malformed sessions while preserving valid session exercises and state sections', () => {
    const storage = new MemoryStorage()
    const state = createDefaultStorageState()
    const exercise = starterExercises[0]!
    state.exercises = [exercise]
    state.routines = [{
      ...state.routines[0]!,
      selections: [{ ...state.routines[0]!.selections[0]!, exercises: [exercise] }],
    }]
    const validSession = createSession(state, 'schedule-1', '2026-10-21')
    const selection = validSession.selections[0]!
    const malformedExerciseSession = {
      ...validSession,
      scheduleEntryId: 'schedule-2',
      occurrenceDate: '2026-10-22',
      selections: [{
        ...selection,
        exercises: [selection.exercises[0], { id: 'broken' }],
      }],
    }
    storage.setItem(STORAGE_KEY, JSON.stringify({
      version: CURRENT_STORAGE_VERSION,
      data: {
        ...state,
        generatedSessions: [validSession, malformedExerciseSession, { occurrenceDate: 'bad' }],
      },
    }))

    const repaired = migrateStorage(storage)

    expect(repaired.data.generatedSessions).toHaveLength(2)
    expect(repaired.data.generatedSessions?.[0]?.selections[0]?.exercises).toEqual([])
    expect(repaired.data.generatedSessions?.[1]?.selections[0]?.exercises).toEqual([])
    expect(repaired.data.routines[0]?.selections[0]?.exercises).toEqual([])
    expect(repaired.data.exercises).toEqual([])
    expect(repaired.data.schedule).toEqual(state.schedule)
    expect(repaired.data.reminders).toEqual(state.reminders)
  })

  it('reuses an occurrence session and generates only for a new occurrence key', () => {
    const storage = new MemoryStorage()
    const adapter = createStorageAdapter(storage)
    const state = createDefaultStorageState()
    state.exercises = [starterExercises[0]!]
    const firstSession = createSession(state, 'schedule-1', '2026-10-21')
    const nextSession = createSession(state, 'schedule-1', '2026-10-28')
    let generationCount = 0

    const first = getOrCreateWorkoutSession(adapter, {
      scheduleEntryId: firstSession.scheduleEntryId,
      occurrenceDate: firstSession.occurrenceDate,
    }, () => {
      generationCount += 1
      return firstSession
    })
    const reused = getOrCreateWorkoutSession(
      adapter,
      firstSession.scheduleEntryId,
      firstSession.occurrenceDate,
      () => {
        generationCount += 1
        return nextSession
      },
    )
    const later = getOrCreateWorkoutSession(adapter, {
      scheduleEntryId: nextSession.scheduleEntryId,
      occurrenceDate: nextSession.occurrenceDate,
    }, () => {
      generationCount += 1
      return nextSession
    })

    expect(first).toEqual(firstSession)
    expect(reused).toEqual(firstSession)
    expect(later).toEqual(nextSession)
    expect(generationCount).toBe(2)
    expect(adapter.read().generatedSessions).toEqual([firstSession, nextSession])
  })

  it('returns failure and preserves the prior state when a session write fails', () => {
    const state = createDefaultStorageState()
    const adapter = {
      read: () => state,
      write: () => false,
    }
    const session = createSession(state, 'schedule-1', '2026-10-21')

    const result = getOrCreateWorkoutSession(adapter, {
      scheduleEntryId: session.scheduleEntryId,
      occurrenceDate: session.occurrenceDate,
    }, () => session)

    expect(result).toBeNull()
    expect(state.generatedSessions).toEqual([])
  })

  it('returns independent state snapshots and writes only validated state', () => {
    const storage = new MemoryStorage()
    const adapter = createStorageAdapter(storage)
    const state = createDefaultStorageState()
    state.exercises = [starterExercises[0]!]

    expect(adapter.write(state)).toBe(true)
    const snapshot = adapter.read()
    snapshot.exercises[0].muscles.push('Changed')
    snapshot.reminders.enabled = true
    snapshot.reminders.time = '10:30'

    const nextSnapshot = adapter.read()
    expect(nextSnapshot.exercises[0].muscles).not.toContain('Changed')
    expect(nextSnapshot.reminders.enabled).toBe(false)
    const invalidState = {
      ...state,
      reminders: { enabled: true, time: '10:30', notificationCapability: 'invalid' },
    } as unknown as FitnessStorageState
    expect(writeStorage(invalidState, storage)).toBe(false)
  })

  it('round-trips a newly added exercise with structured fields', () => {
    // Arrange
    const storage = new MemoryStorage()
    const state = createDefaultStorageState()
    const customExercise = { ...starterExercises[0]!, id: 'custom-round-trip', types: ['Strength'] as [string, ...string[]] }
    state.exercises = [customExercise]

    // Act
    const didWrite = writeStorage(state, storage)
    const roundTripped = readStorage(storage)

    // Assert — serialization must not drop a newly added record or its structured fields.
    expect(didWrite).toBe(true)
    expect(roundTripped.exercises).toEqual([customExercise])
    expect(isExercise(roundTripped.exercises[0])).toBe(true)
  })

  it('preserves multi-select routine filters while keeping legacy scalar fields', () => {
    // Arrange
    const storage = new MemoryStorage()
    const state = createDefaultStorageState()
    const selection = state.routines[0]!.selections[0]!
    state.routines[0] = {
      ...state.routines[0]!,
      selections: [{
        ...selection,
        type: 'Strength',
        types: ['Strength', 'Stretch'],
        muscle: 'Core',
        muscles: ['Core', 'Chest'],
        specificMuscle: 'musculus transversus abdominis',
        specificMuscles: ['musculus transversus abdominis', 'musculus pectoralis major'],
      }],
    }

    // Act
    expect(writeStorage(state, storage)).toBe(true)
    const roundTripped = readStorage(storage)

    // Assert
    expect(roundTripped.routines[0]?.selections[0]).toMatchObject({
      type: 'Strength',
      types: ['Strength', 'Stretch'],
      muscle: 'Core',
      muscles: ['Core', 'Chest'],
      specificMuscle: 'musculus transversus abdominis',
      specificMuscles: ['musculus transversus abdominis', 'musculus pectoralis major'],
    })
  })

  it('normalizes a legacy current-envelope exercise to General and strips evidence fields', () => {
    const storage = new MemoryStorage()
    const legacyExercise = {
      ...starterExercises[0],
      group: undefined,
      evidenceCategory: 'Legacy evidence',
      evidenceStrength: 'Legacy strength',
      sources: ['Legacy source'],
    }
    storage.setItem(STORAGE_KEY, JSON.stringify({
      version: CURRENT_STORAGE_VERSION,
      exerciseLibraryPurged: true,
      data: { ...createDefaultStorageState(), exercises: [legacyExercise] },
    }))

    const migrated = readStorage(storage)

    expect(migrated.exercises[0]).toMatchObject({ id: legacyExercise.id, group: 'General' })
    expect(migrated.exercises[0]).not.toHaveProperty('evidenceCategory')
    expect(migrated.exercises[0]).not.toHaveProperty('evidenceStrength')
    expect(migrated.exercises[0]).not.toHaveProperty('sources')
  })

  it('round-trips arbitrary multi-valued types with deterministic normalization', () => {
    // Arrange — storage receives the type array as an external, user-editable boundary.
    const storage = new MemoryStorage()
    const state = createDefaultStorageState()
    const exercise = {
      ...starterExercises[0]!,
      id: 'multi-type-round-trip',
      type: ' Legacy scalar ',
      types: [' Mobility ', 'Coordination', 'Mobility'] as [string, ...string[]],
    }
    state.exercises = [exercise]

    // Act — persist and read the same state through the versioned storage boundary.
    const didWrite = writeStorage(state, storage)
    const roundTripped = readStorage(storage)
    const persisted = JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}') as {
      data?: { exercises?: Exercise[] }
    }

    // Assert — first occurrence wins, duplicates disappear, and the scalar alias follows it.
    expect(didWrite).toBe(true)
    expect(roundTripped.exercises[0]).toMatchObject({
      id: 'multi-type-round-trip',
      type: 'Mobility',
      types: ['Mobility', 'Coordination'],
    })
    expect(persisted.data?.exercises?.[0]?.types).toEqual(['Mobility', 'Coordination'])
  })

  it('migrates a legacy scalar type into the canonical one-item type array', () => {
    // Arrange — versioned records from before multi-valued types only stored `type`.
    const storage = new MemoryStorage()
    const state = createDefaultStorageState()
    const legacyExercise = { ...starterExercises[0]!, id: 'legacy-scalar-type', type: 'Mobility' }
    delete (legacyExercise as Partial<typeof legacyExercise>).types
    storage.setItem(STORAGE_KEY, JSON.stringify({
      version: CURRENT_STORAGE_VERSION,
      exerciseLibraryPurged: true,
      data: { ...state, exercises: [legacyExercise] },
    }))

    // Act
    const migrated = readStorage(storage)

    // Assert — old records remain readable and are upgraded deterministically.
    expect(migrated.exercises[0]).toMatchObject({
      id: 'legacy-scalar-type',
      type: 'Mobility',
      types: ['Mobility'],
    })
  })

  it('repairs malformed type items by omitting invalid exercises rather than persisting them', () => {
    // Arrange — one record is repairable, while the other has no usable type fallback.
    const storage = new MemoryStorage()
    const state = createDefaultStorageState()
    const validExercise = { ...starterExercises[1]!, id: 'valid-type-record' }
    const repairableExercise = {
      ...starterExercises[0]!,
      id: 'repairable-type-record',
      type: ' Mobility ',
      types: [' Mobility ', 42, '', 'Mobility'],
    } as unknown as Exercise
    const malformedExercise = {
      ...starterExercises[0]!,
      id: 'malformed-type-record',
      type: ' ',
      types: [42, '', null],
    } as unknown as Exercise
    state.exercises = [validExercise, repairableExercise, malformedExercise]

    // Act — normalization occurs before serialization.
    const didWrite = writeStorage(state, storage)
    const persisted = readStorage(storage)

    // Assert — a valid record survives, but no invalid Exercise crosses the storage boundary.
    expect(didWrite).toBe(true)
    expect(persisted.exercises.map((exercise) => exercise.id)).toEqual([
      'valid-type-record',
      'repairable-type-record',
    ])
    expect(persisted.exercises[1]).toMatchObject({
      type: 'Mobility',
      types: ['Mobility'],
    })
    expect(persisted.exercises.every((exercise) => isExercise(exercise))).toBe(true)
    expect(persisted.exercises).not.toContainEqual(expect.objectContaining({ id: 'malformed-type-record' }))
  })

  it('clones multi-valued types in canonical, routine, and session snapshots', () => {
    // Arrange — the same structured exercise is stored in every snapshot location.
    const storage = new MemoryStorage()
    const state = createDefaultStorageState()
    const exercise = {
      ...starterExercises[0]!,
      id: 'snapshot-multi-type',
      type: 'Strength',
      types: ['Strength', 'Balance', 'Mobility'] as [string, ...string[]],
      isFavorite: true,
    }
    const routine = {
      ...state.routines[0]!,
      selections: state.routines[0]!.selections.map((selection, index) => index === 0
        ? { ...selection, exercises: [exercise] }
        : { ...selection, exercises: [] }),
    }
    state.exercises = [exercise]
    state.routines = [routine]
    state.generatedSessions = [{
      scheduleEntryId: 'snapshot-schedule',
      occurrenceDate: '2026-11-16',
      routineId: routine.id,
      selections: routine.selections,
    }]

    // Act — serialize, read a clone, mutate every returned type array, then read again.
    const didWrite = writeStorage(state, storage)
    const snapshot = readStorage(storage)
    snapshot.exercises[0]!.types!.push('Changed')
    snapshot.routines[0]!.selections[0]!.exercises[0]!.types!.push('Changed')
    snapshot.generatedSessions![0]!.selections[0]!.exercises[0]!.types!.push('Changed')
    const reread = readStorage(storage)

    // Assert — persisted favorites and ordered type arrays remain independent in all snapshots.
    expect(didWrite).toBe(true)
    expect(reread.exercises[0]).toMatchObject({ isFavorite: true, types: ['Strength', 'Balance', 'Mobility'] })
    expect(reread.routines[0]?.selections[0]?.exercises[0]?.types)
      .toEqual(['Strength', 'Balance', 'Mobility'])
    expect(reread.generatedSessions?.[0]?.selections[0]?.exercises[0]?.types)
      .toEqual(['Strength', 'Balance', 'Mobility'])
  })

  it('clones structured metadata in routines and generated session snapshots', () => {
    const storage = new MemoryStorage()
    const state = createDefaultStorageState()
    const baseExercise = starterExercises[0]!
    const exercise = {
      ...baseExercise,
      steps: ['A structured step'],
      instructions: ['A structured step'],
      commonErrors: [{ error: 'Rushing', correction: 'Slow down.' }],
      tags: ['control'],
      isFavorite: true,
      specificMuscles: ['musculus transversus abdominis'],
    }
    const routine = {
      ...state.routines[0]!,
      selections: state.routines[0]!.selections.map((selection, index) => index === 0
        ? { ...selection, exercises: [exercise] }
        : { ...selection, exercises: [] }),
    }
    const session: GeneratedWorkoutSession = {
      scheduleEntryId: 'schedule-structured',
      occurrenceDate: '2026-11-15',
      routineId: routine.id,
      selections: routine.selections,
    }
    const structuredState: FitnessStorageState = {
      ...state,
      exercises: [exercise],
      routines: [routine],
      generatedSessions: [session],
    }

    expect(writeStorage(structuredState, storage)).toBe(true)
    const snapshot = readStorage(storage)
    snapshot.exercises[0]!.steps.push('Changed')
    snapshot.exercises[0]!.commonErrors[0]!.correction = 'Changed'
    snapshot.exercises[0]!.specificMuscles.push('Changed')
    snapshot.routines[0]!.selections[0]!.exercises[0]!.tags.push('Changed')
    snapshot.generatedSessions![0]!.selections[0]!.exercises[0]!.commonErrors[0]!.error = 'Changed'

    const reread = readStorage(storage)

    expect(reread.exercises[0]!.steps).toEqual(['A structured step'])
    expect(reread.exercises[0]!.commonErrors[0]!.correction).toBe('Slow down.')
    expect(reread.exercises[0]!.specificMuscles).toEqual(['musculus transversus abdominis'])
    expect(reread.routines[0]!.selections[0]!.exercises[0]!.tags).toEqual(['control'])
    expect(reread.generatedSessions![0]!.selections[0]!.exercises[0]!.commonErrors[0]!.error)
      .toBe('Rushing')
  })

  it('falls back safely when storage is unavailable or throws', () => {
    const unavailable = createStorageAdapter(null)
    const throwingStorage: StorageLike = {
      getItem: () => { throw new Error('storage unavailable') },
      setItem: () => { throw new Error('storage unavailable') },
    }

    expect(() => unavailable.read()).not.toThrow()
    expect(unavailable.write(createDefaultStorageState())).toBe(false)
    expect(() => readStorage(throwingStorage)).not.toThrow()
    expect(writeStorage(createDefaultStorageState(), throwingStorage)).toBe(false)
  })

  it('seeds the catalogue into an existing empty library without replacing user state', () => {
    // Arrange
    const storage = new MemoryStorage()
    const existingState = createDefaultStorageState()
    existingState.routines[0]!.name = 'Saved routine'
    writeStorage(existingState, storage)
    const seedExercises = [starterExercises[0]!, starterExercises[1]!]
    const adapter = createStorageAdapter(storage, seedExercises)

    // Act
    const seeded = adapter.read()

    // Assert
    expect(seeded.exercises).toEqual([
      expect.objectContaining({ id: seedExercises[0]!.id, name: seedExercises[0]!.name, types: ['Strength'] }),
      expect.objectContaining({ id: seedExercises[1]!.id, name: seedExercises[1]!.name, types: ['Strength'] }),
    ])
    expect(seeded.routines[0]!.name).toBe('Saved routine')
    expect(JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}').data.exercises).toHaveLength(2)
  })

  it('adds missing catalogue exercises to an existing library without replacing user state', () => {
    // Arrange
    const storage = new MemoryStorage()
    const existingState = createDefaultStorageState()
    const existingCatalogueExercise = { ...starterExercises[0]!, isFavorite: true }
    const customExercise = { ...starterExercises[1]!, id: 'custom-user-exercise', name: 'Custom user exercise' }
    existingState.exercises = [existingCatalogueExercise, customExercise]
    writeStorage(existingState, storage)
    const seedExercises = [starterExercises[0]!, starterExercises[1]!, starterExercises[2]!]
    const adapter = createStorageAdapter(storage, seedExercises)

    // Act
    const merged = adapter.read()

    // Assert
    expect(merged.exercises.map((exercise) => exercise.id)).toEqual([
      existingCatalogueExercise.id,
      customExercise.id,
      starterExercises[1]!.id,
      starterExercises[2]!.id,
    ])
    expect(merged.exercises[0]?.isFavorite).toBe(true)
    expect(merged.exercises[1]?.name).toBe('Custom user exercise')
    expect(JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}').data.exercises).toHaveLength(4)
  })

  it('refreshes existing catalogue records while preserving their favorites', () => {
    // Arrange
    const storage = new MemoryStorage()
    const existingState = createDefaultStorageState()
    const staleExercise = { ...starterExercises[0]!, description: 'Stale catalogue content', isFavorite: true }
    existingState.exercises = [staleExercise]
    writeStorage(existingState, storage)
    const refreshedExercise = { ...starterExercises[0]!, description: 'Current catalogue content', isFavorite: false }

    // Act
    const refreshed = createStorageAdapter(storage, [refreshedExercise]).read()

    // Assert
    expect(refreshed.exercises[0]).toMatchObject({
      id: refreshedExercise.id,
      description: 'Current catalogue content',
      isFavorite: true,
    })
    expect(JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}').data.exercises[0].description)
      .toBe('Current catalogue content')
  })

  it('purges withdrawn catalogue goals while preserving active exercises and user state', () => {
    // Arrange
    const storage = new MemoryStorage()
    const existingState = createDefaultStorageState()
    const withdrawnExercise = { ...starterExercises[0]!, id: 'withdrawn-exercise', group: 'Mechanical neck pain' }
    const retainedExercise = { ...starterExercises[1]!, isFavorite: true }
    existingState.exercises = [withdrawnExercise, retainedExercise]
    existingState.routines[0]!.name = 'Saved routine'
    writeStorage(existingState, storage)

    // Act
    const adapter = createStorageAdapter(
      storage,
      [retainedExercise],
      ['Chronic mechanical low-back pain', 'Mechanical neck pain'],
    )
    const result = adapter.read()

    // Assert
    expect(result.exercises).toEqual([expect.objectContaining({ id: retainedExercise.id, isFavorite: true })])
    expect(result.routines[0]!.name).toBe('Saved routine')
    expect(JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}').data.exercises).toHaveLength(1)
  })
})
