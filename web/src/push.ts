export type PushRegistrationStatus =
  | 'subscribed'
  | 'unsupported'
  | 'not-configured'
  | 'permission-required'
  | 'error'

export type PushSubscriptionLike = {
  readonly endpoint: string
  readonly toJSON: () => unknown
}

export type PushManagerLike = {
  getSubscription: () => Promise<PushSubscriptionLike | null>
  subscribe: (options: PushSubscriptionOptionsInit) => Promise<PushSubscriptionLike>
}

export type ServiceWorkerContainerLike = {
  readonly ready: Promise<{ readonly pushManager?: PushManagerLike }>
}

export type PushRegistrationResult = {
  status: PushRegistrationStatus
  subscription?: PushSubscriptionLike
}

export type PushRegistrationDependencies = {
  serviceWorker?: ServiceWorkerContainerLike | null
  vapidPublicKey?: string
  notificationPermission?: NotificationPermission
}

const getDefaultServiceWorkerContainer = (): ServiceWorkerContainerLike | null => {
  try {
    const candidate = (globalThis as { navigator?: { serviceWorker?: ServiceWorkerContainerLike } })
      .navigator?.serviceWorker
    return candidate ?? null
  } catch {
    return null
  }
}

const getConfiguredVapidPublicKey = (): string => {
  try {
    return import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim() ?? ''
  } catch {
    return ''
  }
}

export const decodeBase64Url = (value: string): ArrayBuffer => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4)
  const binary = globalThis.atob(`${normalized}${padding}`)
  const bytes = new Uint8Array(binary.length)
  binary.split('').forEach((character, index) => {
    bytes[index] = character.charCodeAt(0)
  })
  return bytes.buffer
}

export const subscribeForPush = async ({
  serviceWorker = getDefaultServiceWorkerContainer(),
  vapidPublicKey = getConfiguredVapidPublicKey(),
  notificationPermission = 'default',
}: PushRegistrationDependencies = {}): Promise<PushRegistrationResult> => {
  if (notificationPermission !== 'granted') return { status: 'permission-required' }
  if (!serviceWorker) return { status: 'unsupported' }
  if (!vapidPublicKey) return { status: 'not-configured' }

  try {
    const registration = await serviceWorker.ready
    const pushManager = registration.pushManager
    if (!pushManager) return { status: 'unsupported' }

    const existingSubscription = await pushManager.getSubscription()
    if (existingSubscription) {
      return { status: 'subscribed', subscription: existingSubscription }
    }

    const subscription = await pushManager.subscribe({
      applicationServerKey: decodeBase64Url(vapidPublicKey),
      userVisibleOnly: true,
    })
    return { status: 'subscribed', subscription }
  } catch {
    return { status: 'error' }
  }
}

export const getPushRegistrationMessage = (status: PushRegistrationStatus): string => {
  switch (status) {
    case 'subscribed':
      return 'This device is registered for future workout push reminders.'
    case 'unsupported':
      return 'This browser cannot register for background push reminders. Your schedule remains available in the app.'
    case 'not-configured':
      return 'Browser notifications are enabled. Push reminders will be available after the notification service is configured.'
    case 'permission-required':
      return 'Allow notifications before registering this device for push reminders.'
    case 'error':
      return 'This device could not be registered for push reminders. Your schedule remains available in the app.'
  }
}
