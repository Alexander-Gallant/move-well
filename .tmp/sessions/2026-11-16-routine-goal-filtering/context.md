# Task Context: Routine Builder Goal Filtering

Session ID: 2026-11-16-routine-goal-filtering
Created: 2026-11-16T19:30:00Z
Status: completed

## Current Request
Voeg nu bij de routine builder toe dat je niet enkel uit target muscle maar ook uit de goals (bv thoracic kyphosis etc) kan kiezen.

## Context Files (Standards to Follow)
- /Users/alexandergallant/.opencode/context/core/standards/code-quality.md
- /Users/alexandergallant/.opencode/context/core/standards/test-coverage.md
- /Users/alexandergallant/.opencode/context/core/workflows/component-planning.md
- /Users/alexandergallant/.opencode/context/core/workflows/design-iteration-stage-implementation.md

## Reference Files (Source Material to Look At)
- web/src/types.ts
- web/src/routine.ts
- web/src/storage.ts
- web/src/components/RoutineBuilder.tsx
- web/src/App.tsx
- web/src/routine.test.ts
- web/src/storage.test.ts
- web/src/App.test.tsx

## External Docs Fetched
None required.

## Components
- Goal-aware routine domain filtering and selection.
- Routine persistence/backward compatibility.
- Routine Builder goal selector UI.
- Unit and integration tests.

## Constraints
- Treat the existing Exercise.group value as the goal label.
- Existing routines without a goal must remain valid and behave as goal `All`.
- Goal, exercise type, and target muscle must jointly constrain regeneration.
- Preserve existing type-array behavior and immutable update patterns.

## Exit Criteria
- [x] Routine Builder exposes a goal selector for each focus area.
- [x] Regeneration filters by goal, type, and target muscle.
- [x] Existing saved routines remain readable.
- [x] Tests, lint, and build pass.
