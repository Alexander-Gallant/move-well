import type { ExerciseCommonError, ExerciseTypes } from './types'

export const EXERCISE_CATALOGUE_FIELDS = [
  'Name',
  'Purpose',
  'Exercise type',
  'Targeted musclegroups',
  'Targeted specific muscles',
  'Equipment and environment',
  'Starting position and set-up',
  'Step-by-step movement',
  'Range and direction',
  'Breathing',
  'Beginner dose and rest',
  'Expected sensation',
  'Regression',
  'Progression',
  'Common errors and corrections',
  'Evidence category',
  'Evidence strength',
  'Source',
] as const

export type ExerciseCatalogueField = typeof EXERCISE_CATALOGUE_FIELDS[number]

/** The normalized, application-independent shape produced by the text parser. */
export type ExerciseCatalogueRawRecord = {
  name: string
  purpose: string
  exerciseType: ExerciseTypes
  muscles: string[]
  specificMuscles: string[]
  equipmentAndEnvironment: string
  startingPosition: string
  steps: string[]
  rangeAndDirection: string
  breathing: string
  beginnerDoseAndRest: string
  expectedSensation: string
  regression: string
  progression: string
  commonErrors: ExerciseCommonError[]
  evidenceCategory: string
  evidenceStrength: string
  sources: string[]
}

export type RawExerciseRecord = ExerciseCatalogueRawRecord

export type ExerciseCatalogueParseErrorCode =
  | 'duplicate-field'
  | 'empty-array-item'
  | 'empty-field'
  | 'malformed-common-error'
  | 'malformed-step'
  | 'missing-field'
  | 'second-record-before-source'
  | 'unknown-field'
  | 'unterminated-record'
  | 'out-of-order-field'

/** A parse error includes the source line and the correction needed to fix it. */
export type ExerciseCatalogueParseError = {
  code: ExerciseCatalogueParseErrorCode
  line: number
  message: string
  field?: ExerciseCatalogueField
  expectedField?: ExerciseCatalogueField
  label?: string
  recordName?: string
}

export type ExerciseCatalogueError = ExerciseCatalogueParseError

export type ExerciseCatalogueParseResult = {
  records: ExerciseCatalogueRawRecord[]
  errors: ExerciseCatalogueParseError[]
}

type CapturedField = {
  line: number
  lines: string[]
}

type ActiveRecord = {
  captures: Partial<Record<ExerciseCatalogueField, CapturedField>>
  currentField: ExerciseCatalogueField | null
  lastFieldIndex: number
  seenFields: Set<ExerciseCatalogueField>
  startLine: number
}

type LabelMatch =
  | { kind: 'recognized'; label: ExerciseCatalogueField }
  | { kind: 'unknown'; label: string }
  | { kind: 'none' }

const XML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&apos;': "'",
  '&gt;': '>',
  '&lt;': '<',
  '&nbsp;': ' ',
  '&quot;': '"',
}

const decodeXmlEntities = (value: string): string => value.replace(
  /&(?:amp|apos|gt|lt|nbsp|quot|#\d+|#x[\da-f]+);/gi,
  (entity) => {
    const named = XML_ENTITIES[entity.toLowerCase()]
    if (named !== undefined) return named

    const isHex = entity.toLowerCase().startsWith('&#x')
    const digits = entity.slice(isHex ? 3 : 2, -1)
    const codePoint = Number.parseInt(digits, isHex ? 16 : 10)
    return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
      ? String.fromCodePoint(codePoint)
      : entity
  },
)

const normalizeLine = (value: string): string => value
  .replace(/[\u00a0\t]/g, ' ')
  .replace(/ {2,}/g, ' ')
  .trim()

const normalizeInput = (value: string): string[] => decodeXmlEntities(value)
  .replace(/\r\n?/g, '\n')
  .split('\n')
  .map(normalizeLine)

const normalizeNumberedExerciseHeadings = (lines: string[]): string[] => lines.map((line, index) => {
  const match = line.match(/^\d+[.)]\s+(.+)$/)
  const nextLine = lines[index + 1]
  return match && nextLine?.startsWith('Purpose:') ? `Name: ${match[1]}` : line
})

