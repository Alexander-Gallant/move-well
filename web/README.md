# Move well

Move well is a local-first fitness web app for browsing exercises, creating named routines, and
planning recurring weekly workouts. The optional private push API stores only device registration,
the Web Push subscription, and a four-field reminder projection; workout data stays in the current
browser.

## Features

- Browse, filter, and inspect strength and stretching exercises.
- Add custom exercises and keep the draft visible if a save fails.
- Generate and save multiple named routines.
- Regenerate one routine group or all groups.
- Assign routines to weekdays and times in a recurring Monday-to-Sunday schedule.
- Check due reminders in the foreground while the app is open.
- Install the production build as a PWA and use the cached app shell offline.

## Setup

From this directory:

```bash
npm install
npm run dev
```

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server. |
| `npm run build` | Type-check and create the production bundle. |
| `npm run preview` | Serve the production bundle locally. |
| `npm run lint` | Run Oxlint. |
| `npm run test` | Start Vitest in watch mode. |
| `npm run test -- --run` | Run the Vitest suite once. |

The service worker is copied to `dist/sw.js` by the build and registered only in production.

## Local data and migration

The app writes a validated version 1 envelope to `localStorage` under `move-well-storage`:

```json
{
  "version": 1,
  "data": {
    "exercises": [],
    "routines": [],
    "schedule": [],
    "reminders": {
      "enabled": false,
      "time": "09:00",
      "notificationCapability": "unsupported"
    }
  }
}
```

Startup behavior is defensive:

- A valid current envelope is normalized and returned.
- Missing, malformed, or unsupported current data is repaired section by section. Valid records are
  retained; malformed records are discarded; an unusable section gets its safe fallback.
- Compatible valid data from the legacy `move-well-exercises` and `move-well-routine` keys is used
  when the corresponding current section cannot be repaired.
- Before replacing a malformed or unsupported current envelope, its original raw value is saved
  under `move-well-storage-backup`.

The version field makes future schema changes explicit. Writes accept only validated state, and
Cache Storage is never used as a user-data backup or synchronization layer.

## Routines and weekly recurrence

Each saved routine has an id, a user-facing name, and exercise selections. A schedule entry references
a routine by id and stores a weekday and 24-hour time:

```json
{
  "id": "monday-strength",
  "day": "monday",
  "time": "07:30",
  "routineId": "morning-strength"
}
```

Assignments recur weekly. The schedule view expands them into a deterministic Monday-to-Sunday week,
validates routine references, and sorts entries by time and id.

Deleting a routine also deletes every schedule assignment that references it. The UI prevents deleting
the last saved routine. In the routine builder, the group button regenerates only that focus area;
**Regenerate all** replaces the exercise selections in every group.

## Reminders

Reminders are permission-gated and best-effort. When the app is open, a foreground check runs at
startup and every 15 seconds. It matches the local weekday and minute against enabled reminders and
scheduled assignments, then attempts at most one notification per scheduled minute during that page
session.

The capability is stored as `granted`, `default`, `denied`, `unsupported`, or `error`:

- Permission is requested only after the user clicks the permission button.
- Unsupported, denied, default, and error states leave the schedule usable and show a fallback.
- A notification display failure is non-fatal; the workout remains visible in the schedule.

This is **not** guaranteed background scheduling and does not promise reliable iPhone notification
delivery. Users can open the app to see the recurring plan.

The client also contains the first Web Push integration boundary:

- Permission is still requested only from the explicit reminder-settings action.
- A configured `VITE_VAPID_PUBLIC_KEY` allows the installed app to register a
  `userVisibleOnly` push subscription through the production service worker.
- The service worker can display a defensive push payload and focus the app when
  its notification is clicked.
- When the private Worker API is configured and the device is paired, the app
  uploads the subscription and four-field reminder projection. It never uploads
  exercises, routines, routine contents, or generated workouts.
- A VAPID public key is safe to expose to the browser; the VAPID private key and
  pairing secret must remain encrypted Worker secrets.

## Separate Pages frontend and Worker API deployment

Cloudflare Pages hosts this Vite frontend. The push API is a separate Cloudflare
Worker at an HTTPS custom domain such as `https://api.<your-domain>`; deploying
one does not deploy the other. Deploy the Worker first so the API origin and
VAPID public key are known, then build and deploy Pages.

### Configure the Pages build

The frontend reads these Vite variables at build time:

