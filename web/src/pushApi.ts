import {
  createPushCredentialStore,
  type PushCredentialStorage,
  type PushCredentialStore,
  type PushCredentials,
} from './pushCredentials'

const API_VERSION_PATH = '/v1'
const MAX_BODY_BYTES = 16 * 1024
const MAX_PAIRING_CODE_LENGTH = 256
const MAX_DEVICE_ID_LENGTH = 128
const MAX_SUBSCRIPTION_VALUE_LENGTH = 2048
const RFC3339_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/
const BASE64_URL = /^[A-Za-z0-9_-]+$/
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/

export type PushSubscriptionPayload = {
  readonly endpoint: string
  readonly keys: {
    readonly p256dh: string
    readonly auth: string
  }
}

export type PushSchedulePayload = {
  readonly enabled: boolean
  readonly localTime: string
  readonly timezone: string
  readonly weekdayMask: number
}

export type PairResponse = {
  readonly deviceId: string
  readonly deviceToken: string
  readonly tokenType: 'Bearer'
}

export type PushUploadResponse = {
  readonly deviceId: string
  readonly registered: true
  readonly updatedAt: string
}

export type ScheduleUploadResponse = {
  readonly deviceId: string
  readonly schedule: PushSchedulePayload
  readonly updatedAt: string
}

export type PushStatusResponse = {
  readonly deviceId: string
  readonly revoked: boolean
  readonly push: {
    readonly registered: boolean
    readonly updatedAt?: string
  }
  readonly schedule: PushSchedulePayload | null
}

export type PushApiFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export type PushRuntimeConfig = {
  readonly pushApiBaseUrl?: unknown
}

export type PushApiOptions = {
  readonly apiBaseUrl?: string
  readonly runtimeConfig?: PushRuntimeConfig
  readonly fetch?: PushApiFetch
  readonly credentials?: PushCredentialStore
  readonly storage?: PushCredentialStorage | null
}

export type PushApiErrorKind =
  | 'configuration'
  | 'validation'
  | 'missing-credentials'
  | 'credential-storage'
  | 'http'
  | 'network'
  | 'invalid-response'

export class PushApiError extends Error {
  readonly kind: PushApiErrorKind
  readonly status?: number

  constructor(kind: PushApiErrorKind, message: string, status?: number) {
    super(message)
    this.name = 'PushApiError'
    this.kind = kind
    this.status = status
  }
}

export class MissingPushCredentialsError extends PushApiError {
  constructor() {
    super('missing-credentials', 'Pair this device before using push settings.')
    this.name = 'MissingPushCredentialsError'
  }
}

export class PushNetworkError extends PushApiError {
  constructor() {
    super('network', 'The push service could not be reached.')
    this.name = 'PushNetworkError'
  }
}

