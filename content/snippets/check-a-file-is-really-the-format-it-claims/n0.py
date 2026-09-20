"""
Decide what an uploaded file is from its bytes, not from what it says it is.

Rung N0. The first bytes of a file are its format: 89 50 4E 47 for a PNG,
%PDF- for a PDF, PK for anything built on a ZIP archive. Those signatures are
published tables, and reading them is a comparison — no model is involved,
and none could be, because the answer is exact.

Where the answer comes from is the whole point of this rung. The file name and
the Content-Type header travel with the upload, which means the client wrote
them: they are a claim, not a fact. This function takes them as a claim, reads
the bytes on its own, and reports whether the two agree.

`puremagic` carries the signature table here, `file-type` in JavaScript. One
difference between them is handled in this file: every ZIP-based format starts
with PK, `file-type` opens the archive to tell a .docx from a .xlsx, and
`puremagic` returns half a dozen candidates at the same score. The twelve lines
of `_inside_zip` read the archive the same way, so both languages answer the
same thing.

What no table can do is a format whose file is text. A CSV, a JSON file, an
SVG and a plain note have no binary header, so they are reported as
unrecognised rather than guessed — and an unrecognised file is never allowed.
"""

from __future__ import annotations

import io
import zipfile

import puremagic

# What the ZIP container really holds, read from the archive rather than
# guessed from the PK signature that all of them share.
ODF_MIMETYPES = {
    "application/vnd.oasis.opendocument.text": "odt",
    "application/vnd.oasis.opendocument.spreadsheet": "ods",
    "application/vnd.oasis.opendocument.presentation": "odp",
}
OOXML_FOLDERS = {"word/": "docx", "xl/": "xlsx", "ppt/": "pptx"}

# Signatures live in the first bytes; reading more than this from an untrusted
# upload buys nothing and costs memory.
HEAD = 4096

# The two tables do not need the same number of bytes: `puremagic` calls a PNG
# on its eight-byte signature, `file-type` wants the sixteen that carry the
# first chunk header too. Below the larger of the two, this snippet answers
# nothing rather than answering differently in each language.
MIN_BYTES = 16

# The same format under two names in the two tables.
ALIASES = {"jfif": "jpg", "jpeg": "jpg", "tif": "tiff", "htm": "html"}

# What a web upload actually carries. A signature table holds a thousand
# formats, and on binary noise it finds one: a hundred null bytes come back
# from `puremagic` as a Compucon-Singer embroidery design, at the same
# confidence as a real PNG. Answering only for this list turns that into a
# refusal instead of a wrong answer — and text formats are not on it, because
# they have no binary signature to read whatever a table claims.
KNOWN = {
    "png", "jpg", "gif", "webp", "avif", "heic", "tiff", "bmp", "ico",
    "pdf", "rtf", "zip", "docx", "xlsx", "pptx", "odt", "ods", "odp",
    "mp3", "mp4", "wav", "ogg", "webm", "gz", "7z", "rar", "exe",
}


def _inside_zip(data: bytes) -> str:
    """Which ZIP-based format this archive is, or 'zip' when it is just one."""
    try:
        archive = zipfile.ZipFile(io.BytesIO(data))
        names = archive.namelist()
        if "mimetype" in names:
            return ODF_MIMETYPES.get(archive.read("mimetype").decode("ascii", "replace"), "zip")
        if "[Content_Types].xml" in names:
            for folder, extension in OOXML_FOLDERS.items():
                if any(name.startswith(folder) for name in names):
                    return extension
    except (zipfile.BadZipFile, KeyError, OSError):
        return "zip"
    return "zip"


def sniff_file(data, *, claimed_name: str | None = None, allowed=()) -> dict:
    """
    Say what the bytes are, and whether that matches what was claimed.

    `claimed_name` is the file name the client sent. It is never used to
    decide, only to be contradicted: `matches_claim` is the comparison, and a
    caller that logs a False there is looking at either a mistake or an attack.

    `allowed` is the caller's own list of extensions. `allowed` in the report
    is true only when something was recognised and it is on that list: an
    unrecognised file is never allowed by default.
    """
    if not isinstance(data, (bytes, bytearray, memoryview)):
        return _report([], claimed_name, allowed, f"a file is bytes, not {type(data).__name__}")
    head = bytes(data[:HEAD])
    if not head:
        return _report([], claimed_name, allowed, "the file is empty")
    if len(head) < MIN_BYTES:
        return _report([], claimed_name, allowed,
                       f"under {MIN_BYTES} bytes: too short to carry a signature")

    try:
        matches = puremagic.magic_string(head)
    except Exception:  # noqa: BLE001 - an unrecognised file is an answer, not a crash
        matches = []
    candidates = [ALIASES.get(m.extension.lstrip(".").lower(), m.extension.lstrip(".").lower())
                  for m in matches]
    detected = [c for c in candidates if c in KNOWN][:1]
    if detected and detected[0] in {"zip", "docx", "xlsx", "pptx", "odt", "ods", "odp"}:
        detected = [_inside_zip(bytes(data))]
    return _report(detected, claimed_name, allowed,
                   None if detected else "no signature read from the bytes")


def _report(detected: list, claimed_name: str | None, allowed, reason: str | None) -> dict:
    claimed = None
    if claimed_name and "." in claimed_name:
        claimed = claimed_name.rsplit(".", 1)[1].lower()
    return {
        "detected": detected[0] if detected else None,
        "claimed": claimed,
        # None when there is nothing to compare: no claim, or nothing read.
        "matches_claim": None if (claimed is None or not detected) else claimed in detected,
        "allowed": bool(detected) and detected[0] in set(allowed),
        "reason": reason,
    }
