import {
  MissingPushCredentialsError,
  PushApiError,
  type PushApiClient,
  type PushSchedulePayload,
} from './pushApi'
import { WEEKDAYS } from './schedule'
import type { ReminderSettings, WeeklyScheduleEntry } from './types'

export type RemoteScheduleStatus =
  | 'unconfigured'
  | 'unpaired'
  | 'unauthorized'
  | 'offline'
  | 'success'
  | 'error'

export type RemoteScheduleFeedback = {
  readonly status: RemoteScheduleStatus
  readonly message: string
}

/** Return the browser's IANA timezone without allowing a browser error to break local reminders. */
export const detectIanaTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

const weekdayMaskForSchedule = (
  schedule: readonly WeeklyScheduleEntry[],
  localTime: string,
): number => WEEKDAYS.reduce((mask, weekday, index) => (
  schedule.some((entry) => entry.day === weekday && entry.time === localTime)
    ? mask | (1 << index)
    : mask
), 0)

/**
 * Project local reminder data to the deliberately small remote contract.
 * Routine names, ids, exercises, and generated sessions are never read here.
 */
export const projectReminderSchedule = (
  reminders: Pick<ReminderSettings, 'enabled' | 'time'>,
  schedule: readonly WeeklyScheduleEntry[],
  timezone = detectIanaTimezone(),
): PushSchedulePayload => ({
  enabled: reminders.enabled,
  localTime: reminders.time,
  timezone,
  weekdayMask: weekdayMaskForSchedule(schedule, reminders.time),
})

export const uploadRemoteSchedule = async (
  api: PushApiClient,
  reminders: Pick<ReminderSettings, 'enabled' | 'time'>,
  schedule: readonly WeeklyScheduleEntry[],
  timezone = detectIanaTimezone(),
): Promise<PushSchedulePayload> => {
  const projection = projectReminderSchedule(reminders, schedule, timezone)
  await api.uploadSchedule(projection)
  return projection
}

export const getRemoteScheduleFeedback = (
  error: unknown,
): RemoteScheduleFeedback => {
  if (error instanceof MissingPushCredentialsError
    || (error instanceof PushApiError && error.kind === 'missing-credentials')) {
    return { status: 'unpaired', message: 'Pair this device before syncing remote reminders.' }
  }
  if (error instanceof PushApiError && error.kind === 'configuration') {
    return { status: 'unconfigured', message: 'Remote reminder sync is not configured. Local reminders remain available.' }
  }
  if (error instanceof PushApiError && error.kind === 'network') {
    return { status: 'offline', message: 'The remote reminder service is unavailable. Your local changes were saved.' }
  }
  if (error instanceof PushApiError && (error.status === 401 || error.status === 403)) {
    return { status: 'unauthorized', message: 'This device is no longer authorized. Pair it again to retry remote reminders.' }
  }
  return { status: 'error', message: 'Remote reminders could not be updated. Your local changes were saved.' }
}

export const remoteScheduleSuccessFeedback: RemoteScheduleFeedback = {
  status: 'success',
  message: 'Remote reminder schedule updated.',
}
