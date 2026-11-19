# Decision: Keep Phase 2 local-first

**Status:** Accepted  
**Scope:** Phase 2 fitness web PoC

## Decision

Keep the Phase 2 application local-only. Exercises, named routines, weekly assignments, and reminder
settings are stored in the browser. Do not add a backend, account system, or sync protocol to this
iteration.

The browser profile is the data boundary: a second device does not see the first device's routines.

## Why

- The PoC must be useful immediately and offline.
- A local store keeps the implementation small and avoids account, authentication, and server
  availability concerns.
- Fitness data is personal; keeping it in the browser avoids sending it to a service that does not
  yet exist.
- The product question for this phase is whether the local planning workflow is useful, not whether
  multi-device synchronization is ready.

## Versioned storage and repair

The app writes one validated envelope to `localStorage` under `move-well-storage`:

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

Startup behavior is deliberately defensive:

1. Read `move-well-storage`.
2. Return a valid current envelope after normalization.
3. For a malformed or unsupported envelope, copy the original raw value to
   `move-well-storage-backup` before replacing it.
4. Repair `exercises`, `routines`, `schedule`, and `reminders` independently. Valid records survive,
   malformed records are discarded, and an unusable section receives its safe fallback.
5. Use compatible valid values from `move-well-exercises` and `move-well-routine` when the matching
   current section cannot be repaired.

This preserves useful legacy data without trusting unvalidated local values. A future schema can
transform version 1 data in a named migration instead of guessing from an unversioned object.

## Weekly assignments and routine behavior

Schedule entries intentionally contain `day`, `time`, and `routineId`:

```json
{
  "id": "wednesday-reset",
  "day": "wednesday",
  "time": "18:00",
  "routineId": "reset-routine"
}
```

The schedule is a weekly rule, not a generated list of future events. Routine ids are validated at the
boundary. Deleting a routine cascades to all assignments that reference that routine, so the schedule
does not retain those assignments. The UI protects the last saved routine.

Routine regeneration is intentionally scoped: a focus-area control regenerates one group, while
**Regenerate all** regenerates every group in the current routine.

## Browser reminders are a foreground fallback, not a guarantee

The app detects the browser Notifications API and requests permission only through an explicit user
action. It stores `granted`, `default`, `denied`, `unsupported`, or `error` in
`notificationCapability` and keeps the schedule visible in every state.

While the page is open, a check runs at startup and every 15 seconds. It looks for an enabled reminder
whose local weekday and minute match a scheduled assignment, and suppresses duplicate attempts within
the same scheduled minute for that page session. Unsupported, denied, and error conditions are
non-fatal and return the schedule as the fallback.

This does not guarantee background scheduling or reliable iPhone notification delivery. A web page
cannot guarantee that a device will wake up and deliver a reminder after the page is closed. Reliable
iPhone notifications require a future native or push-based design.

## PWA delivery

The production build uses a relative Vite base so it can be served below any path. The service worker
discovers the built `index.html` asset graph for precaching, uses versioned precache and runtime caches,
deletes stale `move-well-*` caches on activation, and claims clients after cleanup. Production startup
requests an update and reloads an already-controlled page once when a new worker takes control.

Cache Storage contains application resources only; application data remains in local storage. Service
worker registration, update, optional precache, and cache-storage failures are non-fatal.

## Consequences

### Benefits

- No server deployment or account flow is needed.
- The core planning workflow works without a network after the app shell is cached.
- Storage, recurrence, foreground reminder, and caching logic can be tested as small deterministic
  functions.
- A failed custom exercise write leaves the user's draft visible so it can be retried.

### Limits

- Clearing site data can remove the only copy of a user's data.
- There is no account recovery, backup service, or cross-device sync.
- Foreground reminder checks do not provide guaranteed background execution.
- Browser notification support and delivery vary by platform; iPhone delivery is not reliable here.

These limits are documented rather than hidden because they define the boundary of the Phase 2 PoC.
