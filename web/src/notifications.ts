import type { NotificationCapability, ReminderSettings, Weekday, WeeklyScheduleEntry } from './types'

export type NotificationPermission = 'default' | 'granted' | 'denied'

export type NotificationApi = {
  readonly permission: NotificationPermission
  requestPermission: () => Promise<NotificationPermission> | NotificationPermission
  notify?: (title: string, options?: NotificationDisplayOptions) => void
}

export type NotificationDisplayOptions = {
  body?: string
}

export type NotificationDisplayResult =
  | { success: true }
  | { success: false; capability: NotificationCapability; message: string }

export type ForegroundReminderState = {
  lastHandledMinute: string | null
}

export type ForegroundReminderResult = {
  state: ForegroundReminderState
  displayed: boolean
  feedback: string | null
}

const isNotificationPermission = (value: unknown): value is NotificationPermission => (
  value === 'default' || value === 'granted' || value === 'denied'
)

export const notificationPermissionToCapability = (
  permission: unknown,
): NotificationCapability => (
  isNotificationPermission(permission) ? permission : 'error'
)

export const getNotificationApi = (): NotificationApi | null => {
  try {
    const candidate = (globalThis as { Notification?: unknown }).Notification
    if (!candidate || typeof candidate !== 'function') return null

    const notification = candidate as {
      readonly permission?: unknown
      requestPermission?: () => Promise<NotificationPermission> | NotificationPermission
    }
    if (typeof notification.requestPermission !== 'function') return null

    return {
      get permission() {
        return notificationPermissionToCapability(notification.permission) as NotificationPermission
      },
      requestPermission: () => notification.requestPermission!(),
      notify: (title, options) => {
        const NotificationConstructor = notification as unknown as {
          new (notificationTitle: string, notificationOptions?: NotificationDisplayOptions): unknown
        }
        return new NotificationConstructor(title, options)
      },
    }
  } catch {
    return null
  }
}

export const detectNotificationCapability = (
  notification: NotificationApi | null = getNotificationApi(),
): NotificationCapability => {
  if (!notification) return 'unsupported'

  try {
    return notificationPermissionToCapability(notification.permission)
  } catch {
    return 'error'
  }
}

export const requestNotificationPermission = async (
  notification: NotificationApi | null = getNotificationApi(),
): Promise<NotificationCapability> => {
  if (!notification) return 'unsupported'

  try {
    const permission = await notification.requestPermission()
    return notificationPermissionToCapability(permission)
  } catch {
    return 'error'
  }
}

export const getNotificationCapabilityMessage = (
  capability: NotificationCapability,
): string => {
  switch (capability) {
    case 'granted':
      return 'Browser notifications are enabled for your reminders.'
    case 'default':
      return 'Browser notifications are not enabled yet. Choose “Enable browser notifications” to allow reminder alerts.'
    case 'denied':
      return 'Browser notifications are blocked. Reminders remain visible in your schedule, but browser notifications are unavailable. Allow notifications in your browser settings to try again.'
    case 'unsupported':
      return 'This browser does not support notifications. Reminders remain visible in your schedule, but browser notifications are unavailable.'
    case 'error':
      return 'We could not check browser notification permission. Reminders remain visible in your schedule, but browser notifications are unavailable.'
  }
}

const weekdayForDate = (date: Date): Weekday => {
  const sundayFirst: Weekday[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  return sundayFirst[date.getDay()] ?? 'sunday'
}

const pad = (value: number): string => String(value).padStart(2, '0')

export const getLocalMinuteKey = (date: Date): string => (
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
)

export const isDueReminder = (
  schedule: readonly WeeklyScheduleEntry[],
  reminders: ReminderSettings,
  now: Date,
): boolean => {
  if (Number.isNaN(now.getTime()) || !reminders.enabled || reminders.notificationCapability !== 'granted') {
    return false
  }

  const currentTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`
  const currentDay = weekdayForDate(now)
  if (reminders.time !== currentTime) return false
  return schedule.some((entry) => entry.day === currentDay && entry.time === reminders.time)
}

const getDisplayFailureMessage = (capability: NotificationCapability): string => {
  if (capability === 'granted') {
    return 'Your reminder was due, but the browser could not display it. The schedule is still available in the app.'
  }

  return `Your reminder was due, but browser notifications are unavailable. ${getNotificationCapabilityMessage(capability)}`
}

/** Display only when the capability is currently granted; failures are never reported as success. */
export const displayBrowserNotification = (
  notification: NotificationApi | null,
  title: string,
  options?: NotificationDisplayOptions,
): NotificationDisplayResult => {
  const capability = detectNotificationCapability(notification)
  if (capability !== 'granted') {
    return { success: false, capability, message: getDisplayFailureMessage(capability) }
  }

  if (!notification?.notify) {
    return { success: false, capability: 'error', message: getDisplayFailureMessage('granted') }
  }

  try {
    notification.notify(title, options)
    return { success: true }
  } catch {
    return { success: false, capability: 'error', message: getDisplayFailureMessage('granted') }
  }
}

/** Check one local minute and suppress duplicate attempts during this page session. */
export const checkAndDisplayDueReminder = (
  schedule: readonly WeeklyScheduleEntry[],
  reminders: ReminderSettings,
  now: Date,
  notification: NotificationApi | null,
  state: ForegroundReminderState = { lastHandledMinute: null },
): ForegroundReminderResult => {
  if (!isDueReminder(schedule, reminders, now)) {
    return { state, displayed: false, feedback: null }
  }

  const minuteKey = getLocalMinuteKey(now)
  if (state.lastHandledMinute === minuteKey) {
    return { state, displayed: false, feedback: null }
  }

  const displayResult = displayBrowserNotification(notification, 'Workout reminder', {
    body: 'Your scheduled routine is ready.',
  })
  return {
    state: { lastHandledMinute: minuteKey },
    displayed: displayResult.success,
    feedback: displayResult.success ? null : displayResult.message,
  }
}
