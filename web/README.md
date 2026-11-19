# Move well

Move well is a local-first fitness web app for browsing exercises, creating named routines, and
planning recurring weekly workouts. Data stays in the current browser; no account or backend is
required.

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
- The current deployment does not set a VAPID key and does not upload
  subscriptions; a private backend and scheduled sender are still required for
  background reminders.

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

- There is no backend, account system, backup service, or cross-device synchronization.
- Local data is tied to the browser profile and can be lost when site storage is cleared.
- Foreground reminder checks do not provide guaranteed background scheduling.
- Browser reminders depend on permission, browser support, and platform behavior.
- Reliable iPhone notifications require a future native or push-enabled implementation.
- Web Push registration is currently client-only; there is no subscription API,
  VAPID sender, or scheduled reminder backend yet.
