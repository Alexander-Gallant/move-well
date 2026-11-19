# Personal push backend contract

This document freezes the Step 3 contract for the private reminder backend. It
describes a small HTTPS API for two installed copies of the app. The API stores
the minimum information needed to register a Web Push subscription and a
recurring reminder projection; exercises, routines, and workout history remain
on the device.

The recommended deployment is a separate Worker API at an API origin such as
`https://api.example.com`, with the static Vite app remaining on Pages. The API
base path in the examples below is `/v1`.

## Contract conventions

- Every request and response body is UTF-8 JSON unless the response is `204 No
  Content`.
- The API is HTTPS-only. HTTP requests are not accepted or redirected by the
  application contract.
- Timestamps are RFC 3339 UTC strings, for example
  `2026-11-19T12:34:56Z`.
- `deviceId` is an opaque server-generated identifier. Clients must not derive
  it from a user name, phone number, or push endpoint.
- All request bodies have a 16 KiB maximum. Unknown fields are rejected rather
  than persisted.
- A successful `PUT` is an idempotent replacement of that device's current
  push subscription or schedule.

## Authentication and token lifecycle

### Pairing

Pairing is the only unauthenticated operation. The operator supplies the
private pairing code out of band; it is never embedded in the frontend,
returned by the API, or written to D1. Pairing is allowed only over HTTPS and
is rate-limited. The deployment may use the same operator-controlled code for
the two intended phones, but the code must be rotated or disabled after
enrollment. It is not a device credential.

On a successful pair, the Worker generates at least 32 random bytes with
`crypto.getRandomValues`, encodes the result as an opaque base64url token, and
returns it once. The database stores only a SHA-256 hash of that token. The
plaintext token must not be logged, cached, placed in a URL, or returned by any
later endpoint.

The client stores the token in its device-local protected storage and sends it
as a bearer token. There is no refresh token and no token rotation endpoint in
this contract. A lost token requires pairing a replacement device; a device
that is no longer trusted must be revoked. Revocation is terminal for that
token and deletes its push subscription and schedule. A new pair creates a new
`deviceId` and token.

Authenticated requests use exactly:

```http
Authorization: Bearer <device-token>
```

The server rejects missing, malformed, unknown, or revoked tokens with `401`.
After authentication, the token must belong to the `{deviceId}` in the path.
A valid token used for a different device is rejected with `403`; the response
does not disclose the other device's state.

## Endpoint summary

| Method | Path | Authentication | Purpose |
| --- | --- | --- | --- |
| `POST` | `/v1/pair` | Pairing code in body | Enroll a device and issue its bearer token. |
| `PUT` | `/v1/devices/{deviceId}/push` | Bearer device token | Replace the device's one Web Push subscription. |
| `PUT` | `/v1/devices/{deviceId}/schedule` | Bearer device token | Replace the device's reminder projection. |
| `GET` | `/v1/devices/{deviceId}` | Bearer device token | Read minimal device status. |
| `DELETE` | `/v1/devices/{deviceId}` | Bearer device token | Revoke the device and remove remote reminder data. |

The `GET` route is the status route and the `DELETE` route is the revoke
route. No other route is part of this contract.

## `POST /v1/pair`

Creates one device enrollment. This route does not accept an `Authorization`
header as a substitute for the pairing code.

### Request

```json
{
  "pairingCode": "operator-supplied-code"
}
```

Validation:

- The body must be a JSON object containing only `pairingCode`.
- `pairingCode` must be a non-empty string within the server's configured
  length limit. Whitespace-only values are invalid.
- The code is compared without revealing whether a partial value matched.
- Pairing is rejected when enrollment is disabled or the two-device deployment
  limit has been reached.

### Success: `201 Created`

```json
{
  "deviceId": "device_01JEXAMPLE",
  "deviceToken": "returned-once-base64url-token",
  "tokenType": "Bearer"
}
```

`deviceToken` is present only in this response. The API never returns it from
status, push, schedule, or revoke routes.

## `PUT /v1/devices/{deviceId}/push`

Replaces the single Web Push subscription associated with the authenticated
device. The subscription is the browser's `PushSubscription.toJSON()` data
reduced to the fields below.

### Request

```json
{
  "subscription": {
    "endpoint": "https://push-service.example/subscription/opaque-value",
    "keys": {
      "p256dh": "base64url-public-key",
      "auth": "base64url-auth-secret"
    }
  }
}
```

Validation:

- The body must contain only `subscription`.
- `endpoint` must be an absolute `https` URL with no userinfo, fragment, or
  unexpected control characters. It is treated as opaque and is never logged.
- `keys.p256dh` and `keys.auth` must be non-empty, valid unpadded base64url
  strings within the configured length limit.
- The server stores at most one subscription per device; a later `PUT`
  replaces the previous value atomically.

### Success: `200 OK`