export class PushHttpError extends PushApiError {
  constructor(status: number) {
    super('http', `The push service returned HTTP ${status}.`, status)
    this.name = 'PushHttpError'
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
)

const isNonEmptyString = (value: unknown, maxLength = MAX_SUBSCRIPTION_VALUE_LENGTH): value is string => (
  typeof value === 'string'
    && value.length > 0
    && value.length <= maxLength
    && value === value.trim()
    && !/[\u0000-\u001f\u007f]/.test(value)
)

const isDeviceId = (value: unknown): value is string => (
  isNonEmptyString(value, MAX_DEVICE_ID_LENGTH) && !/[/?#]/.test(value)
)

const isTimestamp = (value: unknown): value is string => (
  typeof value === 'string'
    && RFC3339_TIMESTAMP.test(value)
    && !Number.isNaN(Date.parse(value))
)

const isBase64Url = (value: unknown): value is string => (
  isNonEmptyString(value, MAX_SUBSCRIPTION_VALUE_LENGTH)
    && BASE64_URL.test(value)
)

const isValidTimezone = (value: unknown): value is string => {
  if (!isNonEmptyString(value, 128) || value.includes('\u0000')) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format()
    return true
  } catch {
    return false
  }
}

const isSchedule = (value: unknown): value is PushSchedulePayload => (
  isRecord(value)
    && typeof value.enabled === 'boolean'
    && typeof value.localTime === 'string'
    && TIME.test(value.localTime)
    && isValidTimezone(value.timezone)
    && typeof value.weekdayMask === 'number'
    && Number.isInteger(value.weekdayMask)
    && value.weekdayMask >= 0
    && value.weekdayMask <= 127
    && (!value.enabled || value.weekdayMask > 0)
)

const validateSchedule = (value: unknown): PushSchedulePayload => {
  if (!isSchedule(value)) {
    throw new PushApiError('validation', 'The reminder schedule is invalid.')
  }
  return {
    enabled: value.enabled,
    localTime: value.localTime,
    timezone: value.timezone,
    weekdayMask: value.weekdayMask,
  }
}

const validateSubscription = (value: unknown): PushSubscriptionPayload => {
  const candidate = isRecord(value) && typeof value.toJSON === 'function'
    ? (() => {
      try {
        return value.toJSON()
      } catch {
        return null
      }
    })()
    : value
  if (!isRecord(candidate) || !isNonEmptyString(candidate.endpoint)) {
    throw new PushApiError('validation', 'The push subscription is invalid.')
  }

  let endpoint: URL
  try {
    endpoint = new URL(candidate.endpoint)
  } catch {
    throw new PushApiError('validation', 'The push subscription is invalid.')
  }
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.hash) {
    throw new PushApiError('validation', 'The push subscription is invalid.')
  }

  const keys = candidate.keys
  if (!isRecord(keys) || !isBase64Url(keys.p256dh) || !isBase64Url(keys.auth)) {
    throw new PushApiError('validation', 'The push subscription is invalid.')
  }
  return {
    endpoint: endpoint.toString(),
    keys: { p256dh: keys.p256dh, auth: keys.auth },
  }
}

const validatePairResponse = (value: unknown): PairResponse => {
  if (!isRecord(value)
    || !isDeviceId(value.deviceId)
    || !isBase64Url(value.deviceToken)
    || value.tokenType !== 'Bearer') {
    throw new PushApiError('invalid-response', 'The push service returned an invalid pairing response.')
  }
  return { deviceId: value.deviceId, deviceToken: value.deviceToken, tokenType: 'Bearer' }
}

const validatePushResponse = (value: unknown): PushUploadResponse => {
  if (!isRecord(value)
    || !isDeviceId(value.deviceId)
    || value.registered !== true
    || !isTimestamp(value.updatedAt)) {
    throw new PushApiError('invalid-response', 'The push service returned an invalid response.')
  }
  return { deviceId: value.deviceId, registered: true, updatedAt: value.updatedAt }
}

const validateScheduleResponse = (value: unknown): ScheduleUploadResponse => {
  if (!isRecord(value) || !isDeviceId(value.deviceId) || !isTimestamp(value.updatedAt)) {
    throw new PushApiError('invalid-response', 'The push service returned an invalid response.')
  }
  return {
    deviceId: value.deviceId,
    schedule: validateSchedule(value.schedule),
    updatedAt: value.updatedAt,
  }
}

const validateStatusResponse = (value: unknown): PushStatusResponse => {
  if (!isRecord(value) || !isDeviceId(value.deviceId) || typeof value.revoked !== 'boolean') {
    throw new PushApiError('invalid-response', 'The push service returned an invalid response.')
  }
  const push = value.push
  const schedule = value.schedule
  if (!isRecord(push) || typeof push.registered !== 'boolean') {
    throw new PushApiError('invalid-response', 'The push service returned an invalid response.')
  }
  const updatedAt = push.updatedAt
  if (updatedAt !== undefined && !isTimestamp(updatedAt)) {
    throw new PushApiError('invalid-response', 'The push service returned an invalid response.')
  }
  if (schedule !== null && !isSchedule(schedule)) {
    throw new PushApiError('invalid-response', 'The push service returned an invalid response.')
  }
  return {
    deviceId: value.deviceId,
    revoked: value.revoked,
    push: {
      registered: push.registered,
      ...(updatedAt === undefined ? {} : { updatedAt }),
    },
    schedule: schedule === null ? null : validateSchedule(schedule),
  }
}

