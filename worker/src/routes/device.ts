import {
  authenticateBearerToken,
  authorizeDevice,
  type AuthDependencies,
} from "../auth";
import {
  getPushSubscription,
  getReminderSchedule,
  revokeDevice,
  type PushSubscriptionRecord,
  type ReminderScheduleRecord,
} from "../db";

const DEVICE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export interface DeviceEnvironment {
  readonly DB: D1Database;
}

export interface DeviceDependencies extends AuthDependencies {
  readonly now?: () => number;
  readonly readSubscription?: (db: D1Database, deviceId: string) => Promise<PushSubscriptionRecord | null>;
  readonly readSchedule?: (db: D1Database, deviceId: string) => Promise<ReminderScheduleRecord | null>;
  readonly revoke?: (db: D1Database, deviceId: string, revokedAt: number) => Promise<boolean>;
}

const jsonResponse = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });

const errorResponse = (status: number, code: string, message: string): Response =>
  jsonResponse({ error: { code, message } }, status);

const authenticationError = (code: "missing_authorization" | "invalid_token" | "forbidden_device"): Response =>
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

const validDeviceId = (deviceId: string): boolean =>
  typeof deviceId === "string" && deviceId.length <= 128 && DEVICE_ID_PATTERN.test(deviceId);

const timestamp = (value: number): string => {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("invalid timestamp");
  return new Date(value).toISOString();
};

const emptyRequestBody = async (request: Request): Promise<boolean> => {
  const declaredLength = request.headers.get("Content-Length");
  if (declaredLength !== null && declaredLength !== "0") return false;
  try {
    return (await request.arrayBuffer()).byteLength === 0;
  } catch {
    return false;
  }
};

const statusBody = (
  deviceId: string,
  subscription: PushSubscriptionRecord | null,
  schedule: ReminderScheduleRecord | null,
): Record<string, unknown> => ({
  deviceId,
  revoked: false,
  push: {
    registered: subscription !== null,
    ...(subscription ? { updatedAt: timestamp(subscription.updatedAt) } : {}),
  },
  schedule: schedule
    ? {
        enabled: schedule.enabled,
        localTime: schedule.localTime,
        timezone: schedule.timezone,
        weekdayMask: schedule.weekdayMask,
      }
    : null,
});

export const handleDevice = async (
  request: Request,
  env: DeviceEnvironment,
  deviceId: string,
  overrides: DeviceDependencies = {},
): Promise<Response> => {
  if (request.method !== "GET" && request.method !== "DELETE") {
    return errorResponse(405, "method_not_allowed", "The method is not allowed.");
  }
  if (!requestIsHttps(request)) return errorResponse(400, "invalid_request", "The request must use HTTPS.");

  const authentication = await authenticateBearerToken(request, env.DB, overrides);
  if (!authentication.ok) return authenticationError(authentication.code);
  if (!validDeviceId(deviceId)) return errorResponse(400, "invalid_request", "The device id is invalid.");
  const authorization = authorizeDevice(authentication, deviceId);
  if (!authorization.ok) return authenticationError(authorization.code);

  try {
    if (request.method === "DELETE") {
      if (!(await emptyRequestBody(request))) {
        return errorResponse(400, "invalid_request", "The request body is invalid.");
      }
      const revokedAt = overrides.now ? overrides.now() : Date.now();
      const revoke = overrides.revoke ?? revokeDevice;
      await revoke(env.DB, deviceId, revokedAt);
      return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    }

    const readSubscription = overrides.readSubscription ?? getPushSubscription;
    const readSchedule = overrides.readSchedule ?? getReminderSchedule;
    const [subscription, schedule] = await Promise.all([
      readSubscription(env.DB, deviceId),
      readSchedule(env.DB, deviceId),
    ]);
    return jsonResponse(statusBody(deviceId, subscription, schedule), 200);
  } catch {
    return errorResponse(500, "internal_error", "The server could not complete the operation.");
  }
};

export const device = handleDevice;
