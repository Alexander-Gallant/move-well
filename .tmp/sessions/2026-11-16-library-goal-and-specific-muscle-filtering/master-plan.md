# Master Plan: Library Goals and Routine Muscle Filters

## Component Order
1. [x] Domain types, defaults, and combined filtering
2. [x] Exercise Library and Routine Builder UI
3. [x] Regression and integration tests
4. [x] Full validation

## Global Decisions
- `Exercise.group` is the goal source.
- `Exercise.specificMuscles` is the individual-muscle source.
- `All` means no filter and is the default for new routine focus areas.
- Legacy routine selections retain their existing saved muscle value.
