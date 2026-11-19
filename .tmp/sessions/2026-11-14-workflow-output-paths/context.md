# Task Context: Workflow output paths

Session ID: 2026-11-14-workflow-output-paths
Created: 2026-11-14
Status: completed

## Current Request
Update `schemas/workflow.md` so newly created analysis documents always save the exercise file in
`schemas/exercises` and the summary file in `schemas/summaries`.

## Context Files (Standards to Follow)
- `/Users/alexandergallant/.opencode/context/core/standards/documentation.md`

## Reference Files (Source Material to Look At)
- `/Users/alexandergallant/Library/Mobile Documents/com~apple~CloudDocs/Documents/03_To_Do/08_Fitness_app/schemas/workflow.md`
- `/Users/alexandergallant/Library/Mobile Documents/com~apple~CloudDocs/Documents/03_To_Do/08_Fitness_app/schemas/exercises/`
- `/Users/alexandergallant/Library/Mobile Documents/com~apple~CloudDocs/Documents/03_To_Do/08_Fitness_app/schemas/summaries/`

## Components
- Explicit output directories for summary and exercise reports.
- Filename and pre-delivery validation rules.

## Constraints
- Modify only `schemas/workflow.md` for the requested feature.
- Preserve the existing date-stamped naming convention and `.odt` examples.

## Exit Criteria
- [x] The workflow explicitly requires saving summary reports under `schemas/summaries/`.
- [x] The workflow explicitly requires saving exercise reports under `schemas/exercises/`.
- [x] The workflow requires validation that both files exist in their designated directories.
