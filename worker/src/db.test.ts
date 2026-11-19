import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DataAccessError,
  DataValidationError,
  createDevice,
  findActiveDeviceByTokenHash,
  getDevice,
  getPushSubscription,
  getReminderSchedule,
  listDueReminderSchedules,
  revokeDevice,
  upsertPushSubscription,
  upsertReminderSchedule,
} from "./db";

type StoredDevice = {
  device_id: string;
  token_hash: Uint8Array;
  created_at: number;
  revoked_at: number | null;
};

type StoredSubscription = {
  device_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  updated_at: number;
};

type StoredSchedule = {
  device_id: string;
  enabled: number;
  local_time: string;
  timezone: string;
  weekday_mask: number;
  next_due_at: number | null;
  updated_at: number;
};

const result = <T>(results: T[], changes = 0): D1Result<T> =>
  ({
    success: true,
    results,
    meta: {
      changes,
      changed_db: changes > 0,
      duration: 0,
      last_row_id: 0,
      rows_read: results.length,
      rows_written: changes,
      size_after: 0,
    },
  }) as D1Result<T>;

class DeterministicD1 {
  readonly devices = new Map<string, StoredDevice>();
  readonly subscriptions = new Map<string, StoredSubscription>();
  readonly schedules = new Map<string, StoredSchedule>();
  readonly unboundStatements: string[] = [];

  prepare(sql: string): D1PreparedStatement {
    return new DeterministicStatement(this, sql) as unknown as D1PreparedStatement;
  }

  async batch(statements: D1PreparedStatement[]): Promise<D1Result[]> {
    const snapshot = this.snapshot();
    try {
      const results: D1Result[] = [];
      for (const prepared of statements) {
        results.push(await (prepared as unknown as DeterministicStatement).execute());
      }
      return results;
    } catch (error) {
      this.restore(snapshot);
      throw error;
    }
  }

  execute(sql: string, values: readonly unknown[]): D1Result[] | D1Result {
    const normalized = sql.replace(/\s+/g, " ").trim();
    if (values.length === 0) this.unboundStatements.push(normalized);

    if (normalized.startsWith("INSERT INTO devices")) {
      const [deviceId, tokenHash, createdAt] = values as [string, Uint8Array, number];
      if (this.devices.has(deviceId) || [...this.devices.values()].some((row) => sameBytes(row.token_hash, tokenHash))) {
        throw new Error("constraint failed");
      }
      this.devices.set(deviceId, { device_id: deviceId, token_hash: tokenHash, created_at: createdAt, revoked_at: null });
      return result([], 1);
    }

    if (normalized.includes("WHERE token_hash = ? AND revoked_at IS NULL")) {
      const [tokenHash] = values as [Uint8Array];
      const row = [...this.devices.values()].find(
        (device) => device.revoked_at === null && sameBytes(device.token_hash, tokenHash),
      );
      return result(row ? [withoutTokenHash(row)] : []);
    }

    if (normalized.startsWith("SELECT device_id, created_at, revoked_at FROM devices")) {
      const [deviceId] = values as [string];
      const row = this.devices.get(deviceId);
      return result(row ? [withoutTokenHash(row)] : []);
    }

    if (normalized.startsWith("INSERT INTO push_subscriptions")) {
      const [deviceId, endpoint, p256dh, auth, updatedAt] = values as [string, string, string, string, number];
      if (!this.devices.has(deviceId)) throw new Error("foreign key failed");
      this.subscriptions.set(deviceId, { device_id: deviceId, endpoint, p256dh, auth, updated_at: updatedAt });
      return result([], 1);
    }

    if (normalized.startsWith("SELECT device_id, endpoint, p256dh, auth, updated_at")) {
      const [deviceId] = values as [string];
      const row = this.subscriptions.get(deviceId);
      return result(row ? [row] : []);
    }

    if (normalized.startsWith("INSERT INTO reminder_schedules")) {
      const [deviceId, enabled, localTime, timezone, weekdayMask, nextDueAt, updatedAt] = values as [
        string,
        number,
        string,
        string,
        number,
        number | null,
        number,
      ];
      if (!this.devices.has(deviceId)) throw new Error("foreign key failed");
      this.schedules.set(deviceId, {
        device_id: deviceId,
        enabled,
        local_time: localTime,
        timezone,
        weekday_mask: weekdayMask,
        next_due_at: nextDueAt,
        updated_at: updatedAt,
      });
      return result([], 1);
    }

    if (normalized.startsWith("UPDATE devices SET revoked_at")) {
      const [revokedAt, deviceId] = values as [number, string];
      const row = this.devices.get(deviceId);
      if (!row || row.revoked_at !== null) return result([], 0);
      row.revoked_at = revokedAt;
      return result([], 1);
    }

    if (normalized.startsWith("DELETE FROM push_subscriptions")) {
      const [deviceId] = values as [string];
      const changes = this.subscriptions.delete(deviceId) ? 1 : 0;
      return result([], changes);
    }

    if (normalized.startsWith("DELETE FROM reminder_schedules")) {
      const [deviceId] = values as [string];
      const changes = this.schedules.delete(deviceId) ? 1 : 0;
      return result([], changes);
    }

    if (normalized.includes("WHERE enabled = 1 AND next_due_at IS NOT NULL")) {
      const [dueAt, limit] = values as [number, number];
      const rows = [...this.schedules.values()]
        .filter((schedule) => schedule.enabled === 1 && schedule.next_due_at !== null && schedule.next_due_at <= dueAt)
        .sort((left, right) => (left.next_due_at ?? 0) - (right.next_due_at ?? 0) || left.device_id.localeCompare(right.device_id))
        .slice(0, limit);
      return result(rows);
    }

    if (normalized.startsWith("SELECT device_id, enabled, local_time")) {
      const [deviceId] = values as [string];
      const row = this.schedules.get(deviceId);
      return result(row ? [row] : []);
    }

    throw new Error(`Unhandled SQL: ${normalized}`);
  }

