"""
Find duplicate records by comparing spelling, not strings.

Rung N1. The blocking key of N0 decides in advance which pairs deserve a look,
and everything it puts in two different groups stays invisible. This rung
drops the key: every record becomes a vector of its character n-grams, and
neighbours are looked up by cosine.

Why character n-grams rather than words: they survive a typo, a swapped word
order and a truncated field, because a misspelt word still shares most of its
three-letter slices with the correct one. Nothing here is learnt from a corpus
and there is no model to train. It is a weighting scheme and a distance.

The price is the search itself: no key means every pair of the file is
scored.
"""

import unicodedata

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.neighbors import NearestNeighbors


def normalise(text: str | None) -> str:
    """Lower case, strip accents, invisible characters and punctuation, collapse spaces."""
    decomposed = unicodedata.normalize("NFKD", (text or "").lower())
    # A zero-width space is a format character: dropped, it does not split a word.
    letters = "".join(c for c in decomposed if not unicodedata.combining(c) and unicodedata.category(c) != "Cf")
    return " ".join("".join(c if c.isalnum() else " " for c in letters).split())


def record_text(record: dict) -> str:
    """One comparable string per record; an empty cell adds nothing."""
    return normalise(" ".join(str(value) for value in record.values() if value is not None))


def find_duplicates(records: list[dict], threshold: float = 0.6) -> list[tuple]:
    """
    Return the pairs `(i, j, score)` that look like the same record.

    `char_wb` keeps n-grams inside word boundaries, so "dupont" and "dupond"
    share most of their slices while "dupont paris" borrows nothing from the
    join between the two words.
    """
    texts = [record_text(record) for record in records]
    if sum(1 for text in texts if text) < 2:
        return []  # fewer than two records with something to compare

    vectors = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 4)).fit_transform(texts)

    # Every neighbour within the radius, for every record. The radius takes a
    # hair more than 1 - threshold: a cosine computed in floating point can land
    # just under 1.0 for two identical records.
    index = NearestNeighbors(metric="cosine").fit(vectors)
    distances, neighbours = index.radius_neighbors(vectors, radius=1 - threshold + 1e-9)

    pairs = []
    for i, (row_distances, row_neighbours) in enumerate(zip(distances, neighbours)):
        for distance, j in zip(row_distances, row_neighbours):
            if i < j:
                pairs.append((i, int(j), round(1 - float(distance), 3)))
    return sorted(pairs, key=lambda pair: (-pair[2], pair[0], pair[1]))
