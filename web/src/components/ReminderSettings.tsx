import { useCallback, useMemo, useState } from 'react'
import {
  detectNotificationCapability,
  getNotificationApi,
  getNotificationCapabilityMessage,
  requestNotificationPermission,
  type NotificationApi,
} from '../notifications'
import {
  createStorageAdapter,
  type StorageAdapter,
} from '../storage'
import type { ReminderSettings as ReminderSettingsData } from '../types'
import './ReminderSettings.css'

export type ReminderSettingsProps = {
  storageAdapter?: StorageAdapter
  /** Backward-compatible alias for consumers that name the dependency `storage`. */
  storage?: StorageAdapter
  notificationApi?: NotificationApi | null
  foregroundError?: string
}

const VALID_TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/

const getPermissionActionLabel = (capability: ReminderSettingsData['notificationCapability']): string => {
  if (capability === 'denied') return 'Try browser notifications again'
  if (capability === 'error') return 'Try again'
  return 'Enable browser notifications'
}

function ReminderSettings({ storage, storageAdapter, notificationApi, foregroundError = '' }: ReminderSettingsProps) {
  const adapter = useMemo(
    () => storageAdapter ?? storage ?? createStorageAdapter(),
    [storage, storageAdapter],
  )
  const resolvedNotificationApi = useMemo(
    () => notificationApi === undefined ? getNotificationApi() : notificationApi,
    [notificationApi],
  )
  const detectedCapability = useMemo(
    () => detectNotificationCapability(resolvedNotificationApi),
    [resolvedNotificationApi],
  )
  const [settings, setSettings] = useState<ReminderSettingsData>(() => ({
    ...adapter.read().reminders,
    notificationCapability: detectedCapability,
  }))
  const [isRequesting, setIsRequesting] = useState(false)
  const [persistenceError, setPersistenceError] = useState(false)
  const [timeError, setTimeError] = useState('')

  const persistSettings = useCallback((nextSettings: ReminderSettingsData) => {
    try {
      const currentState = adapter.read()
      const didWrite = adapter.write({ ...currentState, reminders: nextSettings })
      setPersistenceError(!didWrite)
    } catch {
      setPersistenceError(true)
    }
  }, [adapter])

  const updateSettings = (changes: Partial<ReminderSettingsData>) => {
    const nextSettings = { ...settings, ...changes }
    setSettings(nextSettings)
    persistSettings(nextSettings)
  }

  const handlePermissionRequest = async () => {
    setIsRequesting(true)
    const capability = await requestNotificationPermission(resolvedNotificationApi)
    const nextSettings = { ...settings, notificationCapability: capability }
    setSettings(nextSettings)
    persistSettings(nextSettings)
    setIsRequesting(false)
  }

  const handleTimeChange = (time: string) => {
    if (!VALID_TIME.test(time)) {
      setTimeError('Choose a valid reminder time.')
      return
    }

    setTimeError('')
    updateSettings({ time })
  }

  const capability = settings.notificationCapability
  const canRequestPermission = capability !== 'unsupported' && capability !== 'granted'

  return (
    <section aria-labelledby="reminder-settings-title" className="reminder-settings">
      <div className="reminder-settings__header">
        <div>
          <span className="reminder-settings__eyebrow">Keep the rhythm</span>
          <h2 id="reminder-settings-title">Reminder settings</h2>
          <p>Choose when your next workout reminder should appear.</p>
        </div>
        <span aria-hidden="true" className="reminder-settings__icon">◷</span>
      </div>

      <div className="reminder-settings__controls">
        <label className="reminder-settings__toggle-row">
          <span>
            <strong>Enable workout reminders</strong>
            <small>Keep reminders visible in your weekly schedule.</small>
          </span>
          <input
            aria-describedby="reminder-settings-help"
            checked={settings.enabled}
            onChange={(event) => updateSettings({ enabled: event.currentTarget.checked })}
            type="checkbox"
          />
        </label>

        <label className="reminder-settings__time-field">
          <span>Reminder time</span>
          <input
            aria-describedby={timeError ? 'reminder-time-error' : 'reminder-settings-help'}
            aria-invalid={timeError ? 'true' : 'false'}
            onChange={(event) => handleTimeChange(event.currentTarget.value)}
            type="time"
            value={settings.time}
          />
        </label>
      </div>

      <p className="reminder-settings__help" id="reminder-settings-help">
        Browser notifications are optional. While this app is open, a matching reminder may show at
        the configured minute; background delivery is not guaranteed. Your reminder remains part of
        the schedule either way.
      </p>

      {timeError && <p className="reminder-settings__error" id="reminder-time-error" role="alert">{timeError}</p>}

      <div className={`reminder-settings__status reminder-settings__status--${capability}`} aria-live="polite" role="status">
        <strong>{capability === 'granted' ? 'Notifications ready' : 'Browser notification status'}</strong>
        <p>{getNotificationCapabilityMessage(capability)}</p>
        {canRequestPermission && (
          <button
            className="reminder-settings__permission-button"
            disabled={isRequesting}
            onClick={() => { void handlePermissionRequest() }}
            type="button"
          >
            {isRequesting ? 'Checking permission…' : getPermissionActionLabel(capability)}
          </button>
        )}
      </div>

      {persistenceError && (
        <p className="reminder-settings__error" role="alert">
          Your reminder changes could not be saved on this device.
        </p>
      )}

      {foregroundError && (
        <p className="reminder-settings__error" role="alert">
          {foregroundError}
        </p>
      )}
    </section>
  )
}

export default ReminderSettings
