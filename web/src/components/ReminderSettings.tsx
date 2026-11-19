import { useCallback, useMemo, useState } from 'react'
import {
  detectNotificationCapability,
  getNotificationApi,
  getNotificationCapabilityMessage,
  requestNotificationPermission,
  type NotificationApi,
} from '../notifications'
import {
  getPushRegistrationMessage,
  subscribeForPush,
  type PushRegistrationDependencies,
  type PushRegistrationStatus,
} from '../push'
import {
  getRemoteScheduleFeedback,
  projectReminderSchedule,
  remoteScheduleSuccessFeedback,
  type RemoteScheduleFeedback,
} from '../remoteSchedule'
import type { PushApiClient, PushApiError } from '../pushApi'
import { createPushCredentialStore, type PushCredentialStore } from '../pushCredentials'
import {
  createStorageAdapter,
  type StorageAdapter,
} from '../storage'
import type { ReminderSettings as ReminderSettingsData, WeeklyScheduleEntry } from '../types'
import './ReminderSettings.css'

export type ReminderSettingsProps = {
  storageAdapter?: StorageAdapter
  /** Backward-compatible alias for consumers that name the dependency `storage`. */
  storage?: StorageAdapter
  notificationApi?: NotificationApi | null
  pushDependencies?: PushRegistrationDependencies
  foregroundError?: string
  pushApi?: PushApiClient | null
  pushApiError?: PushApiError | null
  pushCredentialStore?: PushCredentialStore
  schedule?: readonly WeeklyScheduleEntry[]
}

const VALID_TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/

const getPermissionActionLabel = (capability: ReminderSettingsData['notificationCapability']): string => {
  if (capability === 'denied') return 'Try browser notifications again'
  if (capability === 'error') return 'Try again'
  return 'Enable browser notifications'
}

const getPushActionLabel = (status: PushRegistrationStatus | 'idle'): string => (
  status === 'error' ? 'Try device registration again' : 'Register this device for push'
)

const getConfigurationFeedback = (pushApi: PushApiClient | null | undefined, pushApiError: PushApiError | null | undefined, isPaired: boolean): RemoteScheduleFeedback => {
  if (pushApi && !pushApiError) {
    return isPaired
      ? { status: 'success', message: 'This device is paired. Register push to sync remote reminders.' }
      : { status: 'unpaired', message: 'Pair this device to enable private remote reminders.' }
  }
  return pushApiError
    ? getRemoteScheduleFeedback(pushApiError)
    : { status: 'unconfigured', message: 'Remote reminder sync is not configured. Local reminders remain available.' }
}

function ReminderSettings({
  storage,
  storageAdapter,
  notificationApi,
  pushDependencies,
  foregroundError = '',
  pushApi = null,
  pushApiError = null,
  pushCredentialStore,
  schedule = [],
}: ReminderSettingsProps) {
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
  const [pushStatus, setPushStatus] = useState<PushRegistrationStatus | 'idle'>('idle')
  const credentials = useMemo(() => pushCredentialStore ?? createPushCredentialStore(), [pushCredentialStore])
  const [pairingCode, setPairingCode] = useState('')
  const [remoteBusy, setRemoteBusy] = useState(false)
  const [isPaired, setIsPaired] = useState(() => credentials.read() !== null)
  const [remoteFeedback, setRemoteFeedback] = useState<RemoteScheduleFeedback>(() => getConfigurationFeedback(pushApi, pushApiError, credentials.read() !== null))
  const [persistenceError, setPersistenceError] = useState(false)
  const [timeError, setTimeError] = useState('')

  const showRemoteError = (error: unknown) => {
    const nextFeedback = getRemoteScheduleFeedback(error)
    if (nextFeedback.status === 'unauthorized') {
      credentials.clear()
      setIsPaired(false)
    }
    setRemoteFeedback(nextFeedback)
  }

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
    void syncSchedule(nextSettings)
  }

  const syncSchedule = async (nextSettings: ReminderSettingsData = settings) => {
    if (!pushApi || !isPaired) return
    setRemoteBusy(true)
    try {
      await pushApi.uploadSchedule(projectReminderSchedule(nextSettings, schedule))
      setRemoteFeedback(remoteScheduleSuccessFeedback)
    } catch (error) {
      showRemoteError(error)
    } finally {
      setRemoteBusy(false)
    }
  }

  const handlePermissionRequest = async () => {
    setIsRequesting(true)
    const capability = await requestNotificationPermission(resolvedNotificationApi)
    const nextSettings = { ...settings, notificationCapability: capability }
    setSettings(nextSettings)
    persistSettings(nextSettings)
    setIsRequesting(false)
  }

  const pairDevice = async () => {
    if (!pushApi || !pairingCode.trim()) return
    setRemoteBusy(true)
    try {
      await pushApi.pair(pairingCode.trim())
      setPairingCode('')
      setIsPaired(true)
      setRemoteFeedback({ status: 'success', message: 'Device paired. Register push to finish setup.' })
    } catch (error) {
      showRemoteError(error)
    } finally {
      setRemoteBusy(false)
    }
  }

  const registerDevice = async () => {
    if (!pushApi) return
    setIsRequesting(true)
    setRemoteBusy(true)
    try {
      const result = await subscribeForPush({
        ...pushDependencies,
        notificationPermission: 'granted',
      })
      setPushStatus(result.status)
      if (result.status !== 'subscribed' || !result.subscription) {
        showRemoteError(new Error('Push subscription unavailable'))
        return
      }
      await pushApi.uploadPush(result.subscription)
      await pushApi.uploadSchedule(projectReminderSchedule(settings, schedule))
      setRemoteFeedback({ status: 'success', message: 'This device and its reminder schedule are registered.' })
    } catch (error) {
      showRemoteError(error)
    } finally {
      setRemoteBusy(false)
      setIsRequesting(false)
    }
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
  const canRegisterPush = capability === 'granted' && Boolean(pushApi) && isPaired

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
        {canRegisterPush && (
          <button
            className="reminder-settings__permission-button"
            disabled={isRequesting}
             onClick={() => { void registerDevice() }}
            type="button"
          >
             {isRequesting ? 'Registering device…' : getPushActionLabel(pushStatus)}
           </button>
        )}
        {pushStatus !== 'idle' && <p>{getPushRegistrationMessage(pushStatus)}</p>}
      </div>

      <div className="reminder-settings__remote" aria-labelledby="remote-reminder-title">
        <strong id="remote-reminder-title">Private remote reminders</strong>
        <p>Only your push subscription and four-field reminder projection leave this device. Exercises and routines stay local.</p>
        {!isPaired && pushApi && (
          <div className="reminder-settings__pairing">
            <label htmlFor="pairing-code">Pairing code</label>
            <input
              id="pairing-code"
              autoComplete="off"
              onChange={(event) => setPairingCode(event.currentTarget.value)}
              value={pairingCode}
            />
            <button
              className="reminder-settings__permission-button"
              disabled={remoteBusy || pairingCode.trim().length === 0}
              onClick={() => { void pairDevice() }}
              type="button"
            >
              {remoteBusy ? 'Pairing device…' : 'Pair this device'}
            </button>
          </div>
        )}
        {isPaired && capability !== 'granted' && <p>Allow browser notifications, then register this device for remote reminders.</p>}
        {isPaired && capability === 'granted' && !canRegisterPush && <p>Push registration is unavailable in this browser; local reminders still work.</p>}
        <p className={`reminder-settings__remote-status reminder-settings__remote-status--${remoteFeedback.status}`} aria-live="polite">
          {remoteFeedback.message}
        </p>
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
