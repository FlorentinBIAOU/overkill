"""
Decide whether 03/04/2024 is 3 April or 4 March, with a light classifier.

Rung N1. A rule still finds the candidates: a date is a shape, and a shape is
what regular expressions are for. The rule here is narrower than the one in N0,
and only covers the all-numeric form with a four-digit year, which is the one
form the ambiguity touches. A document writing its months in letters still
needs N0 beside this.

What no rule can do is read 03/04/2024, because nothing in those digits says
which field is the day. N0 answers by asking the caller to pick one convention
for a whole document, which is wrong the moment a document quotes a supplier
from abroad.

The convention is not in the digits, it is in the prose around them. That is a
classification problem, and a few hundred labelled sentences are enough for it.
The model is small enough to keep beside the code, and the rules still settle
every case they can settle on their own.
"""

import re
from datetime import date

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline

CANDIDATE = re.compile(r"(?<!\d)(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?!\d)")
WINDOW = 40  # characters of context kept on each side of a candidate


def context(text: str, span: tuple[int, int]) -> str:
    """
    The words around a date, with every digit removed.

    Removing the digits is what stops the classifier memorising the dates of
    the training set instead of learning the habits of the prose around them.
    """
    start, end = span
    around = text[max(0, start - WINDOW):start] + " " + text[end:end + WINDOW]
    return re.sub(r"\d+", " ", around).lower()


def train(texts: list[str], labels: list[int]):
    """`labels` is 1 when the text writes the day first, 0 when the month comes first."""
    model = make_pipeline(
        TfidfVectorizer(ngram_range=(1, 2), min_df=1),
        LogisticRegression(class_weight="balanced", max_iter=1000),
    )
    model.fit([context(t, CANDIDATE.search(t).span()) for t in texts], labels)
    return model


def _to_date(year: int, month: int, day: int) -> date | None:
    """Real calendar validation, kept from N0: a regular expression accepts 31 February."""
    try:
        return date(year, month, day)
    except ValueError:
        return None


def extract_dates(model, text: str) -> list[tuple[str, date]]:
    """Return every real date in `text`, reading each one the way its context suggests."""
    found = []
    for match in CANDIDATE.finditer(text):
        first, second, year = (int(group) for group in match.groups())
        if second > 12:  # the second field cannot be a month, so it is a day
            day_first = False
        elif first > 12:  # symmetrically, the first field can only be a day
            day_first = True
        else:  # nothing in the digits decides it, so ask the prose
            day_first = model.predict_proba([context(text, match.span())])[0][1] >= 0.5
        day, month = (first, second) if day_first else (second, first)
        value = _to_date(year, month, day)
        if value is not None:
            found.append((match.group(0), value))
    return found
