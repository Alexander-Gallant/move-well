# Move well: iPhone PWA and workout reminders

This is the implementation reference for running **Move well** as a small,
open-source web app for two people. The app remains local-first for exercises,
routines, and workout data. A minimal backend is added only when it becomes
necessary to deliver background push reminders.

## Current starting point

- The React/Vite app already has a manifest and production service worker.
- The app can cache its shell and run offline after installation.
- Workout data and weekly schedules currently live in browser `localStorage`.
- Current browser reminders are foreground-only; they are not reliable when the
  iPhone app is closed.

## Implementation phases

### Step 1 — Make the PWA installation-ready

**Goal:** Deploy the static app over HTTPS and install it from Safari on both
iPhones.

- [x] Add iPhone-friendly PNG icon assets and manifest entries.
- [x] Add the `apple-touch-icon` HTML link.
- [x] Include the icon assets in service-worker precaching.
- [x] Build and verify the production output.
- [ ] Host the `web/dist` output on GitHub Pages, Cloudflare Pages, Netlify, or
  another HTTPS static host.
- [ ] On each iPhone, open the HTTPS URL in Safari and choose **Share → Add to
  Home Screen**.
- [ ] Open the app from the new Home Screen icon and confirm standalone launch.

**Verification:** `npm run build`, `npm run lint`, and
`npm run test -- --run` pass; the installed app opens and works offline after
the first successful load.

### Step 2 — Add the Web Push client

**Goal:** Allow each installed Home Screen app to register for push notifications.

- [x] Add a push subscription module with explicit browser capability checks.
- [x] Request permission only from the existing reminder-settings button.
- [x] Register the production service worker and call `pushManager.subscribe()`
  with the backend's public VAPID key.
- [x] Send the subscription to the private backend.
- [x] Add a service-worker `push` event handler that immediately calls
  `showNotification()`.
- [x] Add a `notificationclick` handler that opens or focuses the app.
- [x] Keep the existing foreground reminder as a fallback.

**Current status:** The client-side registration flow and Step 3 upload boundary
are implemented. It remains inactive until `VITE_VAPID_PUBLIC_KEY`,
`VITE_PUSH_API_BASE_URL`, and a paired Worker device are configured.

**Verification:** A configured phone obtains a `userVisibleOnly` subscription
and the service worker's local push handler can display a payload when one is
available. Sending a scheduled test push is deferred to Step 4.

### Step 3 — Add the minimal private reminder backend

**Goal:** Store only what is needed to send reminders to two devices.

- [x] Use a separate Cloudflare Worker API and Cloudflare D1 database.
- [x] Generate VAPID keys and store the private key as an encrypted Worker
  secret; expose only the public key to Pages.
- [x] Store a hashed device token, push subscription, time zone, and four-field
  weekly reminder projection.
- [x] Use a private pairing code and per-device bearer token instead of a full
  account system.
- [x] Validate request bodies, use prepared D1 statements, and never log push
  endpoints or secrets.
- [x] Keep exercise details, routines, and generated workouts local.

### Step 3 deployment and pairing runbook

The frontend Pages deployment and Worker API deployment are separate. Run
Worker commands from `worker/` and Pages commands from `web/`; deploying one
does not deploy the other.

1. **Create D1 and configure the Worker.** From `worker/`, run
   `npx wrangler login` and `npx wrangler d1 create personal-push`. Copy the
   returned database ID into `worker/wrangler.jsonc`, replace the example
   custom-domain pattern with `api.<your-domain>`, and keep
   `custom_domain: true`. Apply the schema with
   `npx wrangler d1 migrations apply personal-push --remote`.
2. **Set origins.** Configure production `APP_ORIGIN` as the exact HTTPS Pages
   origin, with no path or trailing slash. Configure `DEV_ORIGIN` only in an
   untracked local `worker/.dev.vars` file, normally
   `http://localhost:5173`; do not deploy it to production. CORS allows only
   these exact origins.
3. **Set encrypted secrets.** From `worker/`, run
   `npx wrangler secret put PAIRING_SECRET` and
   `npx wrangler secret put VAPID_PRIVATE_KEY`, entering values interactively.
   Do not put real secret values in this repository, D1, `wrangler.jsonc`, a
   URL, logs, or frontend variables.
