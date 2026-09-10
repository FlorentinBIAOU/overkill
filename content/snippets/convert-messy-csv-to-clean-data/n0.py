"""
Read a messy CSV: detect its dialect, normalise its encoding, coerce its
types, and write down every row it refuses.

Rung N0. Standard library only.

Three jobs, in that order, because each one needs the previous one done.
Bytes have to become text before a delimiter can be counted, and a delimiter
has to be known before a column can be typed.

The third job is the point of the whole snippet. A cleaner that silently drops
the rows it does not understand is worse than no cleaner at all: it hands back
a tidy file and hides the part you needed to look at. Every refusal here says
which line, which column, and why.
"""

import codecs
import csv
import io
import re
from datetime import date

DELIMITERS = (",", ";", "\t", "|")
SAMPLE_LINES = 20

# ---------------------------------------------------------------------------
# 1. Encoding
# ---------------------------------------------------------------------------

BOMS = (
    (codecs.BOM_UTF8, "utf-8-sig"),
    (codecs.BOM_UTF16_LE, "utf-16"),
    (codecs.BOM_UTF16_BE, "utf-16"),
)


def decode_text(data: bytes) -> str:
    """
    Turn bytes into text, guessing only when there is nothing else to go on.

    A byte order mark is a statement about the file, so it wins. Failing that,
    strict UTF-8 either succeeds, and then it is almost certainly right, or
    fails, and the file is one of the single-byte encodings a spreadsheet
    still exports. cp1252 is by far the most common of those.

    UTF-32 is left out on purpose: no spreadsheet writes it, and pretending to
    support an encoding you have never seen in a real file is how a cleaner
    acquires code nobody can test.
    """
    for bom, encoding in BOMS:
        if data.startswith(bom):
            return data.decode(encoding)
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError:
        # Five byte values are undefined in cp1252; replacing them keeps the
        # rest of the file readable and marks the damage where it happened.
        return data.decode("cp1252", errors="replace")


# ---------------------------------------------------------------------------
# 2. Dialect
# ---------------------------------------------------------------------------


def _count_outside_quotes(line: str, delimiter: str, quote: str) -> int:
    """Count delimiters that separate fields, not those sitting inside one."""
    count, inside = 0, False
    for char in line:
        if char == quote:
            inside = not inside
        elif char == delimiter and not inside:
            count += 1
    return count


def detect_dialect(text: str) -> tuple[str, str]:
    """
    Guess the delimiter first, then the quote character.

    In that order, and not the other way round: counting delimiters needs to
    know what a quoted field looks like, but a quote character cannot be
    recognised without a delimiter to anchor it against. So the count assumes
    the usual double quote, and the quote character is then looked for with
    the delimiter in hand.

    The candidate that wins is the one whose count is the same on the most
    lines. A file separated by semicolons whose free-text column is full of
    commas still lands on its feet, because the comma count varies from line
    to line while the semicolon count does not.
    """
    sample = [line for line in text.split("\n")[:SAMPLE_LINES] if line.strip()]
    delimiter, best = ",", (-1.0, -1)
    for candidate in DELIMITERS:
        counts = [_count_outside_quotes(line, candidate, '"') for line in sample]
        if not counts or counts[0] == 0:
            continue  # absent from the header, so it separates nothing
        score = (sum(1 for c in counts if c == counts[0]) / len(counts), counts[0])
        if score > best:
            delimiter, best = candidate, score

    # A quote character only counts when it opens a field: at the start of a
    # line, or straight after the delimiter.
    opens = {}
    for quote in ('"', "'"):
        starts = sum(1 for line in sample if line.startswith(quote))
        opens[quote] = starts + sum(line.count(delimiter + quote) for line in sample)
    return delimiter, "'" if opens["'"] > opens['"'] else '"'


# ---------------------------------------------------------------------------
# 3. Types, and the journal of what did not fit
# ---------------------------------------------------------------------------

_SPACES = re.compile(r"[\s\u00a0\u202f]")
_INTEGER = re.compile(r"[+-]?\d+")
_NUMBER = re.compile(r"[+-]?(?:\d+\.?\d*|\.\d+)")
_ISO_DATE = re.compile(r"(\d{4})-(\d{2})-(\d{2})")
_DAY_FIRST = re.compile(r"(\d{2})[/.](\d{2})[/.](\d{4})")

TRUE_WORDS = frozenset({"true", "yes", "y", "1", "vrai", "oui", "o"})
FALSE_WORDS = frozenset({"false", "no", "n", "0", "faux", "non"})


