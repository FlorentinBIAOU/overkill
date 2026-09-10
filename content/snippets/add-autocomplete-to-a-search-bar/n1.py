"""
Reorder the suggestions with what people actually clicked.

Rung N1. The prefix tree of N0 ranks candidates by how often a term is
searched. That count says what people looked for, not what they picked once
the drop-down opened. Clicks say the second, and they are already in the logs.

The model is a count, not a gradient: for every prefix that was ever typed,
how many times each suggestion was chosen. It trains in one pass over the log
and is read back with a dictionary lookup, which is what a suggestion budget
of a few milliseconds per keystroke allows.

The candidates come in as an argument: this rung reorders a list, it does not
retrieve it.
"""

import unicodedata


def normalise(text: str) -> str:
    """Same folding as the prefix tree, so both rungs agree on what was typed."""
    decomposed = unicodedata.normalize("NFD", text.casefold())
    return "".join(c for c in decomposed if not unicodedata.combining(c))


def learn(clicks) -> dict:
    """
    Count clicks from pairs of (what was typed, which suggestion was clicked).

    One click teaches something about every prefix of what was typed: whoever
    chose "chaussettes de sport" after typing "chau" also tells us what to
    show at "c" and at "cha".
    """
    model: dict = {}
    for typed, term in clicks:
        typed = normalise(typed)
        for length in range(len(typed) + 1):
            key = (typed[:length], term)
            model[key] = model.get(key, 0) + 1
    return model


def _evidence(model: dict, prefix: str, term: str) -> int:
    """
    Clicks recorded for the longest prefix of the query that saw this term.

    Backing off matters: a rare prefix has too few clicks of its own, but it
    shares its first letters with hundreds of past queries that do. The longer
    the matching prefix, the more specific the evidence, hence the weight.
    """
    for length in range(len(prefix), -1, -1):
        clicked = model.get((prefix[:length], term), 0)
        if clicked:
            return clicked * (length + 1)
    return 0


def rerank(model: dict, prefix: str, candidates, limit: int = 5) -> list[str]:
    """
    Sort candidates by past clicks, keeping their incoming order as tie-break.

    Candidates arrive ordered by search frequency, as the previous rung left
    them. A term nobody ever clicked keeps that order: the model only moves
    what it has evidence about, which is what makes it safe to ship on a log
    that is still thin.
    """
    prefix = normalise(prefix)
    ranked = sorted(
        enumerate(candidates),
        key=lambda pair: (-_evidence(model, prefix, pair[1]), pair[0]),
    )
    return [term for _, term in ranked[:limit]]
