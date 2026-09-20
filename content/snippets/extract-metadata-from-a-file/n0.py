"""
What an office document says about itself, before you send it out.

Rung N0. A .docx, an .xlsx or a .pptx is a ZIP, and two of its entries are
nothing but metadata: `docProps/core.xml` carries the author, whoever saved it
last, the revision count and the two dates; `docProps/app.xml` carries the
company, the manager, the template and the total editing time. Reading them is
unzipping and parsing, with the standard library on both sides.

The interesting part is not the reading, it is what the reading is for. A
document sent to a client carries the name of everyone who touched it, the
internal template it was built from, and how long it took. None of that is
visible on screen, all of it travels with the file, and it is the reason this
entry exists.

One rule the code keeps. It reads two parts and it names the others: a
document carrying comments, tracked changes or session identifiers has more to
say than these two files, and answering « no author » about a document whose
authors are in `word/comments.xml` would be worse than saying nothing. What is
not read is listed, not ignored.
"""

from __future__ import annotations

import io
import xml.etree.ElementTree as ElementTree
import zipfile

# The two parts read, and the fields taken from each. The names are the local
# names of the elements: the namespaces differ between the two files and say
# nothing more than which file you are in.
CORE_PART, APP_PART = "docProps/core.xml", "docProps/app.xml"
FIELDS = {
    "title": "title", "creator": "author", "lastModifiedBy": "last_modified_by",
    "revision": "revision", "created": "created", "modified": "modified",
    "keywords": "keywords", "subject": "subject", "description": "description",
    "category": "category", "Company": "company", "Manager": "manager",
    "Template": "template", "Application": "application", "AppVersion": "app_version",
    # « TotalTime » is the total editing time in minutes, as the OOXML
    # specification defines it — not a duration this code computed.
    "TotalTime": "editing_minutes",
}

# Parts that carry names, dates or identifiers this rung does not read. They
# are listed so that a quiet answer is never mistaken for an empty document.
OTHER_PARTS = ("comments", "people", "settings", "custom.xml", "revisions")

# A ZIP entry can promise far more than the archive weighs. Only the two parts
# read are decompressed, and only below this size.
MAX_PART_BYTES = 4_000_000


def read_document_metadata(data) -> dict:
    """
    The fields an OOXML document declares about itself, and what was not read.

    `data` is the bytes of the file. Nothing is written, and nothing but the
    two metadata parts is decompressed.
    """
    if not isinstance(data, (bytes, bytearray)):
        return _report(None, {}, [], f"expected bytes, not {type(data).__name__}")
    try:
        archive = zipfile.ZipFile(io.BytesIO(data))
        names = archive.namelist()
    except (zipfile.BadZipFile, OSError):
        return _report(None, {}, [], "not a ZIP container, so not an OOXML document")
    if not any(name.startswith("docProps/") or name.endswith("/document.xml")
               for name in names):
        return _report(None, {}, [], "a ZIP, but not an OOXML document")

    fields = {}
    for part in (CORE_PART, APP_PART):
        if part not in names or archive.getinfo(part).file_size > MAX_PART_BYTES:
            continue
        try:
            root = ElementTree.fromstring(archive.read(part))
        except ElementTree.ParseError:
            continue  # a part we cannot read is a part we do not claim
        for element in root:
            local = element.tag.split("}")[-1]
            if local in FIELDS and (element.text or "").strip():
                fields[FIELDS[local]] = element.text.strip()

    others = sorted(name for name in names
                    if any(mark in name for mark in OTHER_PARTS) and name not in (CORE_PART, APP_PART))
    return _report("ooxml", fields, others, None)


def _report(kind, fields: dict, others: list, reason) -> dict:
    return {"format": kind, "fields": fields, "other_parts": others, "reason": reason}
