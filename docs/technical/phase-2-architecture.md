# Phase 2 architecture

Phase 2 is a React and TypeScript browser application with validated storage,
deterministic weekly scheduling, foreground reminder checks, a production-only
service worker, and the first client-side Web Push boundary.

## Runtime shape

```text
React UI
  ├─ storage adapter → localStorage (`move-well-storage`, envelope v1)
  ├─ schedule logic → validated weekly routine assignments
  ├─ foreground reminder loop → due-assignment check while the page is open
  └─ production service worker → shell/static asset Cache Storage + Web Push display handlers
```

There is no API or remote data source. Cache Storage contains application resources; local storage
contains user data. An old asset cache is not a backup or synchronization layer.

## Storage

`src/storage.ts` exposes the current storage key, backup key, version, validators, and adapter:

```ts
type StorageEnvelope = {
  version: 1
  data: {
    exercises: Exercise[]
    routines: SavedRoutine[]
    schedule: WeeklyScheduleEntry[]
    reminders: {
      enabled: boolean
      time: string
      notificationCapability: 'unsupported' | 'default' | 'granted' | 'denied' | 'error'
    }
  }
}
```

Reads are migration-aware. A valid current envelope is normalized and returned. A malformed or
unsupported envelope is copied to `move-well-storage-backup`, then repaired section by section:

- Valid exercise, routine, and schedule records are retained; malformed records are filtered out.
- An unusable section receives its safe fallback rather than invalidating unrelated sections.
- Valid legacy exercise and generated-routine values are used when the corresponding current section
  cannot be repaired.
- Schedule references are retained only when they point to a retained routine.

Writes serialize a new envelope only after complete state validation. Storage access failures return
safe defaults or `false` rather than breaking startup. A failed custom exercise write returns an error
to the form, which keeps the user's draft visible.

## Routines and schedule

Saved routines are named records containing selected exercises. A weekly entry links one routine to a
weekday and a `HH:MM` time:

```ts
const entry = {
  id: 'monday-mobility',
  day: 'monday',
  time: '07:30',
  routineId: 'mobility',
}
```

The schedule module validates days, times, ids, and routine references; rejects duplicate entry ids;
and returns immutable results for add, update, remove, group, and recurrence operations. `getWeeklySchedule`
normalizes the anchor to Monday and expands seven weekday rules into dated entries sorted by time and id.

Deleting a saved routine calls `removeScheduleEntriesByRoutineId`, cascading removal to every schedule
assignment for that routine. The last saved routine cannot be deleted. Routine regeneration passes either
one group id or no id: a group id replaces only that group's exercise selection, while no id replaces
all groups.

## Reminder capability

`src/notifications.ts` treats browser notifications as a capability check:

```ts
const capability = detectNotificationCapability()
// 'granted' | 'default' | 'denied' | 'unsupported' | 'error'
```

Permission requests are guarded against a missing API and rejected promises, and occur only after an
explicit UI action. The foreground reminder loop runs when the app is open and checks every 15 seconds.
It requires enabled reminders, `granted` capability, the current local weekday and minute, and a
matching weekly assignment. A page-session minute key suppresses duplicate attempts, so at most one
notification is attempted per scheduled minute.

Unsupported, denied, default, display-failure, and error states produce non-fatal feedback while the
schedule remains usable. This layer does not provide guaranteed background scheduling or reliable
iPhone notification delivery.

### Web Push client boundary

The client-side push module is separate from the foreground notification
capability. After notification permission is granted, it can use the production
service worker and a `VITE_VAPID_PUBLIC_KEY` to create a `userVisibleOnly`
subscription. The subscription is not persisted in application local storage or
sent to a server yet. The service worker handles `push` payloads defensively,
shows a visible notification immediately, and focuses or opens the app on
notification click. A future backend must receive subscriptions over an
authenticated endpoint and send encrypted VAPID pushes.

## PWA build and service-worker caching

`vite.config.ts` sets `base: './'`, keeping generated asset references relative. Production startup
constructs the service-worker URL from `import.meta.env.BASE_URL`; development does not register a
worker.

`public/sw.js` uses deterministic versioned cache names:

```text
move-well-precache-v3
move-well-runtime-v3
```

### App-shell precaching

During install, the worker precaches relative shell paths such as `index.html`, the manifest, and icon
assets. It then fetches the production `index.html`, extracts safe same-origin static `href` and `src`
references, and precaches the built asset graph, including hashed scripts and styles. Optional asset
failures are isolated with `Promise.allSettled`; they do not abort installation.

### Runtime and activation behavior

Only same-origin, no-query, static `GET` requests are cacheable. Documents, scripts, styles, images,
fonts, manifests, and workers use cache-first lookup; usable network responses are placed in the
runtime cache. Non-`GET`, API-like, and application-data requests bypass the worker. On network failure,
the worker returns a matching cached resource or the cached `index.html` for navigation.

Activation deletes caches beginning with `move-well-` that are not current, then calls `clients.claim()`.
Cache failures do not hide a valid network response.

### Update path

When the shell or caching rules change, increment `CACHE_VERSION` in `public/sw.js`. Production startup
calls `registration.update()` after registration and reloads an already-controlled page once after a
new worker takes control. Registration and update errors are non-fatal, keeping the app usable without
service-worker support.

## Development and validation

```bash
npm install
npm run test -- --run
npm run lint
npm run build
npm run preview
```

The service worker is available in production output, not during Vite development. Offline shell
behavior should be checked with `build` followed by `preview`.

## Known boundaries

- No backend, account, backup service, push subscription API, or cross-device synchronization exists.
- Browser local storage is the only durable copy of user-created data.
- A recurring schedule is stored and displayed, but foreground checks do not guarantee background
  execution.
- Notification permission does not guarantee delivery, especially on iPhone.
