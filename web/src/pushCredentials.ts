export const PUSH_CREDENTIALS_KEY = 'move-well-push-credentials'

const MAX_DEVICE_ID_LENGTH = 128
const MAX_DEVICE_TOKEN_LENGTH = 512

export type PushCredentials = {
  readonly deviceId: string
  readonly deviceToken: string
}

export type PushCredentialStorage = {
  readonly getItem: (key: string) => string | null
  readonly setItem: (key: string, value: string) => void
  readonly removeItem: (key: string) => void
}

export type PushCredentialStore = {
  readonly read: () => PushCredentials | null
  readonly write: (credentials: PushCredentials) => boolean
  readonly clear: () => boolean
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
)

const isSafeCredentialPart = (value: unknown, maxLength: number): value is string => (
  typeof value === 'string'
    && value.length > 0
    && value.length <= maxLength
    && value === value.trim()
    && !/[\u0000-\u0020\u007f]/.test(value)
)

export const isPushCredentials = (value: unknown): value is PushCredentials => (
  isRecord(value)
    && Object.keys(value).length === 2
    && Object.keys(value).every((key) => key === 'deviceId' || key === 'deviceToken')
    && isSafeCredentialPart(value.deviceId, MAX_DEVICE_ID_LENGTH)
    && isSafeCredentialPart(value.deviceToken, MAX_DEVICE_TOKEN_LENGTH)
)

const parseCredentials = (serialized: string | null): PushCredentials | null => {
  if (!serialized || serialized.length > 2048) return null
  try {
    const parsed: unknown = JSON.parse(serialized)
    return isPushCredentials(parsed)
      ? { deviceId: parsed.deviceId, deviceToken: parsed.deviceToken }
      : null
  } catch {
    return null
  }
}

const getBrowserStorage = (): PushCredentialStorage | null => {
  try {
    if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) return null
    return globalThis.localStorage
  } catch {
    return null
  }
}

export const createPushCredentialStore = (
  storage: PushCredentialStorage | null = getBrowserStorage(),
): PushCredentialStore => ({
  read: () => {
    if (!storage) return null
    try {
      return parseCredentials(storage.getItem(PUSH_CREDENTIALS_KEY))
    } catch {
      return null
    }
  },
  write: (credentials) => {
    if (!storage || !isPushCredentials(credentials)) return false
    const serialized = JSON.stringify({
      deviceId: credentials.deviceId,
      deviceToken: credentials.deviceToken,
    })
    try {
      storage.setItem(PUSH_CREDENTIALS_KEY, serialized)
      return true
    } catch {
      return false
    }
  },
  clear: () => {
    if (!storage) return false
    try {
      storage.removeItem(PUSH_CREDENTIALS_KEY)
      return true
    } catch {
      return false
    }
  },
})

export const readPushCredentials = (
  storage: PushCredentialStorage | null = getBrowserStorage(),
): PushCredentials | null => createPushCredentialStore(storage).read()

export const writePushCredentials = (
  credentials: PushCredentials,
  storage: PushCredentialStorage | null = getBrowserStorage(),
): boolean => createPushCredentialStore(storage).write(credentials)

export const clearPushCredentials = (
  storage: PushCredentialStorage | null = getBrowserStorage(),
): boolean => createPushCredentialStore(storage).clear()

export const getPushCredentials = readPushCredentials
export const savePushCredentials = writePushCredentials
export const removePushCredentials = clearPushCredentials
