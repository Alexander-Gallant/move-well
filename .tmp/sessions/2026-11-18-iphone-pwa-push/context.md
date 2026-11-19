# Task Context: Personal iPhone PWA and Push Reminders

Session ID: 2026-11-18-iphone-pwa-push
Created: 2026-11-18
Status: in_progress

## Current Request

Write a step-by-step reference for making this personal fitness app a free,
open-source iPhone Home Screen web app with reliable workout reminders, then
start implementing step one.

## Context Files (Standards to Follow)

- `/Users/alexandergallant/.opencode/context/core/standards/code-quality.md`
- `/Users/alexandergallant/.opencode/context/core/standards/documentation.md`
- `/Users/alexandergallant/.opencode/context/core/standards/test-coverage.md`
- `/Users/alexandergallant/.opencode/context/core/standards/security-patterns.md`
- `/Users/alexandergallant/.opencode/context/core/workflows/feature-breakdown.md`
- `/Users/alexandergallant/.opencode/context/ui/web/react-patterns.md`
- `/Users/alexandergallant/.opencode/context/ui/web/ui-styling-standards.md`

## Reference Files (Source Material)

- `web/README.md`
- `web/index.html`
- `web/public/manifest.webmanifest`
- `web/public/sw.js`
- `web/public/favicon.svg`
- `web/src/notifications.ts`
- `web/src/components/ReminderSettings.tsx`
- `web/src/main.tsx`
- `web/package.json`
- `docs/technical/phase-2-architecture.md`
- `docs/decisions/phase-2-local-first.md`

## External Docs Fetched

- `.tmp/external-context/ios-home-screen-web-push.md`
- Current iOS Home Screen Web Push guidance: HTTPS, iOS/iPadOS 16.4+,
  Home Screen installation, direct user gesture for permission/subscription,
  service-worker `push` handling, and VAPID/server delivery.
- Current static PWA hosting options: `.tmp/external-context/static-pwa-hosting/options.md`

## Components

1. PWA installation and deployment readiness.
2. Web Push client subscription and service-worker display handling.
3. Minimal private reminder backend and scheduled delivery.
4. End-to-end testing on two iPhones.

## Constraints

- Preserve the existing local-first workout and routine data model.
- Only the minimum reminder schedule and push subscription need remote storage.
- This is for two people; avoid full account and scaling infrastructure.
- Keep VAPID private keys and device tokens out of the frontend and repository.
- Implement one phase at a time and validate after each phase.

## Exit Criteria

- [ ] `step-by-step.md` documents the complete phased implementation.
- [x] Step 1 makes the PWA install metadata and icon assets iPhone-ready.
- [x] Step 1 build, lint, and tests pass.
- [ ] Later push/backend phases remain documented but unimplemented until Step 1 is verified.

## Progress

- Step 1 is complete and deployed manually through Cloudflare Pages.
- Step 2 client foundation is implemented: VAPID-configured subscription
  registration, service-worker `push`, and `notificationclick` handling.
- The push subscription is intentionally not uploaded until Step 3 defines the
  private backend contract.
- Full validation currently passes: 176 tests, lint, and production build.
