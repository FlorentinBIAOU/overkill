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
    folded = unicodedata.normalize("NFKD", text).upper().lower().translate(FOLD)
    kept = "".join(c for c in folded if unicodedata.category(c) not in DROPPED)
    return " ".join(word for word in kept.split(" ") if word)


def learn(clicks) -> dict:
    """
    Count clicks from pairs of (what was typed, which suggestion was clicked).

    One click teaches something about every prefix of what was typed: whoever
    chose "chaussettes de sport" after typing "chau" also tells us what to
    show at "c" and at "cha".
    """
    model: dict = {}
    for typed, term in clicks:
        typed = normalise(typed)[:MAX_TYPED]
        for length in range(len(typed) + 1):
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
    prefix = normalise(prefix)[:MAX_TYPED]
    ranked = sorted(
        enumerate(candidates),
        key=lambda pair: (-_evidence(model, prefix, pair[1]), pair[0]),
    )
    return [term for _, term in ranked[:limit]]
