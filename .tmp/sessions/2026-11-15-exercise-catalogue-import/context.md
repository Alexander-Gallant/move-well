# Task Context: Exercise catalogue import

Session ID: 2026-11-15-exercise-catalogue-import
Created: 2026-11-15
Status: in_progress

## Current Request
Import all 20 exercise records from `schemas/exercises/exercises-hunched-shoulders-thoracic-kyphosis-2026-11-14.odt` into the exercise library, excluding the general introductory and ending guidance. Define a reusable document standard so similarly formatted catalogues can be imported easily.

## Context Files (Standards to Follow)
- `/Users/alexandergallant/.opencode/context/core/standards/code-quality.md`
- `/Users/alexandergallant/.opencode/context/core/essential-patterns.md`
- `/Users/alexandergallant/.opencode/context/core/standards/documentation.md`
- `/Users/alexandergallant/.opencode/context/core/standards/test-coverage.md`

## Reference Files (Source Material to Look At)
- `/Users/alexandergallant/Library/Mobile Documents/com~apple~CloudDocs/Documents/03_To_Do/08_Fitness_app/schemas/workflow.md`
- `/Users/alexandergallant/Library/Mobile Documents/com~apple~CloudDocs/Documents/03_To_Do/08_Fitness_app/schemas/exercises/exercises-hunched-shoulders-thoracic-kyphosis-2026-11-14.odt`
- `/Users/alexandergallant/Library/Mobile Documents/com~apple~CloudDocs/Documents/03_To_Do/08_Fitness_app/web/src/types.ts`
- `/Users/alexandergallant/Library/Mobile Documents/com~apple~CloudDocs/Documents/03_To_Do/08_Fitness_app/web/src/data.ts`
- `/Users/alexandergallant/Library/Mobile Documents/com~apple~CloudDocs/Documents/03_To_Do/08_Fitness_app/web/src/storage.ts`
- `/Users/alexandergallant/Library/Mobile Documents/com~apple~CloudDocs/Documents/03_To_Do/08_Fitness_app/web/src/storage.test.ts`

## Components
- Pure parser for the fixed exercise catalogue text format.
- Documented import standard and conversion rules.
- Twenty imported exercise records from the source catalogue.
- Parser, validation, count, and storage regression tests.

## Constraints
- Exclude report-level introduction, monitoring/referral guidance, and references from exercise records.
- Preserve every exercise field as structured data: arrays for muscles, specific muscles, steps, errors/corrections, tags, and sources.
- Keep existing starter exercises and local storage compatibility intact.
- Map source exercise types to the app's current `Strength`/`Stretch` enum without losing the source category.

## Exit Criteria
- [ ] The library contains all 20 source exercises exactly once.
- [ ] The standard documents the importable field order and record boundaries.
- [ ] The parser rejects incomplete records and ignores report-level sections.
- [ ] Import tests and the full test/lint/build suite pass.