  private snapshot(): [Map<string, StoredDevice>, Map<string, StoredSubscription>, Map<string, StoredSchedule>] {
    return [
      new Map<string, StoredDevice>(
        [...this.devices].map(
          ([key, value]) => [key, { ...value, token_hash: new Uint8Array(value.token_hash) }] as [string, StoredDevice],
        ),
      ),
      new Map<string, StoredSubscription>(
        [...this.subscriptions].map(([key, value]) => [key, { ...value }] as [string, StoredSubscription]),
      ),
      new Map<string, StoredSchedule>(
        [...this.schedules].map(([key, value]) => [key, { ...value }] as [string, StoredSchedule]),
      ),
    ];
  }

  private restore(snapshot: [Map<string, StoredDevice>, Map<string, StoredSubscription>, Map<string, StoredSchedule>]): void {
    this.devices.clear();
    this.subscriptions.clear();
    this.schedules.clear();
    for (const [key, value] of snapshot[0]) this.devices.set(key, value);
    for (const [key, value] of snapshot[1]) this.subscriptions.set(key, value);
    for (const [key, value] of snapshot[2]) this.schedules.set(key, value);
  }
}

class DeterministicStatement {
  private values: readonly unknown[] | null = null;

  constructor(private readonly db: DeterministicD1, private readonly sql: string) {}

  bind(...values: unknown[]): D1PreparedStatement {
    this.values = values;
    return this as unknown as D1PreparedStatement;
  }

  execute(): D1Result {
    if (this.values === null) throw new Error("bind() was not called");
    const executed = this.db.execute(this.sql, this.values);
    return Array.isArray(executed) ? executed[0] : executed;
  }

  async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    return this.execute() as D1Result<T>;
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    return (this.execute().results[0] as T | undefined) ?? null;
  }

  async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    return this.execute() as D1Result<T>;
  }
}

const sameBytes = (left: Uint8Array, right: Uint8Array): boolean =>
  left.length === right.length && left.every((byte, index) => byte === right[index]);

const withoutTokenHash = (row: StoredDevice): Omit<StoredDevice, "token_hash"> => {
  const { token_hash: _tokenHash, ...publicRow } = row;
  return publicRow;
};

const asDb = (database: DeterministicD1): D1Database => database as unknown as D1Database;
const token = (value: number): Uint8Array => new Uint8Array(Array.from({ length: 32 }, () => value));
const subscription = (deviceId: string, updatedAt: number) => ({
  deviceId,
  endpoint: `https://push.example.test/subscription/${deviceId}`,
  p256dh: "AQIDBA",
  auth: "BQYH",
  updatedAt,
});

