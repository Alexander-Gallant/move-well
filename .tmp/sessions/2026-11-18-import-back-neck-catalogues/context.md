# Task Context: Import lower-back and mechanical-neck catalogues

Session ID: 2026-11-18-import-back-neck-catalogues
Created: 2026-11-18T00:00:00Z
Status: completed

## Current Request
Importeer `/schemas/exercices/exercises-lower-back-pain-2026-11-11.ods` en `/schemas/exercices/exercises-mechanical-neck-pain-2026-11-14.ods` volgens het protocol in `import-exercises.md`.

## Context Files (Standards to Follow)
- /Users/alexandergallant/Library/Mobile Documents/com~apple~CloudDocs/Documents/03_To_Do/08_Fitness_app/import-exercises.md
- /Users/alexandergallant/Library/Mobile Documents/com~apple~CloudDocs/Documents/03_To_Do/08_Fitness_app/docs/technical/exercise-catalogue-import-standard.md
- /Users/alexandergallant/.opencode/context/core/standards/code-quality.md
- /Users/alexandergallant/.opencode/context/core/standards/test-coverage.md

## Reference Files (Source Material to Look At)
- schemas/exercises/exercises-lower-back-pain-2026-11-11.ods
- schemas/exercises/exercises-mechanical-neck-pain-2026-11-14.ods
- web/src/test/fixtures/exercise-catalogue-lower-back-pain.txt
- web/src/test/fixtures/exercise-catalogue-mechanical-neck-pain.txt
- web/src/exerciseCatalogueData.ts
- web/src/exerciseCatalogueImport.test.ts
- web/src/App.test.tsx
- web/src/storage.ts

## Components
- Existing parser/converter import pipeline.
- Active catalogue inclusion and persistence seeding.
- Import and integration regression tests.

## Constraints
- The user path contains `exercices`; the verified repository path is `schemas/exercises/`.
- Lower-back goal: `Chronic mechanical low-back pain`.
- Neck goal: `Mechanical neck pain`.
- Preserve the existing 20 hunched-shoulders records and import 33 lower-back plus 20 neck records.
- Keep source ODS files as the source of truth and normalized text fixtures as the parser boundary.

## Exit Criteria
- [x] Active catalogue contains 73 unique valid exercises across all three goals.
- [x] Existing persisted libraries receive the 53 newly active exercises on reload.
- [x] Protocol tests, full tests, lint, and build pass.
