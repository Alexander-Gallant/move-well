# Task Context: Mechanical Neck Pain / Stiff Neck Evidence Report

Session ID: 2026-11-14-mechanical-neck-pain
Created: 2026-11-14
Status: completed

## Current Request

Apply the established scientific exercise-search workflow to the complaint “mechanical neck pain / stiff neck” and create separate, date-stamped summary and exercise ODT reports.

## Context Files (Standards to Follow)

- `/Users/alexandergallant/Library/Mobile Documents/com~apple~CloudDocs/Documents/03_To_Do/08_Fitness_app/schemas/workflow.md`
- `/Users/alexandergallant/.opencode/context/core/standards/documentation.md`
- `/Users/alexandergallant/.opencode/context/core/standards/code-analysis.md`
- `/Users/alexandergallant/.opencode/context/core/workflows/task-delegation-basics.md`

## Scope

Treat “mechanical neck pain / stiff neck” as nonspecific/mechanical neck pain in adults. Address acute, subacute, chronic and recurrent presentations where evidence permits. Exclude or clearly separate traumatic injury, fracture, radiculopathy requiring a different pathway, myelopathy, progressive neurological deficit, infection, malignancy, inflammatory disease, vascular emergencies, postoperative rehabilitation and other diagnosed pathology.

## Research Requirements

- Search current clinical guidelines and systematic reviews/meta-analyses before relevant newer trials.
- Focus on physiotherapy, neck and shoulder strengthening, motor-control/endurance, mobility, stretching, aerobic/general activity, education/self-management, ergonomics and manual therapy only in context.
- State what is supported, probably beneficial, uncertain, not clearly superior, unsupported as standalone care, potentially inappropriate and where knowledge gaps remain.
- Include red flags and referral guidance; the report is not a diagnosis.
- Include exact search strings, databases, search date, evidence limitations and references with DOI or stable URL.

## Output Requirements

Create these files in the schemas folder:

- `summary-mechanical-neck-pain-2026-11-14.odt`
- `exercises-mechanical-neck-pain-2026-11-14.odt`

The summary file contains the evidence review, safety scope, practical implications, report-level monitoring, limitations and references. The exercise file contains a broad but organized novice-complete exercise catalogue.

Every exercise must use this exact field order:

1. Purpose
2. Exercise type
3. Targeted musclegroups
4. Targeted specific muscles
5. Equipment and environment
6. Starting position and set-up
7. Step-by-step movement
8. Range and direction
9. Breathing
10. Beginner dose and rest
11. Expected sensation
12. Regression
13. Progression
14. Common errors and corrections
15. Evidence category
16. Evidence strength
17. Source

Do not include `Self-check`, `How to monitor symptoms` or `Stop or modify if` as individual exercise fields. Use semicolon separators in both muscle fields; specific muscles must use classic Latin anatomical names. Do not allow literal `None` or other serialization artefacts in either output.

## Exit Criteria

- [x] Current evidence search completed and sources verified
- [x] Summary report created with search date and report date
- [x] Exercise report created with novice-complete descriptions
- [x] Both ODT files validate and round-trip to text
- [x] No `None` artefacts or forbidden individual exercise fields
- [x] Original unrelated reports preserved
