# Task Context: Dashboard Cleanup, Favorite Weighting, and Multi-Catalogue Import

Session ID: 2026-11-17-dashboard-weighted-multi-catalogue
Created: 2026-11-17T16:45:00Z
Status: in_progress

## Current Request
1. Verwijder de volledige groene kader (met oa 'Make time to move with intention') op het dashboard om dit wat cleaner te maken.
2. Zorg dat de exercise generator bij random selectie van oefeningen een dubbel zo hoge kans geeft op selectie van favoriete oefeningen versus niet-favoriete oefeningen.
3. Importeer `schemas/exercises/exercises-lower-back-pain-2026-11-11.odt` en `schemas/exercises/exercises-mechanical-neck-pain-2026-11-14.odt` op dezelfde manier als de hunched-shoulders-catalogue en maak `import-exercises.md` als toekomstige importreferentie.

## Context Files (Standards to Follow)
- docs/technical/exercise-catalogue-import-standard.md
- schemas/workflow.md
- /Users/alexandergallant/.opencode/context/core/standards/code-quality.md
- /Users/alexandergallant/.opencode/context/core/standards/test-coverage.md
- /Users/alexandergallant/.opencode/context/ui/web/ui-styling-standards.md
- /Users/alexandergallant/.opencode/context/ui/web/react-patterns.md

## Reference Files
- web/src/App.tsx
- web/src/App.css
- web/src/routine.ts
- web/src/routine.test.ts
- web/src/App.test.tsx
- web/src/exerciseCatalogueData.ts
- web/src/exerciseCatalogueParser.ts
- web/src/exerciseCatalogueConverter.ts
- web/src/exerciseCatalogueImport.test.ts
- schemas/exercises/exercises-hunched-shoulders-thoracic-kyphosis-2026-11-14.odt
- schemas/exercises/exercises-lower-back-pain-2026-11-11.odt
- schemas/exercises/exercises-mechanical-neck-pain-2026-11-14.odt

## Decisions
- Remove the entire dashboard hero green panel, including its copy and orbit decoration.
- Favorite weighting means each favorite candidate receives weight 2 and each non-favorite candidate weight 1 during weighted sampling without replacement.
- Preserve existing all-nonfavorite deterministic selection behavior where practical.
- New catalogue goals are `Chronic mechanical low-back pain` and `Mechanical neck pain`.
- ODT records use the established 18-field import format; numbered exercise headings are normalized to `Name:` during extraction.

## Exit Criteria
- [ ] Dashboard no longer renders the green hero panel.
- [ ] Random exercise selection gives favorites twice the per-exercise weight.
- [ ] All three catalogues are available in the app with unique IDs and correct goals.
- [ ] `import-exercises.md` documents the repeatable import process.
- [ ] Tests, lint, and build pass.
