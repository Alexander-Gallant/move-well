import { describe, expect, it } from "vitest";
import { handleSchedule, type ScheduleEnvironment } from "./schedule";

const environment = (): ScheduleEnvironment => ({ DB: {} as D1Database });
const token = "A".repeat(43);
const device = { deviceId: "device_a", createdAt: 1, revokedAt: null };
const validSchedule = {
  enabled: true,
  localTime: "07:30",
  timezone: "America/Toronto",
  weekdayMask: 21,
};

const request = (
  body: unknown,
  headers: Record<string, string> = {},
  method: "PUT" | "POST" = "PUT",
): Request =>
  new Request("https://api.example.test/v1/devices/device_a/schedule", {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const validDependencies = () => ({
  findDevice: async () => device,
  now: () => 1_700_000_000_000,
});

describe("PUT /v1/devices/:id/schedule", () => {
  it("upserts the exact four-field projection and returns a safe response", async () => {
    const saved: unknown[] = [];
    const response = await handleSchedule(request(validSchedule), environment(), "device_a", {
      ...validDependencies(),
      saveSchedule: async (_db, input) => {
        saved.push(input);
        return { ...input, nextDueAt: null };
      },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      deviceId: "device_a",
      schedule: validSchedule,
      updatedAt: "2023-11-14T22:13:20.000Z",
    });
    expect(saved).toEqual([{ ...validSchedule, deviceId: "device_a", nextDueAt: null, updatedAt: 1_700_000_000_000 }]);
  });

  it("allows a disabled schedule with an empty weekday mask", async () => {
    const disabled = { ...validSchedule, enabled: false, weekdayMask: 0 };
    const response = await handleSchedule(request(disabled), environment(), "device_a", {
      ...validDependencies(),
      saveSchedule: async (_db, input) => ({ ...input, nextDueAt: null }),
    });

    expect(response.status).toBe(200);
    expect((await response.json())).toMatchObject({ schedule: disabled });
  });

  it("rejects malformed time, timezone, mask, and enabled values before persistence", async () => {
    const writes: unknown[] = [];
    const response = await handleSchedule(
      request({ enabled: true, localTime: "7:30", timezone: "05:00", weekdayMask: 1.5 }),
      environment(),
      "device_a",
      {
        ...validDependencies(),
        saveSchedule: async (_db, input) => {
          writes.push(input);
          return { ...input, nextDueAt: null };
        },
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "invalid_schedule" } });
    expect(writes).toHaveLength(0);
  });

  it("rejects an enabled schedule with an empty weekday mask", async () => {
    const response = await handleSchedule(
      request({ ...validSchedule, weekdayMask: 0 }),
      environment(),
      "device_a",
      { ...validDependencies(), saveSchedule: async () => { throw new Error("must not write"); } },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "invalid_schedule" } });
  });

  it("rejects unknown fields, malformed JSON, wrong media types, and oversized bodies", async () => {
    const extraField = await handleSchedule(request({ ...validSchedule, routineId: "local-only" }), environment(), "device_a", validDependencies());
    const malformed = await handleSchedule(request("not-json"), environment(), "device_a", validDependencies());
    const wrongMediaType = await handleSchedule(
      request(JSON.stringify(validSchedule), { "Content-Type": "text/plain" }),
      environment(),
      "device_a",
      validDependencies(),
    );
    const oversized = await handleSchedule(
      request(JSON.stringify({ ...validSchedule, padding: "x".repeat(16 * 1024) })),
      environment(),
      "device_a",
      validDependencies(),
    );

    expect(extraField.status).toBe(400);
    expect(malformed.status).toBe(400);
    expect(wrongMediaType.status).toBe(415);
    expect(oversized.status).toBe(400);
  });

  it("requires HTTPS, authentication, and ownership before writing", async () => {
    let writes = 0;
    const saveSchedule = async () => {
      writes += 1;
      throw new Error("must not write");
    };
    const missingAuth = new Request("https://api.example.test/v1/devices/device_a/schedule", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validSchedule),
    });
    const wrongDevice = await handleSchedule(request(validSchedule), environment(), "device_b", {
      ...validDependencies(),
      saveSchedule,
    });
    const insecure = await handleSchedule(
      new Request("http://api.example.test/v1/devices/device_a/schedule", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(validSchedule),
      }),
      environment(),
      "device_a",
      { ...validDependencies(), saveSchedule },
    );
    const unauthenticated = await handleSchedule(missingAuth, environment(), "device_a", { saveSchedule });

    expect(wrongDevice.status).toBe(403);
    expect(insecure.status).toBe(400);
    expect(unauthenticated.status).toBe(401);
    expect(writes).toBe(0);
  });

  it("does not return local workout data", async () => {
    const response = await handleSchedule(request(validSchedule), environment(), "device_a", {
      ...validDependencies(),
      saveSchedule: async (_db, input) => ({ ...input, nextDueAt: null }),
    });
    const serialized = JSON.stringify(await response.json());

    expect(serialized).not.toContain("routine");
    expect(serialized).not.toContain("exercise");
    expect(serialized).not.toContain(token);
  });
});