const getLabelMatch = (line: string): LabelMatch => {
  const colonIndex = line.indexOf(':')
  if (colonIndex <= 0) return { kind: 'none' }

  const candidate = line.slice(0, colonIndex)
  const recognized = EXERCISE_CATALOGUE_FIELDS.find((field) => field === candidate)
  return recognized
    ? { kind: 'recognized', label: recognized }
    : { kind: 'unknown', label: candidate }
}

const getValueFromLine = (line: string, label: ExerciseCatalogueField): string => (
  line.slice(label.length + 1).trim()
)

const getCapturedText = (
  active: ActiveRecord,
  field: ExerciseCatalogueField,
): string => active.captures[field]?.lines.join(' ') ?? ''

const getRecordName = (active: ActiveRecord): string | undefined => {
  const name = getCapturedText(active, 'Name')
  return name || undefined
}

const addError = (
  errors: ExerciseCatalogueParseError[],
  error: ExerciseCatalogueParseError,
): void => {
  errors.push(error)
}

const captureField = (
  active: ActiveRecord,
  label: ExerciseCatalogueField,
  value: string,
  line: number,
  errors: ExerciseCatalogueParseError[],
): void => {
  const fieldIndex = EXERCISE_CATALOGUE_FIELDS.indexOf(label)
  const expectedField = EXERCISE_CATALOGUE_FIELDS[active.lastFieldIndex + 1]
  const recordName = getRecordName(active)

  if (active.seenFields.has(label)) {
    addError(errors, {
      code: 'duplicate-field',
      field: label,
      line,
      message: `Duplicate field "${label}"; each field may occur only once.`,
      recordName,
    })
    return
  }

  if (fieldIndex !== active.lastFieldIndex + 1) {
    addError(errors, {
      code: 'out-of-order-field',
      expectedField,
      field: label,
      line,
      message: `Field "${label}" is out of order; expected "${expectedField ?? 'Source'}".`,
      recordName,
    })
  }

  active.captures[label] = { line, lines: value ? [value] : [] }
  active.currentField = label
  active.lastFieldIndex = fieldIndex
  active.seenFields.add(label)
}

const appendContinuation = (active: ActiveRecord, line: string): void => {
  if (!active.currentField) return
  const captured = active.captures[active.currentField]
  captured?.lines.push(line)
}

const uniqueItems = (items: string[]): string[] => {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item)) return false
    seen.add(item)
    return true
  })
}

const parseSemicolonList = (
  value: string,
  field: ExerciseCatalogueField,
  line: number,
  recordName: string | undefined,
  errors: ExerciseCatalogueParseError[],
): string[] | null => {
  const items = value.split(';').map(normalizeLine)
  const hasEmptyItem = items.some((item) => item.length === 0)
  if (hasEmptyItem) {
    addError(errors, {
      code: 'empty-array-item',
      field,
      line,
      message: `Field "${field}" contains an empty semicolon-delimited item.`,
      recordName,
    })
  }
  return hasEmptyItem ? null : uniqueItems(items)
}

const parseExerciseTypeList = (
  value: string,
  field: ExerciseCatalogueField,
  line: number,
  recordName: string | undefined,
  errors: ExerciseCatalogueParseError[],
): ExerciseTypes | null => {
  const items = parseSemicolonList(value, field, line, recordName, errors)
  if (!items || items.length === 0) return null
  return [items[0], ...items.slice(1)]
}

const stepMarkerPattern = /(?:^|\s)(\(\d+\)|\d+[.)])(?=\s|$)/g

