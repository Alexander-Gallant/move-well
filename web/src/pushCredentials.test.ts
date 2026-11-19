import { describe, expect, it } from 'vitest'
import {
  PUSH_CREDENTIALS_KEY,
  createPushCredentialStore,
  readPushCredentials,
  type PushCredentialStorage,
} from './pushCredentials'

const createStorage = (initial: Record<string, string> = {}): PushCredentialStorage & { values: Record<string, string> } => {
  const values = { ...initial }
  return {
    values,
    getItem: (key) => values[key] ?? null,
    setItem: (key, value) => { values[key] = value },
    removeItem: (key) => { delete values[key] },
  }
}

describe('push credential storage', () => {
  it('stores only device id and token under the dedicated browser key', () => {
    const storage = createStorage({ 'move-well-storage': 'local fitness data' })
    const store = createPushCredentialStore(storage)

    expect(store.write({ deviceId: 'device_123', deviceToken: 'token_abc' })).toBe(true)
    expect(storage.values[PUSH_CREDENTIALS_KEY]).toBe('{"deviceId":"device_123","deviceToken":"token_abc"}')
    expect(storage.values['move-well-storage']).toBe('local fitness data')
    expect(store.read()).toEqual({ deviceId: 'device_123', deviceToken: 'token_abc' })
  })

  it('rejects malformed or expanded credential records', () => {
    const storage = createStorage({
      [PUSH_CREDENTIALS_KEY]: JSON.stringify({ deviceId: 'device_123', deviceToken: 'token', pairingCode: 'secret' }),
    })

    expect(readPushCredentials(storage)).toBeNull()
  })

  it('clears only the dedicated credential key', () => {
    const storage = createStorage({
      [PUSH_CREDENTIALS_KEY]: JSON.stringify({ deviceId: 'device_123', deviceToken: 'token_abc' }),
      'move-well-storage': 'local fitness data',
    })
    const store = createPushCredentialStore(storage)

    expect(store.clear()).toBe(true)
    expect(storage.values[PUSH_CREDENTIALS_KEY]).toBeUndefined()
    expect(storage.values['move-well-storage']).toBe('local fitness data')
  })

  it('fails safely when browser storage is unavailable', () => {
    const store = createPushCredentialStore(null)

    expect(store.read()).toBeNull()
    expect(store.write({ deviceId: 'device_123', deviceToken: 'token_abc' })).toBe(false)
    expect(store.clear()).toBe(false)
  })
})
