---
source: Context7 API + official library/Cloudflare documentation
library: Web Push, VAPID, Cloudflare Workers
package: cloudflare-backend
topic: Cloudflare-compatible Web Push and VAPID delivery
tech_stack: Cloudflare Worker runtime with Web Crypto and fetch
fetched: 2026-11-19T00:00:00Z
official_docs: https://github.com/negrel/webpush
---

# Library decision

Prefer a Web-API-based implementation/library for the future delivery Worker. `@negrel/webpush` (JSR package; repository `negrel/webpush`) explicitly targets Deno and other web-compatible runtimes, has a `cloudflare-workers` topic, and uses `SubtleCrypto` plus `fetch`-compatible primitives. It exposes `generateVapidKeys`, `importVapidKeys`, `exportVapidKeys`, `exportApplicationServerKey`, `ApplicationServer`, and `PushSubscriber`; its README warns that it has not been reviewed by cryptography experts, so pin a version, run browser push-service integration tests, and review maintenance before production.

The popular `web-push` package is documented as a Node.js module and sends with Node `https.request`. It supports VAPID and `sendNotification(subscription, payload, options)`, but it is not the cleanest Workers fit. Current Workers can expose supported Node APIs with `nodejs_compat` (and older compatibility dates may need `enable_nodejs_http_modules`), but Cloudflare documents that the Workers `https` implementation wraps `fetch`, `https.Agent` is a stub, and custom TLS options are unsupported. Therefore treat `web-push` as a compatibility-tested fallback, not the default for a minimal Worker.

The `web-push-libs/vapid` project documents the VAPID claim requirements (`sub`, `aud`, `exp`) and header construction, but its JavaScript project is a small helper/demo rather than a complete Web Push encryption/delivery client. Use it only if implementing the RFC 8291/8292 request pipeline yourself.

## VAPID and secret bindings

Generate a VAPID P-256 key pair once outside request handling. Store the private key in a Worker encrypted secret binding, for example `VAPID_PRIVATE_KEY`; expose only the public key to the Pages app as a non-secret value. Store a stable contact subject such as `mailto:push@example.com`. VAPID `exp` values must be short-lived; the referenced VAPID docs describe a maximum of 24 hours.

The client needs the URL-safe public application-server key when calling `PushManager.subscribe({ applicationServerKey })`. The Worker needs the private key only when sending. Never send the private key to Pages or store it in the browser.

## Delivery shape for the later step

1. `scheduled()` selects due schedules from D1 in bounded batches.
2. For each subscription, construct the push payload and use the Web-API-compatible library to encrypt it and `fetch()` the subscription endpoint with VAPID.
3. Delete or disable subscriptions only for permanent invalid-subscription responses (commonly 404/410); retry transient failures with a bounded policy.
4. Use `ctx.waitUntil()` only for bounded post-response work; a Cron invocation has a finite duration/CPU budget, so paginate delivery rather than sending unbounded rows.

Do not perform delivery from a Pages request handler. Keeping the scheduled Worker separate makes retries, cron deployment, VAPID secrets, and future queues independent from the static Pages build.

## Relevant Cloudflare runtime facts

- Workers implement Web Crypto through `globalThis.crypto.subtle`, including P-256 operations needed by VAPID libraries.
- `crypto.getRandomValues()` is the documented source for secure pairing/device tokens.
- For a Node-only fallback, `nodejs_compat` and the supported Node HTTP client APIs may make `web-push` executable, but test the exact package version and avoid unsupported `https.Agent`/TLS options.
- Cron configuration is `triggers.crons`; each expression invokes `scheduled()`.

## Sources

- Web-compatible Web Push library: https://github.com/negrel/webpush
- JSR package: https://jsr.io/@negrel/webpush
- `web-push` API (`sendNotification`, VAPID): https://github.com/web-push-libs/web-push/blob/master/README.md
- `web-push` API reference: https://github.com/web-push-libs/web-push/blob/master/_autodocs/api-reference/web-push-lib.md
- VAPID project: https://github.com/web-push-libs/vapid
- Cloudflare Web Crypto: https://developers.cloudflare.com/workers/runtime-apis/web-crypto/
- Cloudflare Node HTTP compatibility: https://developers.cloudflare.com/workers/runtime-apis/nodejs/http/
- Cloudflare Node HTTPS limitations: https://developers.cloudflare.com/workers/runtime-apis/nodejs/https/
- Cloudflare compatibility flags: https://developers.cloudflare.com/workers/configuration/compatibility-flags/
- Cloudflare Cron Triggers: https://developers.cloudflare.com/workers/configuration/cron-triggers/
- RFC 8291 (message encryption): https://www.rfc-editor.org/rfc/rfc8291
- RFC 8292 (VAPID): https://www.rfc-editor.org/rfc/rfc8292
