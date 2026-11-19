export const CORS_METHODS = "GET, PUT, POST, DELETE, OPTIONS";
export const CORS_HEADERS = "Authorization, Content-Type";

const allowedMethods = new Set(CORS_METHODS.split(", "));
const allowedHeaders = new Set(CORS_HEADERS.toLowerCase().split(", ").map((header) => header.toLowerCase()));

export interface CorsPolicyInput {
  readonly appOrigin: string;
  readonly developmentOrigin?: string;
}

export interface CorsPolicy {
  readonly origins: ReadonlySet<string>;
}

export interface CorsDecision {
  readonly response: Response | null;
  readonly origin: string | null;
}

const isSerializedOrigin = (value: string, httpsOnly = false): boolean => {
  if (!value || value.trim() !== value || value === "*") return false;
  if (value.endsWith("/")) return false;

  try {
    const parsed = new URL(value);
    return (
      (httpsOnly ? parsed.protocol === "https:" : parsed.protocol === "https:" || parsed.protocol === "http:") &&
      !parsed.username &&
      !parsed.password &&
      parsed.pathname === "/" &&
      parsed.search === "" &&
      parsed.hash === "" &&
      parsed.origin === value
    );
  } catch {
    return false;
  }
};

export const createCorsPolicy = (input: CorsPolicyInput): CorsPolicy => {
  if (!isSerializedOrigin(input.appOrigin, true)) {
    throw new Error("APP_ORIGIN must be one serialized HTTPS origin");
  }

  const origins = new Set<string>([input.appOrigin]);
  if (input.developmentOrigin !== undefined) {
    if (!isSerializedOrigin(input.developmentOrigin)) {
      throw new Error("The development origin must be one serialized HTTP(S) origin");
    }
    origins.add(input.developmentOrigin);
  }
  return { origins };
};

const jsonError = (status: number, code: string, message: string): Response =>
  new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      Vary: "Origin",
    },
  });

const withHeader = (headers: Headers, name: string, value: string): void => {
  headers.set(name, value);
};

const allowedRequestHeaders = (value: string): boolean =>
  value
    .split(",")
    .map((header) => header.trim().toLowerCase())
    .filter(Boolean)
    .every((header) => allowedHeaders.has(header));

const validPreflight = (request: Request): boolean => {
  const requestedMethod = request.headers.get("Access-Control-Request-Method");
  const requestedHeaders = request.headers.get("Access-Control-Request-Headers");
  return (
    (requestedMethod === null || allowedMethods.has(requestedMethod)) &&
    (requestedHeaders === null || allowedRequestHeaders(requestedHeaders))
  );
};

const preflightResponse = (origin: string): Response =>
  new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Headers": CORS_HEADERS,
      "Access-Control-Allow-Methods": CORS_METHODS,
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    },
  });

/** Decide CORS before routing so a denied browser origin cannot reach auth or D1. */
export const decideCors = (request: Request, policy: CorsPolicy): CorsDecision => {
  const origin = request.headers.get("Origin");
  if (origin === null) {
    return { response: request.method === "OPTIONS" ? new Response(null, { status: 204 }) : null, origin: null };
  }

  if (!policy.origins.has(origin)) {
    return {
      response: jsonError(403, "cors_origin_denied", "The request origin is not allowed."),
      origin: null,
    };
  }

  if (request.method === "OPTIONS") {
    return validPreflight(request)
      ? { response: preflightResponse(origin), origin: null }
      : { response: jsonError(403, "cors_origin_denied", "The CORS preflight is not allowed."), origin: null };
  }
  return { response: null, origin };
};

export const applyCors = (response: Response, origin: string | null): Response => {
  if (origin === null) return response;
  const result = new Response(response.body, response);
  withHeader(result.headers, "Access-Control-Allow-Origin", origin);
  withHeader(result.headers, "Vary", "Origin");
  return result;
};
