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

Which is why there are two ways of saying no, and they call for two different
next steps. Nothing was shown at all: the page is a picture, and a recognition
engine is what comes next. Plenty was shown and none of it reads: the text is
there, behind a font table this file does not carry, and a recognition engine
would be the wrong answer entirely — that document was never a picture.
"""

from __future__ import annotations

import re
import zlib

# Under this many readable characters, what was found is a stamp, a page number
# or a stray label, not a text layer. Raise it for dense documents.
MIN_CHARACTERS = 24

STREAM = re.compile(rb"stream\r?\n(.*?)[\r\n]*endstream", re.S)
PAGE = re.compile(rb"/Type\s*/Page[^s]")

# How much of the declaration that introduces a stream is read to find out what
# the stream holds. A stream dictionary is short; three hundred bytes reach the
# keys that matter.
HEADER = 300

# What that declaration says when the bytes are not page instructions: a
# picture, a font program, a colour profile, a bundle of objects, metadata.
# Skipping those is the difference between a scanned page that reports no text
# layer and one that reports several thousand characters of noise.
NOT_CONTENT = re.compile(
    rb"/Subtype\s*/(?:Image|Type1C|CIDFontType0C|OpenType)"
    rb"|/(?:DCTDecode|JPXDecode|CCITTFaxDecode|JBIG2Decode|RunLengthDecode)"
    rb"|/Type\s*/(?:Metadata|ObjStm|XRef)"
    rb"|/(?:Length1|Alternate|ColorSpace|BitsPerComponent)\b"
)

# A text object, from BT to ET. Nothing outside one shows a character, so
# nothing outside one is read. Belt and braces with the filter above: a
# photograph read as prose yields thousands of characters of noise, and the
# caller would file an unread document as read.
TEXT_OBJECT = re.compile(rb"\bBT\b(.*?)\bET\b", re.S)

# Inside a text object: a string, the operator that shows one, or an operator
# that moves the cursor to another line. Kerning numbers inside a TJ array are
# skipped on purpose — they space glyphs, they do not carry characters.
TOKEN = re.compile(
    rb"\((?:\\.|[^\\()])*\)|<[0-9A-Fa-f\s]*>|\bTJ\b|\bTj\b|'|\"|\bTd\b|\bTD\b|\bT\*", re.S
)

# The four operators that put a string on the page. A string no operator shows
# is not text: it is a name, an argument, or a coincidence in a picture.
SHOW = {b"TJ", b"Tj", b"'", b'"'}

ESCAPES = {b"n": b"\n", b"r": b"\r", b"t": b"\t", b"b": b"\b", b"f": b"\f"}
ESCAPE = re.compile(rb"\\(?:([0-7]{1,3})|(.))", re.S)


def _readable(character: str) -> bool:
    """
    Whether a character says something once decoded.

    A word processor subsets its fonts and renumbers their glyphs from one, so
    its strings come out of here as control codes: text in the document, and not
    text yet on this side. Counting those would report a readable page and hand
    the caller gibberish to index.
    """
    code = ord(character)
    return code > 32 and code != 127 and not 128 <= code <= 159 and code != 0xFFFD


def read_text_layer(pdf_bytes: bytes, *, min_characters: int = MIN_CHARACTERS) -> dict:
    """
    Say whether the document carries a text layer, and return it if it does.

    The answer is a report, not a string: `has_text_layer` is the decision the
    caller acts on, and `reason` is what to tell them when it is false.
    """
    chunks = []
    for match in STREAM.finditer(pdf_bytes):
        declaration = pdf_bytes[max(0, match.start() - HEADER) : match.start()]
        if NOT_CONTENT.search(declaration):
            continue
        found = _read_stream(match.group(1))
        if found:
            chunks.append(found)
    text = "\n".join(chunks)
    characters = sum(1 for c in text if _readable(c))
    shown = sum(1 for c in text if not c.isspace())
    # Enough readable characters, and most of what was shown among them. A page
    # whose strings decode one character in ten has not been read, whatever the
    # count says, and calling that a text layer files an unread document.
    has_text_layer = characters >= min_characters and characters * 2 >= shown
    return {
        "has_text_layer": has_text_layer,
        "text": text,
        "characters": characters,
        "pages": len(PAGE.findall(pdf_bytes)),
        "reason": None if has_text_layer else _reason_for(shown, min_characters),
    }


def _reason_for(shown: int, min_characters: int) -> str:
    """
    Why the answer is no, which is the part the caller acts on.

    Two different noes, and they call for two different next steps. Nothing was
    shown at all: the page is a picture, and it needs OCR. Plenty was shown and
    none of it reads: the text is there, behind a font table this function does
    not have, and OCR is the wrong answer — a full PDF library is the right one.
    """
    if shown < min_characters:
        return "no text layer: this page is an image, and needs OCR"
    return "a text layer encoded by a font table: this needs a full PDF library, not a scan"


def _read_stream(raw: bytes) -> str:
    """Inflate the stream if it is compressed, then read what it shows."""
    try:
        # decompressobj, not decompress: a stream may carry padding after the
        # deflated data, and a raw decompress would refuse it.
        data = zlib.decompressobj().decompress(raw)
    except zlib.error:
        data = raw  # an uncompressed content stream is perfectly legal

    lines: list[str] = []
    for body in TEXT_OBJECT.findall(data):
        current: list[str] = []
        pending: list[str] = []
        for token in TOKEN.findall(body):
            if token.startswith(b"("):
                pending.append(_literal(token[1:-1]))
            elif token.startswith(b"<"):
                pending.append(_hex(token[1:-1]))
            elif token in SHOW:
                current.extend(pending)
                pending = []
            elif current:
                lines.append("".join(current))
                current = []
                pending = []
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
