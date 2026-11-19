import { describe, expect, it } from "vitest";
import { handlePush, type PushEnvironment } from "./push";

const environment = (): PushEnvironment => ({ DB: {} as D1Database });
const token = "A".repeat(43);
const device = { deviceId: "device_a", createdAt: 1, revokedAt: null };
const endpoint = "https://push.example.test/subscription/opaque-value";

const request = (body: unknown, headers: Record<string, string> = {}): Request =>
  new Request("https://api.example.test/v1/devices/device_a/push", {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

const validDependencies = () => ({
  findDevice: async () => device,
  now: () => 1_700_000_000_000,
});

describe("PUT /v1/devices/:id/push", () => {
  it("upserts only the reduced subscription and returns a safe status", async () => {
    const saved: unknown[] = [];
    const response = await handlePush(
      request({ subscription: { endpoint, keys: { p256dh: "AQIDBA", auth: "BQYH" } } }),
      environment(),
      "device_a",
      {
        ...validDependencies(),
        saveSubscription: async (_db, input) => {
          saved.push(input);
          return { ...input };
        },
      },
    );
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toEqual({ deviceId: "device_a", registered: true, updatedAt: "2023-11-14T22:13:20.000Z" });
    expect(saved).toEqual([
      { deviceId: "device_a", endpoint, p256dh: "AQIDBA", auth: "BQYH", updatedAt: 1_700_000_000_000 },
    ]);
    expect(JSON.stringify(body)).not.toContain(endpoint);
    expect(JSON.stringify(body)).not.toContain("AQIDBA");
    expect(JSON.stringify(body)).not.toContain(token);
  });

  it("rejects missing authorization before writing", async () => {
    let writes = 0;
    const unauthenticated = new Request("https://api.example.test/v1/devices/device_a/push", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: { endpoint, keys: { p256dh: "AQIDBA", auth: "BQYH" } } }),
    });
    const response = await handlePush(unauthenticated, environment(), "device_a", {
      saveSubscription: async () => {
        writes += 1;
        throw new Error("must not write");
      },
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "missing_authorization", message: "Authorization is required." },
    });
    expect(writes).toBe(0);
  });

  it("forbids a valid token from updating another device", async () => {
    let writes = 0;
    const response = await handlePush(request({ subscription: { endpoint, keys: { p256dh: "AQIDBA", auth: "BQYH" } } }), environment(), "device_b", {
      ...validDependencies(),
      saveSubscription: async () => {
        writes += 1;
        throw new Error("must not write");
      },
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: { code: "forbidden_device", message: "The device is not authorized for this resource." },
    });
    expect(writes).toBe(0);
  });

  it("requires the exact JSON envelope and media type", async () => {
    const extraField = await handlePush(
      request({ subscription: { endpoint, keys: { p256dh: "AQIDBA", auth: "BQYH" } }, extra: true }),
      environment(),
      "device_a",
      validDependencies(),
    );
    const wrongMediaType = await handlePush(
      request({ subscription: { endpoint, keys: { p256dh: "AQIDBA", auth: "BQYH" } } }, { "Content-Type": "text/plain" }),
      environment(),
      "device_a",
      validDependencies(),
    );

    expect(extraField.status).toBe(400);
    expect(wrongMediaType.status).toBe(415);
  });

  it("rejects insecure endpoints, credentials, malformed keys, and oversized bodies", async () => {
    const invalidEndpoint = await handlePush(
      request({ subscription: { endpoint: "http://push.example.test/subscription", keys: { p256dh: "AQIDBA", auth: "BQYH" } } }),
      environment(),
      "device_a",
      validDependencies(),
    );
    const credentials = await handlePush(
      request({ subscription: { endpoint: "https://user:password@push.example.test/subscription", keys: { p256dh: "AQIDBA", auth: "BQYH" } } }),
      environment(),
      "device_a",
      validDependencies(),
    );
    const invalidKey = await handlePush(
      request({ subscription: { endpoint, keys: { p256dh: "not valid", auth: "BQYH" } } }),
      environment(),
      "device_a",
      validDependencies(),
    );
    const oversized = await handlePush(
      request({ subscription: { endpoint, keys: { p256dh: "AQIDBA", auth: "BQYH" } }, padding: "x".repeat(16 * 1024) }),
      environment(),
      "device_a",
      validDependencies(),
    );

    expect(invalidEndpoint.status).toBe(400);
    expect(credentials.status).toBe(400);
    expect(invalidKey.status).toBe(400);
    expect(oversized.status).toBe(400);
    expect((await invalidKey.json())).toMatchObject({ error: { code: "invalid_push_subscription" } });
  });

  it("rejects HTTP API requests and malformed device ids", async () => {
    const insecure = new Request("http://api.example.test/v1/devices/device_a/push", {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: { endpoint, keys: { p256dh: "AQIDBA", auth: "BQYH" } } }),
    });
    const invalidId = await handlePush(request({ subscription: { endpoint, keys: { p256dh: "AQIDBA", auth: "BQYH" } } }), environment(), "../device", validDependencies());

    expect((await handlePush(insecure, environment(), "device_a", validDependencies())).status).toBe(400);
    expect(invalidId.status).toBe(400);
  });
});
