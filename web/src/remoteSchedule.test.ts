import { describe, expect, it, vi } from 'vitest'
import {
  detectIanaTimezone,
  getRemoteScheduleFeedback,
  projectReminderSchedule,
  uploadRemoteSchedule,
} from './remoteSchedule'
import { MissingPushCredentialsError, PushApiError, type PushApiClient } from './pushApi'

const reminders = { enabled: true, time: '07:30' as const }

describe('remote reminder projection', () => {
  it('projects only enabled, local time, IANA timezone, and matching weekday bits', () => {
    const projection = projectReminderSchedule(reminders, [
      { id: 'monday-routine', day: 'monday', time: '07:30', routineId: 'secret-routine' },
      { id: 'tuesday-routine', day: 'tuesday', time: '08:00', routineId: 'other-secret-routine' },
      { id: 'sunday-routine', day: 'sunday', time: '07:30', routineId: 'secret-routine' },
    ], 'America/Toronto')

    expect(projection).toEqual({ enabled: true, localTime: '07:30', timezone: 'America/Toronto', weekdayMask: 65 })
    expect(JSON.stringify(projection)).not.toContain('routine')
  })

  it('detects a usable IANA timezone for the remote contract', () => {
    expect(detectIanaTimezone()).toMatch(/^[A-Za-z_]+(?:\/[A-Za-z_+-]+)*$/)
  })

  it('uploads the projection without reading local routine data', async () => {
    const uploadSchedule = vi.fn(async () => ({
      deviceId: 'device_1',
      schedule: { ...projectReminderSchedule(reminders, [], 'UTC'), weekdayMask: 0 },
      updatedAt: '2026-11-19T12:34:56Z',
    }))
    const api = { uploadSchedule } as unknown as PushApiClient
    await uploadRemoteSchedule(api, reminders, [
      { id: 'entry', day: 'wednesday', time: '07:30', routineId: 'routine-id' },
    ], 'UTC')
    expect(uploadSchedule).toHaveBeenCalledWith({ enabled: true, localTime: '07:30', timezone: 'UTC', weekdayMask: 4 })
  })
})

describe('remote reminder feedback', () => {
  it('distinguishes unpaired, offline, and unauthorized states without secret details', () => {
    expect(getRemoteScheduleFeedback(new MissingPushCredentialsError()).status).toBe('unpaired')
    expect(getRemoteScheduleFeedback(new PushApiError('network', 'private endpoint')).status).toBe('offline')
    expect(getRemoteScheduleFeedback(new PushApiError('http', 'private response', 401))).toMatchObject({ status: 'unauthorized' })
    expect(getRemoteScheduleFeedback(new PushApiError('http', 'private response', 401)).message).not.toContain('private')
  })
})
