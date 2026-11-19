import { applyCors, createCorsPolicy, decideCors } from "./cors";
import { routeRequest, type RouterDependencies, type RouterEnvironment } from "./router";

export interface Env extends RouterEnvironment {
  readonly VAPID_PRIVATE_KEY: string;
  readonly APP_ORIGIN: string;
  readonly DEV_ORIGIN?: string;
  readonly DEVELOPMENT_ORIGIN?: string;
}

const jsonError = (status: number, code: string, message: string): Response =>
  new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });

const isHttps = (request: Request): boolean => {
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
};

export const createWorker = (dependencies: RouterDependencies = {}) => ({
  async fetch(request: Request, env: Env): Promise<Response> {
    let policy;
    try {
      policy = createCorsPolicy({
        appOrigin: env.APP_ORIGIN,
        developmentOrigin: env.DEV_ORIGIN ?? env.DEVELOPMENT_ORIGIN,
      });
    } catch {
      return jsonError(500, "internal_error", "The server could not complete the operation.");
    }

    const cors = decideCors(request, policy);
    if (cors.response !== null) return cors.response;
    if (!isHttps(request)) {
      return applyCors(jsonError(400, "invalid_request", "The request must use HTTPS."), cors.origin);
    }

    let response: Response;
    try {
      response = await routeRequest(request, env, dependencies);
    } catch {
      response = jsonError(500, "internal_error", "The server could not complete the operation.");
    }
    return applyCors(response, cors.origin);
  },
});

const worker = createWorker();

export default worker satisfies ExportedHandler<Env>;
