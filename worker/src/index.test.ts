import { describe, expect, it } from "vitest";
import { createWorker, type Env } from "./index";

const env = (overrides: Partial<Env> = {}): Env => ({
  DB: {} as D1Database,
  PAIRING_SECRET: "test-only-pairing-secret",
  VAPID_PRIVATE_KEY: "test-only-private-key",
  APP_ORIGIN: "https://app.example.test",
  ...overrides,
});

describe("Worker entry point and CORS", () => {
  it("adds exact-origin CORS to API responses without credential wildcards", async () => {
    const response = await createWorker().fetch(
      new Request("https://api.example.test/v1/unknown", {
        headers: { Origin: "https://app.example.test" },
      }),
      env(),
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example.test");
    expect(response.headers.get("Vary")).toBe("Origin");
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBeNull();
    expect(await response.json()).toEqual({
      error: { code: "not_found", message: "The requested resource was not found." },
    });
  });

  it("answers an allowed preflight with only the contract methods and headers", async () => {
    const response = await createWorker().fetch(
      new Request("https://api.example.test/v1/pair", {
        method: "OPTIONS",
        headers: {
          Origin: "https://app.example.test",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "authorization, content-type",
        },
      }),
      env(),
    );

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example.test");
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, PUT, POST, DELETE, OPTIONS");
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe("Authorization, Content-Type");
    expect(response.headers.get("Vary")).toBe("Origin");
  });

  it("allows only the explicitly configured development origin", async () => {
    const worker = createWorker();
    const allowed = await worker.fetch(
      new Request("https://api.example.test/v1/unknown", { headers: { Origin: "http://localhost:5173" } }),
      env({ DEV_ORIGIN: "http://localhost:5173" }),
    );
    const denied = await worker.fetch(
      new Request("https://api.example.test/v1/unknown", { headers: { Origin: "http://localhost:3000" } }),
      env({ DEV_ORIGIN: "http://localhost:5173" }),
    );

    expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
    expect(denied.status).toBe(403);
    expect(denied.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(await denied.json()).toEqual({
      error: { code: "cors_origin_denied", message: "The request origin is not allowed." },
    });
  });

  it("rejects a denied or over-broad preflight safely", async () => {
    const denied = await createWorker().fetch(
      new Request("https://api.example.test/v1/pair", {
        method: "OPTIONS",
        headers: {
          Origin: "https://evil.example.test",
          "Access-Control-Request-Method": "POST",
        },
      }),
      env(),
    );
    const broad = await createWorker().fetch(
      new Request("https://api.example.test/v1/pair", {
        method: "OPTIONS",
        headers: {
          Origin: "https://app.example.test",
          "Access-Control-Request-Method": "PATCH",
          "Access-Control-Request-Headers": "Authorization, X-Secret",
        },
      }),
      env(),
    );

    expect(denied.status).toBe(403);
    expect(broad.status).toBe(403);
    expect(broad.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(await broad.json()).toEqual({
      error: { code: "cors_origin_denied", message: "The CORS preflight is not allowed." },
    });
  });

  it("keeps the HTTPS requirement in front of routing", async () => {
    const response = await createWorker().fetch(
      new Request("http://api.example.test/v1/pair", {
        method: "POST",
        headers: { Origin: "https://app.example.test" },
      }),
      env(),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: "invalid_request", message: "The request must use HTTPS." },
    });
  });
});
