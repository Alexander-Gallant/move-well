# Task Context: Fitness Web PoC

Session ID: 2026-10-18-fitness-web-poc
Created: 2026-10-18
Status: in_progress

## Progress
- Scaffolded a React + TypeScript + Vite app in `web/`.
- Added an English responsive dashboard, exercise library, routine builder, and schedule view.
- Added seeded exercise data, filters, random routine generation, and browser local persistence for the exercise library.
- Added clickable exercise details with step-by-step execution instructions.
- Added validated custom exercise creation with local persistence.
- Added local persistence for generated routines.
- Added a minimal installable/offline PWA foundation with a manifest and service worker.
- Completed Phase 2 review hardening: section-preserving storage repair and backups, routine cascade deletion, scoped regeneration, foreground reminder feedback, collision-safe exercise saves, base-aware PWA precaching, dynamic dashboard scheduling/date, accessibility polish, and updated documentation.
- `npm run build` and `npm run lint` pass.

## Current Request
Continue the fitness web-app PoC by implementing the full Phase 2: functional weekly scheduling, recurring routines, reminder settings/browser notifications, multiple routine management, stronger PWA offline caching/update behavior, tests, and documentation.

## Context Files (Standards to Follow)
- `/Users/alexandergallant/.opencode/context/core/standards/code-quality.md`
- `/Users/alexandergallant/.opencode/context/core/standards/documentation.md`

## Reference Files (Source Material to Look At)
- `outline.odt`

## External Docs Fetched
None yet. The first PoC should use a minimal, local-only stack.

## Components
- Exercise library
- Routine builder with random exercise selection
- Local persistence
- Responsive dashboard and schedule placeholder
- Multiple saved routines
- Weekly recurrence and reminder settings
- Browser notification capability with graceful fallback
- Versioned local storage and improved PWA caching
- Domain tests and setup documentation

## Constraints
- All user-facing content should be in English.
- First version is a browser-based PoC.
- No backend or account system in the first iteration.
- The application should work offline after initial loading and persist local data.
- Prefer small, composable, testable functions and immutable updates.
- Browser notifications are best-effort; reliable iPhone notifications remain a future native-app concern.
- Preserve existing local data through a versioned storage migration.

## Exit Criteria
- [x] A runnable web-app PoC exists in the project directory.
- [x] Users can browse and filter exercises.
- [x] Users can create a routine using random exercise selection.
- [x] Data persists locally in the browser.
- [x] The interface is usable on desktop and mobile widths.
- [x] The project passes its available validation command.
- [x] Phase 2 scheduling, reminders, routine management, PWA behavior, tests, and documentation are implemented.
