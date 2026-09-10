"""
Flag a comment against a term list, after normalisation, with context.

Rung N0. Deterministic, standard library only, and auditable: every decision
can be traced back to one word in a list you control.

Two things make it usable rather than merely simple.

First, normalisation. Accents and case are spellings of the same word, so they
are folded before matching. Nothing else is touched: folding further would
start inventing matches.

Second, the context window. A term list cannot decide anything on its own, so
the function returns the words around each hit. A human reads the window and
decides. A moderation tool that returns a bare boolean hides the one piece of
evidence its reviewer needs.
"""

import re
import unicodedata

# Letters and digits, in any script. Punctuation and underscores separate.
TOKEN = re.compile(r"[^\W_]+")


def normalise(text: str) -> str:
    """Fold case and strip accents, so one entry matches its spellings."""
    decomposed = unicodedata.normalize("NFKD", text.casefold())
    return "".join(c for c in decomposed if not unicodedata.combining(c))


def review(text: str, terms, window: int = 3) -> dict:
    """
    Return every listed term found in `text`, with the words around it.

    `terms` is yours: the list is policy, not code, and it belongs outside the
    function that applies it.

    `window` is a number of words on each side. Widen it when your reviewers
    keep asking what the comment was about.
    """
    listed = {normalise(t) for t in terms}
    words = TOKEN.findall(text)
    matches = []
    for position, word in enumerate(words):
        if normalise(word) in listed:
            start = max(0, position - window)
            matches.append({
                "term": normalise(word),
                "position": position,
                "context": " ".join(words[start:position + window + 1]),
            })
    return {"flagged": bool(matches), "matches": matches}
