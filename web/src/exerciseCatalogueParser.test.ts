import { describe, expect, it } from 'vitest'
import { parseExerciseCatalogue } from './exerciseCatalogueParser'

import fixture from './test/fixtures/exercise-catalogue-hunched-shoulders-thoracic-kyphosis.txt?raw'

const validRecord = (name = 'Balanced &amp; steady'): string => [
  `Name: ${name}`,
  'Purpose: Builds comfortable control &lt;without force&gt;.',
    'Exercise type: Motor-control and endurance',
  'Targeted musclegroups: Trunk; Shoulder girdle; Trunk',
  'Targeted specific muscles: musculus transversus abdominis; musculus multifidus',
  'Equipment and environment: A mat and clear space',
  'Starting position and set-up: Begin in a comfortable supported position.',
  'Step-by-step movement: Complete the controlled movement.',
  'Range and direction: Use a small, comfortable range.',
  'Breathing: Breathe normally throughout.',
  'Beginner dose and rest: Five repetitions with thirty seconds rest.',
  'Expected sensation: Mild effort without sharp symptoms.',
  'Regression: Reduce the range.',
  'Progression: Add a brief controlled hold.',
  'Common errors and corrections: Rushing—Move more slowly; Holding breath—Breathe continuously',
  'Evidence category: Motor-control exercise',
  'Evidence strength: Practical exercise description',
  'Source: Technique notes; https://example.test/?a=1&amp;b=2; Technique notes',
].join('\n')

const parseInvalidRecord = (mutate: (lines: string[]) => string[]): ReturnType<typeof parseExerciseCatalogue> => {
  const lines = mutate(validRecord().split('\n'))
  return parseExerciseCatalogue(lines.join('\n'))
}

