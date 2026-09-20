"""
Read the tables of a PDF, and say how they were read.

Rung N0. A table in a PDF is not a table: it is text placed at coordinates,
sometimes with lines drawn around it. Two readings follow from that, and they
are not equally trustworthy.

When the table is ruled, the lines say where the cells are, and reading it is
exact. `pdfplumber` does that here, and it is the one thing this entry does not
write itself: finding the rules, pairing them into a grid and assigning the
words to cells is its job, and it does it well.

When there is no rule, the columns have to be guessed from where the words sit.
That guess is written below, in both languages, so that the two answer the same
thing — there is no equivalent of `pdfplumber` in JavaScript, and its own
fallback cuts a cell wider than its column, turning « Prix HT » into « Prix H ».

Which reading was used is in the report, because the caller should not have to
wonder: `strategy` is « lines » when the page said where the cells were, and
« text » when the code decided.
"""

from __future__ import annotations

import io

# Two words are on the same line if their baselines are within this many
# points. A ten-point font makes a line about twelve points tall, so three is
# generous without merging neighbouring rows.
SAME_LINE = 3.0

# Two words belong to the same cell when the gap between them is no wider than
# this. A space in a ten-point font is under three points; the gap between two
# columns of a table is tens of points. Ten sits between the two.
SAME_CELL = 10.0

# Two cells are in the same column when their left edges are within this.
SAME_COLUMN = 12.0


def read_tables(pdf_bytes, *, pages=None) -> dict:
    """
    Every table of the document, page by page, with the reading that found it.

    `pages` is the list of page numbers to look at, counted from one; left out,
    every page is read.
    """
    try:
        import pdfplumber

        document = pdfplumber.open(io.BytesIO(pdf_bytes))
    except Exception as error:  # noqa: BLE001 - a broken file is an answer too
        return {"tables": [], "reason": f"this file could not be opened as a PDF: {error}"}

    found = []
    with document:
        for number, page in enumerate(document.pages, start=1):
            if pages is not None and number not in pages:
                continue
            ruled = page.extract_tables()
            if ruled:
                found.extend({"page": number, "strategy": "lines", "rows": rows}
                             for rows in ruled)
                continue
            words = [{"text": w["text"], "x": w["x0"], "end": w["x1"], "y": -w["top"]}
                     for w in page.extract_words()]
            rows = group_into_rows(words)
            if rows:
                found.append({"page": number, "strategy": "text", "rows": rows})
    return {"tables": found, "reason": None}


def group_into_rows(words) -> list:
    """
    Words with coordinates, turned into a grid.

    Lines first, by baseline; then the columns, taken from the left edges seen
    across the whole page. A word is never cut: it belongs to the column its
    left edge is nearest, which is what keeps « Prix HT » whole.
    """
    if not words:
        return []

    # Lines, by baseline.
    lines = []
    for word in sorted(words, key=lambda w: (-w["y"], w["x"])):
        if lines and abs(lines[-1][0]["y"] - word["y"]) <= SAME_LINE:
            lines[-1].append(word)
        else:
            lines.append([word])

    # Cells, by the gap between words: « Moulin a cafe » is one cell, and the
    # eighty points that follow it are a column boundary.
    celled = []
    for line in lines:
        cells = []
        for word in line:
            if cells and word["x"] - cells[-1]["end"] <= SAME_CELL:
                cells[-1] = {"text": f"{cells[-1]['text']} {word['text']}",
                             "x": cells[-1]["x"], "end": word["end"]}
            else:
                cells.append(dict(word))
        celled.append(cells)

    # Columns, from the left edges seen across the whole page.
    columns = []
    for x in sorted(cell["x"] for line in celled for cell in line):
        if not columns or x - columns[-1] > SAME_COLUMN:
            columns.append(x)

    grid = []
    for line in celled:
        row = [""] * len(columns)
        for cell in line:
            index = min(range(len(columns)), key=lambda i: abs(columns[i] - cell["x"]))
            row[index] = f"{row[index]} {cell['text']}".strip()
        grid.append(row)
    return grid
