import { describe, expect, it, vi } from 'vitest'
import {
  MissingPushCredentialsError,
  PushApiError,
  PushHttpError,
  PushNetworkError,
  createPushApi,
  type PushApiFetch,
} from './pushApi'
import { createPushCredentialStore, type PushCredentialStorage } from './pushCredentials'

const credentials = { deviceId: 'device_123', deviceToken: 'token_abc' }
const schedule = { enabled: true, localTime: '07:30', timezone: 'America/Toronto', weekdayMask: 21 }
const subscription = {
  endpoint: 'https://push.example.test/subscription/opaque',
  keys: { p256dh: 'public_key', auth: 'auth_key' },
}

const createStorage = (): PushCredentialStorage & { values: Record<string, string> } => {
  const values: Record<string, string> = {}
  return {
    values,
    getItem: (key) => values[key] ?? null,
    setItem: (key, value) => { values[key] = value },
    removeItem: (key) => { delete values[key] },
  }
}

const response = (body: unknown, status = 200): Response => (
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
)

const createClient = (fetcher: PushApiFetch, storage = createStorage()) => createPushApi({
  apiBaseUrl: 'https://api.example.test',
  fetch: fetcher,
  credentials: createPushCredentialStore(storage),
})

describe('push API adapter', () => {
  it('pairs over HTTPS, serializes the code, and stores returned credentials', async () => {
    const fetcher = vi.fn<PushApiFetch>(() => Promise.resolve(response({
      deviceId: credentials.deviceId,
      deviceToken: credentials.deviceToken,
      tokenType: 'Bearer',
    }, 201)))
    const storage = createStorage()
    const client = createClient(fetcher, storage)

    await expect(client.pair('operator-code')).resolves.toEqual({
      deviceId: credentials.deviceId,
      deviceToken: credentials.deviceToken,
      tokenType: 'Bearer',
    })
    expect(fetcher).toHaveBeenCalledWith('https://api.example.test/v1/pair', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ pairingCode: 'operator-code' }),
    }))
    expect(storage.values['move-well-push-credentials']).toBe(JSON.stringify(credentials))
  })

  it('uses existing credentials for authenticated push and schedule uploads', async () => {
    const fetcher = vi.fn<PushApiFetch>()
      .mockResolvedValueOnce(response({ deviceId: credentials.deviceId, registered: true, updatedAt: '2026-11-19T12:34:56Z' }))
      .mockResolvedValueOnce(response({ deviceId: credentials.deviceId, schedule, updatedAt: '2026-11-19T12:34:56Z' }))
    const storage = createStorage()
    createPushCredentialStore(storage).write(credentials)
    const client = createClient(fetcher, storage)

    await client.uploadPush(subscription)
    await client.uploadSchedule(schedule)

    expect(fetcher).toHaveBeenNthCalledWith(1, 'https://api.example.test/v1/devices/device_123/push', expect.objectContaining({
      headers: { Authorization: 'Bearer token_abc', 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription }),
    }))
    expect(fetcher).toHaveBeenNthCalledWith(2, 'https://api.example.test/v1/devices/device_123/schedule', expect.objectContaining({
      headers: { Authorization: 'Bearer token_abc', 'Content-Type': 'application/json' },
      body: JSON.stringify(schedule),
    }))
  })

  it('validates safe status responses and clears credentials after revoke', async () => {
    const fetcher = vi.fn<PushApiFetch>()
      .mockResolvedValueOnce(response({
        deviceId: credentials.deviceId,
        revoked: false,
        push: { registered: true, updatedAt: '2026-11-19T12:34:56Z' },
        schedule,
      }))
      .mockResolvedValueOnce(response(undefined, 204))
    const storage = createStorage()
    createPushCredentialStore(storage).write(credentials)
    const client = createClient(fetcher, storage)

    await expect(client.status()).resolves.toMatchObject({ deviceId: credentials.deviceId, revoked: false })
    await expect(client.revoke()).resolves.toBeUndefined()
    expect(createPushCredentialStore(storage).read()).toBeNull()
    expect(fetcher).toHaveBeenLastCalledWith('https://api.example.test/v1/devices/device_123', expect.objectContaining({
      method: 'DELETE',
      headers: { Authorization: 'Bearer token_abc' },
    }))
  })

  it('distinguishes missing credentials, network failures, and HTTP failures without response secrets', async () => {
    const missing = createClient(vi.fn<PushApiFetch>())
    await expect(missing.status()).rejects.toBeInstanceOf(MissingPushCredentialsError)

    const network = createClient(vi.fn<PushApiFetch>(() => Promise.reject(new Error('private network detail'))))
    const networkError = await network.pair('operator-code').catch((error: unknown) => error)
    expect(networkError).toBeInstanceOf(PushNetworkError)
    expect((networkError as Error).message).not.toContain('private network detail')

    const http = createClient(vi.fn<PushApiFetch>(() => Promise.resolve(response({
      error: { message: 'token_abc and pairing secret must not escape' },
    }, 401))))
    const httpError = await http.pair('operator-code').catch((error: unknown) => error)
    expect(httpError).toBeInstanceOf(PushHttpError)
    expect((httpError as Error).message).not.toContain('token_abc')
  })

  it('rejects insecure pairing configuration, invalid responses, and oversized payloads', async () => {
    expect(() => createPushApi({ apiBaseUrl: 'http://api.example.test' })).toThrow(PushApiError)

    const invalid = createClient(vi.fn<PushApiFetch>(() => Promise.resolve(response({ deviceId: 'device_123' }, 201))))
    await expect(invalid.pair('operator-code')).rejects.toMatchObject({ kind: 'invalid-response' })

    const oversizedStorage = createStorage()
    createPushCredentialStore(oversizedStorage).write(credentials)
    const oversized = createClient(vi.fn<PushApiFetch>(), oversizedStorage)
    const tooLarge = { ...subscription, endpoint: `https://push.example.test/${'x'.repeat(3000)}` }
    await expect(oversized.uploadPush(tooLarge)).rejects.toMatchObject({ kind: 'validation' })
  })
})