```json
{
  "deviceId": "device_01JEXAMPLE",
  "registered": true,
  "updatedAt": "2026-11-19T12:34:56Z"
}
```

The response contains no endpoint, subscription key, bearer token, or private
VAPID key.

## `PUT /v1/devices/{deviceId}/schedule`

Replaces the one remote reminder projection for the authenticated device. It
does not synchronize the app's local weekly routine assignments.

### Request and stored projection

```json
{
  "enabled": true,
  "localTime": "07:30",
  "timezone": "America/Toronto",
  "weekdayMask": 21
}
```

The remote schedule contains **only** these four fields:

- `enabled`: JSON boolean.
- `localTime`: exactly `HH:MM` in 24-hour local time, with no seconds or date.
- `timezone`: a valid IANA time-zone identifier, such as
  `America/Toronto`; fixed numeric offsets are not accepted.
- `weekdayMask`: integer `0` through `127`. Bit 0 is Monday, bit 1 Tuesday,
  through bit 6 Sunday. When `enabled` is true, at least one bit must be set;
  a disabled projection may use `0`.

The object must contain exactly those four fields. In particular, it must not
contain exercises, routine IDs, routine names, workout history, generated
workouts, notification text, or any other fitness details. The backend stores
no local schedule entries beyond this projection.

### Success: `200 OK`

```json
{
  "deviceId": "device_01JEXAMPLE",
  "schedule": {
    "enabled": true,
    "localTime": "07:30",
    "timezone": "America/Toronto",
    "weekdayMask": 21
  },
  "updatedAt": "2026-11-19T12:34:56Z"
}
```

## `GET /v1/devices/{deviceId}` — status

Returns only the authenticated device's remote registration state. It never
returns a token, endpoint, subscription keys, pairing code, VAPID private key,
or local fitness data.

### Success: `200 OK`

```json
{
  "deviceId": "device_01JEXAMPLE",
  "revoked": false,
  "push": {
    "registered": true,
    "updatedAt": "2026-11-19T12:34:56Z"
  },
  "schedule": {
    "enabled": true,
    "localTime": "07:30",
    "timezone": "America/Toronto",
    "weekdayMask": 21
  }
}
```

If no push subscription has been registered, `push.registered` is `false` and
`push.updatedAt` is omitted. If no schedule has been saved, `schedule` is
`null`. An authenticated, active device always returns `revoked: false`;
revoked devices cannot authenticate to this route.

## `DELETE /v1/devices/{deviceId}` — revoke

Revokes the authenticated device. The server marks its token revoked and
deletes the associated push subscription and schedule in one transaction. The
token cannot be reactivated or reused.

### Request

The request has no body. A `Content-Type` header is not required.

### Success: `204 No Content`

The response has an empty body. The client must remove its locally stored
device token after receiving `204`. Pairing is required to use the API again.

## Validation and error responses

Errors use this shape, except that CORS-denied responses may be deliberately
opaque to a browser:

```json
{
  "error": {
    "code": "invalid_request",
    "message": "The request body is invalid.",
    "fields": {
      "localTime": "Use 24-hour HH:MM."
    }
  }
}
```

`message` is safe for a client to display and must not contain tokens,
pairing-code comparisons, push endpoints, SQL details, or secret values.
`fields` is included only when individual input fields can be identified.

| Status | Code | Meaning |
| --- | --- | --- |
| `400` | `invalid_json` | The body is not valid JSON. |
| `400` | `invalid_request` | The JSON type, fields, size, or required value is invalid. |
| `400` | `invalid_push_subscription` | The endpoint or Web Push keys fail subscription validation. |
| `400` | `invalid_schedule` | The time, IANA zone, enabled state, or weekday mask is invalid. |
| `401` | `invalid_pairing_code` | A syntactically valid pairing code is incorrect or no longer enabled. The response does not say which. |
| `401` | `missing_authorization` | An authenticated route has no bearer header. |
| `401` | `invalid_token` | The bearer token is malformed, unknown, or revoked. |
| `403` | `forbidden_device` | A valid token was used for a different `{deviceId}`. |
| `403` | `cors_origin_denied` | The request `Origin` is not in the exact allowlist. |
| `404` | `not_found` | The requested API resource does not exist. |
| `409` | `pairing_limit_reached` | The two-device enrollment limit has been reached. |
| `405` | `method_not_allowed` | The path does not support the HTTP method used. |
| `415` | `unsupported_media_type` | A JSON request body was required but another media type was sent. |
| `429` | `rate_limited` | Pairing or another protected operation exceeded its request limit. |
| `500` | `internal_error` | The server could not complete the operation; no implementation detail is exposed. |

Missing, malformed, unknown, or revoked bearer tokens always use `401`, even
when the path's device ID is unknown. A valid bearer token for another device
uses `403`. This distinction prevents the API from treating a path ID as an
authentication credential.

