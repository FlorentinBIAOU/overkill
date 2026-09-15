"""
Search your own documents with an inverted index and a BM25 you wrote.

Rung N1. Not because the index of N0 is bad — N0 is still the recommendation —
but because the code below is a BM25 you can read, and reading it once tells
you why a document ranked where it did. It does not reproduce FTS5 to the
decimal: the matching rule, the idf, the length and the title weight all
differ, and each is a line you can change.

Three decisions are yours here, and they were the engine's before.

The tokenizer: what counts as a word, which accents are folded, which terms are
dropped. The matching rule: this one keeps any document carrying at least one
term, where FTS5 demands all of them. And the ranking: k1 saturates repetition,
b corrects for document length, and the field weights say how much a title is
worth. Change one and the order changes; that is the point of owning it.
"""

from __future__ import annotations

import math
import unicodedata
from collections import Counter

FIELD_WEIGHTS = {"title": 3.0, "body": 1.0}


def tokenise(text: str) -> list[str]:
    """Lower case, strip accents, keep letters and digits."""
    decomposed = unicodedata.normalize("NFKD", text.lower())
    letters = "".join(c for c in decomposed if not unicodedata.combining(c))
    return "".join(c if c.isalnum() else " " for c in letters).split()


def build_index(documents: list[dict], weights: dict | None = None) -> dict:
    """Build the postings: for each term, the documents carrying it."""
    weights = weights or FIELD_WEIGHTS
    postings: dict[str, dict[str, float]] = {}
    lengths: dict[str, float] = {}
    for document in documents:
        counts: Counter[str] = Counter()
        for field, weight in weights.items():
            for term in tokenise(document.get(field) or ""):  # a NULL column is empty
                counts[term] += weight
        for term, frequency in counts.items():
            postings.setdefault(term, {})[document["id"]] = frequency
        lengths[document["id"]] = sum(counts.values())
    average = sum(lengths.values()) / len(lengths) if lengths else 0.0
    return {"postings": postings, "lengths": lengths, "average_length": average}


def search(index: dict, query: str, limit: int = 5, k1: float = 1.2, b: float = 0.75) -> list[dict]:
    """Return the best matches, best first, each with the score it was given.

    `terms` says what each query word contributed. A ranking nobody can explain
    is a ranking nobody can fix.
    """
    if limit < 0:
        raise ValueError("limit must be zero or more")
    total = len(index["lengths"])
    scores: dict[str, float] = {}
    contributions: dict[str, dict[str, float]] = {}
    # dict.fromkeys keeps the order and drops repeats: a word typed twice is
    # not twice as important.
    for term in dict.fromkeys(tokenise(query)):
        postings = index["postings"].get(term)
        if not postings:
            continue
        # The rarer the term, the more a match on it means.
        idf = math.log(1 + (total - len(postings) + 0.5) / (len(postings) + 0.5))
        for doc_id, frequency in postings.items():
            norm = 1 - b + b * index["lengths"][doc_id] / index["average_length"]
            share = idf * frequency * (k1 + 1) / (frequency + k1 * norm)
            scores[doc_id] = scores.get(doc_id, 0.0) + share
            contributions.setdefault(doc_id, {})[term] = round(share, 4)
    ranked = sorted(scores.items(), key=lambda item: (-item[1], item[0]))
    return [
        {"id": doc_id, "score": round(score, 4), "terms": contributions[doc_id]}
        for doc_id, score in ranked[:limit]
    ]
