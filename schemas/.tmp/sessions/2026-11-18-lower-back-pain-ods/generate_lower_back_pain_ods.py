from __future__ import annotations

import re
import shutil
import tempfile
from copy import deepcopy
from pathlib import Path
from zipfile import ZIP_STORED, ZipFile
from xml.etree import ElementTree as ET


ROOT = Path(__file__).parents[3]
SOURCE = ROOT / "exercises/exercises-lower-back-pain-2026-11-11.odt"
TEMPLATE = ROOT / "exercises/exercises-hunched-shoulders-thoracic-kyphosis-2026-11-14.ods"
OUTPUT = ROOT / "exercises/exercises-lower-back-pain-2026-11-11.ods"

OFFICE = "urn:oasis:names:tc:opendocument:xmlns:office:1.0"
TEXT = "urn:oasis:names:tc:opendocument:xmlns:text:1.0"
TABLE = "urn:oasis:names:tc:opendocument:xmlns:table:1.0"
CALCEXT = "urn:org:documentfoundation:names:experimental:calc:xmlns:calcext:1.0"
META = "urn:oasis:names:tc:opendocument:xmlns:meta:1.0"
DC = "http://purl.org/dc/elements/1.1/"

FIELDS = [
    "Name",
    "Purpose",
    "Exercise type",
    "Targeted musclegroups",
    "Targeted specific muscles",
    "Equipment and environment",
    "Starting position and set-up",
    "Step-by-step movement",
    "Range and direction",
    "Breathing",
    "Beginner dose and rest",
    "Expected sensation",
    "Regression",
    "Progression",
    "Common errors and corrections",
    "Evidence category",
    "Evidence strength",
    "Source",
]


def normalise_text(node: ET.Element) -> str:
    return " ".join("".join(node.itertext()).split())


def parse_exercises(source: Path) -> list[list[str]]:
    with ZipFile(source) as archive:
        root = ET.fromstring(archive.read("content.xml"))

    office_text = root.find(f".//{{{OFFICE}}}text")
    if office_text is None:
        raise ValueError("The source ODT has no office:text element")

    children = list(office_text)
    exercises: list[list[str]] = []
    for index, node in enumerate(children):
        if not node.tag.endswith("}h"):
            continue
        heading = normalise_text(node)
        if not re.match(r"^\d+\. ", heading):
            continue
        if index + len(FIELDS) - 1 >= len(children):
            continue
        paragraphs = children[index + 1 : index + len(FIELDS)]
        values = [normalise_text(paragraph) for paragraph in paragraphs]
        if not values or not values[0].startswith("Purpose:"):
            continue
        name = re.sub(r"^\d+\. ", "", heading)
        field_values = [name] + [value.split(":", 1)[1].strip() for value in values]
        if len(field_values) != len(FIELDS) or any(not value for value in field_values):
            raise ValueError(f"Incomplete exercise entry: {heading}")
        exercises.append(field_values)

    if len(exercises) != 33:
        raise ValueError(f"Expected 33 exercises, found {len(exercises)}")
    return exercises


def make_cell(template: ET.Element, value: str) -> ET.Element:
    cell = deepcopy(template)
    cell.attrib.pop(f"{{{TABLE}}}number-columns-repeated", None)
    cell.attrib[f"{{{OFFICE}}}value-type"] = "string"
    cell.attrib[f"{{{CALCEXT}}}value-type"] = "string"
    for child in list(cell):
        cell.remove(child)
    paragraph = ET.SubElement(cell, f"{{{TEXT}}}p")
    paragraph.text = value
    return cell


def replace_table(content: bytes, exercises: list[list[str]]) -> bytes:
    root = ET.fromstring(content)
    table = root.find(f".//{{{TABLE}}}table")
    if table is None:
        raise ValueError("The template ODS has no spreadsheet table")

    template_columns = list(table.findall(f"{{{TABLE}}}table-column"))
    template_rows = list(table.findall(f"{{{TABLE}}}table-row"))
    if len(template_columns) < 2 or not template_rows:
        raise ValueError("The template ODS does not contain the expected table styles")
    template_cells = list(template_rows[0].findall(f"{{{TABLE}}}table-cell"))
    if len(template_cells) < 2:
        raise ValueError("The template ODS has fewer than two styled cells")

    for child in list(table):
        table.remove(child)

    first_column = deepcopy(template_columns[0])
    second_column = deepcopy(template_columns[1])
    second_column.attrib[f"{{{TABLE}}}number-columns-repeated"] = str(len(exercises))
    table.extend([first_column, second_column])

    rows = list(zip(FIELDS, zip(*exercises)))
    for label, values in rows:
        row = deepcopy(template_rows[0])
        for child in list(row):
            row.remove(child)
        row.extend([make_cell(template_cells[0], label)])
        row.extend(make_cell(template_cells[1], value) for value in values)
        table.append(row)

    return ET.tostring(root, encoding="UTF-8", xml_declaration=True)


def update_metadata(meta: bytes) -> bytes:
    root = ET.fromstring(meta)
    office_meta = root.find(f".//{{{OFFICE}}}meta")
    if office_meta is None:
        raise ValueError("The template ODS has no office:meta element")

    title = office_meta.find(f"{{{DC}}}title")
    if title is None:
        title = ET.SubElement(office_meta, f"{{{DC}}}title")
    title.text = OUTPUT.stem

    description = office_meta.find(f"{{{META}}}description")
    if description is None:
        description = ET.SubElement(office_meta, f"{{{META}}}description")
    description.text = (
        "Exercise catalogue converted from exercises-lower-back-pain-2026-11-11.odt. "
        "Search date and report date: 11 November 2026."
    )
    return ET.tostring(root, encoding="UTF-8", xml_declaration=True)


def write_ods(exercises: list[list[str]]) -> None:
    with ZipFile(TEMPLATE) as template:
        content = replace_table(template.read("content.xml"), exercises)
        metadata = update_metadata(template.read("meta.xml"))
        with tempfile.NamedTemporaryFile(dir=OUTPUT.parent, suffix=".ods", delete=False) as temporary:
            temporary_path = Path(temporary.name)
        try:
            with ZipFile(temporary_path, "w") as output:
                for info in template.infolist():
                    data = content if info.filename == "content.xml" else metadata if info.filename == "meta.xml" else template.read(info.filename)
                    output.writestr(info, data, compress_type=ZIP_STORED if info.filename == "mimetype" else info.compress_type)
            shutil.move(temporary_path, OUTPUT)
        finally:
            temporary_path.unlink(missing_ok=True)


if __name__ == "__main__":
    write_ods(parse_exercises(SOURCE))
    print(f"Created {OUTPUT} with 33 exercises and 18 fields.")
