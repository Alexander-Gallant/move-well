# Exercise catalogue import standard

This standard defines the text interchange format for exercise catalogues such as
`schemas/exercises/exercises-hunched-shoulders-thoracic-kyphosis-2026-11-14.ods`.
It follows the exercise field order in [`schemas/workflow.md`](../../schemas/workflow.md)
and the application shape in [`web/src/types.ts`](../../web/src/types.ts).

## Importable text format

After ODS extraction, one exercise is a contiguous block of labelled lines. Fields
must occur once, in this order, and `Source:` is the record terminator:

```text
Name: Exercise name
Purpose: What capacity the exercise trains
Exercise type: Source category, for example Resistance strengthening
Targeted musclegroups: Group one; Group two
Targeted specific muscles: musculus example; musculus another
Equipment and environment: Required equipment and space
Starting position and set-up: Starting position and checks
Step-by-step movement: (1) First step. (2) Second step.
Range and direction: Movement range and direction
Breathing: Breathing instructions
Beginner dose and rest: Starting dose and rest
Expected sensation: Expected effort and warning symptoms
Regression: Easier controlled version
Progression: Harder version after the base version is controlled
Common errors and corrections: Error one—Correction one; Error two—Correction two
Evidence category: Evidence category
Evidence strength: Evidence strength
Source: Citation one; Citation two
```

Field labels are exact, including capitalization and the colon. Values may wrap
onto continuation lines until the next recognized label. Blank lines are ignored
inside a record and between records. A field value may not be empty.

### Field order and application mapping

| Source field | Application value | Conversion |
|---|---|---|
| `Name` | `name` | Trimmed display name; also the input to stable ID generation. |
| `Purpose` | `purpose`, `description` | Preserve as one normalized paragraph; `description` is the compatibility alias. |
| `Exercise type` | `category`, `type` | Preserve the complete source value in `category`; map `type` as described below. |
| `Targeted musclegroups` | `muscles` | Split into an ordered array on semicolons. |
| `Targeted specific muscles` | `specificMuscles` | Split into an ordered array on semicolons; retain the Latin names. |
| `Equipment and environment` | `equipmentAndEnvironment` | Preserve as one paragraph. |
| `Starting position and set-up` | `startingPosition` | Preserve as one paragraph. |
| `Step-by-step movement` | `steps`, `instructions` | Split numbered steps; copy `steps` to the legacy `instructions` field. |
| `Range and direction` | `rangeAndDirection` | Preserve as one paragraph. |
| `Breathing` | `breathing` | Preserve as one paragraph. |
| `Beginner dose and rest` | `beginnerDoseAndRest` | Preserve as one paragraph. |
| `Expected sensation` | `expectedSensation` | Preserve as one paragraph. |
| `Regression` | `regression` | Preserve as one paragraph. |
| `Progression` | `progression` | Preserve as one paragraph. |
| `Common errors and corrections` | `commonErrors` | Split pairs as described below. |
| `Evidence category` | `evidenceCategory` | Preserve as one paragraph. |
| `Evidence strength` | `evidenceStrength` | Preserve as one paragraph. |
| `Source` | `sources` | Split into an ordered array on semicolons. |

Importer-created compatibility values are deterministic: `isFavorite` is `false`,
`duration` is an empty string, and `tags` contains the trimmed source category as
its single tag. No source information is silently discarded; the original exercise
category remains in `category`, even when `type` is reduced to the app's two-value
enum.

## Record boundaries and delimiters

- The first `Name:` after report-level content starts a record.
- The next `Name:` is not a new record: it is an error. A record must end at its
  own `Source:` first.
- `Source:` ends exactly one record. Text after it belongs to report-level content
  until the next `Name:`.
- The 18 labels above are the only field boundaries. Do not split on blank lines,
  headings, or sentence punctuation.
- Semicolons delimit array items in `Targeted musclegroups`,
  `Targeted specific muscles`, and `Source`. Empty items are invalid.
- In `Common errors and corrections`, semicolons delimit pairs and the first
  em dash (`—`) separates the error from its correction. Both sides are required:

  ```text
  Common errors and corrections: Arching the back—Shorten the range; Holding the breath—Breathe continuously
  ```

- Semicolons and em dashes are structural delimiters in these fields. Replace such
  punctuation inside prose with a comma or restructure the sentence before import.

## Normalization

Apply these transformations before parsing labels or values:

1. Extract paragraph text, decode XML entities, and normalize CRLF/CR to LF.
2. Convert non-breaking spaces and tabs to ordinary spaces.
3. Trim leading/trailing whitespace on every line and collapse repeated internal
   spaces, without changing case or punctuation in values.
4. Join wrapped continuation lines with one space. Preserve paragraph boundaries
   only as spaces inside a field.
5. Remove empty lines outside field values.
6. For arrays, trim each item, collapse repeated spaces, preserve source order, and
   remove no item except a duplicate identical item after normalization.
7. Do not lowercase display text, anatomical names, citations, or source URLs.
8. Normalize a final full stop only when it is an extraction artefact; do not rewrite
   authored prose.