const parseSteps = (
  value: string,
  field: ExerciseCatalogueField,
  line: number,
  recordName: string | undefined,
  errors: ExerciseCatalogueParseError[],
): string[] | null => {
  const matches: Array<{ start: number; end: number }> = []
  let match = stepMarkerPattern.exec(value)
  while (match) {
    matches.push({ start: match.index, end: match.index + match[0].length })
    match = stepMarkerPattern.exec(value)
  }
  stepMarkerPattern.lastIndex = 0

  const candidates = matches.length === 0
    ? [value]
    : [value.slice(0, matches[0].start), ...matches.map((marker, index) => (
      value.slice(marker.end, matches[index + 1]?.start ?? value.length)
    ))].filter((candidate, index) => index !== 0 || candidate.trim().length > 0)
  const steps = candidates.map(normalizeLine)
  const hasEmptyStep = steps.some((step) => step.length === 0)
  if (hasEmptyStep) {
    addError(errors, {
      code: 'malformed-step',
      field,
      line,
      message: `Field "${field}" contains a numbered step with no text.`,
      recordName,
    })
    return null
  }
  return uniqueItems(steps)
}

const parseCommonErrors = (
  value: string,
  field: ExerciseCatalogueField,
  line: number,
  recordName: string | undefined,
  errors: ExerciseCatalogueParseError[],
): ExerciseCommonError[] | null => {
  const pairs = value.split(';').map(normalizeLine)
  const parsed: ExerciseCommonError[] = []
  let hasMalformedPair = false

  pairs.forEach((pair) => {
    const emDashSeparator = pair.indexOf('—')
    const hyphenSeparator = pair.indexOf(' - ')
    const separator = emDashSeparator >= 0 ? emDashSeparator : hyphenSeparator
    const separatorLength = emDashSeparator >= 0 ? 1 : 3
    const error = normalizeLine(pair.slice(0, separator))
    const correction = normalizeLine(pair.slice(separator + separatorLength))
    if (separator < 0 || !error || !correction) {
      hasMalformedPair = true
      return
    }
    parsed.push({ error, correction })
  })

  if (hasMalformedPair) {
    addError(errors, {
      code: 'malformed-common-error',
      field,
      line,
      message: `Field "${field}" must contain non-empty error—correction pairs separated by semicolons.`,
      recordName,
    })
    return null
  }
  return parsed.filter((pair, index, all) => all.findIndex((candidate) => (
    candidate.error === pair.error && candidate.correction === pair.correction
  )) === index)
}

const addMissingAndEmptyFieldErrors = (
  active: ActiveRecord,
  errors: ExerciseCatalogueParseError[],
): void => {
  const recordName = getRecordName(active)
  EXERCISE_CATALOGUE_FIELDS.forEach((field) => {
    const captured = active.captures[field]
    if (!captured) {
      addError(errors, {
        code: 'missing-field',
        field,
        line: active.startLine,
        message: `Record is missing required field "${field}".`,
        recordName,
      })
      return
    }
    if (!getCapturedText(active, field)) {
      addError(errors, {
        code: 'empty-field',
        field,
        line: captured.line,
        message: `Required field "${field}" must not be empty.`,
        recordName,
      })
    }
  })
}

const buildRawRecord = (
  active: ActiveRecord,
  errors: ExerciseCatalogueParseError[],
): ExerciseCatalogueRawRecord | null => {
  addMissingAndEmptyFieldErrors(active, errors)
  const recordName = getRecordName(active)
  const get = (field: ExerciseCatalogueField): string => getCapturedText(active, field)
  const getLine = (field: ExerciseCatalogueField): number => active.captures[field]?.line ?? active.startLine
  const hasMissingField = EXERCISE_CATALOGUE_FIELDS.some((field) => !active.captures[field])
  if (hasMissingField) return null

  const exerciseType = parseExerciseTypeList(get('Exercise type'), 'Exercise type', getLine('Exercise type'), recordName, errors)
  const muscles = parseSemicolonList(get('Targeted musclegroups'), 'Targeted musclegroups', getLine('Targeted musclegroups'), recordName, errors)
  const specificMuscles = parseSemicolonList(get('Targeted specific muscles'), 'Targeted specific muscles', getLine('Targeted specific muscles'), recordName, errors)
  const steps = parseSteps(get('Step-by-step movement'), 'Step-by-step movement', getLine('Step-by-step movement'), recordName, errors)
  const commonErrors = parseCommonErrors(get('Common errors and corrections'), 'Common errors and corrections', getLine('Common errors and corrections'), recordName, errors)
  const sources = parseSemicolonList(get('Source'), 'Source', getLine('Source'), recordName, errors)

  if (!exerciseType || !muscles || !specificMuscles || !steps || !commonErrors || !sources) return null
  return {
    name: get('Name'),
    purpose: get('Purpose'),
    exerciseType,
    muscles,
    specificMuscles,
    equipmentAndEnvironment: get('Equipment and environment'),
    startingPosition: get('Starting position and set-up'),
    steps,
    rangeAndDirection: get('Range and direction'),
    breathing: get('Breathing'),
    beginnerDoseAndRest: get('Beginner dose and rest'),
    expectedSensation: get('Expected sensation'),
    regression: get('Regression'),
    progression: get('Progression'),
    commonErrors,
    evidenceCategory: get('Evidence category'),
    evidenceStrength: get('Evidence strength'),
    sources,
  }
}

