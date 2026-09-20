"""
Sort a pile of PDFs into the pages that need OCR and the pages that do not.

Rung N0. OCR and vision models are billed by the page, and most of the pages
in an archive do not need either: a PDF written by an accounting tool, a word
processor or a print driver already carries its text, exactly, next to its
drawing instructions. Reading that text costs nothing and cannot be wrong,
because no recognition happened.

So the decision is taken per page, not per document. A contract exported from a
word processor with a scanned signature page at the end is one file with two
kinds of page in it, and sending the whole thing to OCR pays for the pages that
were already readable.

Two numbers per page are enough, and this is the part a model would replace
with a guess: how many non-space characters the page yields, and how many
images it draws. Text and no image is a page to leave alone. An image and
almost no text is a scan — and « almost » matters, because a scanned page
often carries a header or a page number in real text, which a rule that only
asks « is there any text » counts as a readable page.

`pypdf` reads the page here, `pdf.js` in JavaScript. Neither is asked to
recognise anything.
"""

from __future__ import annotations

import io

# A page of an ordinary document yields a few thousand characters; a header, a
# reference or a page number yields a few dozen. Anything under this, with an
# image on the page, is a scan wearing a label. Raise it for dense documents,
# lower it for forms.
MIN_CHARACTERS = 120


def triage_pages(pdf_bytes, *, min_characters: int = MIN_CHARACTERS, reader=None) -> dict:
    """
    Say, page by page, which ones have to go to OCR.

    The answer is a plan: `needs_ocr` is the list of page numbers to pay for,
    `readable` the ones to read for free, `unreadable` the ones that carry
    neither text nor image and that OCR would not help either.

    `reader` is injected by the tests; in production it is `pypdf.PdfReader`.
    """
    if reader is None:  # imported here so the rest of this file needs nothing
        from pypdf import PdfReader as reader

    try:
        document = reader(io.BytesIO(pdf_bytes))
        pages = list(document.pages)
    except Exception as error:  # noqa: BLE001 - a broken file is an answer too
        return {"pages": [], "needs_ocr": [], "readable": [], "unreadable": [],
                "reason": f"this file could not be opened as a PDF: {error}"}

    report = []
    for number, page in enumerate(pages, start=1):
        text = page.extract_text() or ""
        characters = sum(1 for character in text if not character.isspace())
        images = len(page.images)
        report.append({
            "page": number,
            "characters": characters,
            "images": images,
            "verdict": _verdict(characters, images, min_characters),
        })
    return {
        "pages": report,
        "needs_ocr": [p["page"] for p in report if p["verdict"] == "scan"],
        "readable": [p["page"] for p in report if p["verdict"] == "text"],
        "unreadable": [p["page"] for p in report if p["verdict"] == "blank"],
        "reason": None,
    }


def _verdict(characters: int, images: int, min_characters: int) -> str:
    # The order matters. A page with enough text is readable whatever it also
    # draws; below that, an image is what OCR is for, and nothing at all is a
    # page OCR would return empty — which is worth knowing before paying.
    if characters >= min_characters:
        return "text"
    return "scan" if images else "blank"
