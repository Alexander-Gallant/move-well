import { describe, expect, it } from 'vitest'
import type { ExerciseCatalogueRawRecord } from './exerciseCatalogueParser'
import {
  convertExerciseCatalogue,
  ExerciseCatalogueConversionError,
  slugifyExerciseName,
} from './exerciseCatalogueConverter'
import { parseExerciseCatalogue } from './exerciseCatalogueParser'

import fixture from './test/fixtures/exercise-catalogue-hunched-shoulders-thoracic-kyphosis.txt?raw'

const EXPECTED_IDS = [
  'chin-tuck',
  'wall-angel',
  'scapular-retraction',
  'thoracic-extension-over-chair',
  'cat-camel',
  'open-book-rotation',
  'doorway-pectoral-stretch',
  'prone-cobra',
  'wall-slide',
  'band-pull-apart',
  'resistance-band-row',
  'y-raise',
  'serratus-wall-slide',
  'reverse-fly',
  'bird-dog',
  'glute-bridge',
  'plank',
  'dead-bug',
  'sit-to-stand',
  'walking-posture-drill',
] as const

const parseFixture = (): ExerciseCatalogueRawRecord[] => {
  const parsed = parseExerciseCatalogue(fixture)
  if (parsed.errors.length > 0) throw new Error(`Fixture did not parse: ${JSON.stringify(parsed.errors)}`)
  return parsed.records
}

const getConversionError = (action: () => unknown): ExerciseCatalogueConversionError => {
  try {
    action()
  } catch (error) {
    if (error instanceof ExerciseCatalogueConversionError) return error
    throw error
  }
  throw new Error('Expected exercise catalogue conversion to fail.')
}