const createActiveRecord = (line: number, value: string): ActiveRecord => {
  const active: ActiveRecord = {
    captures: {},
    currentField: null,
    lastFieldIndex: -1,
    seenFields: new Set<ExerciseCatalogueField>(),
    startLine: line,
  }
  active.captures.Name = { line, lines: value ? [value] : [] }
  active.currentField = 'Name'
  active.lastFieldIndex = 0
  active.seenFields.add('Name')
  return active
}

/**
 * Parse extracted catalogue text without reading or changing any external state.
 * Report-level text is ignored until a `Name:` line starts a record; numbered
 * headings immediately before `Purpose:` are normalized to that label first.
 * The result contains no records when any actionable validation error is found.
 */
export const parseExerciseCatalogue = (text: string): ExerciseCatalogueParseResult => {
  const lines = normalizeNumberedExerciseHeadings(normalizeInput(text))
  const records: ExerciseCatalogueRawRecord[] = []
  const errors: ExerciseCatalogueParseError[] = []
  let active: ActiveRecord | null = null

  lines.forEach((line, lineIndex) => {
    const lineNumber = lineIndex + 1
    if (!line) return

    const labelMatch = getLabelMatch(line)
    if (!active) {
      if (labelMatch.kind === 'recognized' && labelMatch.label === 'Name') {
        active = createActiveRecord(lineNumber, getValueFromLine(line, 'Name'))
      }
      return
    }

    if (labelMatch.kind === 'recognized') {
      if (labelMatch.label === 'Name') {
        addError(errors, {
          code: 'second-record-before-source',
          line: lineNumber,
          message: `Record beginning at line ${active.startLine} has a second Name field before Source.`,
          recordName: getRecordName(active),
        })
        active.currentField = null
        return
      }

      captureField(
        active,
        labelMatch.label,
        getValueFromLine(line, labelMatch.label),
        lineNumber,
        errors,
      )
      if (labelMatch.label === 'Source') {
        const errorCountBeforeBuild = errors.length
        const record = buildRawRecord(active, errors)
        if (record && errors.length === errorCountBeforeBuild) records.push(record)
        active = null
      }
      return
    }

    if (labelMatch.kind === 'unknown') {
      addError(errors, {
        code: 'unknown-field',
        label: labelMatch.label,
        line: lineNumber,
        message: `Unknown field "${labelMatch.label}:" inside record; use one of the documented labels.`,
        recordName: getRecordName(active),
      })
      return
    }
    appendContinuation(active, line)
  })

  const unfinishedRecord = active as ActiveRecord | null
  if (unfinishedRecord) {
    addError(errors, {
      code: 'unterminated-record',
      line: lines.length,
      message: `Record beginning at line ${unfinishedRecord.startLine} is missing its terminating Source field.`,
      recordName: getRecordName(unfinishedRecord),
      expectedField: 'Source',
    })
    buildRawRecord(unfinishedRecord, errors)
  }

  return errors.length > 0 ? { errors, records: [] } : { errors, records }
}

export const parseExerciseCatalogueText = parseExerciseCatalogue
