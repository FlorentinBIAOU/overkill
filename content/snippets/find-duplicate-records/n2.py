"""
Find duplicate records with a self-hosted sentence encoder.

Rung N2. N1 compares spellings; two records that say the same thing in
different words share no character n-grams and stay invisible. A sentence
encoder maps each record to a dense vector, the mean of the vectors of its
tokens, and records are compared on those vectors rather than on shared
letters.

What this rung really costs is not the comparison, it is the deployment:
weights to download and load, and a process to keep warm.

The encoder is a parameter with a real default, so the reader sees the loading
code while the test injects a local double.
"""

from __future__ import annotations

import math
import unicodedata

# A multilingual model, because a customer file is rarely in one language.
MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"


class EncodingFailed(RuntimeError):
    """The encoder could not be run, or returned something unusable."""


def normalise(text: str | None) -> str:
    """Lower case, strip accents, invisible characters and punctuation, collapse spaces."""
    decomposed = unicodedata.normalize("NFKD", (text or "").lower())
    # A zero-width space is a format character: dropped, it does not split a word.
    letters = "".join(c for c in decomposed if not unicodedata.combining(c) and unicodedata.category(c) != "Cf")
    return " ".join("".join(c if c.isalnum() else " " for c in letters).split())


def record_text(record: dict) -> str:
    """One comparable string per record; an empty cell adds nothing."""
    return normalise(" ".join(str(value) for value in record.values() if value is not None))


def unit(vector) -> list[float]:
    """Normalise once, so that a cosine is a dot product afterwards."""
    values = [float(v) for v in vector]
    norm = sum(v * v for v in values) ** 0.5
    return [v / norm for v in values] if norm else values


def find_duplicates(records: list[dict], encoder=None, threshold: float = 0.75) -> list[tuple]:
    """Return the pairs `(i, j, score)` that look like the same record."""
    texts = [record_text(record) for record in records]
    if len(texts) < 2:
        return []

    if encoder is None:  # pragma: no cover - loads several hundred megabytes
        from sentence_transformers import SentenceTransformer

        encoder = SentenceTransformer(MODEL_NAME)

    # One batched call. Encoding record by record wastes most of the machine.
    try:
        vectors = [unit(v) for v in encoder.encode(texts)]
    except Exception as error:  # noqa: BLE001 - a model failure is not the caller's fault
        raise EncodingFailed(str(error)) from error
    if len(vectors) != len(texts):
        raise EncodingFailed(f"{len(vectors)} vectors returned for {len(texts)} records")
    if len({len(v) for v in vectors}) != 1 or not all(math.isfinite(x) for v in vectors for x in v):
        raise EncodingFailed("vectors of different sizes, or holding something other than numbers")

    pairs = []
    for i in range(len(vectors)):
        for j in range(i + 1, len(vectors)):
            score = sum(x * y for x, y in zip(vectors[i], vectors[j]))
            # A hair of tolerance: in floating point, two identical records can score just under 1.0.
            if score >= threshold - 1e-9:
                pairs.append((i, j, round(score, 3)))
    return sorted(pairs, key=lambda pair: (-pair[2], pair[0], pair[1]))
