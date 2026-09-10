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

The price is the search itself: no key means, in the worst case, every pair.
A neighbour index earns its place well before the file gets large.
"""

import unicodedata

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.neighbors import NearestNeighbors


def normalise(text: str) -> str:
    """Lower case, strip accents and punctuation, collapse spaces."""
    decomposed = unicodedata.normalize("NFKD", text.lower())
    letters = "".join(c for c in decomposed if not unicodedata.combining(c))
    return " ".join("".join(c if c.isalnum() else " " for c in letters).split())


def record_text(record: dict) -> str:
    """One comparable string per record."""
    return normalise(" ".join(str(value) for value in record.values()))


def find_duplicates(records: list[dict], threshold: float = 0.6) -> list[tuple]:
    """
    Return the pairs `(i, j, score)` that look like the same record.

    `char_wb` keeps n-grams inside word boundaries, so "dupont" and "dupond"
    share most of their slices while "dupont paris" borrows nothing from the
    join between the two words.
    """
    texts = [record_text(record) for record in records]
    if len(texts) < 2:
        return []

    vectors = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 4)).fit_transform(texts)

    # A neighbour index, not a full similarity matrix: the matrix is the thing
    # that stops fitting in memory first.
    index = NearestNeighbors(metric="cosine").fit(vectors)
    distances, neighbours = index.radius_neighbors(vectors, radius=1 - threshold)

    pairs = []
    for i, (row_distances, row_neighbours) in enumerate(zip(distances, neighbours)):
        for distance, j in zip(row_distances, row_neighbours):
            if i < j:
                pairs.append((i, int(j), round(1 - float(distance), 3)))
    return sorted(pairs, key=lambda pair: (-pair[2], pair[0], pair[1]))