Normalization must be deterministic: the same extracted text produces the same
records, IDs, array order, and serialized values.

## Stable IDs

Generate the primary ID from the normalized name, not from the source filename or
record position:

```text
slug("Half-kneeling hip flexor stretch")
→ "half-kneeling-hip-flexor-stretch"
```

The slug algorithm is:

- Unicode-normalize and lowercase;
- replace runs of non-alphanumeric characters with one `-`;
- trim leading/trailing `-`;
- reject an empty result.

If two records have the same slug, append `-` plus the first eight lowercase
hexadecimal characters of a stable SHA-256 digest of the canonical record
(`name`, `Exercise type`, and `Source`, joined with LF). Never use array position,
import date, or a random ID. Duplicate records with the same canonical content are
rejected rather than imported twice.

## Type mapping

The app currently accepts only `Strength` and `Stretch` (`ExerciseType` in
`web/src/types.ts`). Preserve the complete source `Exercise type` in `category`,
then apply these case-insensitive keyword rules to derive `type`:

| Source category contains | App `type` |
|---|---|
| `stretch`, `flexibility`, `mobility`, `range of motion`, or `release` | `Stretch` |
| `strength`, `strengthening`, `resistance`, `endurance`, `motor-control`, `functional`, `balance`, `postural`, or `aerobic` | `Strength` |

The first row has precedence if a category contains terms from both rows. A source
category matching neither row is invalid and must be added to the explicit mapping
before import; it must not be guessed or dropped.

## Report-level exclusions

Only `Name:` through the matching `Source:` is an exercise record. Exclude all
content outside those boundaries, including:

- the report introduction and scope;
- general safety, monitoring, symptom-response, and referral guidance;
- conclusions, programme-level advice, and adherence guidance; and
- the references section and any report-level bibliography.

Do not manufacture an exercise from a report heading or from prose that happens to
contain a colon. Individual records must not gain `Self-check`, `How to monitor
symptoms`, or `Stop or modify if` fields; those belong at report level as specified
by the workflow.

## Validation

Reject the complete import (rather than partially saving it) when any record:

- is missing a required field, has fields out of order, or has a duplicate label;
- has an empty scalar, array item, error, correction, name, or source;
- has an unterminated record (no `Source:`) or a second `Name:` before `Source:`;
- contains an unknown label inside a record;
- has no valid mapped app type;
- has duplicate canonical content or a stable-ID collision after hash resolution; or
- produces a malformed `commonErrors` pair or an empty array.

For the dated hunched-shoulders catalogue, assert exactly 20 records, exactly 20
unique IDs, and no record sourced from excluded report-level sections. For a
different catalogue, use its declared expected count and retain the same uniqueness
and completeness checks.

The final records must satisfy the application shape:

```text
type ∈ {"Strength", "Stretch"}
muscles, specificMuscles, steps, sources, tags = non-empty string arrays
commonErrors = [{ error: non-empty string, correction: non-empty string }]
```

## Repeatable ODS-to-text extraction

An ODS is a ZIP package. Extract `content.xml` with an XML parser; do not scrape
rendered layout or use a regular expression over the ZIP bytes. The exercise sheet
is transposed: column A contains the 18 labels and each following column is one
exercise. Expand each `table:table-cell` by its
`table:number-columns-repeated` value, including repeated empty cells, before
transposing rows into records. Concatenate nested text content, decode entities,
normalize whitespace, and preserve table order. The resulting UTF-8 text fixture is
what the parser consumes and what import tests should snapshot.

Minimal extraction example:

```python
from pathlib import Path
from zipfile import ZipFile
import xml.etree.ElementTree as ET

ODS = Path("schemas/exercises/exercises-hunched-shoulders-thoracic-kyphosis-2026-11-14.ods")
TABLE = "urn:oasis:names:tc:opendocument:xmlns:table:1.0"
TEXT = "urn:oasis:names:tc:opendocument:xmlns:text:1.0"

with ZipFile(ODS) as archive:
    root = ET.fromstring(archive.read("content.xml"))

def cell_text(cell):
    return " ".join(
        "".join(node.itertext()).replace("\u00a0", " ").split()
        for node in cell.iter()
        if node.tag in {f"{{{TEXT}}}p", f"{{{TEXT}}}h"}
    ).strip()

def expanded_row(row):
    values = []
    for cell in row:
        repeat = int(cell.get(f"{{{TABLE}}}number-columns-repeated", "1"))
        values.extend([cell_text(cell)] * repeat)
    return values

rows = [expanded_row(row) for row in root.iter() if row.tag.endswith("table-row")]
fields = [row[0] for row in rows]
records = zip(*[row[1:] for row in rows])
lines = [
    "\n".join(f"{field}: {value}" for field, value in zip(fields, record))
    for record in records
]
Path("exercise-catalogue.txt").write_text("\n\n".join(lines) + "\n", encoding="utf-8")
```

Keep the generated text fixture alongside the import test artifacts, not as a
second source of truth. Before parsing, run the normalization rules above; after
parsing, run the declared record-count, completeness and uniqueness checks for the
current source catalogue.
