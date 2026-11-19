import { describe, expect, it, vi } from 'vitest'
import {
  checkAndDisplayDueReminder,
  detectNotificationCapability,
  displayBrowserNotification,
  getNotificationCapabilityMessage,
  notificationPermissionToCapability,
  requestNotificationPermission,
  type NotificationApi,
} from './notifications'
import type { ReminderSettings, WeeklyScheduleEntry } from './types'

const createNotification = (
  permission: NotificationApi['permission'],
  requestPermission = vi.fn(() => Promise.resolve(permission)),
  notify?: NotificationApi['notify'],
): NotificationApi => ({ permission, requestPermission, notify })

const reminders: ReminderSettings = {
  enabled: true,
  time: '09:30',
  notificationCapability: 'granted',
}

const schedule: WeeklyScheduleEntry[] = [
  { id: 'monday-session', day: 'monday', time: '09:30', routineId: 'routine' },
]

describe('browser notification capability', () => {
  it('detects unsupported browsers without calling a permission request', () => {
    expect(detectNotificationCapability(null)).toBe('unsupported')
  })

  it.each([
    ['default', 'default'],
    ['granted', 'granted'],
    ['denied', 'denied'],
  ] as const)('maps the %s browser permission to %s capability', (permission, capability) => {
    expect(notificationPermissionToCapability(permission)).toBe(capability)
  })

  it('does not treat an unknown permission state as successful', () => {
    expect(notificationPermissionToCapability('prompting')).toBe('error')
    expect(notificationPermissionToCapability(undefined)).toBe('error')
  })

  it('returns every permission outcome without opening a real browser prompt', async () => {
    const permissions = ['granted', 'denied', 'default'] as const

    for (const permission of permissions) {
      const requestPermission = vi.fn(() => Promise.resolve(permission))
      const notification = createNotification(permission, requestPermission)

      expect(await requestNotificationPermission(notification)).toBe(permission)
      expect(requestPermission).toHaveBeenCalledOnce()
    }
  })

  it('returns error when the browser permission request rejects', async () => {
    const notification = createNotification('default', vi.fn(() => Promise.reject(new Error('blocked'))))

    expect(await requestNotificationPermission(notification)).toBe('error')
  })

  it('provides an English unsupported fallback message', () => {
    const message = getNotificationCapabilityMessage('unsupported')

    expect(message).toContain('Reminders remain visible in your schedule')
    expect(message).toContain('browser notifications are unavailable')
  })

  it('keeps denied and error messages explicit about unavailable notifications', () => {
    expect(getNotificationCapabilityMessage('denied')).toContain('Allow notifications in your browser settings')
    expect(getNotificationCapabilityMessage('error')).toContain('We could not check browser notification permission')
  })

  it('detects a due reminder from the local weekday and configured minute', () => {
    const due = new Date(2026, 9, 19, 9, 30)
    const notDue = new Date(2026, 9, 19, 9, 31)
    const differentConfiguredTime = { ...reminders, time: '10:00' }

    expect(checkAndDisplayDueReminder(schedule, reminders, due, null).feedback).toContain('unavailable')
    expect(checkAndDisplayDueReminder(schedule, reminders, notDue, null).feedback).toBeNull()
    expect(checkAndDisplayDueReminder(schedule, differentConfiguredTime, due, null).feedback).toBeNull()
  })

  it('displays at most one notification during a due minute', () => {
    const notify = vi.fn()
    const notification = createNotification('granted', undefined, notify)
    const due = new Date(2026, 9, 19, 9, 30, 5)
    const first = checkAndDisplayDueReminder(schedule, reminders, due, notification)
    const second = checkAndDisplayDueReminder(
      schedule,
      reminders,
      new Date(2026, 9, 19, 9, 30, 50),
      notification,
      first.state,
    )

    expect(first.displayed).toBe(true)
    expect(second.displayed).toBe(false)
    expect(notify).toHaveBeenCalledOnce()
  })

  it('returns visible non-fatal feedback when notification display fails', () => {
    const notification = createNotification('granted', undefined, vi.fn(() => { throw new Error('display failed') }))

    const result = checkAndDisplayDueReminder(schedule, reminders, new Date(2026, 9, 19, 9, 30), notification)

    expect(result.displayed).toBe(false)
    expect(result.feedback).toContain('could not display it')
    expect(displayBrowserNotification(notification, 'Test reminder').success).toBe(false)
  })

  it.each(['denied', 'default'] as const)('never treats %s capability as a displayed notification', (permission) => {
    const result = displayBrowserNotification(createNotification(permission), 'Test reminder')

    expect(result.success).toBe(false)
  })
})
