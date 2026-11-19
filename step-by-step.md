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

- [ ] Add a push subscription module with explicit browser capability checks.
- [ ] Request permission only from the existing reminder-settings button.
- [ ] Register the production service worker and call `pushManager.subscribe()`
  with the backend's public VAPID key.
- [ ] Send the subscription to the private backend.
- [ ] Add a service-worker `push` event handler that immediately calls
  `showNotification()`.
- [ ] Add a `notificationclick` handler that opens or focuses the app.
- [ ] Keep the existing foreground reminder as a fallback.

**Verification:** A test push sent to one registered phone displays a
notification while the app is closed.

### Step 3 — Add the minimal private reminder backend

**Goal:** Store only what is needed to send reminders to two devices.

- [ ] Choose one small serverless host, preferably Cloudflare Workers or a
  similar HTTPS platform.
- [ ] Generate VAPID keys and store private keys as server secrets.
- [ ] Store a device token, push subscription, time zone, and weekly reminder
  schedule.
- [ ] Use a private pairing code or long random device token instead of a full
  account system.
- [ ] Validate request bodies and never log push endpoints or secrets.
- [ ] Keep exercise details and routines local unless future sync is explicitly
  needed.

**Verification:** Both phones can register independently, and invalid or
unauthorized requests are rejected.

### Step 4 — Schedule and deliver workout reminders

**Goal:** Send recurring reminders without the app being open.

- [ ] Add a serverless scheduled job that runs approximately once per minute.
- [ ] Resolve each device's weekly schedule in its configured time zone.
- [ ] Send at most one notification for each due workout occurrence.
- [ ] Handle expired subscriptions by removing or disabling them.
- [ ] Update the backend whenever reminder settings or schedules change.

**Verification:** A test schedule produces one notification at the expected
local time on each phone, including when the app is closed.

### Step 5 — Test and document the personal deployment

- [ ] Test iOS/iPadOS 16.4 or newer.
- [ ] Test permission granted, denied, and later re-enabled.
- [ ] Test Focus mode and normal notification settings.
- [ ] Test offline app use and service-worker updates.
- [ ] Test daylight-saving and time-zone behavior.
- [ ] Document deployment secrets, pairing, reset, and subscription removal.
- [ ] Update `web/README.md` and architecture decisions when push delivery is
  implemented.

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
