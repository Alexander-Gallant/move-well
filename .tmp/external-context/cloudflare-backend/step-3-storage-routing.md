---
source: Context7 API + official Cloudflare documentation
library: Cloudflare Pages, Cloudflare Workers, D1, KV
package: cloudflare-backend
topic: Step 3 storage, authentication, routing, and deployment
tech_stack: Cloudflare Pages/Vite frontend; separate Cloudflare Worker API
fetched: 2026-11-19T00:00:00Z
official_docs: https://developers.cloudflare.com/workers/
---

# Recommendation

Use a **separate Worker for the backend/API** and leave the Vite build on Pages. Cloudflare's current Workers SDK guidance says new application logic should be written in a Worker rather than added to an existing `functions/` directory; Workers also provide the scheduled handler needed for later reminder delivery. Use `api.example.com` as a Worker custom domain. A same-domain `example.com/api/*` route is also supported, but a subdomain keeps Pages and API deployment boundaries clear.

Pages Functions remain a valid minimal alternative when same-origin `/api/*` and one deployment are more important than scheduled delivery. Pages Functions use file-based routing (`functions/api/...`) and `context.env` bindings, but Pages Wrangler configuration differs from Workers configuration.

## Recommended Worker configuration

`wrangler.jsonc` for the API Worker (replace IDs and domain):

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "fitness-api",
  "main": "src/index.ts",
  "compatibility_date": "2026-11-19",
  "compatibility_flags": ["nodejs_compat"],
  "routes": [
    { "pattern": "api.example.com", "custom_domain": true }
  ],
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "fitness",
      "database_id": "<D1_DATABASE_ID>",
      "migrations_dir": "./migrations"
    }
  ],
  "triggers": {
    "crons": ["*/5 * * * *"]
  }
}
```

The cron is only a future delivery hook; Step 3 can leave `scheduled()` as a no-op or use it to find due schedules. Cron expressions invoke the Worker `scheduled` handler. A route alternative is:

```jsonc
"routes": [
  { "pattern": "example.com/api/*", "zone_name": "example.com" }
]
```

Deploy and migrate:

```sh
npx wrangler d1 create fitness
npx wrangler d1 migrations apply fitness --remote
npx wrangler secret put PAIRING_SECRET
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler deploy
```

Keep `VAPID_PUBLIC_KEY` as a non-secret build/runtime variable if desired; keep the private key, pairing secret, and any encryption key as encrypted secret bindings. `wrangler secret put` creates and deploys a new Worker version. Do not put secrets in `wrangler.jsonc`, Vite `VITE_*` variables, source, or D1 rows.

## Pages/Vite alternative

If the API is kept in the Pages project, the Vite output and bindings can be configured as follows:

```toml
name = "fitness-pages"
pages_build_output_dir = "./dist"
compatibility_date = "2026-11-19"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "fitness"
database_id = "<D1_DATABASE_ID>"

[[kv_namespaces]]
binding = "CACHE"
id = "<KV_NAMESPACE_ID>"
```

`functions/api/subscriptions.ts` maps to `/api/subscriptions`; `functions/api/schedules.ts` maps to `/api/schedules`. Deploy with:

```sh
npm run build
npx wrangler pages deploy dist --project-name=fitness-pages
```

For this design, do not add KV merely because Pages supports it: use D1 as the source of truth and omit KV unless it is later needed for cache/configuration.

## D1 versus KV

Use **D1** for device records, push subscriptions, and reminder schedules. The data is relational, must be queried by `device_id`/due time, and benefits from unique constraints and transactional writes. Use prepared statements with `bind()` for all user-controlled values. `D1Database.batch()` runs statements sequentially in one transaction and rolls back the entire batch if one fails.

Do **not** use KV as the canonical store: KV is eventually consistent, can expose a previous value for the cache TTL, and is not appropriate when an operation needs atomic read/write behavior. KV is reasonable later for read-heavy, non-critical configuration or cache entries.

Minimal schema shape:

```sql
CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  token_hash BLOB NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER
);

CREATE TABLE push_subscriptions (
  device_id TEXT PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE reminder_schedules (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  local_time TEXT NOT NULL,
  timezone TEXT NOT NULL,
  days_mask INTEGER NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  next_due_at INTEGER,
  updated_at INTEGER NOT NULL
);
```

The `PRIMARY KEY` on `push_subscriptions.device_id` enforces the Step 3 requirement of at most one subscription per device; two device rows are supported. If “two total subscriptions” is a hard invariant, enforce it in application logic inside a D1 transaction and reject a third device.

## Private pairing/device token

Use a one-time pairing secret (or pairing code) in `PAIRING_SECRET` to authorize initial enrollment. On successful pairing, mint a per-device bearer token from `crypto.getRandomValues(new Uint8Array(32))`; return it once over HTTPS. Store only a SHA-256 hash in `devices.token_hash`. Require `Authorization: Bearer <device-token>` on subscription and schedule endpoints; revoke by setting `revoked_at`. Do not use `Math.random()` or store the bearer token plaintext.

Recommended endpoint surface:

```text
POST /v1/pair                 # pairing secret -> device_id + device token (one time)
PUT  /v1/devices/:id/push    # authenticated; upsert exactly one subscription
PUT  /v1/devices/:id/schedule# authenticated; upsert reminder schedule
GET  /v1/devices/:id         # authenticated; minimal status, never token/private key
DELETE /v1/devices/:id       # authenticated; revoke token and delete subscription
```

Bind and query D1 through `env.DB` in a Worker or `context.env.DB` in a Pages Function. Validate JSON size/shape, endpoint URL and subscription keys, device ownership, allowed schedule ranges, and method; return `401` for missing/invalid tokens and `403` for a valid token without access.

## CORS

With the recommended `api.example.com` design, the Pages app is cross-origin. Allow exactly the production app origin (and a separate development origin only when needed); never combine `Access-Control-Allow-Credentials: true` with `*`. Handle `OPTIONS` with `204`, allow only `GET, PUT, POST, DELETE, OPTIONS`, and allow only `Authorization, Content-Type`. Add `Vary: Origin` when the response varies by origin. If the API is mounted at `example.com/api/*`, use same-origin requests and no CORS is needed.

Relevant official examples show the preflight/response pattern, but their wildcard origin is not suitable for this private API.

## Sources

- Pages Functions routing: https://developers.cloudflare.com/pages/functions/routing/
- Pages Wrangler configuration and bindings: https://developers.cloudflare.com/pages/functions/wrangler-configuration/ and https://developers.cloudflare.com/pages/functions/bindings/
- Pages deployment: https://developers.cloudflare.com/pages/get-started/direct-upload/
- Worker routes/custom domains: https://developers.cloudflare.com/workers/configuration/routing/routes/
- Workers static assets/routing guidance: https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/
- Workers-to-Pages migration guidance: https://github.com/cloudflare/workers-sdk/blob/main/packages/pages-functions/README.md
- D1 bindings/configuration: https://developers.cloudflare.com/workers/wrangler/configuration/#d1-databases
- D1 batch transactions: https://developers.cloudflare.com/d1/worker-api/d1-database/#batch
- KV consistency: https://developers.cloudflare.com/kv/concepts/how-kv-works/
- Worker secrets: https://developers.cloudflare.com/workers/configuration/secrets/
- CORS example: https://developers.cloudflare.com/pages/functions/examples/cors-headers/
- Secure token generation/HMAC example: https://developers.cloudflare.com/workers/examples/signing-requests/
- Cron Triggers: https://developers.cloudflare.com/workers/configuration/cron-triggers/
