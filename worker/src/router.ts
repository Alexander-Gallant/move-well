import { handlePair, type PairDependencies } from "./routes/pair";
import { handlePush, type PushDependencies } from "./routes/push";
import { handleSchedule, type ScheduleDependencies } from "./routes/schedule";
import { handleDevice, type DeviceDependencies } from "./routes/device";

export interface RouterEnvironment {
  readonly DB: D1Database;
  readonly PAIRING_SECRET: string;
}

export interface RouterDependencies {
  readonly pair?: PairDependencies;
  readonly push?: PushDependencies;
  readonly schedule?: ScheduleDependencies;
  readonly device?: DeviceDependencies;
}

const jsonResponse = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });

const notFound = (): Response => jsonResponse({ error: { code: "not_found", message: "The requested resource was not found." } }, 404);

const decodePathSegment = (value: string): string | null => {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
};

/** Keep path matching centralized so every endpoint receives the same HTTPS handler contract. */
export const routeRequest = async (
  request: Request,
  env: RouterEnvironment,
  dependencies: RouterDependencies = {},
): Promise<Response> => {
  let pathname: string;
  try {
    pathname = new URL(request.url).pathname;
  } catch {
    return notFound();
  }

  if (pathname === "/v1/pair") return handlePair(request, env, dependencies.pair);

  const segments = pathname.split("/");
  if (segments.length === 4 && segments[1] === "v1" && segments[2] === "devices") {
    const deviceId = decodePathSegment(segments[3]);
    return deviceId === null ? notFound() : handleDevice(request, env, deviceId, dependencies.device);
  }

  if (segments.length === 5 && segments[1] === "v1" && segments[2] === "devices") {
    const deviceId = decodePathSegment(segments[3]);
    if (deviceId === null) return notFound();
    if (segments[4] === "push") return handlePush(request, env, deviceId, dependencies.push);
    if (segments[4] === "schedule") return handleSchedule(request, env, deviceId, dependencies.schedule);
  }

  return notFound();
};

export const router = routeRequest;
