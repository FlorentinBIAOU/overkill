"""
Reorder the suggestions with what people actually clicked.

Rung N1. The prefix tree of N0 ranks candidates by how often a term is
searched. That count says what people looked for, not what they picked once
the drop-down opened. Clicks say the second, and they are already in the logs.

The model is a count, not a gradient: for every prefix that was ever typed,
how many times each suggestion was chosen. It trains in one pass over the log
and is read back with dictionary lookups, at most one per prefix length for
each candidate, on a query whose counted length is capped.

The candidates come in as an argument: this rung reorders a list, it does not
retrieve it.
"""

import unicodedata

# Categories M* are the accents NFKD detaches; Cf holds the invisible characters.
DROPPED = {"Mn", "Mc", "Me", "Cf"}
# NFKD has already turned non-breaking spaces into plain ones; these are the
# other spaces. The final sigma is folded by hand: JavaScript keeps it.
FOLD = str.maketrans("\t\n\v\f\rς", "     σ")

# Only the first characters of a query are counted. A pasted paragraph would
# otherwise store one key per prefix, each a copy of the prefix: the memory
# grows with the square of its length, and so does the lookup.
MAX_TYPED = 64


def normalise(text: str) -> str:
    """Same folding as the prefix tree, so both rungs agree on what was typed."""
    # Upper then lower case folds "ß" into "ss", the same way in both languages.
    # "ẞ" is the capital of "ß" and upper-casing leaves it alone; written as
    # "ß" first, the pair folds to "ss" on both sides.
    folded = unicodedata.normalize("NFKD", text.replace("\u1e9e", "ß")).upper().lower().translate(FOLD)
    kept = "".join(c for c in folded if unicodedata.category(c) not in DROPPED)
    return " ".join(word for word in kept.split(" ") if word)


def learn(clicks) -> dict:
    """
    Count clicks from pairs of (what was typed, which suggestion was clicked).

    One click teaches something about every prefix of what was typed, from the
    first letter on: whoever chose "chaussettes de sport" after typing "chau"
    also tells us what to show at "c" and at "cha". The empty prefix is left
    out on purpose: counted, one click made under any query at all would move
    its term to the top of every other query.

    Nothing here decays and nothing is windowed: a term that was clicked a lot
    two years ago keeps its lead for good.
    """
    model: dict = {}
    for typed, term in clicks:
        typed = normalise(typed)[:MAX_TYPED]
        for length in range(1, len(typed) + 1):
            key = (typed[:length], term)
            model[key] = model.get(key, 0) + 1
    return model


def _evidence(model: dict, prefix: str, term: str) -> int:
    """
    Clicks recorded for the longest prefix of the query that saw this term.

    Backing off matters: a rare prefix has too few clicks of its own, but it
    shares its first letters with past queries that do. The longer
    the matching prefix, the more specific the evidence, hence the weight.
    """
    for length in range(len(prefix), 0, -1):
        clicked = model.get((prefix[:length], term), 0)
        if clicked:
            return clicked * (length + 1)
    return 0


def rerank(model: dict, prefix: str, candidates, limit: int = 5) -> list[str]:
    """
    Sort candidates by past clicks, keeping their incoming order as tie-break.

    Candidates arrive ordered by search frequency, as the previous rung left
    them. A term nobody ever clicked keeps that order.

    What that does not make it is safe on a thin log. Clicks are counted, not
    weighed: one click recorded under "c" puts its term at the top of every
    query that starts with a "c", ahead of terms drawn from thousands of
    searches. And the clicks come from the list this very ranking produced —
    the top suggestions get clicked because they are at the top, and the count
    then hardens the order it was meant to correct.
    """
    prefix = normalise(prefix)[:MAX_TYPED]
    ranked = sorted(
        enumerate(candidates),
        key=lambda pair: (-_evidence(model, prefix, pair[1]), pair[0]),
    )
    return [term for _, term in ranked[:limit]]
