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
    strict UTF-8 either succeeds, and the file is read as UTF-8, or
    fails, and the file is read as cp1252, the Windows single-byte encoding
    for Western European languages. cp1252 and not Latin-1, which has no euro
    sign: a price column would come back with a control character in it.

    UTF-32, and UTF-16 without a mark, are not decoded: they come out full of
    NUL characters, and `clean_csv` refuses such a file in its journal.
    """
    for bom, encoding in BOMS:
        if data.startswith(bom):
            return data.decode(encoding, errors="replace")
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

    The sample is twenty physical lines, not twenty records, because the
    records cannot be cut out before the dialect is known. A quoted field that
    holds line breaks — an address, a comment — is therefore counted line by
    line: a file made of such fields is judged on very few of its records.
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

    # A quote character only counts when it both opens fields (at the start of
    # a line, or straight after the delimiter) and closes them (straight before
    # the delimiter, or at the end of a line). A lone apostrophe in front of a
    # value opens and closes nothing.
    wraps = {}
    for quote in ('"', "'"):
        lines = [line.rstrip("\r") for line in sample]
        opens = sum(line.startswith(quote) + line.count(delimiter + quote) for line in lines)
        closes = sum(line.endswith(quote) + line.count(quote + delimiter) for line in lines)
        wraps[quote] = min(opens, closes)
    return delimiter, "'" if wraps["'"] > wraps['"'] else '"'


# ---------------------------------------------------------------------------
# 3. Types, and the journal of what did not fit
# ---------------------------------------------------------------------------

# ASCII digits only, as in JavaScript: "١٢" is refused rather than read as 12.
_SPACES = re.compile(r"[\s\u00a0\u202f]")
_INTEGER = re.compile(r"[+-]?[0-9]+")
_NUMBER = re.compile(r"[+-]?(?:[0-9]+\.?[0-9]*|\.[0-9]+)")
_ISO_DATE = re.compile(r"([0-9]{4})-([0-9]{2})-([0-9]{2})")
_DAY_FIRST = re.compile(r"([0-9]{2})[/.]([0-9]{2})[/.]([0-9]{4})")
# "1,234": one mark, three digits after it, at most three before. Reads as a
# thousands group or as a decimal, and nothing in the value says which.
_GROUPED = re.compile(r"[+-]?[0-9]{1,3}[,.][0-9]{3}")

TRUE_WORDS = frozenset({"true", "yes", "y", "1", "vrai", "oui", "o"})
FALSE_WORDS = frozenset({"false", "no", "n", "0", "faux", "non"})


def _to_integer(raw: str) -> int:
    text = _SPACES.sub("", raw)
    if not _INTEGER.fullmatch(text):
        raise ValueError("not an integer")
    return int(text)


def _to_number(raw: str, decimal: str | None = None) -> float:
    """
    Read a number, and refuse rather than guess when the mark is ambiguous.

    `decimal` is the convention of the file, declared by the caller: "," or
    ".". Three cases, in order:

    - both marks present, or the same mark twice: the shape settles it. The
      last mark of the two is the decimal one, a mark repeated only groups;
    - one mark, followed by exactly three digits, with at most three before:
      "12,500" is 12.5 under one convention and 12500 under the other. Without
      `decimal`, the value goes to the journal rather than being divided by a
      thousand in silence;
    - one mark that cannot group, because the digits do not fall in threes:
      "12,50" is 12.5 whoever wrote it.

    A mark that contradicts the declared convention is refused too: under
    `decimal="."`, "12,50" is not a number, it is a file read with the wrong
    convention.
    """
    text = _SPACES.sub("", raw)
    if decimal not in (None, ",", "."):
        raise ValueError("decimal must be ',' or '.'")
    marks = [mark for mark in (",", ".") if mark in text]
    if len(marks) == 2:
        point = "," if text.rindex(",") > text.rindex(".") else "."
    elif len(marks) == 1 and text.count(marks[0]) > 1:
        point = None  # repeated, so it groups thousands: "1,234,567"
    elif len(marks) == 1 and _GROUPED.fullmatch(text):
        if decimal is None:
            raise ValueError("ambiguous decimal mark: declare decimal=',' or decimal='.'")
        point = marks[0] if marks[0] == decimal else None
    else:
        point = marks[0] if marks else None
    if decimal is not None and point is not None and point != decimal:
        raise ValueError(f"decimal mark is not the {decimal!r} declared for the file")
    grouping = {",", "."} - {point}
    for mark in grouping:
        text = text.replace(mark, "")
    if point:
        text = text.replace(point, ".")
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


# Every coercer takes the declared decimal mark, so that the signature does
# not depend on the type: only `_to_number` has anything to do with it.
COERCERS = {
    "text": lambda raw, decimal: raw.strip(),
    "integer": lambda raw, decimal: _to_integer(raw),
    "number": _to_number,
    "date": lambda raw, decimal: _to_date(raw),
    "boolean": lambda raw, decimal: _to_boolean(raw),
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


def coerce_row(
    header: list[str], fields: list[str], schema: dict, decimal: str | None = None
) -> dict:
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
            row[name] = COERCERS[schema.get(name, "text")](value, decimal)
        except ValueError as error:
            raise Rejected(name, str(error)) from error
    return row


def _unreadable(error: csv.Error) -> str:
    """Name what the csv module could not read, in words both versions share."""
    message = str(error)
    if "end of data" in message:
        return "quote opened and never closed"
    if "field limit" in message:
        return f"field longer than {csv.field_size_limit()} characters"
    return "text after a closing quote"


def read_records(text: str, delimiter: str, quote: str):
    """
    Yield `(line, fields, problem)` for each record, `problem` being None when
    the record was read.

    A record the csv module cannot read is refused with the line it starts on,
    and reading resumes on the next line. Without that, one quote opened and
    never closed swallows the rest of the file into a single field.
    """
    lines = io.StringIO(text, newline="").readlines()
    done = 0
    while done < len(lines):
        rest = (lines[k] for k in range(done, len(lines)))
        reader = csv.reader(rest, delimiter=delimiter, quotechar=quote, strict=True)
        previous = 0
        try:
            for fields in reader:
                yield done + previous + 1, fields, None
                previous = reader.line_num
            return
        except csv.Error as error:
            start = done + previous
            yield start + 1, [lines[start].rstrip("\r\n")], _unreadable(error)
            done = start + 1


def clean_csv(data: bytes, schema: dict, decimal: str | None = None) -> dict:
    """
    Return the rows that survived, and a journal of everything refused.

    `data` is the raw bytes of the file and `schema` maps a column name to one
    of the keys of COERCERS. A column absent from the schema is kept as text.
    `decimal` declares the decimal mark of the file, "," or "."; without it a
    value that the two conventions read differently is refused to the journal.

    The journal is the whole point. Each entry carries the line, the column
    and the reason, plus the fields as they were read, so the refusal can be
    acted on without opening the file again. Hand it back to whoever produced
    the file, or to rung N3, which repairs those rows and only those.
    """
    text = decode_text(data)
    delimiter, quote = detect_dialect(text)
    if "\x00" in text:
        reason = "NUL characters: UTF-16 without a byte order mark, or UTF-32, not read"
        return {"columns": [], "delimiter": delimiter, "quote": quote, "rows": [],
                "rejects": [_journal(1, "", reason, [])]}

    header, rows, rejects, twice = None, [], [], []
    for line, fields, problem in read_records(text, delimiter, quote):
        if problem:
            rejects.append(_journal(line, "", problem, fields))
            continue
        if not fields or fields == [""]:
            continue  # a blank line carries nothing, in any dialect
        if header is None:
            header = [name.strip() for name in fields]
            twice = sorted({name for name in header if header.count(name) > 1})
            continue
        if twice:  # a row keyed by name would lose one of the two values
            rejects.append(_journal(line, twice[0], "column name used twice", fields))
            continue
        if len(fields) != len(header):
            plural = "" if len(header) == 1 else "s"
            reason = f"expected {len(header)} field{plural}, found {len(fields)}"
            rejects.append(_journal(line, "", reason, fields))
            continue
        try:
            rows.append(coerce_row(header, fields, schema, decimal))
        except Rejected as refusal:
            rejects.append(_journal(line, refusal.column, refusal.reason, fields))
    return {
        "columns": header or [],
        "delimiter": delimiter,
        "quote": quote,
        "rows": rows,
        "rejects": rejects,
    }
