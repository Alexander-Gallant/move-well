import {
  authenticateBearerToken,
  authorizeDevice,
  type AuthDependencies,
} from "../auth";
import {
  DataValidationError,
  upsertPushSubscription,
  type PushSubscriptionRecord,
} from "../db";

const MAX_BODY_BYTES = 16 * 1024;
const MAX_ENDPOINT_LENGTH = 2048;
const MAX_PUSH_KEY_LENGTH = 512;
const DEVICE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

export interface PushEnvironment {
  readonly DB: D1Database;
}

export interface PushDependencies extends AuthDependencies {
  readonly now?: () => number;
  readonly saveSubscription?: (db: D1Database, input: {
    readonly deviceId: string;
    readonly endpoint: string;
    readonly p256dh: string;
    readonly auth: string;
    readonly updatedAt: number;
  }) => Promise<PushSubscriptionRecord>;
}

type PushBody = {
  readonly endpoint: string;
  readonly p256dh: string;
  readonly auth: string;
};

const jsonResponse = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });

const errorResponse = (status: number, code: string, message: string, fields?: Record<string, string>): Response =>
  jsonResponse({ error: { code, message, ...(fields ? { fields } : {}) } }, status);

const requestIsHttps = (request: Request): boolean => {
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
};

const isJsonRequest = (request: Request): boolean =>
  request.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase() === "application/json";

const hasOnlyKeys = (value: object, expected: readonly string[]): boolean => {
  const keys = Object.keys(value);
  return keys.length === expected.length && expected.every((key) => keys.includes(key));
};

const validDeviceId = (deviceId: string): boolean =>
  typeof deviceId === "string" && deviceId.length <= 128 && DEVICE_ID_PATTERN.test(deviceId);

const validBase64Url = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= MAX_PUSH_KEY_LENGTH &&
  value.length % 4 !== 1 &&
  BASE64URL_PATTERN.test(value);

const validEndpoint = (value: unknown): value is string => {
  if (
    typeof value !== "string" ||
    value.length < 12 ||
    value.length > MAX_ENDPOINT_LENGTH ||
    /[\u0000-\u001F\u007F]/.test(value)
  ) {
    return false;
  }

  try {
    const endpoint = new URL(value);
    return endpoint.protocol === "https:" && !endpoint.username && !endpoint.password && !endpoint.hash;
  } catch {
    return false;
  }
};

const parsePushBody = async (request: Request): Promise<PushBody | Response> => {
  const declaredLength = request.headers.get("Content-Length");
  if (declaredLength !== null) {
    const length = Number(declaredLength);
    if (!Number.isSafeInteger(length) || length < 0 || length > MAX_BODY_BYTES) {
      return errorResponse(400, "invalid_request", "The request body is invalid.");
    }
  }

  let rawBody: ArrayBuffer;
  try {
    rawBody = await request.arrayBuffer();
  } catch {
    return errorResponse(400, "invalid_json", "The request body is not valid JSON.");
  }
  if (rawBody.byteLength > MAX_BODY_BYTES) {
    return errorResponse(400, "invalid_request", "The request body is invalid.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(rawBody));
  } catch {
    return errorResponse(400, "invalid_json", "The request body is not valid JSON.");
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed) || !hasOnlyKeys(parsed, ["subscription"])) {
    return errorResponse(400, "invalid_request", "The request body is invalid.");
  }

  const subscription = (parsed as { subscription?: unknown }).subscription;
  if (subscription === null || typeof subscription !== "object" || Array.isArray(subscription)) {
    return errorResponse(400, "invalid_request", "The request body is invalid.");
  }
  if (!hasOnlyKeys(subscription, ["endpoint", "keys"])) {
    return errorResponse(400, "invalid_request", "The request body is invalid.");
  }

  const candidate = subscription as { endpoint?: unknown; keys?: unknown };
  const keys = candidate.keys;
  if (keys === null || typeof keys !== "object" || Array.isArray(keys) || !hasOnlyKeys(keys, ["p256dh", "auth"])) {
    return errorResponse(400, "invalid_request", "The request body is invalid.");
  }

  const pushKeys = keys as { p256dh?: unknown; auth?: unknown };
  const fields: Record<string, string> = {};
  if (!validEndpoint(candidate.endpoint)) fields.endpoint = "The push endpoint is invalid.";
  if (!validBase64Url(pushKeys.p256dh)) fields.p256dh = "The public key is invalid.";
  if (!validBase64Url(pushKeys.auth)) fields.auth = "The authentication key is invalid.";
  if (Object.keys(fields).length > 0) {
    return errorResponse(400, "invalid_push_subscription", "The push subscription is invalid.", fields);
  }

  return {
    endpoint: candidate.endpoint as string,
    p256dh: pushKeys.p256dh as string,
    auth: pushKeys.auth as string,
  };
};

const authenticationError = (code: "missing_authorization" | "invalid_token" | "forbidden_device"): Response =>
  code === "missing_authorization"
    ? errorResponse(401, code, "Authorization is required.")
    : code === "invalid_token"
      ? errorResponse(401, code, "The bearer token is invalid.")
      : errorResponse(403, code, "The device is not authorized for this resource.");

const timestamp = (value: number): string => {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("invalid timestamp");
  return new Date(value).toISOString();
};

export const handlePush = async (
  request: Request,
  env: PushEnvironment,
  deviceId: string,
  overrides: PushDependencies = {},
): Promise<Response> => {
  if (request.method !== "PUT") return errorResponse(405, "method_not_allowed", "The method is not allowed.");
  if (!requestIsHttps(request)) return errorResponse(400, "invalid_request", "The request must use HTTPS.");

  const authentication = await authenticateBearerToken(request, env.DB, overrides);
  if (!authentication.ok) return authenticationError(authentication.code);
  if (!validDeviceId(deviceId)) return errorResponse(400, "invalid_request", "The device id is invalid.");
  const authorization = authorizeDevice(authentication, deviceId);
  if (!authorization.ok) return authenticationError(authorization.code);
  if (!isJsonRequest(request)) return errorResponse(415, "unsupported_media_type", "The request body must be JSON.");

  const body = await parsePushBody(request);
  if (body instanceof Response) return body;

  try {
    const updatedAt = overrides.now ? overrides.now() : Date.now();
    const saveSubscription = overrides.saveSubscription ?? upsertPushSubscription;
    const saved = await saveSubscription(env.DB, { deviceId, ...body, updatedAt });
    return jsonResponse({ deviceId, registered: true, updatedAt: timestamp(saved.updatedAt) }, 200);
  } catch (error) {
    if (error instanceof DataValidationError) {
      return errorResponse(400, "invalid_push_subscription", "The push subscription is invalid.");
    }
    return errorResponse(500, "internal_error", "The server could not complete the operation.");
  }
};

export const push = handlePush;
