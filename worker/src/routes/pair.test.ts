import { describe, expect, it } from "vitest";
import { handlePair, type PairEnvironment } from "./pair";

interface SavedDevice {
  readonly deviceId: string;
  readonly tokenHash: Uint8Array;
  readonly createdAt: number;
}

const environment = (pairingSecret = "correct horse battery staple"): PairEnvironment =>
  ({ DB: {} as D1Database, PAIRING_SECRET: pairingSecret });

const request = (pairingCode: string): Request =>
  new Request("https://api.example.test/v1/pair", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pairingCode }),
  });

const deterministicRandom = () => {
  let value = 1;
  return (bytes: Uint8Array): Uint8Array => {
    bytes.fill(value);
    value += 1;
    return bytes;
  };
};

describe("POST /v1/pair", () => {
  it("creates a device and returns the bearer token once", async () => {
    const saved: SavedDevice[] = [];
    const response = await handlePair(request("correct horse battery staple"), environment(), {
      getRandomValues: deterministicRandom(),
      now: () => 123,
      countActiveDevices: async () => saved.length,
      saveDevice: async (_db, input) => {
        saved.push(input);
        return { deviceId: input.deviceId, createdAt: input.createdAt, revokedAt: null };
      },
    });
    const body = (await response.json()) as Record<string, string>;

    expect(response.status).toBe(201);
    expect(body).toMatchObject({ tokenType: "Bearer" });
    expect(body.deviceId).toMatch(/^device_[A-Za-z0-9_-]+$/);
    expect(body.deviceToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(saved).toHaveLength(1);
    expect(saved[0].tokenHash).toHaveLength(32);
    expect(JSON.stringify(body)).not.toContain("correct horse battery staple");
  });

  it("allows two active devices and rejects the third pairing", async () => {
    const saved: SavedDevice[] = [];
    const dependencies = {
      getRandomValues: deterministicRandom(),
      countActiveDevices: async () => saved.length,
      saveDevice: async (_db: D1Database, input: SavedDevice) => {
        saved.push(input);
        return { deviceId: input.deviceId, createdAt: input.createdAt, revokedAt: null };
      },
    };

    await expect(handlePair(request("correct horse battery staple"), environment(), dependencies)).resolves.toMatchObject({
      status: 201,
    });
    await expect(handlePair(request("correct horse battery staple"), environment(), dependencies)).resolves.toMatchObject({
      status: 201,
    });
    const response = await handlePair(request("correct horse battery staple"), environment(), dependencies);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: { code: "pairing_limit_reached", message: "The device pairing limit has been reached." },
    });
    expect(saved).toHaveLength(2);
  });

  it("rejects an invalid secret without writing a device or exposing it", async () => {
    let writes = 0;
    const response = await handlePair(request("wrong secret"), environment(), {
      saveDevice: async () => {
        writes += 1;
        throw new Error("must not write");
      },
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "invalid_pairing_code", message: "The pairing code is invalid or disabled." },
    });
    expect(writes).toBe(0);
  });

  it("rejects non-HTTPS pairing requests and malformed bodies safely", async () => {
    const insecure = new Request("http://api.example.test/v1/pair", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pairingCode: "correct horse battery staple" }),
    });
    const malformed = new Request("https://api.example.test/v1/pair", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pairingCode: "correct horse battery staple", extra: true }),
    });

    expect((await handlePair(insecure, environment())).status).toBe(400);
    expect((await handlePair(malformed, environment())).status).toBe(400);
  });
});
