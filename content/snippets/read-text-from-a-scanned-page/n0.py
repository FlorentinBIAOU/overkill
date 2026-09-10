"""
Read the text layer the document may already carry, before reaching for OCR.

Rung N0. Standard library only: zlib to inflate the page streams, and a
reading of the text-showing operators inside them.

Most « scanned pages » were never scanned. A PDF produced by an accounting
tool, a word processor or a print-to-PDF driver carries its text next to its
drawing instructions, already correct, with no recognition step and therefore
nothing to get wrong. Asking the question first is one function call, and it
answers the whole need whenever the answer is yes.

The point is the question, not the extractor. When the answer is no, this
function says so — it does not hand back an empty string, which a caller would
read as « the page is blank ».
"""

from __future__ import annotations

import re
import zlib

# Under this many non-space characters, what was found is a stamp, a page
# number or a stray label, not a text layer. Raise it for dense documents.
MIN_CHARACTERS = 24

STREAM = re.compile(rb"stream\r?\n(.*?)[\r\n]*endstream", re.S)
PAGE = re.compile(rb"/Type\s*/Page[^s]")

# Inside a content stream: a string being shown, or an operator that moves the
# cursor to another line. Kerning numbers inside a TJ array are skipped on
# purpose — they space glyphs, they do not carry characters.
TOKEN = re.compile(rb"\((?:\\.|[^\\()])*\)|<[0-9A-Fa-f\s]*>|\bTd\b|\bTD\b|\bT\*|\bET\b", re.S)

ESCAPES = {b"n": b"\n", b"r": b"\r", b"t": b"\t", b"b": b"\b", b"f": b"\f"}
ESCAPE = re.compile(rb"\\(?:([0-7]{1,3})|(.))", re.S)


def read_text_layer(pdf_bytes: bytes, *, min_characters: int = MIN_CHARACTERS) -> dict:
    """
    Say whether the document carries a text layer, and return it if it does.

    The answer is a report, not a string: `has_text_layer` is the decision the
    caller acts on, and `reason` is what to tell them when it is false.
    """
    chunks = [t for t in (_read_stream(s) for s in STREAM.findall(pdf_bytes)) if t]
    text = "\n".join(chunks)
    characters = sum(1 for c in text if not c.isspace())
    has_text_layer = characters >= min_characters
    return {
        "has_text_layer": has_text_layer,
        "text": text,
        "characters": characters,
        "pages": len(PAGE.findall(pdf_bytes)),
        "reason": None if has_text_layer else "no text layer: this page is an image, and needs OCR",
    }


def _read_stream(raw: bytes) -> str:
    """Inflate the stream if it is compressed, then read what it shows."""
    try:
        # decompressobj, not decompress: a stream may carry padding after the
        # deflated data, and a raw decompress would refuse it.
        data = zlib.decompressobj().decompress(raw)
    except zlib.error:
        data = raw  # an uncompressed content stream is perfectly legal

    lines: list[str] = []
    current: list[str] = []
    for token in TOKEN.findall(data):
        if token.startswith(b"("):
            current.append(_literal(token[1:-1]))
        elif token.startswith(b"<"):
            current.append(_hex(token[1:-1]))
        elif current:
            lines.append("".join(current))
            current = []
    if current:
        lines.append("".join(current))
    return "\n".join(lines)


def _literal(body: bytes) -> str:
    """A literal string: backslash escapes, and octal for everything else."""

    def replace(match: re.Match) -> bytes:
        octal, char = match.groups()
        if octal:
            return bytes([int(octal, 8) & 0xFF])
        return ESCAPES.get(char, char)

    # Latin-1, because a simple font encodes one byte per character. A font
    # with its own encoding table needs that table, which is another job.
    return ESCAPE.sub(replace, body).decode("latin-1")


def _hex(body: bytes) -> str:
    """A hex string, as PDF writers emit for anything beyond ASCII."""
    digits = re.sub(rb"\s", b"", body)
    if len(digits) % 2:
        digits += b"0"  # the spec pads a lone last digit with zero
    raw = bytes.fromhex(digits.decode("ascii"))
    if raw[:2] == b"\xfe\xff":
        return raw[2:].decode("utf-16-be", errors="replace")
    return raw.decode("latin-1")
