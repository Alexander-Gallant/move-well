import { describe, expect, it } from "vitest";
import { handleDevice, type DeviceEnvironment } from "./device";

const environment = (): DeviceEnvironment => ({ DB: {} as D1Database });
const token = "A".repeat(43);
const device = { deviceId: "device_a", createdAt: 1, revokedAt: null };
const subscription = {
  deviceId: "device_a",
  endpoint: "https://push.example.test/subscription/opaque-value",
  p256dh: "AQIDBA",
  auth: "BQYH",
  updatedAt: 1_700_000_000_000,
};
const schedule = {
  deviceId: "device_a",
  enabled: true,
  localTime: "07:30",
  timezone: "America/Toronto",
  weekdayMask: 21,
  nextDueAt: null,
  updatedAt: 1_700_000_000_000,
};

const request = (method: "GET" | "DELETE", body?: string): Request =>
  new Request("https://api.example.test/v1/devices/device_a", {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    ...(body === undefined ? {} : { body }),
  });

const validDependencies = () => ({ findDevice: async () => device });

describe("GET /v1/devices/:id", () => {
  it("returns only minimal registration status", async () => {
    const response = await handleDevice(request("GET"), environment(), "device_a", {
      ...validDependencies(),
      readSubscription: async () => subscription,
      readSchedule: async () => schedule,
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toEqual({
      deviceId: "device_a",
      revoked: false,
      push: { registered: true, updatedAt: "2023-11-14T22:13:20.000Z" },
      schedule: { enabled: true, localTime: "07:30", timezone: "America/Toronto", weekdayMask: 21 },
    });
    expect(JSON.stringify(body)).not.toContain(subscription.endpoint);
    expect(JSON.stringify(body)).not.toContain(subscription.p256dh);
    expect(JSON.stringify(body)).not.toContain(token);
  });

  it("reports an unregistered device without leaking null secrets", async () => {
    const response = await handleDevice(request("GET"), environment(), "device_a", {
      ...validDependencies(),
      readSubscription: async () => null,
      readSchedule: async () => null,
    });

    expect(await response.json()).toEqual({
      deviceId: "device_a",
      revoked: false,
      push: { registered: false },
      schedule: null,
    });
  });

  it("rejects missing authorization and another device", async () => {
    const missing = await handleDevice(new Request("https://api.example.test/v1/devices/device_a"), environment(), "device_a", validDependencies());
    const forbidden = await handleDevice(request("GET"), environment(), "device_b", validDependencies());

    expect(missing.status).toBe(401);
    expect(forbidden.status).toBe(403);
    expect(await forbidden.json()).toEqual({
      error: { code: "forbidden_device", message: "The device is not authorized for this resource." },
    });
  });
});

describe("DELETE /v1/devices/:id", () => {
  it("revokes the owner and delegates atomic subscription/schedule cleanup", async () => {
    const calls: Array<{ deviceId: string; revokedAt: number }> = [];
    const response = await handleDevice(request("DELETE"), environment(), "device_a", {
      ...validDependencies(),
      now: () => 1_700_000_000_000,
      revoke: async (_db, deviceId, revokedAt) => {
        calls.push({ deviceId, revokedAt });
        return true;
      },
    });

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(calls).toEqual([{ deviceId: "device_a", revokedAt: 1_700_000_000_000 }]);
  });

  it("rejects a revoke body and invalid path ids without touching storage", async () => {
    let revocations = 0;
    const withBody = await handleDevice(request("DELETE", "{}"), environment(), "device_a", {
      ...validDependencies(),
      revoke: async () => {
        revocations += 1;
        return true;
      },
    });
    const invalidId = await handleDevice(request("DELETE"), environment(), "device/../a", {
      ...validDependencies(),
      revoke: async () => {
        revocations += 1;
        return true;
      },
    });

    expect(withBody.status).toBe(400);
    expect(invalidId.status).toBe(400);
    expect(revocations).toBe(0);
  });

  it("rejects insecure requests and unsupported methods safely", async () => {
    const insecure = new Request("http://api.example.test/v1/devices/device_a", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const unsupported = new Request("https://api.example.test/v1/devices/device_a", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect((await handleDevice(insecure, environment(), "device_a", validDependencies())).status).toBe(400);
    expect((await handleDevice(unsupported, environment(), "device_a", validDependencies())).status).toBe(405);
  });
});
