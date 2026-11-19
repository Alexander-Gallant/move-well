# Task Context: Purge withdrawn library goals from persistence

Session ID: 2026-11-18-purge-withdrawn-library-goals
Created: 2026-11-18T00:00:00Z
Status: completed

## Current Request
Wanneer de library opnieuw wordt ingeladen, verschijnen oefeningen met de verwijderde goals nog steeds.

## Context Files (Standards to Follow)
- /Users/alexandergallant/.opencode/context/core/standards/code-analysis.md
- /Users/alexandergallant/.opencode/context/core/standards/code-quality.md
- /Users/alexandergallant/.opencode/context/core/standards/test-coverage.md

## Reference Files (Source Material to Look At)
- web/src/storage.ts
- web/src/storage.test.ts
- web/src/App.tsx
- web/src/exerciseCatalogueData.ts
- web/src/exerciseCatalogueImport.test.ts

## Findings
- The catalogue seed now excludes the withdrawn goals.
- `createStorageAdapter` merges the current seed into existing persisted exercises, so stale exercises in `localStorage` survive reloads.

## Components
- Persistence cleanup for withdrawn exercise goals.
- Regression coverage for an existing stored library.

## Constraints
- Remove only exercises whose `group` matches the withdrawn goals.
- Preserve other stored exercises, favorites, routines, and unrelated state.
- Validate incrementally after implementation.

## Exit Criteria
- [x] Reloading an existing library removes both withdrawn goals.
- [x] Other exercises and user state remain available.
- [x] Tests, lint, and build pass.
