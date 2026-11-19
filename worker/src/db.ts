const MAX_DEVICE_ID_LENGTH = 128;
const MAX_ENDPOINT_LENGTH = 2048;
const MAX_PUSH_KEY_LENGTH = 512;
const MAX_TIMEZONE_LENGTH = 128;
const MAX_DUE_SCHEDULES = 500;

export interface DeviceInput {
  readonly deviceId: string;
  readonly tokenHash: Uint8Array | ArrayBuffer;
  readonly createdAt: number;
}

export interface DeviceRecord {
  readonly deviceId: string;
  readonly createdAt: number;
  readonly revokedAt: number | null;
}

export interface PushSubscriptionInput {
  readonly deviceId: string;
  readonly endpoint: string;
  readonly p256dh: string;
  readonly auth: string;
  readonly updatedAt: number;
}

export interface PushSubscriptionRecord extends PushSubscriptionInput {}

export interface ReminderScheduleInput {
  readonly deviceId: string;
  readonly enabled: boolean;
  readonly localTime: string;
  readonly timezone: string;
  readonly weekdayMask: number;
  readonly nextDueAt?: number | null;
  readonly updatedAt: number;
}

export interface ReminderScheduleRecord {
  readonly deviceId: string;
  readonly enabled: boolean;
  readonly localTime: string;
  readonly timezone: string;
  readonly weekdayMask: number;
  readonly nextDueAt: number | null;
  readonly updatedAt: number;
}

interface DeviceRow {
  readonly device_id: string;
  readonly created_at: number;
  readonly revoked_at: number | null;
}

interface PushSubscriptionRow {
  readonly device_id: string;
  readonly endpoint: string;
  readonly p256dh: string;
  readonly auth: string;
  readonly updated_at: number;
}

interface ReminderScheduleRow {
  readonly device_id: string;
  readonly enabled: number;
  readonly local_time: string;
  readonly timezone: string;
  readonly weekday_mask: number;
  readonly next_due_at: number | null;
  readonly updated_at: number;
}

export class DataValidationError extends Error {
  readonly field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = "DataValidationError";
    this.field = field;
  }
}

export class DataAccessError extends Error {
  constructor() {
    super("The database operation could not be completed.");
    this.name = "DataAccessError";
  }
}

const statement = (db: D1Database, sql: string, values: readonly unknown[]): D1PreparedStatement =>
  db.prepare(sql).bind(...values);

const run = (prepared: D1PreparedStatement): Promise<D1Result> =>
  prepared.run().catch(() => {
    throw new DataAccessError();
  });

const first = <T>(prepared: D1PreparedStatement): Promise<T | null> =>
  prepared.first<T>().catch(() => {
    throw new DataAccessError();
  });

const batch = (db: D1Database, statements: readonly D1PreparedStatement[]): Promise<D1Result[]> =>
  db.batch(statements as D1PreparedStatement[]).catch(() => {
    throw new DataAccessError();
  });

const requireDeviceId = (deviceId: string): string => {
  if (
    typeof deviceId !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(deviceId) ||
    deviceId.length > MAX_DEVICE_ID_LENGTH
  ) {
    throw new DataValidationError("deviceId", "The device id is invalid.");
  }
  return deviceId;
};

const requireTimestamp = (field: string, value: number): number => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new DataValidationError(field, "The timestamp must be a non-negative integer.");
  }
  return value;
};

const copyTokenHash = (value: Uint8Array | ArrayBuffer): Uint8Array => {
  const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : value;
  if (!(bytes instanceof Uint8Array) || bytes.byteLength !== 32) {
    throw new DataValidationError("tokenHash", "The token hash must contain 32 bytes.");
  }
  return new Uint8Array(bytes);
};

const requireBase64Url = (field: string, value: string): string => {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > MAX_PUSH_KEY_LENGTH ||
    !/^[A-Za-z0-9_-]+$/.test(value)
  ) {
    throw new DataValidationError(field, "The value must be unpadded base64url.");
  }
  return value;
};

const requireEndpoint = (endpoint: string): string => {
  if (
    typeof endpoint !== "string" ||
    endpoint.length < 12 ||
    endpoint.length > MAX_ENDPOINT_LENGTH ||
    /[\u0000-\u001F\u007F]/.test(endpoint)
  ) {
    throw new DataValidationError("endpoint", "The push endpoint is invalid.");
  }

  try {
    const parsed = new URL(endpoint);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.hash) {
      throw new Error("invalid endpoint");
    }
  } catch {
    throw new DataValidationError("endpoint", "The push endpoint is invalid.");
  }
  return endpoint;
};

