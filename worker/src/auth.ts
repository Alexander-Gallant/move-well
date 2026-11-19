import { findActiveDeviceByTokenHash, type DeviceRecord } from "./db";

export const DEVICE_TOKEN_BYTES = 32;
export const DEVICE_ID_BYTES = 16;
export const DEVICE_TOKEN_LENGTH = 43;
export const MAX_DEVICE_TOKEN_LENGTH = 512;

export interface CryptoDependencies {
  readonly getRandomValues: (bytes: Uint8Array) => Uint8Array;
  readonly digest: (algorithm: AlgorithmIdentifier, data: Uint8Array) => Promise<ArrayBuffer>;
}

export interface AuthDependencies extends Partial<CryptoDependencies> {
  readonly findDevice?: typeof findActiveDeviceByTokenHash;
}

export type AuthorizationFailureCode = "missing_authorization" | "invalid_token";

export interface AuthenticatedDevice {
  readonly ok: true;
  readonly device: DeviceRecord;
}

export interface AuthorizationFailure {
  readonly ok: false;
  readonly code: AuthorizationFailureCode;
}

export type AuthenticationResult = AuthenticatedDevice | AuthorizationFailure;

export interface DeviceAuthorizationFailure {
  readonly ok: false;
  readonly code: AuthorizationFailureCode | "forbidden_device";
}

export type DeviceAuthorizationResult = AuthenticatedDevice | DeviceAuthorizationFailure;

const defaultGetRandomValues = (bytes: Uint8Array): Uint8Array => {
  const secureBytes = new Uint8Array(new ArrayBuffer(bytes.byteLength));
  globalThis.crypto.getRandomValues(secureBytes);
  bytes.set(secureBytes);
  return bytes;
};

const defaultDigest = (algorithm: AlgorithmIdentifier, data: Uint8Array): Promise<ArrayBuffer> =>
  globalThis.crypto.subtle.digest(algorithm, data as BufferSource);

const dependencies = (overrides: AuthDependencies = {}): CryptoDependencies => ({
  getRandomValues: overrides.getRandomValues ?? defaultGetRandomValues,
  digest: overrides.digest ?? defaultDigest,
});

const base64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
};

const utf8 = (value: string): Uint8Array => new TextEncoder().encode(value);

export const randomBytes = (length: number, overrides: AuthDependencies = {}): Uint8Array => {
  const bytes = new Uint8Array(length);
  dependencies(overrides).getRandomValues(bytes);
  return bytes;
};

export const createDeviceId = (overrides: AuthDependencies = {}): string =>
  `device_${base64Url(randomBytes(DEVICE_ID_BYTES, overrides))}`;

export const createDeviceToken = (overrides: AuthDependencies = {}): string =>
  base64Url(randomBytes(DEVICE_TOKEN_BYTES, overrides));

export const sha256 = async (
  value: string | Uint8Array,
  overrides: AuthDependencies = {},
): Promise<Uint8Array> => {
  const digest = await dependencies(overrides).digest("SHA-256", typeof value === "string" ? utf8(value) : value);
  return new Uint8Array(digest);
};

export const hashDeviceToken = (token: string, overrides: AuthDependencies = {}): Promise<Uint8Array> =>
  sha256(token, overrides);

const equalBytes = (left: Uint8Array, right: Uint8Array): boolean => {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
};

export const pairingSecretMatches = async (
  suppliedCode: string,
  configuredSecret: string,
  overrides: AuthDependencies = {},
): Promise<boolean> => {
  if (!suppliedCode.trim() || !configuredSecret || !configuredSecret.trim()) return false;
  const [suppliedHash, configuredHash] = await Promise.all([
    sha256(suppliedCode, overrides),
    sha256(configuredSecret, overrides),
  ]);
  return equalBytes(suppliedHash, configuredHash);
};

export const parseBearerToken = (header: string | null):
  | { readonly ok: true; readonly token: string }
  | { readonly ok: false; readonly code: AuthorizationFailureCode } => {
  if (header === null) return { ok: false, code: "missing_authorization" };
  if (!new RegExp(`^Bearer [A-Za-z0-9_-]{1,${MAX_DEVICE_TOKEN_LENGTH}}$`).test(header)) {
    return { ok: false, code: "invalid_token" };
  }
  return { ok: true, token: header.slice("Bearer ".length) };
};

export const authenticateBearerToken = async (
  request: Request,
  db: D1Database,
  overrides: AuthDependencies = {},
): Promise<AuthenticationResult> => {
  const parsed = parseBearerToken(request.headers.get("Authorization"));
  if (!parsed.ok) return parsed;

  try {
    const tokenHash = await hashDeviceToken(parsed.token, overrides);
    const findDevice = overrides.findDevice ?? findActiveDeviceByTokenHash;
    const device = await findDevice(db, tokenHash);
    return device && device.revokedAt === null
      ? { ok: true, device }
      : { ok: false, code: "invalid_token" };
  } catch {
    return { ok: false, code: "invalid_token" };
  }
};

export const authorizeDevice = (
  authentication: AuthenticationResult,
  deviceId: string,
): DeviceAuthorizationResult => {
  if (!authentication.ok) return authentication;
  return authentication.device.deviceId === deviceId
    ? authentication
    : { ok: false, code: "forbidden_device" };
};

export const authenticateDevice = async (
  request: Request,
  db: D1Database,
  deviceId: string,
  overrides: AuthDependencies = {},
): Promise<DeviceAuthorizationResult> =>
  authorizeDevice(await authenticateBearerToken(request, db, overrides), deviceId);
