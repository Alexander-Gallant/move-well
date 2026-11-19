# Task Context: Remove two exercise-library goals

Session ID: 2026-11-18-remove-catalogue-goals
Created: 2026-11-18T00:00:00Z
Status: completed

## Current Request
Verwijder alle oefeningen met goal 'Chronic mechanical low back pain' en 'Mechaical neck pain' uit de exercise library.

## Context Files (Standards to Follow)
- /Users/alexandergallant/.opencode/context/core/standards/code-quality.md
- /Users/alexandergallant/.opencode/context/core/standards/test-coverage.md
- /Users/alexandergallant/.opencode/context/core/workflows/component-planning.md

## Reference Files (Source Material to Look At)
- web/src/exerciseCatalogueData.ts
- web/src/exerciseCatalogueImport.test.ts
- web/src/exerciseCatalogueLegacyData.ts
- web/package.json
- docs/technical/exercise-catalogue-import-standard.md

## External Docs Fetched
None required.

## Components
- Exercise catalogue library filtering.
- Regression tests for excluded goals.

## Constraints
- The current code uses `Chronic mechanical low-back pain` and `Mechanical neck pain` as the actual goal/group values.
- Remove the exercises from the app catalogue/library, but retain source ODS/text artifacts and unrelated catalogue records.
- Validate incrementally after the implementation step.

## Exit Criteria
- [x] No catalogue exercise has either excluded goal.
- [x] Existing hunched-shoulders catalogue exercises remain available.
- [x] Tests, lint, and build pass.