def _to_integer(raw: str) -> int:
    text = _SPACES.sub("", raw)
    if not _INTEGER.fullmatch(text):
        raise ValueError("not an integer")
    return int(text)


def _to_number(raw: str) -> float:
    """
    Accept the decimal marks a European spreadsheet actually writes.

    When a comma and a dot are both present, the last one is the decimal mark
    and the other groups the thousands. When only a comma is present it is the
    decimal mark, which is the convention across most of the continent.
    """
    text = _SPACES.sub("", raw)
    if "," in text and "." in text:
        grouping = "," if text.rindex(".") > text.rindex(",") else "."
        text = text.replace(grouping, "")
    text = text.replace(",", ".")
    if not _NUMBER.fullmatch(text):
        raise ValueError("not a number")
    return float(text)


def _to_date(raw: str) -> str:
    """Return an ISO date, or refuse. Day-first is assumed outside ISO form."""
    text = raw.strip()
    iso, day_first = _ISO_DATE.fullmatch(text), _DAY_FIRST.fullmatch(text)
    if iso:
        year, month, day = iso.groups()
    elif day_first:
        day, month, year = day_first.groups()
    else:
        raise ValueError("not a date")
    try:
        date(int(year), int(month), int(day))  # rejects 31 February and month 13
    except ValueError as error:
        raise ValueError("not a real date") from error
    return f"{year}-{month}-{day}"


def _to_boolean(raw: str) -> bool:
    text = raw.strip().lower()
    if text in TRUE_WORDS:
        return True
    if text in FALSE_WORDS:
        return False
    raise ValueError("not a true or false value")


COERCERS = {
    "text": lambda raw: raw.strip(),
    "integer": _to_integer,
    "number": _to_number,
    "date": _to_date,
    "boolean": _to_boolean,
}


def _journal(line: int, column: str, reason: str, fields: list[str]) -> dict:
    """One entry of the journal: where, which column, why, and what was read."""
    return {"line": line, "column": column, "reason": reason, "fields": fields}


class Rejected(Exception):
    """One value the schema refuses, carrying the column and the reason."""

    def __init__(self, column: str, reason: str) -> None:
        super().__init__(f"{column}: {reason}")
        self.column = column
        self.reason = reason


def coerce_row(header: list[str], fields: list[str], schema: dict) -> dict:
    """
    Coerce one row, or refuse it at the first value that does not fit.

    First failure wins: a row is refused once, naming the column that caused
    it. Whoever repairs the file then has one thing to look at rather than a
    list of consequences.
    """
    row = {}
    for name, raw in zip(header, fields):
        value = raw.strip()
        if value == "":
            row[name] = None  # an empty cell is missing, not malformed
            continue
        try:
            row[name] = COERCERS[schema.get(name, "text")](value)
        except ValueError as error:
            raise Rejected(name, str(error)) from error
    return row


def clean_csv(data: bytes, schema: dict) -> dict:
    """
    Return the rows that survived, and a journal of everything refused.

    `data` is the raw bytes of the file and `schema` maps a column name to one
    of the keys of COERCERS. A column absent from the schema is kept as text.

    The journal is the whole point. Each entry carries the line, the column
    and the reason, plus the fields as they were read, so the refusal can be
    acted on without opening the file again. Hand it back to whoever produced
    the file, or to rung N3, which repairs those rows and only those.
    """
    text = decode_text(data)
    delimiter, quote = detect_dialect(text)
    reader = csv.reader(io.StringIO(text, newline=""), delimiter=delimiter, quotechar=quote)

    header, rows, rejects, previous = None, [], [], 0
    for fields in reader:
        line, previous = previous + 1, reader.line_num
        if not fields or fields == [""]:
            continue  # a blank line carries nothing, in any dialect
        if header is None:
            header = [name.strip() for name in fields]
            continue
        if len(fields) != len(header):
            plural = "" if len(header) == 1 else "s"
            reason = f"expected {len(header)} field{plural}, found {len(fields)}"
            rejects.append(_journal(line, "", reason, fields))
            continue
        try:
            rows.append(coerce_row(header, fields, schema))
        except Rejected as refusal:
            rejects.append(_journal(line, refusal.column, refusal.reason, fields))
    return {
        "columns": header or [],
        "delimiter": delimiter,
        "quote": quote,
        "rows": rows,
        "rejects": rejects,
    }
