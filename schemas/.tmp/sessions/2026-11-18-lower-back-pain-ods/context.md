# Task Context: Lower-Back-Pain Exercise Catalogue ODS

Session ID: 2026-11-18-lower-back-pain-ods
Created: 2026-11-18
Status: completed

## Current Request
Maak de file `exercises/exercises-lower-back-pain-2026-11-11.ods` op basis van
`exercises/exercises-lower-back-pain-2026-11-11.odt`. Verwijs naar `workflow.md`
en de bestaande hunched-shoulders/thoracic-kyphosis en mechanical-neck-pain
ODS/ODT-paren als voorbeelden.

## Context Files (Standards to Follow)
- `/Users/alexandergallant/Library/Mobile Documents/com~apple~CloudDocs/Documents/03_To_Do/08_Fitness_app/schemas/workflow.md`
- `/Users/alexandergallant/.opencode/context/core/standards/documentation.md`
- `/Users/alexandergallant/.opencode/context/core/standards/code-quality.md`

## Reference Files (Source Material to Look At)
- `exercises/exercises-lower-back-pain-2026-11-11.odt`
- `exercises/exercises-lower-back-pain-2026-11-11.ods`
- `exercises/exercises-hunched-shoulders-thoracic-kyphosis-2026-11-14.odt`
- `exercises/exercises-hunched-shoulders-thoracic-kyphosis-2026-11-14.ods`
- `exercises/exercises-mechanical-neck-pain-2026-11-14.odt`
- `exercises/exercises-mechanical-neck-pain-2026-11-14.ods`

## External Docs Fetched
None required.

## Components
- Extract the exercise catalogue from the lower-back-pain ODT.
- Match the established transposed ODS structure: field labels in column A and one exercise per subsequent column.
- Validate OpenDocument structure and workflow constraints.

## Constraints
- Preserve the required output path and filename.
- Use the exact 18-field order from `workflow.md`, including `Name`.
- Do not include forbidden individual exercise fields.
- Keep semicolon-separated muscle fields and classic Latin anatomical names.
- Replace the existing target ODS only after inspecting the source and examples.

## Exit Criteria
- [x] Target ODS exists at the required path.
- [x] ODS has one field-label column and one complete column per exercise.
- [x] All 18 fields are present, ordered correctly, and non-empty for every exercise.
- [x] No `None`, forbidden fields, or invalid serialization artefacts occur.
- [x] The ODS is a valid OpenDocument Spreadsheet and the source/examples remain preserved.
