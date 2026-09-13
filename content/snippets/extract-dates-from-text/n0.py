"""
Extract dates from text: one regular expression per format, then a real
calendar check.

Rung N0. Deterministic, standard library only, and the whole of it fits on a
screen.

The regular expression is the easy half. It finds three groups of digits and
knows nothing else: 31/02/2024 matches it perfectly, and so does 29/02/2023.
The second half is what makes the difference, and it is one line long, because
`datetime.date` already owns the calendar — month lengths, leap years, and the
century rule that makes 1900 a common year.

What the digits cannot say is whether 03/04/2024 is 3 April or 4 March. No
amount of pattern matching settles that, so the caller settles it once.
"""

import re
import unicodedata
from datetime import date

# Month names in French and English, the two a French-language document mixes.
MONTHS = {name: number for number, names in enumerate(
    ("janvier january", "fevrier february", "mars march", "avril april", "mai may",
     "juin june", "juillet july", "aout august", "septembre september",
     "octobre october", "novembre november", "decembre december"), 1) for name in names.split()}

# "3 avril 2024", "1er mars 2024".
TEXTUAL = re.compile(r"(?<!\d)(\d{1,2})(?:er)?\s+([^\W\d_]+)\s+(\d{4})(?!\d)")

# "12/03/2024", "12.03.24", "12-03-2024", and the ISO "2024-03-12". Years are
# two or four digits, never three: that is what keeps "1.2.3" out.
NUMERIC = re.compile(r"(?<!\d)(\d{1,2}|\d{4})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?!\d)")


def _fold(word: str) -> str:
    """Drop accents, so that "février" and "fevrier" reach the same entry."""
    decomposed = unicodedata.normalize("NFKD", word.lower())
    return "".join(c for c in decomposed if not unicodedata.combining(c))


def _to_date(year: int, month: int, day: int) -> date | None:
    """
    Real calendar validation, and the point of this rung.

    A regular expression accepts 31 February; `date` does not. Leap years come
    with it, century rule included.
    """
    try:
        return date(year, month, day)
    except ValueError:
        return None


def _full_year(year: int) -> int:
    """Two-digit years on the usual pivot: 69 reads as 2069, 70 as 1970."""
    return year if year >= 100 else year + (2000 if year < 70 else 1900)


def _read_textual(match: re.Match) -> date | None:
    month = MONTHS.get(_fold(match.group(2)))
    return _to_date(int(match.group(3)), month, int(match.group(1))) if month else None


def _read_numeric(match: re.Match, day_first: bool) -> date | None:
    first, second, third = (int(group) for group in match.groups())
    if len(match.group(1)) == 4:  # ISO order, whatever the local habit is
        return _to_date(first, second, third)
    day, month = (first, second) if day_first else (second, first)
    return _to_date(_full_year(third), month, day)


def extract_dates(text: str, day_first: bool = True) -> list[tuple[str, date]]:
    """
    Return every real date in `text`, as (what was written, what it means).

    `day_first` says how to read 03/04/2024. The digits cannot say, so the
    caller decides once, for a whole document, and lives with it.
    """
    found = []
    for pattern in (TEXTUAL, NUMERIC):
        for match in pattern.finditer(text):
            # A match that overlaps an accepted one is a second reading of the
            # same characters, not a second date.
            if any(start < match.end() and match.start() < end for start, end, _, _ in found):
                continue
            value = _read_textual(match) if pattern is TEXTUAL else _read_numeric(match, day_first)
            if value is not None:
                found.append((match.start(), match.end(), match.group(0), value))
    found.sort(key=lambda item: item[0])
    return [(written, value) for _, _, written, value in found]
