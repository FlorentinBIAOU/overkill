"""
Extract dates from text: one regular expression per format, then a real
calendar check.

Rung N0. Deterministic, standard library only.

The regular expression is the easy half. It finds groups of digits and knows
nothing else: 31/02/2024 matches it perfectly, and so does 29/02/2023. The
second half is what makes the difference, and it is a single call, because
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

# ASCII digits and full-width digits, read the same way in Python and JavaScript.
D = "[0-9０-９]"
# A month name, its accents typed as one character or as a letter plus a mark.
WORD = r"(?P<month>(?:[^\W\d_]|[̀-ͯ])+)"
ORDINAL = "(?:er|st|nd|rd|th)?"

# "3 avril 2024", "1er mars 2024", "3rd April 2024", in any case.
TEXTUAL = re.compile(rf"(?<!{D})(?P<day>{D}{{1,2}}){ORDINAL}\s+{WORD}\s+(?P<year>{D}{{4}})(?!{D})", re.I)

# "March 3, 2024". It only starts at the start of a word, so a long run of
# letters is read once, not once per letter.
MONTH_FIRST = re.compile(
    rf"(?<![^\W\d_]){WORD}\s+(?P<day>{D}{{1,2}}){ORDINAL},?\s+(?P<year>{D}{{4}})(?!{D})", re.I)

# "12/03/2024", "12.03.24", "12-03-2024", and the ISO "2024-03-12". Never a
# piece of a longer dotted number: in "10.1.1.24", "1.1.24" is not a date.
NUMERIC = re.compile(rf"(?<!{D})(?<!{D}[/.-])({D}{{1,2}}|{D}{{4}})[/.-]({D}{{1,2}})[/.-]({D}{{2}}|{D}{{4}})(?![/.-]?{D})")


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


def _full_year(written: str) -> int:
    """Two-digit years as MySQL reads them: 00-69 are 2000-2069, 70-99 are 1970-1999."""
    year = int(written)
    return year if len(written) == 4 else year + (2000 if year < 70 else 1900)


def _read_textual(match: re.Match) -> date | None:
    month = MONTHS.get(_fold(match["month"]))
    return _to_date(int(match["year"]), month, int(match["day"])) if month else None


def _read_numeric(match: re.Match, day_first: bool) -> date | None:
    first, second, third = match.groups()
    if len(first) == 4:  # ISO order, whatever the local habit is
        return _to_date(int(first), int(second), int(third))
    if len(third) == 2 and (len(first) == 1 or len(second) == 1):
        return None  # a short year only with a padded day and month: "version 2.1.24" is no date
    day, month = (first, second) if day_first else (second, first)
    return _to_date(_full_year(third), int(month), int(day))


def extract_dates(text: str, day_first: bool = True) -> list[tuple[str, date]]:
    """
    Return every real date in `text`, as (what was written, what it means).

    `day_first` says how to read 03/04/2024. The digits cannot say, so the
    caller decides once, for a whole document, and lives with it.
    """
    found, taken = [], bytearray(len(text))  # taken: characters already read as a date
    for pattern in (TEXTUAL, MONTH_FIRST, NUMERIC):
        for match in pattern.finditer(text):
            start, end = match.span()
            # A match that overlaps an accepted one is a second reading of the
            # same characters, not a second date.
            if 1 in taken[start:end]:
                continue
            value = _read_numeric(match, day_first) if pattern is NUMERIC else _read_textual(match)
            if value is not None:
                found.append((start, match.group(0), value))
                taken[start:end] = b"\x01" * (end - start)
    found.sort(key=lambda item: item[0])
    return [(written, value) for _, written, value in found]
