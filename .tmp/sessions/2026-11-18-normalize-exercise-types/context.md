# Task Context: Normalize imported exercise types

Session ID: 2026-11-18-normalize-exercise-types
Created: 2026-11-18T00:00:00Z
Status: completed

## Current Request
Normaliseer geïmporteerde `Exercise type`-waarden zodat de app alleen `Breathing`, `Aerobic`, `Stretch` en `Strength` gebruikt.

## Context Files (Standards to Follow)
- /Users/alexandergallant/.opencode/context/core/standards/code-quality.md
- /Users/alexandergallant/.opencode/context/core/standards/test-coverage.md
- /Users/alexandergallant/.opencode/context/core/standards/code-analysis.md
- /Users/alexandergallant/.opencode/context/development/principles/clean-code.md

## Reference Files (Source Material to Look At)
- web/src/exerciseCatalogueData.ts
- web/src/exerciseCatalogueImport.test.ts
- web/src/App.tsx
- web/src/App.test.tsx
- web/src/types.ts
- web/src/test/fixtures/exercise-catalogue-*.txt
- import-exercises.md

## Components
- Canonical imported type mapping.
- Library/add-exercise type options.
- Import and UI regression tests.

## Constraints
- Canonical app values are exactly `Breathing`, `Aerobic`, `Stretch`, and `Strength`.
- Preserve ODS and normalized fixtures as source material; normalize at the application boundary.
- Breathing takes precedence for respiratory categories; Aerobic takes precedence for aerobic categories; mobility/stretch terms map to Stretch; remaining supported imported categories map to Strength.
- Existing generic parser/converter behavior and custom exercise compatibility should remain intact where possible.

## Exit Criteria
- [x] No imported exercise exposes a non-canonical app type.
- [x] Library and add-exercise type options use only the four canonical values.
- [x] Tests, lint, and build pass.
