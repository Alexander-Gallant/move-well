# Task Context: Generated Exercise Details

Session ID: 2026-11-17-generated-exercise-details
Created: 2026-11-17T09:05:00Z
Status: completed

## Current Request
On the dashboard when I generate the concrete exercise selections for my workout, I want to be able to click each generated exercise to open the extended exercise view with all details of the exercise.

## Context Files (Standards to Follow)
- /Users/alexandergallant/.opencode/context/core/standards/code-quality.md
- /Users/alexandergallant/.opencode/context/core/standards/test-coverage.md
- /Users/alexandergallant/.opencode/context/ui/web/ui-styling-standards.md
- /Users/alexandergallant/.opencode/context/ui/web/react-patterns.md

## Reference Files (Source Material to Look At)
- web/src/App.tsx
- web/src/App.css
- web/src/App.test.tsx

## Components
- Dashboard generated-exercise interaction.
- Reuse of the existing full ExerciseDialog.
- Accessible button styling and interaction tests.

## Constraints
- Reuse the existing ExerciseDialog rather than duplicating detail markup.
- Preserve favorite behavior and existing Exercise Library behavior.
- Generated exercise entries must be keyboard accessible.

## Exit Criteria
- [x] Generated exercises are clickable buttons.
- [x] Clicking opens the full exercise detail dialog.
- [x] Existing tests, lint, and build pass.