const requireLocalTime = (localTime: string): string => {
  const match = /^(\d{2}):(\d{2})$/.exec(localTime);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) {
    throw new DataValidationError("localTime", "Use 24-hour HH:MM.");
  }
  return localTime;
};

const requireTimezone = (timezone: string): string => {
  if (
    typeof timezone !== "string" ||
    timezone.length < 1 ||
    timezone.length > MAX_TIMEZONE_LENGTH ||
    /[\u0000-\u001F\u007F]/.test(timezone)
  ) {
    throw new DataValidationError("timezone", "The timezone is invalid.");
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
  } catch {
    throw new DataValidationError("timezone", "The timezone is invalid.");
  }
  return timezone;
};

const requireWeekdayMask = (enabled: boolean, weekdayMask: number): number => {
  if (
    !Number.isInteger(weekdayMask) ||
    weekdayMask < 0 ||
    weekdayMask > 127 ||
    (enabled && weekdayMask === 0)
  ) {
    throw new DataValidationError("weekdayMask", "The weekday mask must be between 0 and 127.");
  }
  return weekdayMask;
};

const optionalTimestamp = (field: string, value: number | null | undefined): number | null =>
  value === null || value === undefined ? null : requireTimestamp(field, value);

const mapDevice = (row: DeviceRow): DeviceRecord => ({
  deviceId: row.device_id,
  createdAt: row.created_at,
  revokedAt: row.revoked_at,
});

const mapSubscription = (row: PushSubscriptionRow): PushSubscriptionRecord => ({
  deviceId: row.device_id,
  endpoint: row.endpoint,
  p256dh: row.p256dh,
  auth: row.auth,
  updatedAt: row.updated_at,
});

const mapSchedule = (row: ReminderScheduleRow): ReminderScheduleRecord => ({
  deviceId: row.device_id,
  enabled: row.enabled === 1,
  localTime: row.local_time,
  timezone: row.timezone,
  weekdayMask: row.weekday_mask,
  nextDueAt: row.next_due_at,
  updatedAt: row.updated_at,
});

export const createDevice = (db: D1Database, input: DeviceInput): Promise<DeviceRecord> => {
  const deviceId = requireDeviceId(input.deviceId);
  const tokenHash = copyTokenHash(input.tokenHash);
  const createdAt = requireTimestamp("createdAt", input.createdAt);
  return run(
    statement(
      db,
      "INSERT INTO devices (device_id, token_hash, created_at) VALUES (?, ?, ?)",
      [deviceId, tokenHash, createdAt],
    ),
  ).then(() => ({ deviceId, createdAt, revokedAt: null }));
};

export const getDevice = (db: D1Database, deviceId: string): Promise<DeviceRecord | null> =>
  first<DeviceRow>(
    statement(
      db,
      "SELECT device_id, created_at, revoked_at FROM devices WHERE device_id = ?",
      [requireDeviceId(deviceId)],
    ),
  ).then((row) => (row ? mapDevice(row) : null));

export const findActiveDeviceByTokenHash = (
  db: D1Database,
  tokenHash: Uint8Array | ArrayBuffer,
): Promise<DeviceRecord | null> =>
  first<DeviceRow>(
    statement(
      db,
      "SELECT device_id, created_at, revoked_at FROM devices WHERE token_hash = ? AND revoked_at IS NULL",
      [copyTokenHash(tokenHash)],
    ),
  ).then((row) => (row ? mapDevice(row) : null));

export const upsertPushSubscription = (
  db: D1Database,
  input: PushSubscriptionInput,
): Promise<PushSubscriptionRecord> => {
  const deviceId = requireDeviceId(input.deviceId);
  const endpoint = requireEndpoint(input.endpoint);
  const p256dh = requireBase64Url("p256dh", input.p256dh);
  const auth = requireBase64Url("auth", input.auth);
  const updatedAt = requireTimestamp("updatedAt", input.updatedAt);
  return run(
    statement(
      db,
      `INSERT INTO push_subscriptions (device_id, endpoint, p256dh, auth, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(device_id) DO UPDATE SET
         endpoint = excluded.endpoint,
         p256dh = excluded.p256dh,
         auth = excluded.auth,
         updated_at = excluded.updated_at`,
      [deviceId, endpoint, p256dh, auth, updatedAt],
    ),
  ).then(() => ({ deviceId, endpoint, p256dh, auth, updatedAt }));
};

