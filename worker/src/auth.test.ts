import { describe, expect, it } from "vitest";
import {
  authenticateBearerToken,
  authorizeDevice,
  createDeviceToken,
  hashDeviceToken,
  parseBearerToken,
  type AuthenticatedDevice,
} from "./auth";

const db = {} as D1Database;
const request = (authorization?: string): Request =>
  new Request("https://api.example.test/v1/devices/device_a", {
    headers: authorization === undefined ? undefined : { Authorization: authorization },
  });

describe("device bearer authorization", () => {
  it("creates an opaque 32-byte token as unpadded base64url", () => {
    const token = createDeviceToken({
      getRandomValues: (bytes) => {
        bytes.fill(7);
        return bytes;
      },
    });

    expect(token).toHaveLength(43);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("strictly parses only the expected bearer form", () => {
    const token = "A".repeat(43);
    expect(parseBearerToken(null)).toEqual({ ok: false, code: "missing_authorization" });
    expect(parseBearerToken(`Bearer ${token}`)).toEqual({ ok: true, token });
    expect(parseBearerToken(`Bearer  ${token}`)).toEqual({ ok: false, code: "invalid_token" });
    expect(parseBearerToken(`Basic ${token}`)).toEqual({ ok: false, code: "invalid_token" });
    expect(parseBearerToken(`Bearer ${token} `)).toEqual({ ok: false, code: "invalid_token" });
  });

  it("hashes a token to 32 bytes without returning the plaintext", async () => {
    const token = "A".repeat(43);
    const hash = await hashDeviceToken(token);

    expect(hash).toBeInstanceOf(Uint8Array);
    expect(hash).toHaveLength(32);
    expect(new TextDecoder().decode(hash)).not.toContain(token);
  });

  it("rejects missing, malformed, unknown, and revoked tokens", async () => {
    const token = "B".repeat(43);
    const findDevice = async () => null;

    await expect(authenticateBearerToken(request(), db, { findDevice })).resolves.toEqual({
      ok: false,
      code: "missing_authorization",
    });
    await expect(authenticateBearerToken(request("Bearer not a token"), db, { findDevice })).resolves.toEqual({
      ok: false,
      code: "invalid_token",
    });
    await expect(authenticateBearerToken(request(`Bearer ${token}`), db, { findDevice })).resolves.toEqual({
      ok: false,
      code: "invalid_token",
    });

    await expect(
      authenticateBearerToken(request(`Bearer ${token}`), db, {
        findDevice: async () => ({ deviceId: "device_a", createdAt: 1, revokedAt: 2 }),
      }),
    ).resolves.toEqual({ ok: false, code: "invalid_token" });
  });

  it("allows the token's device and forbids a different path device", async () => {
    const token = "C".repeat(43);
    const device: AuthenticatedDevice = {
      ok: true,
      device: { deviceId: "device_a", createdAt: 1, revokedAt: null },
    };
    const authentication = await authenticateBearerToken(request(`Bearer ${token}`), db, {
      findDevice: async () => device.device,
    });

    expect(authorizeDevice(authentication, "device_a")).toEqual(device);
    expect(authorizeDevice(authentication, "device_b")).toEqual({
      ok: false,
      code: "forbidden_device",
    });
  });
});
