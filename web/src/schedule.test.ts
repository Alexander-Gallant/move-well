import { describe, expect, it } from 'vitest'
import {
  ScheduleValidationError,
  addScheduleEntry,
  buildWeeklyRecurrence,
  getWeeklySchedule,
  getNextScheduleEntry,
  getNextScheduleOccurrence,
  groupScheduleEntries,
  normalizeWeeklyEntries,
  removeScheduleEntry,
  removeScheduleEntriesByRoutineId,
  updateScheduleEntry,
  updateScheduleEntryById,
} from './schedule'
import type { SavedRoutine, WeeklyScheduleEntry } from './types'

const routines: SavedRoutine[] = [
  { id: 'strength', name: 'Strength', selections: [] },
  { id: 'mobility', name: 'Mobility', selections: [] },
]

const entry = (overrides: Partial<WeeklyScheduleEntry> = {}): WeeklyScheduleEntry => ({
  id: 'session-1',
  day: 'monday',
  time: '09:00',
  routineId: 'strength',
  ...overrides,
})

describe('weekly schedule operations', () => {
  it('normalizes valid entries into new immutable records', () => {
    // Arrange
    const original = [entry()]

    // Act
    const result = normalizeWeeklyEntries(original, routines)

    // Assert
    expect(result).toEqual(original)
    expect(result).not.toBe(original)
    expect(result[0]).not.toBe(original[0])
  })

  it('rejects malformed times and missing routine references while preserving valid entries', () => {
    // Arrange
    const values = [
      entry(),
      entry({ id: 'bad-time', time: '24:00' }),
      entry({ id: 'missing-routine', routineId: 'unknown' }),
      entry({ id: 'bad-format', time: '9:00' }),
    ]

    // Act
    const result = normalizeWeeklyEntries(values, routines)

    // Assert
    expect(result).toEqual([entry()])
  })

  it('adds a valid assignment without mutating the source array', () => {
    // Arrange
    const current = [entry()]
    const next = entry({ id: 'session-2', day: 'wednesday', time: '23:59', routineId: 'mobility' })

    // Act
    const result = addScheduleEntry(current, next, routines)

    // Assert
    expect(result).toEqual([entry(), next])
    expect(result).not.toBe(current)
    expect(current).toEqual([entry()])
  })

  it('fails to add an invalid or duplicate assignment', () => {
    // Arrange
    const current = [entry()]

    // Act and assert
    expect(() => addScheduleEntry(current, entry({ time: '25:00' }), routines))
      .toThrow(ScheduleValidationError)
    expect(() => addScheduleEntry(current, entry(), routines))
      .toThrow('already exists')
    expect(() => addScheduleEntry(current, entry({ routineId: 'unknown' }), routines))
      .toThrow('unknown routine')
  })

  it('updates an assignment immutably and supports partial updates by id', () => {
    // Arrange
    const current = [entry()]
    const replacement = entry({ day: 'friday', time: '18:30', routineId: 'mobility' })

    // Act
    const replaced = updateScheduleEntry(current, replacement, routines)
    const partiallyUpdated = updateScheduleEntryById(current, 'session-1', { time: '00:00' }, routines)

    // Assert
    expect(replaced).toEqual([replacement])
    expect(partiallyUpdated).toEqual([entry({ time: '00:00' })])
    expect(current).toEqual([entry()])
  })

  it('fails to update unknown or invalid assignments', () => {
    // Arrange
    const current = [entry()]

    // Act and assert
    expect(() => updateScheduleEntry(current, entry({ id: 'missing' }), routines))
      .toThrow('was not found')
    expect(() => updateScheduleEntry(current, entry({ routineId: 'missing' }), routines))
      .toThrow('unknown routine')
    expect(() => updateScheduleEntryById(current, 'session-1', { time: '9:00' }, routines))
      .toThrow('HH:MM')
  })

  it('removes an assignment without mutating the source and keeps an unknown removal a no-op', () => {
    // Arrange
    const current = [entry(), entry({ id: 'session-2', day: 'tuesday' })]

    // Act
    const result = removeScheduleEntry(current, 'session-1')
    const unchanged = removeScheduleEntry(current, 'missing')

    // Assert
    expect(result).toEqual([entry({ id: 'session-2', day: 'tuesday' })])
    expect(unchanged).toEqual(current)
    expect(result).not.toBe(current)
    expect(current).toHaveLength(2)
  })

  it('removes every assignment for a routine without mutating other entries', () => {
    // Arrange
    const current = [
      entry({ id: 'strength-monday' }),
      entry({ id: 'mobility-tuesday', day: 'tuesday', routineId: 'mobility' }),
      entry({ id: 'strength-friday', day: 'friday' }),
    ]

    // Act
    const result = removeScheduleEntriesByRoutineId(current, 'strength')

    // Assert
    expect(result).toEqual([entry({ id: 'mobility-tuesday', day: 'tuesday', routineId: 'mobility' })])
    expect(result).not.toBe(current)
    expect(current).toHaveLength(3)
  })

  it('groups multiple assignments in time order and exposes empty rest days', () => {
    // Arrange
    const assignments = [
      entry({ id: 'late', time: '18:00' }),
      entry({ id: 'early', time: '07:30' }),
      entry({ id: 'other-day', day: 'sunday', routineId: 'mobility' }),
    ]

    // Act
    const grouped = groupScheduleEntries(assignments, routines)

    // Assert
    expect(grouped.monday.map((item) => item.id)).toEqual(['early', 'late'])
    expect(grouped.tuesday).toEqual([])
    expect(grouped.sunday).toEqual([entry({ id: 'other-day', day: 'sunday', routineId: 'mobility' })])
  })

  it('expands the supplied Sunday anchor into a deterministic Monday-to-Sunday week', () => {
    // Arrange
    const assignments = [
      entry({ id: 'monday-session' }),
      entry({ id: 'sunday-session', day: 'sunday', routineId: 'mobility' }),
    ]

    // Act
    const result = getWeeklySchedule(assignments, '2026-01-04', routines)
    const equivalent = buildWeeklyRecurrence(assignments, new Date('2026-01-04T17:45:00Z'), routines)

    // Assert
    expect(result.map((day) => day.date)).toEqual([
      '2025-12-29', '2025-12-30', '2025-12-31', '2026-01-01',
      '2026-01-02', '2026-01-03', '2026-01-04',
    ])
    expect(result[0]?.entries).toEqual([assignments[0]])
    expect(result[6]?.entries).toEqual([assignments[1]])
    expect(result).toEqual(equivalent)
  })

  it('rejects an invalid week anchor instead of consulting the current clock', () => {
    // Arrange
    const invalidAnchors = ['2026-02-30', 'not-a-date', new Date('invalid')]

    // Act and assert
    invalidAnchors.forEach((anchor) => {
      expect(() => getWeeklySchedule([], anchor as Date | string, routines))
        .toThrow(ScheduleValidationError)
    })
  })

  it('finds the next weekday and time in order instead of using insertion order', () => {
    // Arrange
    const assignments = [
      entry({ id: 'tuesday-early', day: 'tuesday', time: '07:30' }),
      entry({ id: 'monday-late', day: 'monday', time: '18:00' }),
      entry({ id: 'monday-early', day: 'monday', time: '07:00' }),
    ]

    // Act
    const result = getNextScheduleEntry(assignments, new Date(2026, 0, 5, 8, 0))

    // Assert
    expect(result).toEqual(assignments[1])
  })

  it('wraps to the next week when the remaining assignments are earlier', () => {
    // Arrange
    const assignments = [
      entry({ id: 'monday-session', day: 'monday', time: '09:00' }),
      entry({ id: 'wednesday-session', day: 'wednesday', time: '09:00' }),
    ]

    // Act
    const result = getNextScheduleEntry(assignments, new Date(2026, 0, 9, 18, 0))

    // Assert
    expect(result).toEqual(assignments[0])
  })

  it('resolves same-day assignments before and after their scheduled time', () => {
    // Arrange
    const assignments = [entry({ day: 'monday', time: '09:00' })]

    // Act
    const before = getNextScheduleOccurrence(assignments, new Date(2026, 0, 5, 8, 59))
    const after = getNextScheduleOccurrence(assignments, new Date(2026, 0, 5, 9, 1))

    // Assert
    expect(before).toEqual({ entry: assignments[0], occurrenceDate: '2026-01-05' })
    expect(after).toEqual({ entry: assignments[0], occurrenceDate: '2026-01-12' })
  })

  it('returns the concrete date when the next assignment rolls into the following week', () => {
    // Arrange
    const assignments = [
      entry({ id: 'monday-session', day: 'monday', time: '09:00' }),
      entry({ id: 'wednesday-session', day: 'wednesday', time: '09:00' }),
    ]

    // Act
    const result = getNextScheduleOccurrence(assignments, new Date(2026, 0, 9, 18, 0))

    // Assert
    expect(result).toEqual({ entry: assignments[0], occurrenceDate: '2026-01-12' })
  })

  it('orders multiple assignments by occurrence time and breaks ties by id', () => {
    // Arrange
    const assignments = [
      entry({ id: 'later', day: 'tuesday', time: '10:00' }),
      entry({ id: 'same-day-late', day: 'monday', time: '18:00' }),
      entry({ id: 'same-day-early', day: 'monday', time: '09:00' }),
    ]

    // Act
    const result = getNextScheduleOccurrence(assignments, new Date(2026, 0, 5, 8, 0))

    // Assert
    expect(result).toEqual({ entry: assignments[2], occurrenceDate: '2026-01-05' })
    expect(getNextScheduleOccurrence(assignments, new Date(2026, 0, 5, 8, 0))).toEqual(result)
  })

  it('rejects invalid dates without consulting an implicit current clock', () => {
    // Arrange
    const invalidDates = [new Date('invalid'), 'not-a-date' as unknown as Date]

    // Act and assert
    invalidDates.forEach((date) => {
      expect(() => getNextScheduleOccurrence([], date)).toThrow(ScheduleValidationError)
    })
  })
})
