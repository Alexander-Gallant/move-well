import type { Exercise, ExerciseCommonError, ExerciseTypes } from './types'
import type { ExerciseCatalogueRawRecord } from './exerciseCatalogueParser'

export type ExerciseCatalogueConversionErrorCode =
  | 'invalid-record'
  | 'duplicate-canonical-record'
  | 'invalid-id'
  | 'duplicate-id'

export type ExerciseCatalogueConversionErrorDetails = {
  code: ExerciseCatalogueConversionErrorCode
  message: string
  recordIndex?: number
  recordName?: string
  category?: string
  id?: string
}

/** A typed, actionable failure raised when a catalogue cannot be converted completely. */
export class ExerciseCatalogueConversionError extends Error {
  readonly code: ExerciseCatalogueConversionErrorCode
  readonly recordIndex?: number
  readonly recordName?: string
  readonly category?: string
  readonly id?: string

  constructor(details: ExerciseCatalogueConversionErrorDetails) {
    super(details.message)
    this.name = 'ExerciseCatalogueConversionError'
    this.code = details.code
    this.recordIndex = details.recordIndex
    this.recordName = details.recordName
    this.category = details.category
    this.id = details.id
  }
}

/** Create the standard Unicode-safe slug used as the base exercise ID. */
export const slugifyExerciseName = (name: string): string => {
  const normalized = name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/\p{Mark}+/gu, '')
  return normalized
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
}

const encodeUtf8 = (value: string): Uint8Array => new TextEncoder().encode(value)

// Kept local and synchronous so the converter remains pure and browser-compatible.
const sha256Hex = (value: string): string => {
  const roundConstants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]
  const initialHash = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]
  const source = encodeUtf8(value)
  const bitLength = source.length * 8
  const paddedLength = Math.ceil((source.length + 9) / 64) * 64
  const padded = new Uint8Array(paddedLength)
  padded.set(source)
  padded[source.length] = 0x80
  const view = new DataView(padded.buffer)
  view.setUint32(paddedLength - 4, bitLength >>> 0)
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000))

  const hash = [...initialHash]
  const schedule = new Uint32Array(64)
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) schedule[index] = view.getUint32(offset + index * 4)
    for (let index = 16; index < 64; index += 1) {
      const valueA = schedule[index - 15]
      const valueB = schedule[index - 2]
      const smallSigmaA = ((valueA >>> 7) | (valueA << 25)) ^ ((valueA >>> 18) | (valueA << 14)) ^ (valueA >>> 3)
      const smallSigmaB = ((valueB >>> 17) | (valueB << 15)) ^ ((valueB >>> 19) | (valueB << 13)) ^ (valueB >>> 10)
      schedule[index] = (schedule[index - 16] + smallSigmaA + schedule[index - 7] + smallSigmaB) >>> 0
    }

    let [a, b, c, d, e, f, g, h] = hash
    for (let index = 0; index < 64; index += 1) {
      const bigSigmaE = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))
      const choose = (e & f) ^ (~e & g)
      const temporary1 = (h + bigSigmaE + choose + roundConstants[index] + schedule[index]) >>> 0
      const bigSigmaA = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))
      const majority = (a & b) ^ (a & c) ^ (b & c)
      const temporary2 = (bigSigmaA + majority) >>> 0
      h = g
      g = f
      f = e
      e = (d + temporary1) >>> 0
      d = c
      c = b
      b = a
      a = (temporary1 + temporary2) >>> 0
    }
    hash[0] = (hash[0] + a) >>> 0
    hash[1] = (hash[1] + b) >>> 0
    hash[2] = (hash[2] + c) >>> 0
    hash[3] = (hash[3] + d) >>> 0
    hash[4] = (hash[4] + e) >>> 0
    hash[5] = (hash[5] + f) >>> 0
    hash[6] = (hash[6] + g) >>> 0
    hash[7] = (hash[7] + h) >>> 0
  }
  return hash.map((part) => part.toString(16).padStart(8, '0')).join('')
}

const canonicalRecord = (record: ExerciseCatalogueRawRecord, types: ExerciseTypes): string => [
  record.name,
  types.join(';'),
  record.sources?.join(';') ?? '',
].join('\n')

const invalidRecord = (recordIndex: number, message: string): ExerciseCatalogueConversionError => (
  new ExerciseCatalogueConversionError({ code: 'invalid-record', recordIndex, message })
)

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0

const normalizeExerciseTypes = (value: unknown): ExerciseTypes | null => {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => !isNonEmptyString(item))) return null
  const uniqueTypes = value.reduce<string[]>((types, item) => {
    const normalized = item.trim()
    return types.includes(normalized) ? types : [...types, normalized]
  }, [])
  return uniqueTypes.length > 0 ? [uniqueTypes[0]!, ...uniqueTypes.slice(1)] : null
}

