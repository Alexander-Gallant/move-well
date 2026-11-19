import { describe, expect, it } from "vitest";
import { createWorker, type Env } from "./index";

type StoredDevice = {
  readonly deviceId: string;
  readonly hash: Uint8Array;
  revokedAt: number | null;
};

const origin = "https://app.example.test";
const pairingSecret = "pairing secret used only by the test";
const tokenText = (value: string): string => `Bearer ${value}`;

const deterministicCrypto = () => {
  let randomValue = 1;
  return {
    getRandomValues: (bytes: Uint8Array): Uint8Array => {
      bytes.fill(randomValue);
      randomValue += 1;
      return bytes;
    },
    digest: async (_algorithm: AlgorithmIdentifier, data: Uint8Array): Promise<ArrayBuffer> => {
      const digest = new Uint8Array(32);
      data.forEach((value, index) => {
        digest[index % digest.length] = (digest[index % digest.length] + value + index) % 256;
      });
      return digest.buffer.slice(0) as ArrayBuffer;
    },
  };
};

const setup = () => {
  const devices: StoredDevice[] = [];
  const subscriptions = new Map<string, { endpoint: string; p256dh: string; auth: string; updatedAt: number }>();
  const schedules = new Map<string, { enabled: boolean; localTime: string; timezone: string; weekdayMask: number; updatedAt: number }>();
  const crypto = deterministicCrypto();
  const findDevice = async (_db: D1Database, hash: Uint8Array | ArrayBuffer) => {
    const expectedHash = hash instanceof ArrayBuffer ? new Uint8Array(hash) : hash;
    const device = devices.find((candidate) => candidate.revokedAt === null && candidate.hash.every((value, index) => value === expectedHash[index]));
    return device ? { deviceId: device.deviceId, createdAt: 1, revokedAt: device.revokedAt } : null;
  };
  const dependencies = {
    pair: {
      ...crypto,
      now: () => 1_700_000_000_000,
      countActiveDevices: async () => devices.filter((device) => device.revokedAt === null).length,
      saveDevice: async (_db: D1Database, input: { deviceId: string; tokenHash: Uint8Array; createdAt: number }) => {
        devices.push({ deviceId: input.deviceId, hash: new Uint8Array(input.tokenHash), revokedAt: null });
        return { deviceId: input.deviceId, createdAt: input.createdAt, revokedAt: null };
      },
    },
    push: {
      ...crypto,
      findDevice,
      now: () => 1_700_000_000_000,
      saveSubscription: async (_db: D1Database, input: { deviceId: string; endpoint: string; p256dh: string; auth: string; updatedAt: number }) => {
        subscriptions.set(input.deviceId, input);
        return input;
      },
    },
    schedule: {
      ...crypto,
      findDevice,
      now: () => 1_700_000_000_000,
      saveSchedule: async (_db: D1Database, input: { deviceId: string; enabled: boolean; localTime: string; timezone: string; weekdayMask: number; nextDueAt?: number | null; updatedAt: number }) => {
        const saved = { ...input, nextDueAt: null };
        schedules.set(input.deviceId, saved);
        return saved;
      },
    },
    device: {
      ...crypto,
      findDevice,
      now: () => 1_700_000_000_000,
      readSubscription: async (_db: D1Database, deviceId: string) => {
        const value = subscriptions.get(deviceId);
        return value ? { deviceId, ...value } : null;
      },
      readSchedule: async (_db: D1Database, deviceId: string) => {
        const value = schedules.get(deviceId);
        return value ? { deviceId, ...value, nextDueAt: null } : null;
      },
      revoke: async (_db: D1Database, deviceId: string, revokedAt: number) => {
        const device = devices.find((candidate) => candidate.deviceId === deviceId);
        if (!device || device.revokedAt !== null) return false;
        device.revokedAt = revokedAt;
        subscriptions.delete(deviceId);
        schedules.delete(deviceId);
        return true;
      },
    },
  };
  const worker = createWorker(dependencies);
  const environment: Env = {
    DB: {} as D1Database,
    PAIRING_SECRET: pairingSecret,
    VAPID_PRIVATE_KEY: "never returned",
    APP_ORIGIN: origin,
  };
  return { worker, environment };
};

