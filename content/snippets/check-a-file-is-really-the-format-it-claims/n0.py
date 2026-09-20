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

One format, one name. `.jpeg` and `.jpg` are the same picture, `.tif` and
`.tiff` the same scan, and the two tables do not always pick the same spelling.
The detected type, the claimed extension and every entry of the caller's allow
list are compared under one canonical name, so a photo exported by a phone as
`photo.jpeg` is not reported as a mismatch.
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

# Signatures live in the first bytes; reading more than this to find one buys
# nothing. It is not a bound on the whole read, and saying so matters on an
# upload path: a ZIP keeps its table of contents at the end of the file, so
# `_inside_zip` below holds the whole upload in memory. That is the price of
# answering `docx` rather than `zip`, and of answering it in both languages —
# `file-type` tells the two apart from the head alone, `puremagic` cannot. A
# caller that will not pay it bounds the upload before calling.
HEAD = 4096

# The two tables do not need the same number of bytes: `puremagic` calls a PNG
# on its eight-byte signature, `file-type` wants the sixteen that carry the
# first chunk header too. Below the larger of the two, this snippet answers
# nothing rather than answering differently in each language.
MIN_BYTES = 16

# The same format under two names, in the tables and in the wild.
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


def _canonical(extension: str) -> str:
    """The one name this snippet uses for a format, however it was written."""
    name = extension.strip().lstrip(".").lower()
    return ALIASES.get(name, name)


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
    # puremagic raises PureError (a LookupError) when nothing matches, and
    # PureValueError (a ValueError) on empty input. An unrecognised file is an
    # answer here, not a crash.
    except (LookupError, ValueError):
        matches = []
    candidates = [_canonical(m.extension) for m in matches]
    detected = [c for c in candidates if c in KNOWN][:1]
    if detected and detected[0] in {"zip", "docx", "xlsx", "pptx", "odt", "ods", "odp"}:
        detected = [_inside_zip(bytes(data))]
    return _report(detected, claimed_name, allowed,
                   None if detected else "no signature read from the bytes")


def _report(detected: list, claimed_name: str | None, allowed, reason: str | None) -> dict:
    claimed = None
    if claimed_name and "." in claimed_name:
        claimed = claimed_name.rsplit(".", 1)[1].lower()
    # `claimed` is reported as the client spelled it; the comparisons are made
    # on canonical names, on all three sides. Comparing a canonical `jpg` to a
    # raw `jpeg` raised a mismatch on half the photos on the web, and refused
    # them when the allow list was spelled `jpeg` too.
    permitted = {_canonical(extension) for extension in allowed}
    return {
        "detected": detected[0] if detected else None,
        "claimed": claimed,
        # None when there is nothing to compare: no claim, or nothing read.
        "matches_claim": None if (claimed is None or not detected) else _canonical(claimed) in detected,
        "allowed": bool(detected) and detected[0] in permitted,
        "reason": reason,
    }
