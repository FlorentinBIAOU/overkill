"""
Read the text layer the document may already carry, before reaching for OCR.

Rung N0. Standard library only: zlib to inflate the page streams, and a
reading of the text-showing operators inside them.

A PDF produced by an accounting tool, a word processor or a print-to-PDF
driver carries its text next to its drawing instructions, already correct,
with no recognition step and therefore nothing to get wrong. Asking the
question first is one function call, and it answers the whole need whenever
the answer is yes.

The point is the question, not the extractor. When the answer is no, this
function says so — it does not hand back an empty string, which a caller would
read as « the page is blank ».

Which is why a no comes with one of two next steps. Nothing was shown at all:
the page is a picture, and a recognition engine is what comes next. Text is
there and this file cannot decode it — a font with its own table, an encrypted
document, a filter other than Flate: a full PDF library is what comes next,
and a recognition engine would be the wrong answer, since that document was
never a picture.
"""

from __future__ import annotations

import re
import zlib

# Under this many readable characters, what was found is a stamp, a page number
# or a stray label, not a text layer. Raise it for dense documents.
MIN_CHARACTERS = 24

STREAM = re.compile(rb"stream\r?\n(.*?)[\r\n]*endstream", re.S)
PAGE = re.compile(rb"/Type\s*/Page[^s]")
OBJECT_STREAM = re.compile(rb"/Type\s*/ObjStm")  # PDF 1.5 packs objects, pages included, in these
ENCRYPTED = re.compile(rb"/Encrypt\b")
UNDECODED = re.compile(rb"/(?:LZWDecode|ASCII85Decode|ASCIIHexDecode|Crypt)\b")

# What the declaration of a stream says when its bytes are not page
# instructions: a picture, a font program, a colour profile, metadata. The whole
# declaration is read, from its `obj` keyword on: an image with an inline colour
# palette runs to kilobytes before it says `/Subtype /Image`.
NOT_CONTENT = re.compile(
    rb"/Subtype\s*/(?:Image|Type1C|CIDFontType0C|OpenType)"
    rb"|/(?:DCTDecode|JPXDecode|CCITTFaxDecode|JBIG2Decode|RunLengthDecode)"
    rb"|/Type\s*/(?:Metadata|XRef)"
    rb"|/(?:Length1|Alternate|ColorSpace|BitsPerComponent)\b"
)

# A string (with one level of balanced parentheses, which the spec allows
# unescaped), a hex string, a name, or an operator. One pass, left to right.
TOKEN = re.compile(
    rb"\((?:\\.|[^\\()]|\((?:\\.|[^\\()])*\))*\)|<[0-9A-Fa-f\s]*>|/[^\s/<>\[\]()]*|[A-Za-z]+\*?|['\"]", re.S
)

# The four operators that put a string on the page. A string any other operator
# takes is not text: a marked-content property, a name, an argument.
SHOW = {b"TJ", b"Tj", b"'", b'"'}
NEW_LINE = {b"Td", b"TD", b"T*", b"ET"}

ESCAPES = {b"n": b"\n", b"r": b"\r", b"t": b"\t", b"b": b"\b", b"f": b"\f"}
ESCAPE = re.compile(rb"\\(?:([0-7]{1,3})|(.))", re.S)

# WinAnsiEncoding is Windows code page 1252 (PDF 32000-1, annex D), not Latin-1:
# from 127 to 159 it holds the euro sign and typographic quotes, and a bullet
# on every unused code.
WIN_ANSI = dict(zip(range(127, 160), "•€•‚ƒ„…†‡ˆ‰Š‹Œ•Ž••‘’“”•–—˜™š›œ•žŸ"))


def _is_control(character: str) -> bool:
    """
    A code no named encoding of a simple font puts a glyph on (annex D).

    A word processor subsets its fonts and renumbers their glyphs from one, so
    its strings come out of here with codes below 32: one of them is enough to
    know the bytes are not letters yet, and counting the rest would hand the
    caller gibberish to index.
    """
    code = ord(character)
    return (code < 32 and character not in "\t\n\f\r") or 127 <= code <= 159


