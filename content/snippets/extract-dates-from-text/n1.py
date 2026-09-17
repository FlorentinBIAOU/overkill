"""
Read the dates a pattern cannot: a mature date parser.

Rung N1. Rung N0 enumerates the shapes it knows, and a relative deadline has
no shape to enumerate: "dans 15 jours" has to be counted from a date. That
counting, in thirty-odd languages, is what a date parser library does.
`dateparser` here, `chrono-node` in JavaScript: local, free, deterministic,
and installed rather than written.

Two things have to be told to it that a pattern never needed. Which languages
the text may be in — a parser given every language it knows reads more, and
reads more wrongly. And which date to count from: `reference` has no default
here, on purpose, because the date to count from is the date of the document,
not the date of the run. "jeudi prochain" in an email received three weeks ago
is not next Thursday.

A snippet that hands the job to a library inherits the library, not a
specification: the two languages of this page do not have the same parser, and
they do not read the same things. On "3 janv. 2024" `dateparser` answers
3 January 2025 and `chrono-node` answers nothing, where rung N0 answers
3 January 2024 — which is why N0 stays underneath rather than beside. On
"jeudi prochain" they disagree too: 14 March for one, 21 March for the other.
"""

from datetime import date, datetime

from dateparser.search import search_dates

LANGUAGES = ("fr", "en")


def extract_dates(text: str, reference: date, languages=LANGUAGES) -> list[tuple[str, date]]:
    """
    Return every date found in `text`, as (what was written, what it means).

    `reference` is the date the relative expressions count from: the date of
    the document. It is required, because a default would silently be the day
    of the run, and a backlog reprocessed on Monday would move every deadline.

    "PREFER_DATES_FROM: future" is the reading of a deadline: "le 3 janvier" in
    a March document is the next one, not the one gone by.
    """
    if not isinstance(reference, date):
        raise TypeError("reference must be a date: the date of the document, not of the run")
    if not languages:
        # An empty list means "every language it knows" to the library. Asked
        # for nothing, this returns nothing, as the JavaScript version does.
        raise ValueError("at least one language is needed")
    settings = {
        "RELATIVE_BASE": datetime(reference.year, reference.month, reference.day),
        "PREFER_DATES_FROM": "future",
    }
    found = search_dates(text, languages=list(languages), settings=settings)
    return [(written, value.date()) for written, value in found or []]
