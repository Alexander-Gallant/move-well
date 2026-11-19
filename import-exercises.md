# Exercise catalogue import

This is the repeatable process for importing an exercise catalogue into the web
application. The source of truth remains the dated ODS in
`schemas/exercises/`; the TypeScript catalogue is the immutable application
snapshot.

The current snapshot contains 73 records: 20 hunched-shoulders records, 33
chronic mechanical low-back-pain records and 20 mechanical-neck-pain records.

## 1. Extract the ODS

An ODS is a ZIP package. Extract `content.xml` with an XML parser, preserving
table order. Do not scrape rendered layout or search the ZIP bytes with a
regular expression. The catalogues are transposed tables: column A contains the
18 field labels and each subsequent column is one exercise. Expand every
`table:table-cell` using its `table:number-columns-repeated` value before reading
cells, including repeated empty cells. Read each row by its field-label cell and
transpose the remaining cells into exercise records:

```python
from pathlib import Path
from zipfile import ZipFile
import xml.etree.ElementTree as ET

source = Path("schemas/exercises/exercises-<topic>-YYYY-MM-DD.ods")
table_namespace = "urn:oasis:names:tc:opendocument:xmlns:table:1.0"
text_namespace = "urn:oasis:names:tc:opendocument:xmlns:text:1.0"
cell_tag = f"{{{table_namespace}}}table-cell"
paragraph_tags = {f"{{{text_namespace}}}p", f"{{{text_namespace}}}h"}

with ZipFile(source) as archive:
    root = ET.fromstring(archive.read("content.xml"))

def cell_text(cell):
    return " ".join(
        "".join(node.itertext()).replace("\u00a0", " ").split()
        for node in cell.iter()
        if node.tag in paragraph_tags
    ).strip()

def expanded_row(row):
    cells = []
    for cell in row:
        repeat = int(cell.get(f"{{{table_namespace}}}number-columns-repeated", "1"))
        cells.extend([cell_text(cell)] * repeat)
    return cells

rows = [expanded_row(row) for row in root.iter() if row.tag.endswith("table-row")]
fields = [row[0] for row in rows]
records = zip(*[row[1:] for row in rows])
lines = [
    "\n".join(f"{field}: {value}" for field, value in zip(fields, record))
    for record in records
]
Path("web/src/test/fixtures/exercise-catalogue-<topic>.txt").write_text(
    "\n\n".join(lines) + "\n", encoding="utf-8"
)
```

Normalize CRLF/CR to LF, tabs and non-breaking spaces to ordinary spaces, and
trim/collapse whitespace before parsing. Wrapped lines continue the current
field and are joined with one space. Preserve case, punctuation, array order,
Latin anatomical names and citation text.

Only the 18 labelled rows are imported. Empty repeated cells are not records;
they must remain empty until the record is validated and rejected. Never create
a record from a report heading, introduction, safety guidance, monitoring
guidance, conclusion or references section.

## 2. Required field order

Each record is one contiguous block. `Source:` terminates the record. The exact
18-field order is:

```text
Name:
Purpose:
Exercise type:
Targeted musclegroups:
Targeted specific muscles:
Equipment and environment:
Starting position and set-up:
Step-by-step movement:
Range and direction:
Breathing:
Beginner dose and rest:
Expected sensation:
Regression:
Progression:
Common errors and corrections:
Evidence category:
Evidence strength:
Source:
```

Use semicolons for `Targeted musclegroups`, `Targeted specific muscles` and
`Source`. In `Common errors and corrections`, use
`error—correction; error—correction`; both sides are required. Numbered steps
may use `(1)`, `1.` or `1)` and are converted to the ordered `steps` array.

## 3. Assign the catalogue goal

Set `Exercise.group` for every imported record from the source catalogue:

| Source file | Goal/group |
|---|---|
| `exercises-hunched-shoulders-thoracic-kyphosis-2026-11-14.ods` | `Hunched shoulders / thoracic kyphosis` |
| `exercises-lower-back-pain-2026-11-11.ods` | `Chronic mechanical low-back pain` |
| `exercises-mechanical-neck-pain-2026-11-14.ods` | `Mechanical neck pain` |

Do not infer a goal from an individual exercise name. Keep the complete source
`Exercise type` as the category/tag value. Map the application type
case-insensitively using these rules, with Stretch precedence when both sets
match:

- `Stretch`: stretch, flexibility, mobility, range of motion, release
- `Strength`: strength, strengthening, resistance, endurance, motor-control,
  functional, balance, postural, aerobic, breathing (the lower-back catalogue's
  respiratory-control record is treated as a strength/control record)

An unmatched source type is an import error, not a reason to guess or drop the
record.

## 4. Create the application snapshot safely

Use `web/src/exerciseCatalogueParser.ts` for the normalized 18-field boundary
and `web/src/exerciseCatalogueConverter.ts` conventions for validation,
compatibility aliases and stable IDs. IDs are Unicode-normalized slugs of the
normalized name. If names collide, append the first eight lowercase hexadecimal
characters of the stable SHA-256 digest of the canonical name, source type and
source list. Never use an array index, import date or random ID.

The exported `Exercise` shape contains the compatibility fields `description`
and `instructions`, plus `purpose` and `steps`. Keep array values as new arrays,
set `isFavorite` to `false`, set `duration` to `''`, and do not expose report
fields such as `evidenceCategory`, `evidenceStrength` or `sources` on the
application object.

Before replacing catalogue data, check that the import is atomic: no record is
missing a field, has an empty scalar/array item, has an invalid common-error
pair, has an unknown label, or has an unmapped type. Preserve the existing
hunched-shoulders assertions when adding another catalogue.

## 5. Validate

From the repository root, run the narrow import test first:

```sh
cd web
npm test -- --run src/exerciseCatalogueImport.test.ts
```

Then run the parser/converter tests and the normal project checks:

```sh
npm test -- --run src/exerciseCatalogueParser.test.ts src/exerciseCatalogueConversion.test.ts
npm run build
npm run lint
```

The import test must assert the expected total, unique IDs, all three goals,
absence of report-level prose, normalized `Strength`/`Stretch` values, non-empty
semicolon-derived arrays, and valid `Exercise` records.

## 6. Future updates

1. Add the dated ODS under `schemas/exercises/` and extract a normalized text
   fixture beside the import test.
2. Expand `table:number-columns-repeated`, transpose the 18 labelled rows, and
   remove all report-level prose.
3. Parse and convert through the established parser/converter shape.
4. Assign the exact goal from the table above and verify every source type has a
   deliberate mapping.
5. Update `web/src/exerciseCatalogueData.ts` without changing unrelated app,
   routine or dashboard files.
6. Update only catalogue import tests/fixtures, retaining the 20-record
   hunched-catalogue checks.
7. Run the narrow test, then parser/converter tests, build and lint. Do not
   commit a partially validated catalogue.
