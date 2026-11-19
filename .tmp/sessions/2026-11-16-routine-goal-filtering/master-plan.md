# Master Plan: Routine Builder Goal Filtering

## Component Order
1. [x] Domain model and filtering helpers
2. [x] Storage compatibility and defaults
3. [x] Routine Builder UI integration
4. [x] Tests and validation

## Global Decisions
- Goals are sourced from `Exercise.group`.
- `All` is the backward-compatible default for routines created before goal selection existed.
- A selected goal narrows available target muscles and regenerated exercises.
