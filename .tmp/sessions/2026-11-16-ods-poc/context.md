# Task Context: Import hunched shoulders ODS as a PoC

Session ID: 2026-11-16-ods-poc
Created: 2026-11-16
Status: completed

## Current Request
Import `schemas/exercises/exercises-hunched-shoulders-thoracic-kyphosis-2026-11-14.ods` so the app has an example PoC exercise library.

## Context Files (Standards to Follow)
- /Users/alexandergallant/.opencode/context/core/standards/code-quality.md
- /Users/alexandergallant/.opencode/context/core/standards/test-coverage.md
- schemas/workflow.md
- web/src/exerciseCatalogueParser.ts
- web/src/exerciseCatalogueConverter.ts
- web/src/storage.ts

## Reference Files
- schemas/exercises/exercises-hunched-shoulders-thoracic-kyphosis-2026-11-14.ods
- web/src/data.ts
- web/src/exerciseCatalogueData.ts
- web/src/exerciseCatalogueImport.test.ts

## Components
- Static PoC conversion of representative ODS records
- Initial app-library seeding through the storage adapter
- Import and persistence tests

## Constraints
- Keep the app model free of evidence/source fields.
- Preserve the existing empty default state for isolated storage tests.
- Use the existing `Strength`/`Stretch` exercise type enum.

## Exit Criteria
- [x] The fresh app loads representative exercises from the requested ODS.
- [x] The imported records are valid, grouped, and visible in the Exercise Library.
- [x] Existing tests, lint, and build pass.