## Strict CORS policy

The Worker uses a separate API origin, so browser calls are cross-origin. CORS
is an exact origin allowlist, not a convenience wildcard:

- In production, `ALLOWED_ORIGINS` must contain exactly one serialized origin:
  `APP_ORIGIN`, the deployed Pages app origin including scheme and optional
  port, with no path or trailing slash. The server refuses to start if this is
  absent, malformed, or contains a wildcard.
- In development only, the allowlist may additionally contain exactly
  `http://localhost:5173`. It must not be enabled in production. Other local
  ports, `file:`, `null`, preview URLs, and arbitrary `*.pages.dev` origins are
  denied unless explicitly configured as the one production `APP_ORIGIN`.
- The API never returns `Access-Control-Allow-Origin: *` and does not use
  credentialed cookies. `Access-Control-Allow-Credentials` is omitted.
- For an allowed origin, responses include
  `Access-Control-Allow-Origin: <the exact request Origin>` and
  `Vary: Origin`.
- A valid preflight `OPTIONS` request is answered with `204`,
  `Access-Control-Allow-Methods: GET, PUT, POST, DELETE, OPTIONS`, and
  `Access-Control-Allow-Headers: Authorization, Content-Type`. No other
  request method or request header is allowed by CORS.
- A preflight or request from a denied origin is rejected with `403
  cors_origin_denied` and receives no `Access-Control-Allow-Origin` header.
  CORS headers are never used to bypass bearer authentication or validation.

If the API is later mounted at the exact same origin as the Pages app under
`/api/*`, browser CORS is unnecessary; the route and bearer-token contract
above remains unchanged. The separate-origin deployment described here is the
default and must use the allowlist policy.

## Remote data boundary and security requirements

The minimum durable model is:

```text
devices
  device_id, token_hash, created_at, revoked_at
push_subscriptions
  device_id, endpoint, p256dh, auth, updated_at
reminder_schedules
  device_id, enabled, local_time, timezone, weekday_mask, updated_at
```

The push subscription is one row per device. The schedule projection is one
row per device. Foreign keys and a transaction keep revocation from leaving
remote reminder data behind. User-controlled values are written with prepared
statements and bound parameters.

Only the following may leave the phone for this feature:

1. The Web Push subscription required to address that browser.
2. The four-field reminder projection described above.
3. The opaque device ID and server timestamps needed to report registration
   status.

Exercises, named routines, routine contents, workout history, local storage
envelopes, and other fitness details stay in browser storage. The API is not an
account system, backup service, synchronization protocol, or source of truth
for the local-first workout data. Push endpoints, bearer tokens, pairing codes,
and VAPID private keys are secrets or sensitive values: do not log them, put
them in URLs, commit them, or expose them to frontend build variables. Store
the pairing and VAPID private keys in encrypted server secret bindings; only a
VAPID public key may be provided to the client.

## Step 3 deployment runbook

The deployable topology has two independent projects:

```text
Cloudflare Pages                    Cloudflare Worker
React/Vite dist                     https://api.<your-domain>
VITE_PUSH_API_BASE_URL              D1 binding: DB
VITE_VAPID_PUBLIC_KEY               APP_ORIGIN / optional DEV_ORIGIN
                                    encrypted PAIRING_SECRET
                                    encrypted VAPID_PRIVATE_KEY
```

The Pages project contains the frontend only. The Worker project contains the
API, D1 binding, and server secrets. Do not add the Worker secrets to Pages or
to a `VITE_*` variable.

### Provision D1 and the Worker domain

Run these commands from `worker/` with an authenticated Wrangler account:

```sh
npx wrangler login
npx wrangler d1 create personal-push
```

Copy the returned D1 `database_id` into `worker/wrangler.jsonc`, replacing
`<D1_DATABASE_ID>`. Replace the example `api.example.com` custom-domain
pattern with the real API hostname in the Cloudflare zone owned by the
operator. The existing `custom_domain: true` configuration lets Cloudflare
create the DNS record and certificate when the Worker is deployed.

Set the non-secret origin configuration before deployment. `APP_ORIGIN` is the
exact HTTPS Pages origin with no path or trailing slash. Put it in the
production Worker `vars` configuration. For local development, use an
untracked `worker/.dev.vars` file instead:

```dotenv
APP_ORIGIN="https://<pages-origin>"
DEV_ORIGIN="http://localhost:5173"
```

Do not deploy `DEV_ORIGIN` with production. The Worker accepts only the exact
configured origins and never enables wildcard CORS.

### Apply the migration and set encrypted secrets

After checking that the database name and ID identify the intended account,
apply the committed migration and confirm its state:

```sh
npx wrangler d1 migrations apply personal-push --remote
npx wrangler d1 migrations list personal-push --remote
```