def read_text_layer(pdf_bytes: bytes, *, min_characters: int = MIN_CHARACTERS) -> dict:
    """
    Say whether the document carries a text layer, and return it if it does.

    The answer is a report, not a string: `has_text_layer` is the decision the
    caller acts on, and `reason` is what to tell them when it is false.
    """
    chunks, previous = [], 0
    pages, locked = len(PAGE.findall(pdf_bytes)), bool(ENCRYPTED.search(pdf_bytes))
    for match in STREAM.finditer(pdf_bytes):
        between = pdf_bytes[previous : match.start()]
        declaration, previous = between[max(0, between.rfind(b"obj")) :], match.end()
        if OBJECT_STREAM.search(declaration):
            pages += len(PAGE.findall(_inflate(match.group(1))))
        elif NOT_CONTENT.search(declaration):
            continue
        elif UNDECODED.search(declaration):
            locked = True
        else:
            chunks.append(_read_stream(_inflate(match.group(1))))
    text = "\n".join(chunk for chunk in chunks if chunk)
    controls = any(_is_control(c) for c in text)
    characters = sum(1 for c in text if ord(c) > 32 and not _is_control(c) and c != "\ufffd")
    has_text_layer = characters >= min_characters and not controls and not locked
    return {
        "has_text_layer": has_text_layer,
        "text": text,
        "characters": characters,
        "pages": pages,
        "reason": None if has_text_layer else _reason_for(locked, controls),
    }


def _reason_for(locked: bool, controls: bool) -> str:
    """Why the answer is no, which is the part the caller acts on."""
    if locked:
        return "encrypted or encoded content this function cannot open: this needs a full PDF library, not a scan"
    if controls:
        return "a text layer encoded by a font table: this needs a full PDF library, not a scan"
    return "no text layer: this page is an image, and needs OCR"


def _inflate(raw: bytes) -> bytes:
    try:
        # decompressobj, not decompress: a stream may carry padding after the
        # deflated data, and a raw decompress would refuse it.
        return zlib.decompressobj().decompress(raw)
    except zlib.error:
        return raw  # an uncompressed content stream is perfectly legal


def _read_stream(data: bytes) -> str:
    """Read what the text objects of a content stream show, line by line."""
    lines: list[str] = []
    current: list[str] = []
    pending: list[str] = []
    in_text = False
    for token in TOKEN.findall(data):
        if token == b"BT":
            in_text, current, pending = True, [], []
        elif not in_text or token.startswith(b"/"):
            continue  # nothing outside BT ... ET shows a character
        elif token.startswith(b"("):
            pending.append(_literal(token[1:-1]))
        elif token.startswith(b"<"):
            pending.append(_hex(token[1:-1]))
        elif token in SHOW:
            current.extend(pending)
            pending = []
        else:
            # Kerning numbers inside a TJ array are not tokens: they space glyphs.
            pending = []
            if token in NEW_LINE and current:
                lines.append("".join(current))
                current = []
            in_text = token != b"ET"
    return "\n".join(lines)


def _literal(body: bytes) -> str:
    """A literal string: backslash escapes, and octal for everything else."""

    def replace(match: re.Match) -> bytes:
        octal, char = match.groups()
        if octal:
            return bytes([int(octal, 8) & 0xFF])
        return ESCAPES.get(char, char)

    return ESCAPE.sub(replace, body).decode("latin-1").translate(WIN_ANSI)


def _hex(body: bytes) -> str:
    """A hex string, as PDF writers emit for anything beyond ASCII."""
    digits = re.sub(rb"\s", b"", body)
    if len(digits) % 2:
        digits += b"0"  # the spec pads a lone last digit with zero
    raw = bytes.fromhex(digits.decode("ascii"))
    if raw[:2] == b"\xfe\xff":
        return raw[2:].decode("utf-16-be", errors="replace")
    return raw.decode("latin-1").translate(WIN_ANSI)