const bodySize = (body: string): number => new TextEncoder().encode(body).byteLength

const serializeBody = (value: unknown): string => {
  let body: string
  try {
    body = JSON.stringify(value)
  } catch {
    throw new PushApiError('validation', 'The request body is invalid.')
  }
  if (bodySize(body) > MAX_BODY_BYTES) {
    throw new PushApiError('validation', 'The request body is too large.')
  }
  return body
}

const runtimeBaseUrl = (runtimeConfig?: PushRuntimeConfig): string => {
  if (runtimeConfig && typeof runtimeConfig.pushApiBaseUrl === 'string') {
    return runtimeConfig.pushApiBaseUrl
  }
  try {
    const runtime = globalThis as typeof globalThis & {
      __MOVE_WELL_PUSH_API_BASE_URL__?: unknown
      __MOVE_WELL_RUNTIME_CONFIG__?: PushRuntimeConfig
    }
    if (typeof runtime.__MOVE_WELL_PUSH_API_BASE_URL__ === 'string') {
      return runtime.__MOVE_WELL_PUSH_API_BASE_URL__
    }
    const configured = runtime.__MOVE_WELL_RUNTIME_CONFIG__?.pushApiBaseUrl
    if (typeof configured === 'string') return configured
    return import.meta.env.VITE_PUSH_API_BASE_URL?.trim() ?? ''
  } catch {
    return ''
  }
}

export const normalizePushApiBaseUrl = (value: string): string => {
  if (!isNonEmptyString(value, 2048)) {
    throw new PushApiError('configuration', 'The push API URL is not configured.')
  }
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new PushApiError('configuration', 'The push API URL is invalid.')
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new PushApiError('configuration', 'The push API URL must use HTTPS.')
  }
  return url.toString().replace(/\/+$/, '')
}

const readResponseBody = async (response: Response): Promise<unknown> => {
  let text: string
  try {
    if (typeof response.text === 'function') {
      text = await response.text()
    } else {
      const jsonResponse = response as unknown as { json?: () => Promise<unknown> }
      if (typeof jsonResponse.json !== 'function') throw new Error('Missing response body reader')
      const parsed = await jsonResponse.json()
      const serialized = JSON.stringify(parsed)
      if (typeof serialized !== 'string') throw new Error('Missing response body')
      text = serialized
    }
  } catch {
    throw new PushApiError('invalid-response', 'The push service returned an unreadable response.')
  }
  if (bodySize(text) > MAX_BODY_BYTES || text.length === 0) {
    throw new PushApiError('invalid-response', 'The push service returned an invalid response.')
  }
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new PushApiError('invalid-response', 'The push service returned an invalid response.')
  }
}

export type PushApiClient = {
  readonly pair: (pairingCode: string) => Promise<PairResponse>
  readonly uploadPush: {
    (subscription: unknown): Promise<PushUploadResponse>
    (deviceId: string, subscription: unknown): Promise<PushUploadResponse>
  }
  readonly uploadSchedule: {
    (schedule: unknown): Promise<ScheduleUploadResponse>
    (deviceId: string, schedule: unknown): Promise<ScheduleUploadResponse>
  }
  readonly status: (deviceId?: string) => Promise<PushStatusResponse>
  readonly revoke: (deviceId?: string) => Promise<void>
}

