# Task Context: Library Goals and Routine Muscle Filters

Session ID: 2026-11-16-library-goal-and-specific-muscle-filtering
Created: 2026-11-16T19:45:00Z
Status: completed

## Current Request
Ik wil in de exercise library ook kunnen kiezen uit de verschillende goals. In de routine builder wil ik de optie om ook te selecteren op specifieke individuele spieren maar zowel voor spiergroepen als individuele spieren wil ik dat de builder standaard 'all' voorstelt zodat hier standaard geen filter wordt geappliceerd tenzij ik het specifiek wil.

## Context Files (Standards to Follow)
- /Users/alexandergallant/.opencode/context/core/standards/code-quality.md
- /Users/alexandergallant/.opencode/context/core/standards/test-coverage.md
- /Users/alexandergallant/.opencode/context/core/workflows/component-planning.md
- /Users/alexandergallant/Library/Mobile Documents/com~apple~CloudDocs/Documents/03_To_Do/08_Fitness_app/.tmp/sessions/2026-11-16-routine-goal-filtering/context.md

## Reference Files (Source Material to Look At)
- web/src/types.ts
- web/src/data.ts
- web/src/routine.ts
- web/src/storage.ts
- web/src/App.tsx
- web/src/components/RoutineBuilder.tsx
- web/src/routine.test.ts
- web/src/App.test.tsx
- web/src/storage.test.ts

## External Docs Fetched
None required.

## Components
- Combined goal, muscle-group, and specific-muscle domain filtering.
- Exercise Library goal filter.
- Routine Builder default-All controls.
- Backward-compatible persistence and tests.

## Constraints
- Goals are sourced from `Exercise.group`.
- Individual muscles are sourced from `Exercise.specificMuscles`.
- New/default routine filters for goal, muscle group, and specific muscle are `All`.
- Existing routines with saved specific muscle groups remain readable.
- Existing exercise-library filter call signatures should remain compatible where practical.

## Exit Criteria
- [x] Exercise Library exposes a goal filter defaulting to `All`.
- [x] Routine Builder exposes goal, muscle-group, and specific-muscle filters.
- [x] Routine selection applies only explicitly selected filters.
- [x] Existing saved data remains readable.
- [x] Tests, lint, and build pass.
