"""
Get the text out of a PDF, in the order it is meant to be read.

Rung N0. A PDF does not store a text: it stores instructions for drawing
glyphs at coordinates. Turning them back into characters is what `pypdf` and
`pdftotext` do, and `pdf.js` in JavaScript, and none of them needs a model —
the characters are in the file, exactly, and no recognition happens. This
snippet does not call those three: it goes through `pdfplumber`, which is the
one that also hands out the position of every word, and the position is what
the rest of this file works on.

What they do not do is decide in which order those characters are meant to be
read. A word processor exporting two columns often draws them line by line,
left then right, so the naïve reading gives « La boulangerie Martin fête
Clémentine Martin a repris ». The columns are found here instead, by looking
for the vertical gutters — the bands of the page where no word sits — and each
one is read from top to bottom before the next begins.

A page with more than two bands is not reordered at all. Two columns is what a
word processor exports; three or more, on a page nobody here typeset, is a
table, a form or a price list, and the gutters of a table are as wide as those
of a text. Reading its bands top to bottom would give all the part numbers,
then all the designations, then all the prices, and the link between MC-4501
and 19,90 would be gone. Those pages are read in page order, and `reason` says
so on the page that got it. What to do next is the `extract-tables-from-a-pdf`
entry, which reads the grid instead of the prose.

The count of bands is all this rule has, and it is what is portable: how many
words a line holds depends on how the extractor cut the runs, and `pdfplumber`
and `pdf.js` do not cut them the same way. So a table of exactly two columns —
a label on the left, an amount on the right — is still read as two columns, and
still transposed. That is the first line of the breaking point, not a footnote.

One thing is deliberately left alone: a word cut at the end of a line stays
cut. Gluing « généra- » and « tions » back together is one line of code and
would also glue « Boulogne- » and « Billancourt », which is a different town.
The caller knows its corpus; this function does not guess, and it counts those
lines in `hyphenated_lines` so the caller can decide for its own.
"""

from __future__ import annotations

import io

# Two words are on the same line if their baselines are within this many points.
SAME_LINE = 3.0

# A band of the page this wide with no word in it is a gutter between columns.
# An ordinary word space is under five points; a column gutter is twenty to
# forty. Twenty-five sits between the two. It is the default of `min_gutter`,
# which the caller can move: a page laid out in a tighter grid needs a smaller
# one, and a page with wide word spacing a larger.
MIN_GUTTER = 25.0

# Above this many bands, the page is not a document in columns: it is a table,
# a form or a price list, and reading its bands top to bottom would transpose
# it. Two is the layout a word processor exports; three or more, on a page the
# caller did not typeset, is a grid.
MAX_COLUMNS = 2


def read_text(pdf_bytes, *, pages=None, min_gutter: float = MIN_GUTTER) -> dict:
    """
    The text of the document, page by page, read column by column.

    `columns` in each page's report is how many bands the code found, which is
    what tells a caller that the page was not a simple column of prose. It says
    what was found, not what was done: when those bands are a grid rather than
    columns, the page is read in page order and its `reason` says so.
    Reordering a table transposes it, and a transposed table is a wrong text,
    not an incomplete one.

    `hyphenated_lines` counts the lines that end on a hyphen, because this
    function never glues them back and the caller may want to.
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
            bands = find_columns(words, min_gutter=min_gutter)
            reason = None
            reading = bands
            if len(bands) > MAX_COLUMNS:
                # The bands are kept in `columns`: the caller is told what was
                # found as well as what was done with it.
                reading = [(bands[0][0], bands[-1][1])]
                reason = "this page looks like a table: read in page order"
            blocks = [_column_text(words, band) for band in reading]
            text = "\n\n".join(block for block in blocks if block)
            read.append({"page": number, "columns": len(bands), "text": text,
                         "hyphenated_lines": sum(1 for line in text.split("\n")
                                                 if line.endswith("-")),
                         "reason": reason})
    return {"pages": read, "reason": None}


def find_columns(words, *, min_gutter: float = MIN_GUTTER) -> list:
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
            if gap >= min_gutter and position - gap > start:
                bands.append((left + start, left + position - gap))
                start = position - gap
            gap = 0
        else:
            gap += 1
    bands.append((left + start, right))
    return bands


def _lines_of(words, band) -> list:
    """The words of one band, grouped into lines, top to bottom."""
    middle = [w for w in words if band[0] <= (w["x"] + w["end"]) / 2 < band[1]]
    lines = []
    for word in sorted(middle, key=lambda w: (-w["y"], w["x"])):
        if lines and abs(lines[-1][0]["y"] - word["y"]) <= SAME_LINE:
            lines[-1].append(word)
        else:
            lines.append([word])
    return lines


def _column_text(words, band) -> str:
    """The words of one band, read top to bottom, left to right."""
    return "\n".join(" ".join(word["text"] for word in line)
                     for line in _lines_of(words, band))
