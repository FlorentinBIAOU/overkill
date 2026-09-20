"""
A table published in a web page, turned into a rectangular grid.

Rung N0. The rows and the cells are elements the HTML specification names, so
reading them is parsing. What is not parsing is the one thing that makes tables
hard: a cell can span several columns or several rows, and the markup grid is
then not the data grid. « Total » written once over three columns is one cell
in the source and three cells in the table a reader sees.

This rung builds the grid a reader sees. A spanned cell is repeated over the
places it covers, and every repeat is flagged — a caller that adds up a column
would otherwise count the same amount twice without knowing it. The other
choice, leaving holes, misaligns every column after the span, which is worse
because nothing tells you.

Two more things are reported rather than smoothed over. A table inside a cell
of another table is a table of its own: its text does not leak into the cell
that holds it, and the holder is flagged. And the caption, when the page wrote
one, comes back with the grid, because it is usually what the columns mean.
"""

from __future__ import annotations

from html.parser import HTMLParser

CELLS = {"td", "th"}

# The largest span the HTML specification allows: « greater than zero and
# less than or equal to 1000 ». A page can claim more than it draws, and past
# this the claim is capped rather than believed.
MAX_SPAN = 1000


class _Tables(HTMLParser):
    """Tables, rows and cells, with the nesting kept straight."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tables, self._stack = [], []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == "table":
            if self._stack:
                self._stack[-1]["nested"] = True
            table = {"rows": [], "caption": None, "nested": False,
                     "cell": None, "in_caption": False}
            # Listed in the order the page opens them, so a table that holds
            # another comes before it — the order a reader would give.
            self.tables.append(table)
            self._stack.append(table)
        elif not self._stack:
            return
        elif tag == "tr":
            self._stack[-1]["rows"].append([])
        elif tag in CELLS:
            if not self._stack[-1]["rows"]:
                self._stack[-1]["rows"].append([])
            cell = {"text": [], "header": tag == "th",
                    "colspan": _span(values.get("colspan")),
                    "rowspan": _span(values.get("rowspan"))}
            self._stack[-1]["rows"][-1].append(cell)
            self._stack[-1]["cell"] = cell
        elif tag == "caption":
            self._stack[-1]["in_caption"] = True

    def handle_endtag(self, tag):
        if not self._stack:
            return
        if tag == "table":
            self._stack.pop()
        elif tag in CELLS:
            self._stack[-1]["cell"] = None
        elif tag == "caption":
            self._stack[-1]["in_caption"] = False

    def handle_data(self, data):
        if not self._stack:
            return
        top = self._stack[-1]
        if top["in_caption"]:
            top["caption"] = (top["caption"] or "") + data
        elif top["cell"] is not None:
            top["cell"]["text"].append(data)


def extract_tables(html) -> dict:
    """
    Every table of `html`, as the rectangular grid a reader sees.

    A cell that spans is repeated over what it covers, and each repeat says so.
    """
    if not isinstance(html, str):
        return {"tables": [], "reason": f"expected text, not {type(html).__name__}"}
    parser = _Tables()
    parser.feed(html)
    parser.close()

    tables = []
    for table in parser.tables:
        grid = _grid(table["rows"])
        tables.append({"rows": grid, "columns": len(grid[0]) if grid else 0,
                       "caption": " ".join((table["caption"] or "").split()) or None,
                       "nested": table["nested"]})
    return {"tables": tables, "reason": None}


def _grid(rows) -> list:
    """The markup rows, spread over the places their spans cover."""
    grid: list = []
    for index, row in enumerate(rows):
        while len(grid) <= index:
            grid.append([])
        column = 0
        for cell in row:
            while column < len(grid[index]) and grid[index][column] is not None:
                column += 1
            value = {"text": " ".join("".join(cell["text"]).split()),
                     "header": cell["header"], "repeated": False}
            for down in range(cell["rowspan"]):
                while len(grid) <= index + down:
                    grid.append([])
                line = grid[index + down]
                for across in range(cell["colspan"]):
                    while len(line) <= column + across:
                        line.append(None)
                    if line[column + across] is None:
                        line[column + across] = value if (down or across) == 0 else \
                            {**value, "repeated": True}
            column += cell["colspan"]
    width = max((len(line) for line in grid), default=0)
    return [[cell or {"text": "", "header": False, "repeated": False}
             for cell in line + [None] * (width - len(line))] for line in grid]


def _span(value) -> int:
    try:
        return max(1, min(MAX_SPAN, int(str(value))))
    except (TypeError, ValueError):
        return 1
