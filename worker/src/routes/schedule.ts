import {
  authenticateBearerToken,
  authorizeDevice,
  type AuthDependencies,
} from "../auth";
import {
  DataValidationError,
  upsertReminderSchedule,
  type ReminderScheduleRecord,
} from "../db";

const MAX_BODY_BYTES = 16 * 1024;
const MAX_TIMEZONE_LENGTH = 128;
const DEVICE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const SCHEDULE_FIELDS = ["enabled", "localTime", "timezone", "weekdayMask"] as const;

export interface ScheduleEnvironment {
  readonly DB: D1Database;
}

export interface ScheduleDependencies extends AuthDependencies {
  readonly now?: () => number;
  readonly saveSchedule?: (
    db: D1Database,
    input: {
      readonly deviceId: string;
      readonly enabled: boolean;
      readonly localTime: string;
      readonly timezone: string;
      readonly weekdayMask: number;
      readonly nextDueAt?: number | null;
      readonly updatedAt: number;
    },
  ) => Promise<ReminderScheduleRecord>;
}

type ScheduleBody = {
  readonly enabled: boolean;
  readonly localTime: string;
  readonly timezone: string;
  readonly weekdayMask: number;
};

const jsonResponse = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });

const errorResponse = (
  status: number,
  code: string,
  message: string,
  fields?: Record<string, string>,
): Response => jsonResponse({ error: { code, message, ...(fields ? { fields } : {}) } }, status);

const authenticationError = (
  code: "missing_authorization" | "invalid_token" | "forbidden_device",
): Response =>
  code === "missing_authorization"
    ? errorResponse(401, code, "Authorization is required.")
    : code === "invalid_token"
      ? errorResponse(401, code, "The bearer token is invalid.")
      : errorResponse(403, code, "The device is not authorized for this resource.");

const requestIsHttps = (request: Request): boolean => {
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
};

const isJsonRequest = (request: Request): boolean =>
  request.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase() === "application/json";

const validDeviceId = (deviceId: string): boolean =>
  typeof deviceId === "string" && deviceId.length <= 128 && DEVICE_ID_PATTERN.test(deviceId);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasOnlyScheduleFields = (value: Record<string, unknown>): boolean => {
  const keys = Object.keys(value);
  return keys.length === SCHEDULE_FIELDS.length && SCHEDULE_FIELDS.every((field) => keys.includes(field));
};

const validLocalTime = (value: unknown): value is string =>
  typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);

const validTimezone = (value: unknown): value is string => {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > MAX_TIMEZONE_LENGTH ||
    /[\u0000-\u001F\u007F\s]/.test(value)
  ) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
};

const validWeekdayMask = (value: unknown, enabled: unknown): value is number =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value >= 0 &&
  value <= 127 &&
  (enabled !== true || value > 0);

const parseScheduleBody = async (request: Request): Promise<ScheduleBody | Response> => {
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
    parsed = JSON.parse(new TextDecoder().decode(rawBody)) as unknown;
  } catch {
    return errorResponse(400, "invalid_json", "The request body is not valid JSON.");
  }
  if (!isRecord(parsed) || !hasOnlyScheduleFields(parsed)) {
    return errorResponse(400, "invalid_request", "The request body is invalid.");
  }

  const fields: Record<string, string> = {};
  if (typeof parsed.enabled !== "boolean") fields.enabled = "Enabled must be a boolean.";
  if (!validLocalTime(parsed.localTime)) fields.localTime = "Use 24-hour HH:MM.";
  if (!validTimezone(parsed.timezone)) fields.timezone = "The timezone must be a valid IANA identifier.";
  if (!validWeekdayMask(parsed.weekdayMask, parsed.enabled)) {
    fields.weekdayMask = "The weekday mask must be an integer from 0 through 127 and non-zero when enabled.";
  }
  if (Object.keys(fields).length > 0) {
    return errorResponse(400, "invalid_schedule", "The reminder schedule is invalid.", fields);
  }

  return {
    enabled: parsed.enabled as boolean,
    localTime: parsed.localTime as string,
    timezone: parsed.timezone as string,
    weekdayMask: parsed.weekdayMask as number,
  };
};

const timestamp = (value: number): string => {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("invalid timestamp");
  return new Date(value).toISOString();
};

const scheduleResponse = (deviceId: string, body: ScheduleBody, saved: ReminderScheduleRecord): Response =>
  jsonResponse(
    {
      deviceId,
      schedule: {
        enabled: body.enabled,
        localTime: body.localTime,
        timezone: body.timezone,
        weekdayMask: body.weekdayMask,
      },
      updatedAt: timestamp(saved.updatedAt),
    },
    200,
  );

export const handleSchedule = async (
  request: Request,
  env: ScheduleEnvironment,
  deviceId: string,
  overrides: ScheduleDependencies = {},
): Promise<Response> => {
  if (request.method !== "PUT") return errorResponse(405, "method_not_allowed", "The method is not allowed.");
  if (!requestIsHttps(request)) return errorResponse(400, "invalid_request", "The request must use HTTPS.");

  const authentication = await authenticateBearerToken(request, env.DB, overrides);
  if (!authentication.ok) return authenticationError(authentication.code);
  if (!validDeviceId(deviceId)) return errorResponse(400, "invalid_request", "The device id is invalid.");
  const authorization = authorizeDevice(authentication, deviceId);
  if (!authorization.ok) return authenticationError(authorization.code);
  if (!isJsonRequest(request)) return errorResponse(415, "unsupported_media_type", "The request body must be JSON.");

  const body = await parseScheduleBody(request);
  if (body instanceof Response) return body;

  try {
    const updatedAt = overrides.now ? overrides.now() : Date.now();
    const saveSchedule = overrides.saveSchedule ?? upsertReminderSchedule;
    const saved = await saveSchedule(env.DB, { ...body, deviceId, nextDueAt: null, updatedAt });
    return scheduleResponse(deviceId, body, saved);
  } catch (error) {
    if (error instanceof DataValidationError) {
      return errorResponse(400, "invalid_schedule", "The reminder schedule is invalid.");
    }
    return errorResponse(500, "internal_error", "The server could not complete the operation.");
  }
};

export const schedule = handleSchedule;