```dotenv
VITE_PUSH_API_BASE_URL="https://api.<your-domain>"
VITE_VAPID_PUBLIC_KEY="<base64url-vapid-public-key>"
```

The API base URL is the Worker origin only; do not append `/v1` because the
client adds that path. Set both variables in the Cloudflare Pages project's
production environment (and separately in its preview environment if preview
testing is required). For a local build, use an untracked `.env.local` file or
provide the variables in the shell. Never put `PAIRING_SECRET`,
`VAPID_PRIVATE_KEY`, or a device bearer token in a `VITE_*` variable.

From `web/`, validate and deploy the static site separately:

```bash
npm install
npm run test -- --run
npm run lint
npm run build
npx wrangler pages deploy dist --project-name <pages-project>
```

For a direct-upload build, the Pages environment variables must be present
before `npm run build`; a local one-off build can use placeholders supplied only
through the shell, for example:

```bash
VITE_PUSH_API_BASE_URL="https://api.<your-domain>" \
VITE_VAPID_PUBLIC_KEY="<base64url-vapid-public-key>" \
npm run build
```

The Worker database migration, custom domain, `APP_ORIGIN`, `DEV_ORIGIN`, and
encrypted secrets are configured from `worker/`; see `worker/README.md`. In
production, `APP_ORIGIN` must exactly match this Pages origin. `DEV_ORIGIN` is
only for an explicitly configured local development origin such as
`http://localhost:5173`.

### Pair and register each phone

On iOS/iPadOS 16.4 or newer, open the deployed Pages URL in Safari, choose
**Share → Add to Home Screen**, and open the installed app. Repeat on both
phones:

1. In **Reminder settings**, enter the operator-supplied pairing code and tap
   **Pair this device**.
2. Grant notification permission from the explicit permission button.
3. Tap **Register this device for push**. The app uploads the browser
   subscription and the remote reminder projection.
4. Confirm that changing the reminder time or weekly assignment reports a
   successful remote update.

Pairing creates a separate device record and bearer token per phone. The token
is stored only in that browser's `move-well-push-credentials` entry. To reset a
device, revoke `DELETE /v1/devices/{deviceId}` with its bearer token, clear that
local credential entry, and unsubscribe/remove the browser PushSubscription if
a complete browser reset is needed. Pair again to create a replacement device;
never paste tokens or pairing codes into URLs or logs.

### Final validation

Run the frontend checks from `web/` and the API checks from `worker/`:

```bash
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

After deployment, also verify the Worker's HTTPS CORS preflight from the exact
Pages origin and complete one pairing/registration on each phone. The Worker
README contains the safe `curl -X OPTIONS` check. A `204` preflight, successful
pairing, registered push subscription, and status response confirm Step 3;
they do not test scheduled delivery.

## Offline and PWA behavior

Use a production build to test the PWA:

```bash
npm run build
npm run preview
```

Vite builds with `base: './'`, and the production service worker is registered from the base-aware
URL. During installation it precaches the production `index.html`, manifest/icon shell assets, and
the static asset graph discovered from the built app shell (for example, hashed scripts and styles).

The worker uses versioned caches `move-well-precache-v5` and `move-well-runtime-v5`:

- Same-origin static `GET` requests without query strings use cache-first lookup and runtime caching.
- API-like requests, non-`GET` requests, and application data bypass Cache Storage; user data stays in
  browser local storage.
- If the network fails, cached assets are used and a cached `index.html` can serve navigation.
- Installation tolerates missing optional shell assets, and cache/storage failures do not block use of
  a valid network response.
- Activation removes older `move-well-*` caches, then the new worker claims clients.

To publish a changed shell or caching rule, increment `CACHE_VERSION` in `public/sw.js`. Production
startup registers the worker, requests an update, and reloads an already-controlled page once when a
new worker takes control. Registration and update failures are non-fatal.

## Known limitations

- The optional backend is not an account, backup, or cross-device workout
  synchronization service; it stores only push registration data.
- Local data is tied to the browser profile and can be lost when site storage is cleared.
- Foreground reminder checks do not provide guaranteed background scheduling.
- Browser reminders depend on permission, browser support, and platform behavior.
- Reliable delivery still depends on browser permission, iOS behavior, Focus
  mode, network availability, and the future sender.
- Step 4 scheduled push delivery/Cron, VAPID encryption and sending, retries,
  expired-subscription handling, and workout-specific notification payloads are
  not implemented by this feature. The current API accepts registration and
  schedule data but does not promise a background notification.
