import type { SavedRoutine, Weekday, WeeklyScheduleEntry } from './types'

export const WEEKDAYS: readonly Weekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

export type ScheduleRoutineReference = string | Pick<SavedRoutine, 'id'>
export type ScheduleEntryChanges = Partial<Omit<WeeklyScheduleEntry, 'id'>>

export type WeeklyScheduleDay = {
  date: string
  day: Weekday
  entries: WeeklyScheduleEntry[]
}

export class ScheduleValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ScheduleValidationError'
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
)

export const isWeekday = (value: unknown): value is Weekday => (
  typeof value === 'string' && WEEKDAYS.includes(value as Weekday)
)

export const isValidTime = (value: unknown): value is string => (
  typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)
)

const routineIds = (routines: readonly ScheduleRoutineReference[]): Set<string> => (
  new Set(routines.map((routine) => typeof routine === 'string' ? routine : routine.id))
)

export const validateScheduleEntry = (
  value: unknown,
  routines?: readonly ScheduleRoutineReference[],
): string[] => {
  if (!isRecord(value)) return ['Schedule entry must be an object.']

  const errors: string[] = []
  if (typeof value.id !== 'string' || !value.id.trim()) {
    errors.push('Schedule entry needs a non-empty id.')
  }
  if (!isWeekday(value.day)) {
    errors.push('Schedule entry day must be a weekday.')
  }
  if (!isValidTime(value.time)) {
    errors.push('Schedule entry time must use HH:MM in 24-hour format.')
  }
  if (typeof value.routineId !== 'string' || !value.routineId.trim()) {
    errors.push('Schedule entry needs a routine reference.')
  } else if (routines && !routineIds(routines).has(value.routineId)) {
    errors.push('Schedule entry references an unknown routine.')
  }
  return errors
}

const cloneEntry = (entry: WeeklyScheduleEntry): WeeklyScheduleEntry => ({ ...entry })

function assertValidEntry(
  value: unknown,
  routines?: readonly ScheduleRoutineReference[],
): asserts value is WeeklyScheduleEntry {
  const errors = validateScheduleEntry(value, routines)
  if (errors.length > 0) throw new ScheduleValidationError(errors.join(' '))
}

/** Keep only structurally valid entries and, when supplied, known routine references. */
export const normalizeWeeklyEntries = (
  entries: readonly unknown[],
  routines?: readonly ScheduleRoutineReference[],
): WeeklyScheduleEntry[] => {
  if (!Array.isArray(entries)) return []
  return entries
    .filter((entry): entry is WeeklyScheduleEntry => validateScheduleEntry(entry, routines).length === 0)
    .map(cloneEntry)
}

export const normalizeScheduleEntries = normalizeWeeklyEntries

export const addScheduleEntry = (
  entries: readonly WeeklyScheduleEntry[],
  entry: WeeklyScheduleEntry,
  routines?: readonly ScheduleRoutineReference[],
): WeeklyScheduleEntry[] => {
  assertValidEntry(entry, routines)
  if (entries.some((current) => current.id === entry.id)) {
    throw new ScheduleValidationError(`Schedule entry id "${entry.id}" already exists.`)
  }
  return [...entries.map(cloneEntry), cloneEntry(entry)]
}

export const addWeeklyScheduleEntry = addScheduleEntry

export const updateScheduleEntry = (
  entries: readonly WeeklyScheduleEntry[],
  updatedEntry: WeeklyScheduleEntry,
  routines?: readonly ScheduleRoutineReference[],
): WeeklyScheduleEntry[] => {
  assertValidEntry(updatedEntry, routines)
  if (!entries.some((entry) => entry.id === updatedEntry.id)) {
    throw new ScheduleValidationError(`Schedule entry id "${updatedEntry.id}" was not found.`)
  }
  return entries.map((entry) => entry.id === updatedEntry.id ? cloneEntry(updatedEntry) : cloneEntry(entry))
}

export const updateWeeklyScheduleEntry = updateScheduleEntry

export const updateScheduleEntryById = (
  entries: readonly WeeklyScheduleEntry[],
  id: string,
  changes: ScheduleEntryChanges,
  routines?: readonly ScheduleRoutineReference[],
): WeeklyScheduleEntry[] => {
  if (typeof id !== 'string' || !id.trim()) {
    throw new ScheduleValidationError('Schedule entry id must not be empty.')
  }
  const current = entries.find((entry) => entry.id === id)
  if (!current) throw new ScheduleValidationError(`Schedule entry id "${id}" was not found.`)
  return updateScheduleEntry(entries, { ...current, ...changes, id }, routines)
}

export const removeScheduleEntry = (
  entries: readonly WeeklyScheduleEntry[],
  entryId: string,
): WeeklyScheduleEntry[] => {
  if (typeof entryId !== 'string' || !entryId.trim()) {
    throw new ScheduleValidationError('Schedule entry id must not be empty.')
  }
  return entries
    .filter((entry) => entry.id !== entryId)
    .map(cloneEntry)
}

