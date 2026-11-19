# Personal push backend

This directory is the separate Cloudflare Worker API for the private Step 3
push-registration backend. The static React/Vite frontend is deployed to
Cloudflare Pages; it is not bundled into or deployed by this project.

The Worker stores only device registration data, one Web Push subscription per
device, and the four-field reminder projection described in
[`docs/technical/personal-push-backend.md`](../docs/technical/personal-push-backend.md).
Exercises, named routines, generated workouts, workout history, and the rest of
the local-first application state remain in each browser.

## Local development and checks

Run these commands from `worker/`:

```sh
npm install
npm run check
npm test
npm run dev
```

`npm run check` type-checks the Worker and `npm test` runs the route, database,
authentication, CORS, and integration tests. `npm run dev` is useful for
inspecting the Worker locally. The API contract accepts HTTPS only, so use the
test suite or the deployed HTTPS custom domain for end-to-end browser pairing;
do not treat an ordinary local HTTP request as a production API check.

For local D1 and secrets, create an untracked `worker/.dev.vars` file. It may
contain local-only values, but never commit it or print its contents:

```dotenv
APP_ORIGIN="https://<pages-origin>"
DEV_ORIGIN="http://localhost:5173"
PAIRING_SECRET="<local-pairing-secret>"
VAPID_PRIVATE_KEY="<local-vapid-private-key>"
```

`APP_ORIGIN` must be an exact HTTPS origin with no path or trailing slash.
`DEV_ORIGIN` is an exact development origin and is for local development only.
To exercise the migration against Wrangler's local D1 store rather than the
remote database, run this from `worker/`:

```sh
npx wrangler d1 migrations apply personal-push --local
```

## Configure Cloudflare resources

1. Log in with the Cloudflare account that owns the Worker and DNS zone:

   ```sh
   npx wrangler login
   ```

2. Create the remote D1 database from `worker/`:

   ```sh
   npx wrangler d1 create personal-push
   ```

   Copy the returned `database_id` into `worker/wrangler.jsonc`, replacing
   `<D1_DATABASE_ID>`. Keep the binding name `DB`, database name
   `personal-push`, and migrations directory unchanged.

3. Replace the example Worker custom domain in `wrangler.jsonc`:

   ```jsonc
   "routes": [{
     "pattern": "api.<your-domain>",
     "custom_domain": true
   }]
   ```

   The zone must be active in Cloudflare. A custom domain provisions the DNS
   record and certificate; it sends all paths on that host to this Worker.

4. Configure the non-secret origins. In the production Worker configuration,
   add `APP_ORIGIN` to `vars` with the exact deployed Pages origin (for
   example, `https://<pages-origin>`). Do **not** put `DEV_ORIGIN` in the
   production configuration. For local development, use the `.dev.vars`
   example above. The API allows only `APP_ORIGIN`, plus `DEV_ORIGIN` when it
   is explicitly running as a development origin; it never uses `*` CORS.

5. Generate one VAPID key pair with the chosen Web Push tooling. Keep the
   private key out of this repository and give the public key to the Pages
   build only. Set the encrypted Worker secrets interactively:

   ```sh
   npx wrangler secret put PAIRING_SECRET
   npx wrangler secret put VAPID_PRIVATE_KEY
   ```

   The prompts must receive real values only in the deployment operator's
   terminal. Neither value belongs in `wrangler.jsonc`, D1, source code, a
   Vite variable, a URL, or a log. Wrangler's `secrets.required` declaration
   validates that both encrypted bindings exist before deployment.

## Apply the migration and deploy the API

Apply the migration only after the configured database name and ID point to the
intended account:

```sh
npx wrangler d1 migrations apply personal-push --remote
npx wrangler d1 migrations list personal-push --remote
npx wrangler deploy --dry-run
npm run deploy
```

`npx wrangler deploy` deploys the Worker API and its custom domain. It does not
build or deploy the Pages frontend. `--dry-run` is a configuration/bundle
check; the migration-list command should show the committed migration as
applied. Re-run migrations after a later migration is added, but never edit an
already-applied migration in place.

To roll back code, redeploy a known-good Worker revision from version control
after running `npm run check` and `npm test`; deploy the matching known-good
Pages build separately. Treat D1 migrations as forward-only: do not delete or
rewrite an applied migration to undo code. A corrective migration or an
operator-reviewed D1 recovery procedure is required for data changes. Code
rollback does not revoke devices; use the revoke procedure below when a phone
or token is no longer trusted.

## API smoke check

After DNS and TLS are ready, check the exact Pages origin against the API
preflight. This does not disclose a pairing code or token:

```sh
curl -i -X OPTIONS "https://api.<your-domain>/v1/pair" \
  -H "Origin: https://<pages-origin>" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type"
```

An allowed preflight returns `204` with the exact origin and the documented
CORS methods/headers. A denied origin must not receive
`Access-Control-Allow-Origin`.

## Pair both phones

Configure the Pages build first (see `web/README.md`), install that HTTPS site
from Safari as a Home Screen app on each iPhone, and then repeat the following
on each installed app:

1. Open **Reminder settings** and use the operator-provided pairing code in
   **Private remote reminders → Pair this device**.
2. Allow browser notifications from the explicit permission action.
3. Select **Register this device for push**. The app uploads the browser's
   subscription and the four-field reminder projection; it does not upload
   routines or exercises.
4. Change a reminder time or weekly assignment and confirm the remote status
   remains successful. Each phone receives its own `deviceId` and bearer token.

The pairing code is an enrollment secret, not a device token. Treat the token
returned by pairing as sensitive; the frontend stores it locally under
`move-well-push-credentials`, and the Worker stores only its SHA-256 hash.

## Reset, revoke, and remove a subscription

To revoke the current device, call the authenticated contract route with that
device's locally stored token (or use the corresponding client API):

```sh
curl -i -X DELETE "https://api.<your-domain>/v1/devices/<device-id>" \
  -H "Authorization: Bearer <device-token>"
```

The expected response is `204 No Content`. Revocation marks the device
revoked and transactionally deletes its remote push subscription and schedule;
the token cannot be reused. Clear the browser's `move-well-push-credentials`
entry afterward. If the browser's PushSubscription itself must be removed,
unsubscribe it from the installed app/browser's site data or service-worker
tools, then pair the replacement device again. A lost token requires a new
pairing; never put a token in a URL or log.

## Step 4 boundary

This Worker implements registration and storage only. Scheduled push delivery,
VAPID encryption, retry/expiry handling, notification payload generation, and
the Worker `scheduled()`/Cron handler are **not implemented**. An accepted
subscription and schedule therefore do not promise that a reminder is sent
while the app is closed. The foreground reminder remains the fallback until
Step 4 is designed, implemented, and validated separately.
