"""
Extract dates from text: one regular expression per format, then a real
calendar check.

Rung N0. Deterministic, standard library only.

The regular expression is the easy half. It finds groups of digits and knows
nothing else: 31/02/2024 matches it perfectly, and so does 29/02/2023. The
second half is what makes the difference, and it is a single call, because
`datetime.date` already owns the calendar — month lengths, leap years, and the
century rule that makes 1900 a common year.

What the digits cannot say is whether 03/04/2024 is 3 April or 4 March. The
document usually says it somewhere else: one date in it whose first field is
above twelve can only be day-first, and that settles every other date of the
same document. Failing that, the caller may know the locale of the sender.
Failing that too, the snippet abstains: the date comes back without a day
rather than with a guess in the shape of a fact.
"""

import re
import unicodedata
from datetime import date

# Month names in French and English, the two a French-language document mixes,
# with the abbreviations an invoice, a delivery note or an email actually use.
MONTHS = {name: number for number, names in enumerate(
    ("janvier january janv jan", "fevrier february fevr fev feb", "mars march mar",
     "avril april avr apr", "mai may", "juin june jun", "juillet july juil jul",
     "aout august aou aug", "septembre september sept sep",
     "octobre october oct", "novembre november nov", "decembre december dec"), 1)
    for name in names.split()}

# ASCII digits and full-width digits, read the same way in Python and JavaScript.
D = "[0-9０-９]"
# A month name, its accents typed as one character or as a letter plus a mark.
WORD = r"(?P<month>(?:[^\W\d_]|[̀-ͯ])+)"
ORDINAL = "(?:er|st|nd|rd|th)?"

# "3 avril 2024", "1er mars 2024", "3rd April 2024", "3 janv. 2024",
# "3 April, 2024", in any case. The full stop of an abbreviation and the comma
# that often follows the month are both optional.
TEXTUAL = re.compile(
    rf"(?<!{D})(?P<day>{D}{{1,2}}){ORDINAL}\s+{WORD}\.?,?\s+(?P<year>{D}{{4}})(?!{D})", re.I)

# "March 3, 2024", "Mar 3, 2024". It only starts at the start of a word — and
# a combining mark is not the start of a word — so a long run of letters or of
# marks is read once, not once per character.
MONTH_FIRST = re.compile(
    rf"(?<![^\W\d_])(?<![\u0300-\u036f]){WORD}\.?\s+(?P<day>{D}{{1,2}}){ORDINAL},?\s+(?P<year>{D}{{4}})(?!{D})",
    re.I)

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
    """
    Two-digit years as MySQL reads them: 00-69 are 2000-2069, 70-99 are 1970-1999.

    The pivot is right for deadlines and wrong for birth dates: "12/03/65"
    comes out 2065. A field that holds dates of birth wants its own rule.
    """
    year = int(written)
    return year if len(written) == 4 else year + (2000 if year < 70 else 1900)


def _read_textual(match: re.Match) -> date | None:
    month = MONTHS.get(_fold(match["month"]))
    return _to_date(int(match["year"]), month, int(match["day"])) if month else None


UNDECIDED = object()  # a date whose day nothing in the document settles


def _fields_of(match: re.Match) -> tuple[str, str, str] | None:
    """The three numeric fields, or None when the match is not a date at all."""
    first, second, third = match.groups()
    if len(third) == 2 and (len(first) == 1 or len(second) == 1):
        return None  # a short year only with a padded day and month: "version 2.1.24" is no date
    return first, second, third


def document_convention(text: str) -> bool | None:
    """
    Read the day-month convention off the document itself.

    A numeric date whose first field is above twelve can only be day-first;
    one whose second field is above twelve can only be month-first. A single
    such date settles every ambiguous date of the same document, which is what
    a person does when reading it. A document that carries both kinds
    contradicts itself and settles nothing.

    Returns True for day-first, False for month-first, None when the document
    is silent or contradicts itself.
    """
    convention = None
    for match in NUMERIC.finditer(text):
        fields = _fields_of(match)
        if fields is None or len(fields[0]) == 4:
            continue  # ISO carries its own order and proves nothing about the rest
        first, second, _ = (int(field) for field in fields)
        proof = True if first > 12 else False if second > 12 else None
        if proof is None:
            continue
        if convention is not None and convention != proof:
            return None
        convention = proof
    return convention


def _read_numeric(match: re.Match, day_first: bool | None):
    fields = _fields_of(match)
    if fields is None:
        return None
    first, second, third = fields
    if len(first) == 4:  # ISO order, whatever the local habit is
        return _to_date(int(first), int(second), int(third))
    settled = True if int(first) > 12 else False if int(second) > 12 else day_first
    if settled is None:
        return UNDECIDED
    day, month = (first, second) if settled else (second, first)
    return _to_date(_full_year(third), int(month), int(day))


def extract_dates(text: str, day_first: bool | None = None) -> list[tuple[str, date | None]]:
    """
    Return every real date in `text`, as (what was written, what it means).

    `day_first` says how to read 03/04/2024 when the document does not. Left
    out, the convention is read from the document itself, once, and applied to
    all of it: see `document_convention`. Passed, it is the caller's own
    knowledge — the locale of the sender, the country of the supplier — and it
    wins over nothing, because the document's own proof is stronger and is
    applied date by date before it.

    A date the document does not settle and the caller did not settle comes
    back with None instead of a day. That is the point: a guess in the shape
    of a fact is worse than a hole, because nothing downstream can tell the
    two apart.
    """
    if day_first is None:
        day_first = document_convention(text)
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
                found.append((start, match.group(0), None if value is UNDECIDED else value))
                taken[start:end] = b"\x01" * (end - start)
    found.sort(key=lambda item: item[0])
    return [(written, value) for _, written, value in found]