export const removeScheduleEntriesByRoutineId = (
  entries: readonly WeeklyScheduleEntry[],
  routineId: string,
): WeeklyScheduleEntry[] => {
  if (typeof routineId !== 'string' || !routineId.trim()) {
    throw new ScheduleValidationError('Routine id must not be empty.')
  }
  return entries
    .filter((entry) => entry.routineId !== routineId)
    .map(cloneEntry)
}

export const removeWeeklyScheduleEntry = removeScheduleEntry

const sortEntries = (entries: WeeklyScheduleEntry[]): WeeklyScheduleEntry[] => (
  entries.sort((left, right) => left.time.localeCompare(right.time) || left.id.localeCompare(right.id))
)

export const groupScheduleEntries = (
  entries: readonly unknown[],
  routines?: readonly ScheduleRoutineReference[],
): Record<Weekday, WeeklyScheduleEntry[]> => {
  const grouped = Object.fromEntries(WEEKDAYS.map((day) => [day, [] as WeeklyScheduleEntry[]])) as Record<
    Weekday,
    WeeklyScheduleEntry[]
  >
  normalizeWeeklyEntries(entries, routines).forEach((entry) => grouped[entry.day].push(entry))
  WEEKDAYS.forEach((day) => sortEntries(grouped[day]))
  return grouped
}

export const groupScheduleByDay = groupScheduleEntries

const pad = (value: number): string => String(value).padStart(2, '0')

const formatDate = (date: Date): string => (
  `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
)

const parseWeekAnchor = (anchor: Date | string): Date => {
  if (typeof anchor === 'string') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(anchor)) {
      throw new ScheduleValidationError('Week anchor must be a valid YYYY-MM-DD date.')
    }
    const date = new Date(`${anchor}T00:00:00.000Z`)
    if (Number.isNaN(date.getTime()) || formatDate(date) !== anchor) {
      throw new ScheduleValidationError('Week anchor must be a valid YYYY-MM-DD date.')
    }
    return date
  }
  if (!(anchor instanceof Date) || Number.isNaN(anchor.getTime())) {
    throw new ScheduleValidationError('Week anchor must be a valid Date or YYYY-MM-DD date.')
  }
  return new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate()))
}

const getMonday = (anchor: Date): Date => {
  const daysSinceMonday = (anchor.getUTCDay() + 6) % 7
  const monday = new Date(anchor)
  monday.setUTCDate(monday.getUTCDate() - daysSinceMonday)
  return monday
}

/** Expand weekly assignments into a deterministic Monday-to-Sunday view. */
export const getWeeklySchedule = (
  entries: readonly unknown[],
  weekAnchor: Date | string,
  routines?: readonly ScheduleRoutineReference[],
): WeeklyScheduleDay[] => {
  const monday = getMonday(parseWeekAnchor(weekAnchor))
  const grouped = groupScheduleEntries(entries, routines)
  return WEEKDAYS.map((day, index) => {
    const date = new Date(monday)
    date.setUTCDate(monday.getUTCDate() + index)
    return { date: formatDate(date), day, entries: grouped[day].map(cloneEntry) }
  })
}

export const buildWeeklyRecurrence = getWeeklySchedule
export const getWeekView = getWeeklySchedule
export const getWeekSchedule = getWeeklySchedule
export const getWeeklyRecurrence = getWeeklySchedule
export const normalizeSchedule = normalizeWeeklyEntries

const getWeekdayIndex = (date: Date): number => (date.getDay() + 6) % 7

export type NextScheduleOccurrence = {
  entry: WeeklyScheduleEntry
  occurrenceDate: string
}

const formatLocalDate = (date: Date): string => (
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
)

/** Resolve the next weekly assignment and its concrete local calendar date. */
export const getNextScheduleOccurrence = (
  entries: readonly unknown[],
  now: Date,
): NextScheduleOccurrence | undefined => {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new ScheduleValidationError('Current date must be a valid Date.')
  }

  const currentDay = getWeekdayIndex(now)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const orderedEntries = normalizeWeeklyEntries(entries)
    .map((entry) => {
      const entryDay = WEEKDAYS.indexOf(entry.day)
      const dayOffset = (entryDay - currentDay + WEEKDAYS.length) % WEEKDAYS.length
      const occurrence = new Date(today)
      occurrence.setDate(occurrence.getDate() + dayOffset)
      const [hours, minutes] = entry.time.split(':').map(Number)
      occurrence.setHours(hours, minutes, 0, 0)

      if (occurrence.getTime() < now.getTime()) {
        occurrence.setDate(occurrence.getDate() + WEEKDAYS.length)
      }

      return { entry, occurrence }
    })
    .sort((left, right) => (
      left.occurrence.getTime() - right.occurrence.getTime()
      || left.entry.id.localeCompare(right.entry.id)
    ))

  const next = orderedEntries[0]
  return next
    ? { entry: next.entry, occurrenceDate: formatLocalDate(next.occurrence) }
    : undefined
}

/** Find the next weekly assignment without relying on the stored insertion order. */
export const getNextScheduleEntry = (
  entries: readonly unknown[],
  now: Date,
): WeeklyScheduleEntry | undefined => {
  return getNextScheduleOccurrence(entries, now)?.entry
}