const jsonRequest = (url: string, method: string, body: unknown, authorization?: string): Request =>
  new Request(url, {
    method,
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const assertNoSecrets = (body: unknown, token?: string): void => {
  const serialized = JSON.stringify(body);
  expect(serialized).not.toContain(pairingSecret);
  expect(serialized).not.toContain("never returned");
  if (token) expect(serialized).not.toContain(token);
  expect(serialized).not.toContain("push.example.test/subscription");
};

describe("Worker API integration", () => {
  it("pairs, uploads the minimal push and schedule projections, reports status, then revokes", async () => {
    const { worker, environment } = setup();
    const pairResponse = await worker.fetch(
      jsonRequest("https://api.example.test/v1/pair", "POST", { pairingCode: pairingSecret }),
      environment,
    );
    const pairBody = (await pairResponse.json()) as { deviceId: string; deviceToken: string };
    const authorization = tokenText(pairBody.deviceToken);

    expect(pairResponse.status).toBe(201);
    expect(pairBody.deviceToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    assertNoSecrets(pairBody);

    const pushResponse = await worker.fetch(
      jsonRequest(
        `https://api.example.test/v1/devices/${pairBody.deviceId}/push`,
        "PUT",
        { subscription: { endpoint: "https://push.example.test/subscription/private", keys: { p256dh: "AQIDBA", auth: "BQYH" } } },
        authorization,
      ),
      environment,
    );
    const scheduleResponse = await worker.fetch(
      jsonRequest(
        `https://api.example.test/v1/devices/${pairBody.deviceId}/schedule`,
        "PUT",
        { enabled: true, localTime: "07:30", timezone: "America/Toronto", weekdayMask: 21 },
        authorization,
      ),
      environment,
    );
    const statusResponse = await worker.fetch(
      new Request(`https://api.example.test/v1/devices/${pairBody.deviceId}`, {
        headers: { Origin: origin, Authorization: authorization },
      }),
      environment,
    );

    expect(pushResponse.status).toBe(200);
    expect(scheduleResponse.status).toBe(200);
    expect(statusResponse.status).toBe(200);
    const statusBody = await statusResponse.json();
    expect(statusBody).toEqual({
      deviceId: pairBody.deviceId,
      revoked: false,
      push: { registered: true, updatedAt: "2023-11-14T22:13:20.000Z" },
      schedule: { enabled: true, localTime: "07:30", timezone: "America/Toronto", weekdayMask: 21 },
    });
    assertNoSecrets(await pushResponse.json(), pairBody.deviceToken);
    assertNoSecrets(await scheduleResponse.json(), pairBody.deviceToken);
    assertNoSecrets(statusBody, pairBody.deviceToken);

    const revokeResponse = await worker.fetch(
      new Request(`https://api.example.test/v1/devices/${pairBody.deviceId}`, {
        method: "DELETE",
        headers: { Origin: origin, Authorization: authorization },
      }),
      environment,
    );
    expect(revokeResponse.status).toBe(204);
    expect(await revokeResponse.text()).toBe("");
    const afterRevoke = await worker.fetch(
      new Request(`https://api.example.test/v1/devices/${pairBody.deviceId}`, {
        headers: { Origin: origin, Authorization: authorization },
      }),
      environment,
    );
    expect(afterRevoke.status).toBe(401);
    assertNoSecrets(await afterRevoke.json(), pairBody.deviceToken);
  });

  it("covers invalid JSON, missing auth, wrong-device authorization, and denied origins", async () => {
    const { worker, environment } = setup();
    const pairResponse = await worker.fetch(
      jsonRequest("https://api.example.test/v1/pair", "POST", { pairingCode: pairingSecret }),
      environment,
    );
    const pairBody = (await pairResponse.json()) as { deviceId: string; deviceToken: string };
    const authorization = tokenText(pairBody.deviceToken);
    const invalidJson = await worker.fetch(
      jsonRequest(`https://api.example.test/v1/devices/${pairBody.deviceId}/schedule`, "PUT", "not-json", authorization),
      environment,
    );
    const missingAuth = await worker.fetch(
      jsonRequest(`https://api.example.test/v1/devices/${pairBody.deviceId}/schedule`, "PUT", { enabled: true }),
      environment,
    );
    const forbidden = await worker.fetch(
      jsonRequest(`https://api.example.test/v1/devices/another-device/schedule`, "PUT", { enabled: true }, authorization),
      environment,
    );
    const deniedOriginRequest = new Request(`https://api.example.test/v1/devices/${pairBody.deviceId}/schedule`, {
      method: "PUT",
      headers: { Origin: "https://evil.example.test", Authorization: authorization, "Content-Type": "application/json" },
      body: "{}",
    });
    const deniedOrigin = await worker.fetch(deniedOriginRequest, environment);

    expect(invalidJson.status).toBe(400);
    expect(missingAuth.status).toBe(401);
    expect(forbidden.status).toBe(403);
    expect(deniedOrigin.status).toBe(403);
    expect(deniedOrigin.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(await invalidJson.json()).toMatchObject({ error: { code: "invalid_json" } });
    expect(await missingAuth.json()).toMatchObject({ error: { code: "missing_authorization" } });
    expect(await forbidden.json()).toMatchObject({ error: { code: "forbidden_device" } });
    assertNoSecrets(await deniedOrigin.json(), pairBody.deviceToken);
  });

  it("rejects an invalid pairing code without persistence or secret leakage", async () => {
    const { worker, environment } = setup();
    const response = await worker.fetch(
      jsonRequest("https://api.example.test/v1/pair", "POST", { pairingCode: "wrong" }),
      environment,
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: { code: "invalid_pairing_code", message: "The pairing code is invalid or disabled." } });
    assertNoSecrets(body);
  });
});