describe("D1 migration and data access", () => {
  it("defines relational constraints and a due-time index without local fitness tables", () => {
    const migration = readFileSync(new URL("../migrations/0001_initial.sql", import.meta.url), "utf8");
    expect(migration).toContain("CREATE TABLE devices");
    expect(migration).toContain("CREATE TABLE push_subscriptions");
    expect(migration).toContain("CREATE TABLE reminder_schedules");
    expect(migration.match(/ON DELETE CASCADE/g)).toHaveLength(2);
    expect(migration.match(/REFERENCES devices\(device_id\)/g)).toHaveLength(2);
    expect(migration).toContain("device_id TEXT PRIMARY KEY");
    expect(migration).toContain("CREATE INDEX idx_reminder_schedules_due");
    expect(migration).toContain("UNIQUE");
    expect(migration).not.toMatch(/exercise|routine/i);
  });

  it("creates devices, supports hashed-token lookup, and binds every value", async () => {
    const database = new DeterministicD1();
    const db = asDb(database);
    await createDevice(db, { deviceId: "phone-a", tokenHash: token(1), createdAt: 100 });

    expect(await findActiveDeviceByTokenHash(db, token(1))).toEqual({
      deviceId: "phone-a",
      createdAt: 100,
      revokedAt: null,
    });
    await expect(createDevice(db, { deviceId: "phone-b", tokenHash: token(1), createdAt: 101 })).rejects.toThrow(
      DataAccessError,
    );
    expect(database.unboundStatements).toEqual([]);
  });

  it("replaces one subscription and one schedule per device", async () => {
    const database = new DeterministicD1();
    const db = asDb(database);
    await createDevice(db, { deviceId: "phone-a", tokenHash: token(2), createdAt: 100 });
    await upsertPushSubscription(db, subscription("phone-a", 200));
    await upsertPushSubscription(db, { ...subscription("phone-a", 201), p256dh: "CQkJ" });
    await upsertReminderSchedule(db, {
      deviceId: "phone-a",
      enabled: true,
      localTime: "07:30",
      timezone: "America/Toronto",
      weekdayMask: 21,
      nextDueAt: 300,
      updatedAt: 201,
    });

    expect(await getPushSubscription(db, "phone-a")).toMatchObject({ p256dh: "CQkJ", updatedAt: 201 });
    expect(await getReminderSchedule(db, "phone-a")).toMatchObject({ weekdayMask: 21, nextDueAt: 300 });
  });

  it("rejects invalid push and schedule values before D1 is called", async () => {
    const database = new DeterministicD1();
    const db = asDb(database);
    await createDevice(db, { deviceId: "phone-a", tokenHash: token(3), createdAt: 100 });

    await expect(
      Promise.resolve().then(() =>
        upsertPushSubscription(db, { ...subscription("phone-a", 200), endpoint: "http://not-https" }),
      ),
    ).rejects.toThrow(DataValidationError);
    await expect(
      Promise.resolve().then(() =>
        upsertReminderSchedule(db, {
          deviceId: "phone-a",
          enabled: true,
          localTime: "25:00",
          timezone: "America/Toronto",
          weekdayMask: 1,
          updatedAt: 200,
        }),
      ),
    ).rejects.toThrow(DataValidationError);
    await expect(
      Promise.resolve().then(() =>
        upsertReminderSchedule(db, {
          deviceId: "phone-a",
          enabled: true,
          localTime: "07:30",
          timezone: "America/Toronto",
          weekdayMask: 0,
          updatedAt: 200,
        }),
      ),
    ).rejects.toThrow(DataValidationError);
    expect(database.subscriptions.size).toBe(0);
    expect(database.schedules.size).toBe(0);
  });

  it("reads due schedules and revocation removes dependent data atomically", async () => {
    const database = new DeterministicD1();
    const db = asDb(database);
    await createDevice(db, { deviceId: "phone-a", tokenHash: token(4), createdAt: 100 });
    await upsertPushSubscription(db, subscription("phone-a", 200));
    await upsertReminderSchedule(db, {
      deviceId: "phone-a",
      enabled: true,
      localTime: "07:30",
      timezone: "UTC",
      weekdayMask: 1,
      nextDueAt: 300,
      updatedAt: 200,
    });

    expect(await listDueReminderSchedules(db, 300)).toHaveLength(1);
    expect(await revokeDevice(db, "phone-a", 400)).toBe(true);
    expect(await findActiveDeviceByTokenHash(db, token(4))).toBeNull();
    expect(await getDevice(db, "phone-a")).toMatchObject({ revokedAt: 400 });
    expect(await getPushSubscription(db, "phone-a")).toBeNull();
    expect(await getReminderSchedule(db, "phone-a")).toBeNull();
    expect(await revokeDevice(db, "phone-a", 401)).toBe(false);
  });
});
