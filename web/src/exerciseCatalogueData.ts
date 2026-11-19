import type { Exercise, ExerciseTypes } from './types'
import { exerciseCatalogueExercises as legacyCatalogueExercises } from './exerciseCatalogueLegacyData'
import { convertExerciseCatalogue, slugifyExerciseName } from './exerciseCatalogueConverter'
import { parseExerciseCatalogue, type ExerciseCatalogueRawRecord } from './exerciseCatalogueParser'
import lowerBackFixture from './test/fixtures/exercise-catalogue-lower-back-pain.txt?raw'
import neckFixture from './test/fixtures/exercise-catalogue-mechanical-neck-pain.txt?raw'

export const EXERCISE_CATALOGUE_SOURCE = 'schemas/exercises/exercises-hunched-shoulders-thoracic-kyphosis-2026-11-14.ods'
export const EXERCISE_CATALOGUE_GROUP = 'Hunched shoulders / thoracic kyphosis'
export const EXERCISE_CATALOGUE_SOURCES = [
  EXERCISE_CATALOGUE_SOURCE,
  'schemas/exercises/exercises-lower-back-pain-2026-11-11.ods',
  'schemas/exercises/exercises-mechanical-neck-pain-2026-11-14.ods',
] as const

export const EXERCISE_TYPE_OPTIONS = ['Breathing', 'Aerobic', 'Stretch', 'Strength'] as const

const mapApplicationType = (sourceType: string): ExerciseTypes => {
  const value = sourceType.toLowerCase()
  if (/breath|respiratory/.test(value)) return ['Breathing']
  if (/aerobic/.test(value)) return ['Aerobic']
  if (/stretch|flexibility|mobility|range of motion|release/.test(value)) return ['Stretch']
  if (/strength|strengthening|resistance|endurance|motor-control|functional|balance|postural/.test(value)) return ['Strength']
  throw new Error(`Unmapped exercise source type: ${sourceType}`)
}

const parseFixture = (fixture: string): ExerciseCatalogueRawRecord[] => {
  const parsed = parseExerciseCatalogue(fixture)
  if (parsed.errors.length > 0) {
    throw new Error(`Catalogue fixture did not parse: ${JSON.stringify(parsed.errors)}`)
  }
  convertExerciseCatalogue(parsed.records)
  return parsed.records.map((record) => ({ ...record, name: record.name.trim() }))
}

const toExercise = (
  record: ExerciseCatalogueRawRecord,
  group: string,
  usedIds: Set<string>,
): Exercise => {
  const baseId = slugifyExerciseName(record.name)
  const id = usedIds.has(baseId) ? `${baseId}-${slugifyExerciseName(group)}` : baseId
  usedIds.add(id)
  const types = mapApplicationType(record.exerciseType.join('; '))
  const type = types[0]
  const category = types.join('; ')
  const steps = [...record.steps]
  return {
    id,
    name: record.name,
    group,
    type,
    types: [...types],
    muscles: [...record.muscles],
    purpose: record.purpose,
    specificMuscles: [...record.specificMuscles],
    equipmentAndEnvironment: record.equipmentAndEnvironment,
    startingPosition: record.startingPosition,
    rangeAndDirection: record.rangeAndDirection,
    breathing: record.breathing,
    beginnerDoseAndRest: record.beginnerDoseAndRest,
    expectedSensation: record.expectedSensation,
    regression: record.regression,
    progression: record.progression,
    category,
    description: record.purpose,
    instructions: [...steps],
    steps,
    commonErrors: record.commonErrors.map((pair) => ({ ...pair })),
    tags: [category],
    isFavorite: false,
    duration: '',
  }
}

const importOdsFixture = (
  fixture: string,
  group: string,
  usedIds: Set<string>,
): Exercise[] => parseFixture(fixture).map((record) => toExercise(record, group, usedIds))

const normalizeCatalogueExercise = (exercise: Exercise): Exercise => {
  const types = mapApplicationType((exercise.types ?? [exercise.type]).join('; '))
  const category = types.join('; ')
  return {
    ...exercise,
    type: types[0],
    types: [...types],
    category,
    tags: [category],
  }
}

const establishedCatalogueExercises = legacyCatalogueExercises
  .slice(0, 20)
  .map(normalizeCatalogueExercise)
const usedIds = new Set(establishedCatalogueExercises.map((exercise) => exercise.id))
const importedOdsExercises = [
  ...importOdsFixture(lowerBackFixture, 'Chronic mechanical low-back pain', usedIds),
  ...importOdsFixture(neckFixture, 'Mechanical neck pain', usedIds),
]

// The first twenty records are the established hunched-shoulders snapshot. The
// ODS records are parsed and converted atomically before being appended.
export const exerciseCatalogueExercises: Exercise[] = [
  ...establishedCatalogueExercises,
  ...importedOdsExercises,
]

export const importedExercises = exerciseCatalogueExercises
