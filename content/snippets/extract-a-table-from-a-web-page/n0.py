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

# The largest spans the HTML specification allows, and they are not the same
# number: colspan « must be greater than zero and less than or equal to 1000 »,
# rowspan « must be greater than zero and less than or equal to 65534 ». The
# grid-forming algorithm repeats both caps. A page can claim more than it
# draws, and past these the claim is capped rather than believed — `capped` in
# the report counts how often.
MAX_COLSPAN = 1000
MAX_ROWSPAN = 65534

# « For this attribute, the value zero means that the cell is to span all the
# remaining rows in the row group. » Kept as zero here and resolved in `_grid`,
# which is the only place that knows how many rows follow. Row groups are not
# tracked, so « the row group » is read as « the table », which is the same
# thing on a table with one `tbody` — the ordinary case.
TO_END_OF_GROUP = 0


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
                     "cell": None, "in_caption": False, "row_open": False,
                     "capped": 0}
            # Listed in the order the page opens them, so a table that holds
            # another comes before it — the order a reader would give.
            self.tables.append(table)
            self._stack.append(table)
        elif not self._stack:
            return
        elif tag == "tr":
            self._stack[-1]["rows"].append([])
            self._stack[-1]["row_open"] = True
        elif tag in CELLS:
            # « in table body »: a `td` met outside a `tr` opens one. Adding it
            # to the row that just closed would widen every row of the table.
            if not self._stack[-1]["rows"] or not self._stack[-1].get("row_open"):
                self._stack[-1]["rows"].append([])
                self._stack[-1]["row_open"] = True
            cell = {"text": [], "header": tag == "th",
                    "colspan": self._span(values.get("colspan"), MAX_COLSPAN),
                    "rowspan": self._span(values.get("rowspan"), MAX_ROWSPAN,
                                          zero_allowed=True)}
            self._stack[-1]["rows"][-1].append(cell)
            self._stack[-1]["cell"] = cell
        elif tag == "caption":
            self._stack[-1]["in_caption"] = True

    def _span(self, value, largest: int, *, zero_allowed: bool = False) -> int:
        """One span attribute, read as the standard reads it."""
        try:
            number = int(str(value))
        except (TypeError, ValueError):
            return 1
        if zero_allowed and number == 0:
            return TO_END_OF_GROUP
        if number > largest:
            self._stack[-1]["capped"] += 1
            return largest
        return max(1, number)

    def handle_endtag(self, tag):
        if not self._stack:
            return
        if tag == "table":
            self._stack.pop()
        elif tag == "tr":
            self._stack[-1]["row_open"] = False
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
        grid, padded = _grid(table["rows"])
        tables.append({"rows": grid, "columns": len(grid[0]) if grid else 0,
                       # How many cells the rectangular padding added, and how
                       # many spans the caps cut back. Without them, `columns`
                       # says a width and never says where it came from.
                       "padded": padded, "capped": table["capped"],
                       "caption": " ".join((table["caption"] or "").split()) or None,
                       "nested": table["nested"]})
    return {"tables": tables, "reason": None}


def _grid(rows) -> tuple:
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
            # A rowspan of zero covers every row left in the group.
            down_to = (len(rows) - index if cell["rowspan"] == TO_END_OF_GROUP
                       else cell["rowspan"])
            for down in range(down_to):
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
    padded = sum(width - len(line) for line in grid) + sum(
        1 for line in grid for cell in line if cell is None)
    return ([[cell or {"text": "", "header": False, "repeated": False}
              for cell in line + [None] * (width - len(line))] for line in grid], padded)