export const createPushApi = (options: PushApiOptions = {}): PushApiClient => {
  const baseUrl = normalizePushApiBaseUrl(options.apiBaseUrl ?? runtimeBaseUrl(options.runtimeConfig))
  const fetcher = options.fetch ?? globalThis.fetch.bind(globalThis)
  const credentialStore = options.credentials
    ?? createPushCredentialStore(options.storage)

  const getCredentials = (requestedDeviceId?: string): PushCredentials => {
    const credentials = credentialStore.read()
    if (!credentials) throw new MissingPushCredentialsError()
    if (requestedDeviceId !== undefined && requestedDeviceId !== credentials.deviceId) {
      throw new PushApiError('validation', 'The requested device does not match this browser.')
    }
    return credentials
  }

  const request = async <T>(
    path: string,
    init: RequestInit,
    expectedStatus: number,
    validate: (value: unknown) => T,
  ): Promise<T> => {
    let response: Response
    try {
      response = await fetcher(`${baseUrl}${API_VERSION_PATH}${path}`, init)
    } catch {
      throw new PushNetworkError()
    }
    if (response.status < 200 || response.status >= 300) throw new PushHttpError(response.status)
    if (response.status !== expectedStatus) {
      throw new PushApiError('invalid-response', 'The push service returned an unexpected status.')
    }
    if (expectedStatus === 204) return undefined as T
    return validate(await readResponseBody(response))
  }

  const authenticatedHeaders = (token: string, hasBody: boolean): HeadersInit => ({
    Authorization: `Bearer ${token}`,
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
  })

  const pair = async (pairingCode: string): Promise<PairResponse> => {
    if (!isNonEmptyString(pairingCode, MAX_PAIRING_CODE_LENGTH)) {
      throw new PushApiError('validation', 'The pairing code is invalid.')
    }
    const result = await request('/pair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: serializeBody({ pairingCode }),
    }, 201, validatePairResponse)
    if (!credentialStore.write({ deviceId: result.deviceId, deviceToken: result.deviceToken })) {
      throw new PushApiError('credential-storage', 'This device could not store its push credentials.')
    }
    return result
  }

  const uploadPush = async (
    first: unknown,
    second?: unknown,
  ): Promise<PushUploadResponse> => {
    const explicitDeviceId = typeof first === 'string' && second !== undefined ? first : undefined
    const subscription = explicitDeviceId === undefined ? first : second
    const credentials = getCredentials(explicitDeviceId)
    const payload = { subscription: validateSubscription(subscription) }
    return request(`/devices/${encodeURIComponent(credentials.deviceId)}/push`, {
      method: 'PUT',
      headers: authenticatedHeaders(credentials.deviceToken, true),
      body: serializeBody(payload),
    }, 200, validatePushResponse)
  }

  const uploadSchedule = async (
    first: unknown,
    second?: unknown,
  ): Promise<ScheduleUploadResponse> => {
    const explicitDeviceId = typeof first === 'string' && second !== undefined ? first : undefined
    const schedule = explicitDeviceId === undefined ? first : second
    const credentials = getCredentials(explicitDeviceId)
    const payload = validateSchedule(schedule)
    return request(`/devices/${encodeURIComponent(credentials.deviceId)}/schedule`, {
      method: 'PUT',
      headers: authenticatedHeaders(credentials.deviceToken, true),
      body: serializeBody(payload),
    }, 200, validateScheduleResponse)
  }

  const status = async (deviceId?: string): Promise<PushStatusResponse> => {
    const credentials = getCredentials(deviceId)
    return request(`/devices/${encodeURIComponent(credentials.deviceId)}`, {
      method: 'GET',
      headers: authenticatedHeaders(credentials.deviceToken, false),
    }, 200, validateStatusResponse)
  }

  const revoke = async (deviceId?: string): Promise<void> => {
    const credentials = getCredentials(deviceId)
    await request(`/devices/${encodeURIComponent(credentials.deviceId)}`, {
      method: 'DELETE',
      headers: authenticatedHeaders(credentials.deviceToken, false),
    }, 204, () => undefined)
    credentialStore.clear()
  }

  return { pair, uploadPush, uploadSchedule, status, revoke }
}

export const createPushApiClient = createPushApi
