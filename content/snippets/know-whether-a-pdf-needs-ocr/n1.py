"""
Tell a usable text layer from a broken one, on the pages that claim to have one.

Rung N1. Rung N0 counts characters, and a text layer made of the wrong
characters counts just as high: a PDF whose font carries no character map, or a
broken one, extracts as glyph indices read as ASCII — «#$%&'*+,-./0123» where
the page shows a paragraph. N0 calls that page readable and it is not.

Telling language from that is what a character model does, and it is the
smallest one there is: the frequency of each pair of letters. «qu» and «es» are
common in French, «q#» and «&'» are not, and a page scores by how well its
pairs match the pairs of pages you already trust.

Nothing is shipped with this model. `fit` is given the text of your own
readable pages — N0 has just listed them — so the reference is your documents,
in your language, with your vocabulary. The threshold comes from the same
place: the lowest score among the training pages, with a margin, rather than a
number chosen here.

What this cannot do is read. A page of figures, a table of amounts, a form of
short fields: these are real text that no language model of letters will call
language, and the score says so. It separates letters from noise, not sense
from nonsense.
"""

from __future__ import annotations

import math

# The letters this model counts. Anything else — digits, punctuation, symbols
# — becomes a single « other » class, which is exactly what a broken character
# map produces in quantity.
ALPHABET = "abcdefghijklmnopqrstuvwxyzàâäçéèêëîïôöùûüÿœæ "
OTHER = "#"
SYMBOLS = ALPHABET + OTHER

# How far below the worst training page a page may score before it is called
# unreadable.
#
# Half a nat per pair, and the number comes from pages that are NOT in the
# training set: four ordinary French administrative pages — an amendment, an
# article of the civil code, an acknowledgement letter, an invoice heading —
# score between −2.42 and −2.83 against a model fitted on six contract pages
# whose worst is −2.48. The furthest sits 0.35 below it, so three tenths would
# refuse it, and did. Half a nat clears it and still refuses an English page,
# 0.65 below, and a table of amounts, 1.66 below.
#
# It is a default, not a constant: it was measured on six training pages and
# four held-out ones, which is small. Keep a handful of your own readable pages
# out of `fit`, score them, and move this number until they all pass — that is
# the only calibration that says anything about your own documents.
MARGIN = 0.5


def normalise(text: str) -> str:
    """Lower case, and every symbol outside the alphabet folded into one."""
    return "".join(c if c in ALPHABET else OTHER for c in text.lower())


def fit(pages) -> dict:
    """Count the letter pairs of pages you trust, and set the threshold from them."""
    counts = {a: {b: 1 for b in SYMBOLS} for a in SYMBOLS}  # add-one smoothing
    for page in pages:
        clean = normalise(page)
        for first, second in zip(clean, clean[1:]):
            counts[first][second] += 1
    totals = {a: sum(row.values()) for a, row in counts.items()}
    model = {"log_probability": {a: {b: math.log(counts[a][b] / totals[a]) for b in SYMBOLS}
                                 for a in SYMBOLS}}
    scores = [score(page, model) for page in pages]
    if not scores:
        # A model fitted on nothing would answer « readable » to everything,
        # which is the expensive mistake of this entry: a page declared
        # readable that is not one goes into the index empty, and nobody looks
        # at it again.
        raise ValueError("fit needs at least one page you have read yourself")
    model["threshold"] = min(scores) - MARGIN
    return model


def score(text: str, model: dict) -> float:
    """Mean log probability of the letter pairs, or -inf on a page too short."""
    clean = normalise(text)
    pairs = list(zip(clean, clean[1:]))
    if not pairs:
        return float("-inf")
    table = model["log_probability"]
    return sum(table[a][b] for a, b in pairs) / len(pairs)


def is_readable(text: str, model: dict) -> dict:
    """Say whether this text layer looks like the pages the model was fitted on."""
    value = score(text, model)
    return {"readable": value >= model["threshold"], "score": value,
            "threshold": model["threshold"]}