const isValidCommonError = (value: unknown): value is ExerciseCommonError => (
  typeof value === 'object'
  && value !== null
  && isNonEmptyString((value as { error?: unknown }).error)
  && isNonEmptyString((value as { correction?: unknown }).correction)
)

const validateRecord = (record: ExerciseCatalogueRawRecord, recordIndex: number): void => {
  if (typeof record !== 'object' || record === null) throw invalidRecord(recordIndex, `Record ${recordIndex} is not an object.`)
  const requiredScalars: Array<keyof ExerciseCatalogueRawRecord> = [
    'name', 'purpose', 'equipmentAndEnvironment', 'startingPosition',
    'rangeAndDirection', 'breathing', 'beginnerDoseAndRest', 'expectedSensation',
    'regression', 'progression',
  ]
  requiredScalars.forEach((field) => {
    if (!isNonEmptyString(record[field])) throw invalidRecord(recordIndex, `Record ${recordIndex} has an empty ${field} field.`)
  })
  const requiredArrays: Array<keyof ExerciseCatalogueRawRecord> = [
    'muscles', 'specificMuscles', 'steps', 'sources',
  ]
  requiredArrays.forEach((field) => {
    const value = record[field]
    if (!Array.isArray(value) || value.length === 0 || value.some((item) => !isNonEmptyString(item))) {
      throw invalidRecord(recordIndex, `Record ${recordIndex} has an invalid ${field} array.`)
    }
  })
  if (!Array.isArray(record.commonErrors) || record.commonErrors.length === 0 || record.commonErrors.some((item) => !isValidCommonError(item))) {
    throw invalidRecord(recordIndex, `Record ${recordIndex} has invalid commonErrors pairs.`)
  }
  if (!normalizeExerciseTypes(record.exerciseType)) {
    throw invalidRecord(recordIndex, `Record ${recordIndex} has an invalid exerciseType array.`)
  }
}

const toExercise = (
  record: ExerciseCatalogueRawRecord,
  id: string,
  types: ExerciseTypes,
): Exercise => ({
  id,
  name: record.name,
  group: 'General',
  type: types[0],
  types: [types[0], ...types.slice(1)],
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
  category: types.join('; '),
  description: record.purpose,
  instructions: [...record.steps],
  steps: [...record.steps],
  commonErrors: record.commonErrors.map((pair) => ({ ...pair })),
  tags: [types.join('; ')],
  isFavorite: false,
  duration: '',
})

/** Convert parser output without mutating it or partially returning an invalid import. */
export const convertExerciseCatalogue = (records: ExerciseCatalogueRawRecord[]): Exercise[] => {
  if (!Array.isArray(records)) throw invalidRecord(-1, 'Exercise catalogue records must be an array.')

  const canonicalRecords = new Set<string>()
  const prepared = records.map((record, recordIndex) => {
    validateRecord(record, recordIndex)
    const types = normalizeExerciseTypes(record.exerciseType)
    if (!types) throw invalidRecord(recordIndex, `Record ${recordIndex} has an invalid exerciseType array.`)
    const canonical = canonicalRecord(record, types)
    if (canonicalRecords.has(canonical)) {
      throw new ExerciseCatalogueConversionError({
        code: 'duplicate-canonical-record',
        recordIndex,
        recordName: record.name,
        message: `Record ${recordIndex} duplicates canonical exercise content for "${record.name}".`,
      })
    }
    canonicalRecords.add(canonical)
    const baseId = slugifyExerciseName(record.name)
    if (!baseId) {
      throw new ExerciseCatalogueConversionError({
        code: 'invalid-id',
        recordIndex,
        recordName: record.name,
        message: `Exercise name "${record.name}" produces an empty stable ID.`,
      })
    }
    return { record, canonical, baseId, types }
  })

  const baseIdCounts = new Map<string, number>()
  prepared.forEach(({ baseId }) => baseIdCounts.set(baseId, (baseIdCounts.get(baseId) ?? 0) + 1))
  const usedIds = new Set<string>()
  return prepared.map(({ record, canonical, baseId, types }, recordIndex) => {
    const id = baseIdCounts.get(baseId) === 1
      ? baseId
      : `${baseId}-${sha256Hex(canonical).slice(0, 8)}`
    if (usedIds.has(id)) {
      throw new ExerciseCatalogueConversionError({
        code: 'duplicate-id',
        recordIndex,
        recordName: record.name,
        id,
        message: `Stable ID "${id}" is duplicated after collision resolution.`,
      })
    }
    usedIds.add(id)
    return toExercise(record, id, types)
  })
}

export const convertExerciseCatalogueRecords = convertExerciseCatalogue
