import {
  createDeviceId,
  createDeviceToken,
  pairingSecretMatches,
  sha256,
  type AuthDependencies,
} from "../auth";
import { createDevice, type DeviceRecord } from "../db";

const MAX_BODY_BYTES = 16 * 1024;
const MAX_PAIRING_CODE_LENGTH = 256;
const MAX_ACTIVE_DEVICES = 2;

export interface PairEnvironment {
  readonly DB: D1Database;
  readonly PAIRING_SECRET: string;
}

export interface PairDependencies extends AuthDependencies {
  readonly now?: () => number;
  readonly countActiveDevices?: (db: D1Database) => Promise<number>;
  readonly saveDevice?: (db: D1Database, input: {
    readonly deviceId: string;
    readonly tokenHash: Uint8Array;
    readonly createdAt: number;
  }) => Promise<DeviceRecord>;
}

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
): Response =>
  jsonResponse({ error: { code, message, ...(fields ? { fields } : {}) } }, status);

const requestIsHttps = (request: Request): boolean => {
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
};

const isJsonRequest = (request: Request): boolean => {
  const contentType = request.headers.get("Content-Type");
  return contentType?.split(";", 1)[0].trim().toLowerCase() === "application/json";
};

const parsePairingBody = async (
  request: Request,
): Promise<{ readonly pairingCode: string } | Response> => {
  const declaredLength = request.headers.get("Content-Length");
  if (declaredLength !== null && Number(declaredLength) > MAX_BODY_BYTES) {
    return errorResponse(400, "invalid_request", "The request body is invalid.");
  }

  let body: ArrayBuffer;
  try {
    body = await request.arrayBuffer();
  } catch {
    return errorResponse(400, "invalid_json", "The request body is not valid JSON.");
  }
  if (body.byteLength > MAX_BODY_BYTES) {
    return errorResponse(400, "invalid_request", "The request body is invalid.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(body));
  } catch {
    return errorResponse(400, "invalid_json", "The request body is not valid JSON.");
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return errorResponse(400, "invalid_request", "The request body is invalid.");
  }

  const fields = Object.keys(parsed);
  if (fields.length !== 1 || fields[0] !== "pairingCode") {
    return errorResponse(400, "invalid_request", "The request body is invalid.");
  }
  const pairingCode = (parsed as { pairingCode?: unknown }).pairingCode;
  if (
    typeof pairingCode !== "string" ||
    pairingCode.length === 0 ||
    pairingCode.length > MAX_PAIRING_CODE_LENGTH ||
    !pairingCode.trim()
  ) {
    return errorResponse(400, "invalid_request", "The request body is invalid.", {
      pairingCode: "The pairing code is invalid.",
    });
  }
  return { pairingCode };
};

const countActiveDevices = async (db: D1Database): Promise<number> => {
  const row = await db
    .prepare("SELECT COUNT(*) AS count FROM devices WHERE revoked_at IS NULL")
    .first<{ count: number | string }>();
  if (!row) throw new Error("missing device count");
  const count = typeof row?.count === "string" ? Number(row.count) : row?.count;
  if (!Number.isSafeInteger(count) || count < 0) throw new Error("invalid device count");
  return count;
};

export const handlePair = async (
  request: Request,
  env: PairEnvironment,
  overrides: PairDependencies = {},
): Promise<Response> => {
  if (request.method !== "POST") {
    return errorResponse(405, "method_not_allowed", "The method is not allowed.");
  }
  if (!requestIsHttps(request)) {
    return errorResponse(400, "invalid_request", "The request must use HTTPS.");
  }
  if (!isJsonRequest(request)) {
    return errorResponse(415, "unsupported_media_type", "The request body must be JSON.");
  }

  const body = await parsePairingBody(request);
  if (body instanceof Response) return body;

  try {
    if (!(await pairingSecretMatches(body.pairingCode, env.PAIRING_SECRET, overrides))) {
      return errorResponse(401, "invalid_pairing_code", "The pairing code is invalid or disabled.");
    }

    const count = await (overrides.countActiveDevices ?? countActiveDevices)(env.DB);
    if (count >= MAX_ACTIVE_DEVICES) {
      return errorResponse(409, "pairing_limit_reached", "The device pairing limit has been reached.");
    }

    const deviceToken = createDeviceToken(overrides);
    const deviceId = createDeviceId(overrides);
    const tokenHash = await sha256(deviceToken, overrides);
    const createdAt = overrides.now ? overrides.now() : Date.now();
    const saveDevice = overrides.saveDevice ?? createDevice;
    await saveDevice(env.DB, { deviceId, tokenHash, createdAt });

    return jsonResponse({ deviceId, deviceToken, tokenType: "Bearer" }, 201);
  } catch {
    return errorResponse(500, "internal_error", "The server could not complete the operation.");
  }
};

export const pair = handlePair;