Generate a VAPID key pair outside this repository. Give only the URL-safe
public key to the Pages build. Set the pairing code and VAPID private key as
encrypted Worker secrets; enter their real values only at the Wrangler
prompts:

```sh
npx wrangler secret put PAIRING_SECRET
npx wrangler secret put VAPID_PRIVATE_KEY
```

No real secret value belongs in this document, source code, `wrangler.jsonc`,
D1, a URL, a log, or a frontend build variable. The pairing secret is for
initial enrollment; the returned per-device bearer token is stored only on
that browser and only its hash is stored in D1.

### Deploy the Worker API

From `worker/`, run the local checks and a non-deploying bundle validation,
then deploy the API independently of Pages:

```sh
npm install
npm run check
npm test
npx wrangler deploy --dry-run
npm run deploy
```

The API should now be reachable at `https://api.<your-domain>`. A safe CORS
smoke test, which does not use a pairing code or token, is:

```sh
curl -i -X OPTIONS "https://api.<your-domain>/v1/pair" \
  -H "Origin: https://<pages-origin>" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type"
```

The allowed response is `204` with the exact Pages origin. A different origin
must be denied without an `Access-Control-Allow-Origin` header.

### Rollback

Pages and the Worker have independent deployment histories. Roll back each by
redeploying its known-good build/revision after the same local checks; rolling
back Worker code does not roll back D1. Applied D1 migrations are forward-only:
do not edit or delete an applied migration. Use a corrective migration or an
operator-reviewed D1 recovery procedure for data changes. A deployment
rollback is separate from device reset/revocation; revoke a device explicitly
when its token is no longer trusted.

### Configure and deploy Pages

In the Cloudflare Pages project, set these build-time variables separately for
production (and preview only when explicitly needed):

```dotenv
VITE_PUSH_API_BASE_URL="https://api.<your-domain>"
VITE_VAPID_PUBLIC_KEY="<base64url-vapid-public-key>"
```

The API base URL is the Worker origin, not the `/v1` path. From `web/`, build
and deploy the static output separately:

```sh
npm install
npm run test -- --run
npm run lint
npm run build
npx wrangler pages deploy dist --project-name <pages-project>
```

The Pages deployment must be HTTPS before installing it on an iPhone. A local
development build may use an untracked `.env.local`, while the Worker allows
`http://localhost:5173` only when it is explicitly configured as `DEV_ORIGIN`.

### Pairing, push registration, and reset

On each iPhone/iPad (iOS/iPadOS 16.4 or newer), open the Pages HTTPS URL in
Safari, choose **Share → Add to Home Screen**, and open the installed app.
Repeat these steps independently on both phones:

1. In **Reminder settings**, enter the operator-supplied pairing code and
   select **Pair this device**. The API returns a new `deviceId` and bearer
   token once.
2. Grant notification permission from the explicit user action.
3. Select **Register this device for push**. The client uploads the
   `PushSubscription.toJSON()` projection and the four-field remote schedule.
4. Change a reminder time or weekly assignment and confirm the app reports a
   successful remote update.

To reset a trusted device, call `DELETE /v1/devices/{deviceId}` with its
bearer token (or the equivalent `createPushApi().revoke()` client operation):

```sh
curl -i -X DELETE "https://api.<your-domain>/v1/devices/<device-id>" \
  -H "Authorization: Bearer <device-token>"
```

`204 No Content` means the Worker revoked the token and deleted its remote
subscription and schedule in one transaction. Clear the browser's
`move-well-push-credentials` entry. To remove the browser-side subscription as
well, unsubscribe it through the installed app/browser's service-worker site
data tools, then pair again if needed. A lost token cannot be recovered; pair a
replacement device and revoke the old one through an operator-controlled
procedure. Never put a token or pairing code in a URL or log.

### Final validation checklist

```sh
# web/
npm run test -- --run
npm run lint
npm run build

# worker/
npm run check
npm test
npx wrangler d1 migrations list personal-push --remote
npx wrangler deploy --dry-run
```

Also complete the HTTPS preflight, one pairing and push registration on each
phone, one remote schedule update, and one authenticated status check. These
checks validate Step 3 registration/storage only; they do not validate a
notification arriving while the app is closed.

## Explicit Step 4 boundary

This feature freezes storage and registration only. **Step 4 delivery, retries,
and Cron sending are out of scope for this feature.** In particular, this
contract does not define or implement:

- a Worker `scheduled()`/Cron Trigger that finds due schedules;
- VAPID encryption or a push-service send operation;
- delivery timing, duplicate suppression, retry or backoff policy;
- handling of expired subscriptions after a send attempt; or
- notification payload contents and workout-specific message generation.

Step 4 may consume the subscription and four-field schedule projection later,
but it must be specified and validated separately. Until then, these routes do
not promise that a reminder is delivered merely because a subscription and
schedule were accepted.