describe('convertExerciseCatalogue', () => {
  it('parses and converts the complete twenty-record fixture with exact stable IDs', () => {
    // Arrange — the fixture is the normalized import boundary for the current catalogue.
    const parsed = parseExerciseCatalogue(fixture)

    // Act — conversion must succeed only after the complete fixture has parsed.
    const exercises = convertExerciseCatalogue(parsed.records)

    // Assert — all source records are present once, and report-level prose is excluded.
    expect(parsed.errors).toEqual([])
    expect(exercises).toHaveLength(20)
    expect(exercises.map((exercise) => exercise.id)).toEqual(EXPECTED_IDS)
    expect(new Set(exercises.map((exercise) => exercise.id)).size).toBe(20)
    expect(exercises.map((exercise) => exercise.name)).not.toContain('Report introduction')
    expect(exercises.map((exercise) => exercise.name)).not.toContain('References')
    expect(exercises.map((exercise) => exercise.name)).not.toContain('Monitoring and referral guidance')
    expect(exercises.map((exercise) => exercise.type)).toEqual([
      'Motor-control and endurance', 'Mobility and motor-control', 'Resistance strengthening',
      'Thoracic mobility', 'Mobility and motor-control', 'Thoracic mobility',
      'Flexibility and mobility', 'Postural strengthening', 'Mobility and motor-control',
      'Resistance strengthening', 'Resistance strengthening', 'Postural strengthening',
      'Motor-control and strengthening', 'Resistance strengthening', 'Motor-control and endurance',
      'Resistance strengthening', 'Strengthening and endurance', 'Motor-control and endurance',
      'Functional resistance strengthening', 'Aerobic and postural activity',
    ])
  })

  it('emits the app Exercise fields and applies compatibility defaults', () => {
    // Arrange — convert a representative parsed record at the app boundary.
    const [record] = parseFixture()

    // Act
    const [exercise] = convertExerciseCatalogue([record])

    // Assert — this exact shape protects field mapping and legacy aliases from drift.
    expect(exercise).toEqual({
      id: 'chin-tuck',
       name: 'Chin tuck',
       group: 'General',
       type: 'Motor-control and endurance',
       types: ['Motor-control and endurance'],
      muscles: ['Neck stabilisers', 'upper back'],
      purpose: 'Practise gentle head and neck alignment.',
      specificMuscles: ['musculus longus colli', 'musculus trapezius'],
      equipmentAndEnvironment: 'A wall and a clear floor space',
      startingPosition: 'Stand comfortably with the back supported.',
      rangeAndDirection: 'Use a small controlled range.',
      breathing: 'Breathe normally throughout.',
      beginnerDoseAndRest: 'Five repetitions with thirty seconds rest.',
      expectedSensation: 'Mild effort without sharp symptoms.',
      regression: 'Reduce the range.',
      progression: 'Add a brief controlled hold.',
      category: 'Motor-control and endurance',
      description: 'Practise gentle head and neck alignment.',
      instructions: ['Move slowly through the comfortable range.'],
      steps: ['Move slowly through the comfortable range.'],
      commonErrors: [{ error: 'Lifting the chin', correction: 'Keep the gaze level.' }],
      tags: ['Motor-control and endurance'],
      isFavorite: false,
      duration: '',
    })
  })

  it('copies arbitrary ordered source types and keeps the first type as the compatibility value', () => {
    // Arrange — source categories are not limited to the former app enum.
    const [record] = parseFixture()
    const multiTypeRecord: ExerciseCatalogueRawRecord = {
      ...record,
      exerciseType: ['Mobility', 'Coordination', 'Motor-control'],
    }

    // Act
    const [exercise] = convertExerciseCatalogue([multiTypeRecord])

    // Assert — source order is canonical, while legacy scalar fields remain deterministic.
    expect(exercise?.category).toBe('Mobility; Coordination; Motor-control')
    expect(exercise?.types).toEqual(['Mobility', 'Coordination', 'Motor-control'])
    expect(exercise?.type).toBe('Mobility')
    expect(exercise?.tags).toEqual(['Mobility; Coordination; Motor-control'])
  })

  it('keeps all converted list fields non-empty and compatibility instructions equal to steps', () => {
    // Arrange
    const records = parseFixture()

    // Act
    const exercises = convertExerciseCatalogue(records)

    // Assert — application arrays must remain structured, ordered, and usable for every record.
    exercises.forEach((exercise) => {
      const listFields = [
        exercise.muscles,
        exercise.specificMuscles,
        exercise.instructions,
        exercise.steps,
        exercise.types ?? [],
        exercise.tags,
      ]
      listFields.forEach((values) => {
        expect(Array.isArray(values)).toBe(true)
        expect(values.length).toBeGreaterThan(0)
        values.forEach((value) => expect(typeof value).toBe('string'))
      })
      expect(exercise.instructions).toEqual(exercise.steps)
      expect(exercise.types).toEqual([exercise.type])
      exercise.commonErrors.forEach((pair) => {
        expect(pair.error.trim().length).toBeGreaterThan(0)
        expect(pair.correction.trim().length).toBeGreaterThan(0)
        expect(typeof pair.error).toBe('string')
        expect(typeof pair.correction).toBe('string')
      })
      expect(exercise.description).toBe(exercise.purpose)
      expect(exercise.tags).toEqual([exercise.category.trim()])
      expect(exercise.isFavorite).toBe(false)
      expect(exercise.duration).toBe('')
    })
  })

  it('rejects duplicate canonical records instead of returning a partial catalogue', () => {
    // Arrange — the second object is distinct but has identical canonical content.
    const [record] = parseFixture()
    const duplicate = { ...record, muscles: [...record.muscles] }

    // Act
    const error = getConversionError(() => convertExerciseCatalogue([record, duplicate]))

    // Assert — conversion is atomic and reports the duplicate record index.
    expect(error.code).toBe('duplicate-canonical-record')
    expect(error.recordIndex).toBe(1)
    expect(error.recordName).toBe(record.name)
  })

  it('uses deterministic hexadecimal suffixes for names that collide after slugification', () => {
    // Arrange — punctuation differs, but both names intentionally produce one base slug.
    const [record] = parseFixture()
    const first = { ...record, name: 'Shoulder control!' }
    const second = { ...record, name: 'Shoulder control?' }

    // Act
    const converted = convertExerciseCatalogue([first, second])
    const repeated = convertExerciseCatalogue([first, second])

    // Assert — suffixes are stable, distinct per canonical record, and never positional IDs.
    expect(slugifyExerciseName(first.name)).toBe('shoulder-control')
    expect(slugifyExerciseName(second.name)).toBe('shoulder-control')
    expect(converted.map((exercise) => exercise.id)).toEqual(repeated.map((exercise) => exercise.id))
    expect(converted.map((exercise) => exercise.id)).toEqual([
      'shoulder-control-4b73915d',
      'shoulder-control-08070055',
    ])
    expect(converted[0]?.id).not.toBe(converted[1]?.id)
  })

  it.each([
    ['an empty record', {} as ExerciseCatalogueRawRecord, 'invalid-record'],
    ['an empty scalar', { purpose: '' }, 'invalid-record'],
    ['an empty required array', { muscles: [] }, 'invalid-record'],
    ['an empty common-error pair', { commonErrors: [{ error: '', correction: 'Correct it' }] }, 'invalid-record'],
    ['an empty exercise type array', { exerciseType: [] }, 'invalid-record'],
  ] as const)('rejects %s without creating an invalid Exercise', (_description, changes, expectedCode) => {
    // Arrange
    const [record] = parseFixture()
    const invalidRecord = (Object.keys(changes).length === 0
      ? changes
      : { ...record, ...changes }) as ExerciseCatalogueRawRecord

    // Act
    const error = getConversionError(() => convertExerciseCatalogue([invalidRecord]))

    // Assert — required fields and non-empty arrays are validated before conversion returns.
    expect(error.code).toBe(expectedCode)
  })

  it('rejects a non-empty name that produces an empty stable ID', () => {
    // Arrange
    const [record] = parseFixture()
    const invalidIdRecord = { ...record, name: '!!!' }

    // Act
    const error = getConversionError(() => convertExerciseCatalogue([invalidIdRecord]))

    // Assert — IDs remain derived from names and cannot silently become empty.
    expect(error.code).toBe('invalid-id')
  })

  it('rejects an invalid record after a valid record without returning partial results', () => {
    // Arrange
    const [validRecord] = parseFixture()
    const invalidRecord = { ...validRecord, purpose: ' ' }

    // Act
    const error = getConversionError(() => convertExerciseCatalogue([validRecord, invalidRecord]))

    // Assert — an all-or-nothing import reports the failing record rather than saving the first.
    expect(error.code).toBe('invalid-record')
    expect(error.recordIndex).toBe(1)
  })

  it('does not mutate raw records or share mutable output arrays with parser input', () => {
    // Arrange
    const records = parseFixture()
    const beforeConversion = structuredClone(records)

    // Act
    const [exercise] = convertExerciseCatalogue(records)
    exercise.muscles.push('Output-only mutation')
    exercise.commonErrors[0]!.error = 'Output-only mutation'

    // Assert — conversion follows the project immutability standard in both directions.
    expect(records).toEqual(beforeConversion)
    expect(records[0]?.muscles).not.toContain('Output-only mutation')
    expect(records[0]?.commonErrors[0]?.error).toBe('Lifting the chin')
  })
})