export const getPushSubscription = (
  db: D1Database,
  deviceId: string,
): Promise<PushSubscriptionRecord | null> =>
  first<PushSubscriptionRow>(
    statement(
      db,
      "SELECT device_id, endpoint, p256dh, auth, updated_at FROM push_subscriptions WHERE device_id = ?",
      [requireDeviceId(deviceId)],
    ),
  ).then((row) => (row ? mapSubscription(row) : null));

export const upsertReminderSchedule = (
  db: D1Database,
  input: ReminderScheduleInput,
): Promise<ReminderScheduleRecord> => {
  const deviceId = requireDeviceId(input.deviceId);
  const enabled = input.enabled;
  if (typeof enabled !== "boolean") {
    throw new DataValidationError("enabled", "Enabled must be a boolean.");
  }
  const localTime = requireLocalTime(input.localTime);
  const timezone = requireTimezone(input.timezone);
  const weekdayMask = requireWeekdayMask(enabled, input.weekdayMask);
  const nextDueAt = optionalTimestamp("nextDueAt", input.nextDueAt);
  const updatedAt = requireTimestamp("updatedAt", input.updatedAt);
  return run(
    statement(
      db,
      `INSERT INTO reminder_schedules
         (device_id, enabled, local_time, timezone, weekday_mask, next_due_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(device_id) DO UPDATE SET
         enabled = excluded.enabled,
         local_time = excluded.local_time,
         timezone = excluded.timezone,
         weekday_mask = excluded.weekday_mask,
         next_due_at = excluded.next_due_at,
         updated_at = excluded.updated_at`,
      [deviceId, enabled ? 1 : 0, localTime, timezone, weekdayMask, nextDueAt, updatedAt],
    ),
  ).then(() => ({ deviceId, enabled, localTime, timezone, weekdayMask, nextDueAt, updatedAt }));
};

export const getReminderSchedule = (
  db: D1Database,
  deviceId: string,
): Promise<ReminderScheduleRecord | null> =>
  first<ReminderScheduleRow>(
    statement(
      db,
      "SELECT device_id, enabled, local_time, timezone, weekday_mask, next_due_at, updated_at FROM reminder_schedules WHERE device_id = ?",
      [requireDeviceId(deviceId)],
    ),
  ).then((row) => (row ? mapSchedule(row) : null));

export const listDueReminderSchedules = (
  db: D1Database,
  dueAt: number,
  limit = 100,
): Promise<ReminderScheduleRecord[]> => {
  const timestamp = requireTimestamp("dueAt", dueAt);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_DUE_SCHEDULES) {
    throw new DataValidationError("limit", "The due schedule limit is invalid.");
  }
  return statement(
    db,
    `SELECT device_id, enabled, local_time, timezone, weekday_mask, next_due_at, updated_at
     FROM reminder_schedules
     WHERE enabled = 1 AND next_due_at IS NOT NULL AND next_due_at <= ?
     ORDER BY next_due_at ASC, device_id ASC
     LIMIT ?`,
    [timestamp, limit],
  )
    .all<ReminderScheduleRow>()
    .catch(() => {
      throw new DataAccessError();
    })
    .then((result) => result.results.map(mapSchedule));
};

export const revokeDevice = (
  db: D1Database,
  deviceId: string,
  revokedAt: number,
): Promise<boolean> => {
  const safeDeviceId = requireDeviceId(deviceId);
  const safeRevokedAt = requireTimestamp("revokedAt", revokedAt);
  const update = statement(
    db,
    "UPDATE devices SET revoked_at = ? WHERE device_id = ? AND revoked_at IS NULL",
    [safeRevokedAt, safeDeviceId],
  );
  const deleteSubscription = statement(db, "DELETE FROM push_subscriptions WHERE device_id = ?", [
    safeDeviceId,
  ]);
  const deleteSchedule = statement(db, "DELETE FROM reminder_schedules WHERE device_id = ?", [
    safeDeviceId,
  ]);
  return batch(db, [update, deleteSubscription, deleteSchedule]).then(
    (results) => (results[0]?.meta.changes ?? 0) > 0,
  );
};