describe('parseExerciseCatalogue', () => {
  it('parses the complete fixture as twenty unique exercise boundaries and excludes report prose', () => {
    // Arrange
    const input = fixture

    // Act
    const result = parseExerciseCatalogue(input)
    const names = result.records.map((record) => record.name)
    const ids = names.map((name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))

    // Assert
    expect(result.errors).toEqual([])
    expect(result.records).toHaveLength(20)
    expect(new Set(names).size).toBe(20)
    expect(new Set(ids).size).toBe(20)
    expect(names).not.toContain('Report introduction')
    expect(names).not.toContain('References')
    expect(names).not.toContain('Monitoring and referral guidance')
  })

  it('parses every scalar, semicolon list, error pair, and XML entity in a valid record', () => {
    // Arrange
    const input = validRecord()

    // Act
    const result = parseExerciseCatalogue(input)
    const record = result.records[0]

    // Assert
    expect(result.errors).toEqual([])
    expect(record).toEqual({
      name: 'Balanced & steady',
      purpose: 'Builds comfortable control <without force>.',
      exerciseType: ['Motor-control and endurance'],
      muscles: ['Trunk', 'Shoulder girdle'],
      specificMuscles: ['musculus transversus abdominis', 'musculus multifidus'],
      equipmentAndEnvironment: 'A mat and clear space',
      startingPosition: 'Begin in a comfortable supported position.',
      steps: ['Complete the controlled movement.'],
      rangeAndDirection: 'Use a small, comfortable range.',
      breathing: 'Breathe normally throughout.',
      beginnerDoseAndRest: 'Five repetitions with thirty seconds rest.',
      expectedSensation: 'Mild effort without sharp symptoms.',
      regression: 'Reduce the range.',
      progression: 'Add a brief controlled hold.',
      commonErrors: [
        { error: 'Rushing', correction: 'Move more slowly' },
        { error: 'Holding breath', correction: 'Breathe continuously' },
      ],
      evidenceCategory: 'Motor-control exercise',
      evidenceStrength: 'Practical exercise description',
      sources: ['Technique notes', 'https://example.test/?a=1&b=2'],
    })
  })

  it('joins wrapped continuation lines into the current field', () => {
    // Arrange
    const input = validRecord().replace(
      'Purpose: Builds comfortable control &lt;without force&gt;.',
      'Purpose: Builds comfortable\n control &lt;without force&gt;.',
    )

    // Act
    const result = parseExerciseCatalogue(input)

    // Assert
    expect(result.errors).toEqual([])
    expect(result.records[0]?.purpose).toBe('Builds comfortable control <without force>.')
  })

  it('accepts fields in the documented exact order', () => {
    // Arrange
    const input = validRecord()

    // Act
    const result = parseExerciseCatalogue(input)

    // Assert
    expect(result.errors).toEqual([])
    expect(result.records).toHaveLength(1)
  })

  it('normalizes a semicolon-delimited type list while preserving source order', () => {
    // Arrange
    const input = validRecord().replace(
      'Exercise type: Motor-control and endurance',
      'Exercise type:  Mobility  ;  Motor-control   and endurance ; Mobility',
    )

    // Act
    const result = parseExerciseCatalogue(input)

    // Assert
    expect(result.errors).toEqual([])
    expect(result.records[0]?.exerciseType).toEqual(['Mobility', 'Motor-control and endurance'])
  })

  it('splits numbered movement instructions into ordered steps', () => {
    // Arrange
    const input = validRecord().replace(
      'Step-by-step movement: Complete the controlled movement.',
      'Step-by-step movement: (1) Set up comfortably. (2) Move slowly. (3) Return with control.',
    )

    // Act
    const result = parseExerciseCatalogue(input)

    // Assert
    expect(result.errors).toEqual([])
    expect(result.records[0]?.steps).toEqual([
      'Set up comfortably.',
      'Move slowly.',
      'Return with control.',
    ])
  })

  it.each([
    ['missing field', (lines: string[]) => lines.filter((line) => !line.startsWith('Evidence strength:')),
      'missing-field'],
    ['empty scalar', (lines: string[]) => lines.map((line) => line.startsWith('Breathing:') ? 'Breathing:' : line),
      'empty-field'],
    ['unknown field', (lines: string[]) => lines.flatMap((line) => line.startsWith('Source:') ? ['Unrecognized: value', line] : [line]),
      'unknown-field'],
    ['out-of-order field', (lines: string[]) => {
      const purposeIndex = lines.findIndex((line) => line.startsWith('Purpose:'))
      const typeIndex = lines.findIndex((line) => line.startsWith('Exercise type:'))
      const swapped = [...lines]
      const purpose = swapped[purposeIndex]!
      swapped[purposeIndex] = swapped[typeIndex]!
      swapped[typeIndex] = purpose
      return swapped
    }, 'out-of-order-field'],
    ['duplicate field', (lines: string[]) => lines.flatMap((line) => line.startsWith('Purpose:') ? [line, 'Purpose: Duplicate purpose.'] : [line]),
      'duplicate-field'],
    ['unterminated record', (lines: string[]) => lines.filter((line) => !line.startsWith('Source:')),
      'unterminated-record'],
    ['second Name before Source', (lines: string[]) => lines.flatMap((line) => line.startsWith('Purpose:') ? ['Name: Second name', line] : [line]),
      'second-record-before-source'],
    ['empty semicolon item', (lines: string[]) => lines.map((line) => line.startsWith('Targeted musclegroups:') ? 'Targeted musclegroups: Trunk; ; Shoulder girdle' : line),
      'empty-array-item'],
    ['empty exercise type item', (lines: string[]) => lines.map((line) => line.startsWith('Exercise type:') ? 'Exercise type: Mobility; ; Strength' : line),
      'empty-array-item'],
    ['malformed common error pair', (lines: string[]) => lines.map((line) => line.startsWith('Common errors and corrections:') ? 'Common errors and corrections: Rushing; Holding breath—Breathe continuously' : line),
      'malformed-common-error'],
    ['malformed numbered step', (lines: string[]) => lines.map((line) => line.startsWith('Step-by-step movement:') ? 'Step-by-step movement: (1) (2) Move slowly.' : line),
      'malformed-step'],
  ] as const)('rejects a %s record with an actionable %s error', (_description, mutate, expectedCode) => {
    // Arrange
    const input = mutate(validRecord().split('\n')).join('\n')

    // Act
    const result = parseExerciseCatalogue(input)

    // Assert
    expect(result.records).toEqual([])
    expect(result.errors.map((error) => error.code)).toContain(expectedCode)
  })

  it('rejects an empty source field instead of emitting an incomplete record', () => {
    // Arrange
    const result = parseInvalidRecord((lines) => lines.map((line) => line.startsWith('Source:') ? 'Source:' : line))

    // Act
    const records = result.records

    // Assert
    expect(records).toEqual([])
    expect(result.errors.map((error) => error.code)).toContain('empty-field')
  })

  it('returns no records when one invalid record follows a valid record', () => {
    // Arrange
    const invalid = validRecord('Broken record').replace('Evidence strength: Practical exercise description', 'Evidence strength:')
    const input = `${validRecord('Valid record')}\n\n${invalid}`

    // Act
    const result = parseExerciseCatalogue(input)

    // Assert
    expect(result.records).toEqual([])
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]?.code).toBe('empty-field')
  })
})
