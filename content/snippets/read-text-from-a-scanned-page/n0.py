"""
Ask the document whether it already carries its text, before reaching for OCR.

Rung N0. One question, put to a PDF library, and an answer the caller can act
on.

A PDF produced by an accounting tool, a word processor or a print-to-PDF driver
carries its text next to its drawing instructions, already correct, with no
recognition step and therefore nothing to get wrong. A scan of the same
document carries pixels. The two look alike in a mailbox, and nothing
downstream tells them apart unless somebody asks.

The question is the point of this rung; the extractor is not. Writing the
extractor is the trap: inflating page streams and decoding the text-showing
operators is two hundred lines that still lose to the first font the file
renumbers for itself, which is what a word processor does on every export.
That work is done and shipped — `pypdf` here, `pdf.js` in JavaScript,
`pdftotext` at a shell prompt — and what is left to write is the decision.

Which is this: a page that carries no readable text is not an empty page, and
the function says so instead of handing back an empty string a caller would
read as « the page is blank ». A no comes with its next step.
"""

from __future__ import annotations

import io

# Under this many readable characters, what was found is a stamp, a page number
# or a stray label, not a text layer. Raise it for dense documents.
MIN_CHARACTERS = 24


def read_text_layer(pdf_bytes: bytes, *, min_characters: int = MIN_CHARACTERS, reader=None) -> dict:
    """
    Say whether the document carries a text layer, and return it if it does.

    The answer is a report, not a string: `has_text_layer` is the decision the
    caller acts on, and `reason` is what to tell them when it is false.

    `reader` is injected by the tests; in production it is `pypdf.PdfReader`.
    """
    if reader is None:  # imported here so the rest of this file needs nothing
        from pypdf import PdfReader as reader

    try:
        document = reader(io.BytesIO(pdf_bytes))
        pages = [page.extract_text() or "" for page in document.pages]
    except Exception as error:  # noqa: BLE001 - a broken file is an answer too
        return _report("", 0, 0, f"this file could not be opened as a PDF: {error}")

    text = "\n".join(page for page in pages if page.strip())
    characters = sum(1 for character in text if character.isprintable() and not character.isspace())
    if characters >= min_characters:
        return _report(text, characters, len(pages), None)
    return _report(text, characters, len(pages),
                   "no text layer: this page is an image, and needs OCR")


def _report(text: str, characters: int, pages: int, reason: str | None) -> dict:
    return {
        "has_text_layer": reason is None,
        "text": text,
        "characters": characters,
        "pages": pages,
        "reason": reason,
    }
