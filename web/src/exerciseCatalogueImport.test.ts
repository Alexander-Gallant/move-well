import { describe, expect, it } from 'vitest'
import { EXERCISE_CATALOGUE_SOURCES, EXERCISE_TYPE_OPTIONS, exerciseCatalogueExercises } from './exerciseCatalogueData'
import { exerciseLibrary, starterExercises } from './data'
import { isExercise } from './storage'
import type { Exercise } from './types'

const sourceIdentity = (exercise: Exercise): string => JSON.stringify([
  exercise.name,
  exercise.category,
  exercise.group,
])

const importedRecords = (exercises: readonly Exercise[]): Exercise[] => [...exercises]

describe('canonical exercise catalogue import', () => {
  it('contains all three catalogues with unique imported source records', () => {
    // Arrange — source identity is independent of IDs, which may receive a deterministic
    // suffix when an imported name overlaps a starter exercise.
    const sourceRecords = exerciseCatalogueExercises
    const canonicalImportedRecords = importedRecords(exerciseCatalogueExercises)

    // Act
    const sourceIdentities = sourceRecords.map(sourceIdentity)
    const canonicalIdentities = canonicalImportedRecords.map(sourceIdentity)
    const matchesPerSource = sourceRecords.map((source) => canonicalImportedRecords.filter(
      (candidate) => sourceIdentity(candidate) === sourceIdentity(source),
    ))

    // Assert — the complete imported set is present once, with no report-level records.
    expect(EXERCISE_CATALOGUE_SOURCES.every((source) => source.endsWith('.ods'))).toBe(true)
    expect(sourceRecords).toHaveLength(73)
    expect(sourceRecords.filter((exercise) => exercise.group === 'Hunched shoulders / thoracic kyphosis')).toHaveLength(20)
    expect(sourceRecords.filter((exercise) => exercise.group === 'Chronic mechanical low-back pain')).toHaveLength(33)
    expect(sourceRecords.filter((exercise) => exercise.group === 'Mechanical neck pain')).toHaveLength(20)
    expect(exerciseLibrary).toEqual([])
    expect(new Set(sourceRecords.map((exercise) => exercise.id)).size).toBe(73)
    expect(canonicalImportedRecords).toHaveLength(73)
    expect(new Set(canonicalImportedRecords.map((exercise) => exercise.id)).size).toBe(73)
    expect(new Set(canonicalIdentities).size).toBe(73)
    expect([...canonicalIdentities].sort()).toEqual([...sourceIdentities].sort())
    matchesPerSource.forEach((matches) => expect(matches).toHaveLength(1))
    expect(canonicalImportedRecords.map((exercise) => exercise.name)).not.toContain('Report introduction')
    expect(canonicalImportedRecords.map((exercise) => exercise.name)).not.toContain('References')
    expect(canonicalImportedRecords.map((exercise) => exercise.name))
      .not.toContain('Monitoring and referral guidance')
    expect(canonicalImportedRecords.map((exercise) => exercise.name))
      .not.toContain('Report-Level Monitoring')
    expect(canonicalImportedRecords.map((exercise) => exercise.name))
      .not.toContain('Mechanical Neck Pain / Stiff Neck')
    expect(canonicalImportedRecords.map((exercise) => exercise.name))
      .not.toContain('Safety and referral considerations')
    expect(canonicalImportedRecords.map((exercise) => exercise.name)).toContain('Diaphragmatic breathing with relaxed abdominal expansion')
    expect(canonicalImportedRecords.map((exercise) => exercise.name)).toContain('Progressive lifting from an elevated surface')
    expect(canonicalImportedRecords.map((exercise) => exercise.name)).toContain('Comfortable cervical rotation')
    expect(new Set(sourceRecords.map((exercise) => exercise.group))).toEqual(new Set([
      'Hunched shoulders / thoracic kyphosis',
      'Chronic mechanical low-back pain',
      'Mechanical neck pain',
    ]))
    expect(new Set(sourceRecords.map((exercise) => exercise.type))).toEqual(new Set(EXERCISE_TYPE_OPTIONS))
  })

  it('keeps imported records and starter records in the validated structured shape', () => {
    // Arrange
    const imported = importedRecords(exerciseCatalogueExercises)

    // Act
    const importedValidation = imported.map((exercise) => ({
      exercise,
      listFields: [
        exercise.muscles,
        exercise.specificMuscles,
        exercise.steps,
        exercise.instructions,
        exercise.tags,
       ],
    }))

    // Assert — imported data remains valid for storage and starter references remain intact.
    importedValidation.forEach(({ exercise, listFields }) => {
      expect(isExercise(exercise)).toBe(true)
      expect([
        'Hunched shoulders / thoracic kyphosis',
        'Chronic mechanical low-back pain',
        'Mechanical neck pain',
      ]).toContain(exercise.group)
      expect(EXERCISE_TYPE_OPTIONS).toContain(exercise.type)
      expect(exercise.types).toEqual([exercise.type])
      expect(EXERCISE_TYPE_OPTIONS).toContain(exercise.type)
      expect(exercise).not.toHaveProperty('evidenceCategory')
      expect(exercise).not.toHaveProperty('evidenceStrength')
      expect(exercise).not.toHaveProperty('sources')
       expect(exercise.category.trim()).not.toBe('')
        expect(exercise.category).toBe(exercise.type)
        expect(exercise.tags).toEqual([exercise.type])
      listFields.forEach((values) => {
        expect(Array.isArray(values)).toBe(true)
        expect(values.length).toBeGreaterThan(0)
        values.forEach((value) => expect(typeof value).toBe('string'))
      })
      expect(exercise.commonErrors.length).toBeGreaterThan(0)
      exercise.commonErrors.forEach((pair) => {
        expect(typeof pair.error).toBe('string')
        expect(typeof pair.correction).toBe('string')
        expect(pair.error.trim()).not.toBe('')
        expect(pair.correction.trim()).not.toBe('')
      })
    })
    starterExercises.forEach((starter) => expect(isExercise(starter)).toBe(true))
  })
})