4. **Validate and deploy the Worker API.** Run `npm run check`, `npm test`,
   `npx wrangler d1 migrations list personal-push --remote`, and
   `npx wrangler deploy --dry-run`; then run `npm run deploy` from `worker/`.
5. **Configure and deploy Pages.** In the Pages project's production build
   environment, set `VITE_PUSH_API_BASE_URL` to the Worker origin
   (`https://api.<your-domain>`, without `/v1`) and
   `VITE_VAPID_PUBLIC_KEY` to the URL-safe public VAPID key. From `web/`, run
   `npm run test -- --run`, `npm run lint`, `npm run build`, then
   `npx wrangler pages deploy dist --project-name <pages-project>`.
6. **Pair each phone.** On iOS/iPadOS 16.4 or newer, open the Pages HTTPS URL
   in Safari, choose **Share → Add to Home Screen**, and open the installed
   app. In **Reminder settings**, enter the operator-provided pairing code,
   select **Pair this device**, grant notification permission, and select
   **Register this device for push**. Repeat on the second phone; each gets a
   separate device ID and bearer token. Confirm that a reminder-time or
   weekly-assignment change reports a successful remote update.
7. **Reset or revoke.** `DELETE /v1/devices/{deviceId}` with the device's
   bearer token returns `204`, revokes the token, and deletes that device's
   remote subscription and schedule. Clear the local
   `move-well-push-credentials` entry and unsubscribe/remove the browser
   PushSubscription through the installed app/browser's site data tools when a
   complete reset is required. Pair again for a replacement device. A lost
   token cannot be recovered.
8. **Roll back safely.** Pages and the Worker have separate deployment
   histories; redeploy a known-good frontend build and Worker revision
   independently after their checks pass. Applied D1 migrations are
   forward-only, so use a corrective migration or an operator-reviewed D1
   recovery procedure rather than editing or deleting an applied migration.

**Verification:** Both phones can register independently, and invalid or
unauthorized requests are rejected. The Worker README contains the safe CORS
`OPTIONS` smoke check; it must return `204` only for the configured Pages
origin.

### Step 4 — Schedule and deliver workout reminders (not implemented)

**Goal:** Send recurring reminders without the app being open.

- [ ] Add a serverless scheduled job that runs approximately once per minute.
- [ ] Resolve each device's weekly schedule in its configured time zone.
- [ ] Send at most one notification for each due workout occurrence.
- [ ] Handle expired subscriptions by removing or disabling them.
- [ ] Update the backend whenever reminder settings or schedules change.

**Verification:** A test schedule produces one notification at the expected
local time on each phone, including when the app is closed.

**Current boundary:** Step 4 scheduled push delivery is explicitly out of scope
for `personal-push-backend`. There is no Worker `scheduled()` handler or Cron
Trigger, VAPID encryption/send operation, retry policy, expired-subscription
cleanup, or workout-specific notification payload yet. Registering a push
subscription and schedule does not promise background delivery; the existing
foreground reminder remains the fallback.

### Step 5 — Test and document the personal deployment

- [ ] Test iOS/iPadOS 16.4 or newer.
- [ ] Test permission granted, denied, and later re-enabled.
- [ ] Test Focus mode and normal notification settings.
- [ ] Test offline app use and service-worker updates.
- [ ] Test daylight-saving and time-zone behavior.
- [x] Document deployment secrets, pairing, reset, and subscription removal.
- [x] Update `web/README.md` and the personal push backend technical runbook
  for Step 3 registration/storage.
- [ ] Update the delivery documentation when Step 4 is separately implemented.

## Architecture decisions

### Keep the app local-first

The full workout experience should continue to work without an account or
network. Only push subscriptions and the minimum recurring reminder data need to
leave the phone.

### Use Web Push rather than native iOS packaging

This avoids the App Store and Apple Developer Program. iPhone Web Push is
available to Home Screen web apps on iOS/iPadOS 16.4 and newer, provided the app
is served over HTTPS and permission is requested from a direct user action.

### Do not promise delivery as absolute

Push delivery can still be affected by notification permissions, Focus modes,
network availability, expired subscriptions, and operating-system behavior.

## Useful references

- [Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [Vite static deployment](https://vite.dev/guide/static-deploy.html)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [PushManager.subscribe](https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe)
