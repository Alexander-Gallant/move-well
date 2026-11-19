# Task Context: Generalize exercise types and import full ODS catalogue

Session ID: 2026-11-16-full-ods-import
Created: 2026-11-16
Status: in_progress

## Current Request
Allow exercise types beyond Strength and Stretch, treat semicolon-separated values as separate values, remove the three PoC exercises, and import the complete ODS document.

## Context Files (Standards to Follow)
- /Users/alexandergallant/.opencode/context/core/standards/code-quality.md
- /Users/alexandergallant/.opencode/context/core/standards/test-coverage.md
- docs/technical/exercise-catalogue-import-standard.md
- schemas/workflow.md

## Reference Files
- web/src/types.ts
- web/src/exerciseCatalogueParser.ts
- web/src/exerciseCatalogueConverter.ts
- web/src/exerciseCatalogueData.ts
- web/src/exerciseCataloguePocData.ts
- web/src/storage.ts
- web/src/App.tsx
- web/src/components/RoutineBuilder.tsx
- web/src/routine.ts
- web/src/*test.ts and web/src/components/*test.tsx
- schemas/exercises/exercises-hunched-shoulders-thoracic-kyphosis-2026-11-14.ods

## Components
- Flexible exercise-type and multi-type model
- Semicolon-delimited field normalization
- Full 20-record ODS conversion
- Removal of the 3-record PoC
- UI, storage, routine, and test updates

## Constraints
- Preserve the complete source exercise category in `category`.
- Preserve source values without forcing them into Strength/Stretch.
- Keep evidence/source fields outside the user-facing app model.
- Use deterministic IDs and atomic import validation.

## Exit Criteria
- [ ] Arbitrary exercise types, including semicolon-separated multiple types, work end-to-end.
- [ ] All 20 ODS exercises are loaded; the 3-record PoC is removed.
- [ ] App UI and storage accept the expanded model.
- [ ] Full test, lint, and build validation passes.
