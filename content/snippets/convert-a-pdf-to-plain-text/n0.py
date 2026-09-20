"""
Get the text out of a PDF, in the order it is meant to be read.

Rung N0. A PDF does not store a text: it stores instructions for drawing
glyphs at coordinates. Reading them is what `pypdf` and `pdftotext` do here,
and `pdf.js` in JavaScript, and none of them needs a model — the characters are
in the file, exactly, and no recognition happens.

What they do not do is decide in which order those characters are meant to be
read. A word processor exporting two columns often draws them line by line,
left then right, so the naïve reading gives « La boulangerie Martin fête
Clémentine Martin a repris ». The columns are found here instead, by looking
for the vertical gutters — the bands of the page where no word sits — and each
one is read from top to bottom before the next begins.

One thing is deliberately left alone: a word cut at the end of a line stays
cut. Gluing « généra- » and « tions » back together is one line of code and
would also glue « Boulogne- » and « Billancourt », which is a different town.
The caller knows its corpus; this function does not guess.
"""

from __future__ import annotations

import io

# Two words are on the same line if their baselines are within this many points.
SAME_LINE = 3.0

# A band of the page this wide with no word in it is a gutter between columns.
# An ordinary word space is under five points; a column gutter is twenty to
# forty. Twenty-five sits between the two.
MIN_GUTTER = 25.0


def read_text(pdf_bytes, *, pages=None) -> dict:
    """
    The text of the document, page by page, read column by column.

    `columns` in each page's report is how many the code found, which is what
    tells a caller that the page was not a simple column of prose.
    """
    try:
        import pdfplumber

        document = pdfplumber.open(io.BytesIO(pdf_bytes))
    except Exception as error:  # noqa: BLE001 - a broken file is an answer too
        return {"pages": [], "reason": f"this file could not be opened as a PDF: {error}"}

    read = []
    with document:
        for number, page in enumerate(document.pages, start=1):
            if pages is not None and number not in pages:
                continue
            words = [{"text": w["text"], "x": w["x0"], "end": w["x1"], "y": -w["top"]}
                     for w in page.extract_words()]
            bands = find_columns(words)
            blocks = [_column_text(words, band) for band in bands]
            read.append({"page": number, "columns": len(bands),
                         "text": "\n\n".join(block for block in blocks if block)})
    return {"pages": read, "reason": None}


def find_columns(words) -> list:
    """
    The horizontal bands the page's text sits in, left to right.

    The page is swept one point at a time; a run of points no word overlaps,
    wider than a gutter, separates two columns.
    """
    if not words:
        return []
    left = int(min(word["x"] for word in words))
    right = int(max(word["end"] for word in words)) + 1
    busy = bytearray(right - left)
    for word in words:
        for position in range(int(word["x"]) - left, int(word["end"]) - left):
            busy[position] = 1

    bands, start, gap = [], 0, 0
    for position, occupied in enumerate(busy):
        if occupied:
            if gap >= MIN_GUTTER and position - gap > start:
                bands.append((left + start, left + position - gap))
                start = position - gap
            gap = 0
        else:
            gap += 1
    bands.append((left + start, right))
    return bands


def _column_text(words, band) -> str:
    """The words of one band, read top to bottom, left to right."""
    middle = [w for w in words if band[0] <= (w["x"] + w["end"]) / 2 < band[1]]
    lines = []
    for word in sorted(middle, key=lambda w: (-w["y"], w["x"])):
        if lines and abs(lines[-1][0]["y"] - word["y"]) <= SAME_LINE:
            lines[-1].append(word)
        else:
            lines.append([word])
    return "\n".join(" ".join(word["text"] for word in line) for line in lines)
