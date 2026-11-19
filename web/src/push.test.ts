import { describe, expect, it, vi } from 'vitest'
import {
  decodeBase64Url,
  getPushRegistrationMessage,
  subscribeForPush,
  type PushSubscriptionLike,
  type ServiceWorkerContainerLike,
} from './push'

const subscription: PushSubscriptionLike = {
  endpoint: 'https://push.example.test/subscription',
  toJSON: () => ({ endpoint: 'https://push.example.test/subscription' }),
}

const createServiceWorker = (
  existingSubscription: PushSubscriptionLike | null = null,
  subscribeResult: PushSubscriptionLike = subscription,
): { serviceWorker: ServiceWorkerContainerLike; getSubscription: ReturnType<typeof vi.fn>; subscribe: ReturnType<typeof vi.fn> } => {
  const getSubscription = vi.fn(() => Promise.resolve(existingSubscription))
  const subscribe = vi.fn(() => Promise.resolve(subscribeResult))
  return {
    serviceWorker: {
      ready: Promise.resolve({ pushManager: { getSubscription, subscribe } }),
    },
    getSubscription,
    subscribe,
  }
}

describe('push subscription registration', () => {
  it('decodes URL-safe base64 values for application server keys', () => {
    expect(Array.from(new Uint8Array(decodeBase64Url('AQIDBA')))).toEqual([1, 2, 3, 4])
  })

  it('requires notification permission before touching the service worker', async () => {
    const serviceWorker = createServiceWorker()

    const result = await subscribeForPush({
      notificationPermission: 'default',
      serviceWorker: serviceWorker.serviceWorker,
      vapidPublicKey: 'AQIDBA',
    })

    expect(result.status).toBe('permission-required')
    expect(serviceWorker.getSubscription).not.toHaveBeenCalled()
  })

  it('reports unsupported environments without a service worker', async () => {
    const result = await subscribeForPush({
      notificationPermission: 'granted',
      serviceWorker: null,
      vapidPublicKey: 'AQIDBA',
    })

    expect(result.status).toBe('unsupported')
  })

  it('reports a missing VAPID public key without subscribing', async () => {
    const serviceWorker = createServiceWorker()

    const result = await subscribeForPush({
      notificationPermission: 'granted',
      serviceWorker: serviceWorker.serviceWorker,
    })

    expect(result.status).toBe('not-configured')
    expect(serviceWorker.getSubscription).not.toHaveBeenCalled()
  })

  it('returns an existing subscription without creating a duplicate', async () => {
    const serviceWorker = createServiceWorker(subscription)

    const result = await subscribeForPush({
      notificationPermission: 'granted',
      serviceWorker: serviceWorker.serviceWorker,
      vapidPublicKey: 'AQIDBA',
    })

    expect(result).toEqual({ status: 'subscribed', subscription })
    expect(serviceWorker.subscribe).not.toHaveBeenCalled()
  })

  it('creates a visible push subscription with the configured VAPID key', async () => {
    const serviceWorker = createServiceWorker()

    const result = await subscribeForPush({
      notificationPermission: 'granted',
      serviceWorker: serviceWorker.serviceWorker,
      vapidPublicKey: 'AQIDBA',
    })

    expect(result).toEqual({ status: 'subscribed', subscription })
    expect(serviceWorker.subscribe).toHaveBeenCalledWith({
      applicationServerKey: new Uint8Array([1, 2, 3, 4]).buffer,
      userVisibleOnly: true,
    })
  })

  it('maps registration failures to non-fatal error results', async () => {
    const serviceWorker = createServiceWorker()
    serviceWorker.getSubscription.mockRejectedValue(new Error('subscription unavailable'))

    const result = await subscribeForPush({
      notificationPermission: 'granted',
      serviceWorker: serviceWorker.serviceWorker,
      vapidPublicKey: 'AQIDBA',
    })

    expect(result.status).toBe('error')
  })
})

describe('push registration messages', () => {
  it('explains that unconfigured push is separate from browser permission', () => {
    expect(getPushRegistrationMessage('not-configured')).toContain('notification service is configured')
  })
})
