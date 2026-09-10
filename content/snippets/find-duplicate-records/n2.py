"""
Find duplicate records with a self-hosted sentence encoder.

Rung N2. N1 compares spellings; two records that say the same thing in
different words share no character n-grams and stay invisible. A sentence
encoder maps each record to a vector where "Société Nationale des Chemins de
Fer" and "SNCF" can land close together, because the model was trained on text
where they occur in the same places.

What this rung really costs is not the comparison, it is the deployment: a few
hundred megabytes of weights to load, a process to keep warm, and a vector
index once the file no longer fits in a list.

The encoder is a parameter with a real default, so the reader sees the loading
code while the test injects a local double.
"""

from __future__ import annotations

import unicodedata

# A multilingual model, because a customer file is rarely in one language.
MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"


class EncodingFailed(RuntimeError):
    """The encoder could not be run, or returned something unusable."""


def normalise(text: str) -> str:
    """Lower case, strip accents and punctuation, collapse spaces."""
    decomposed = unicodedata.normalize("NFKD", text.lower())
    letters = "".join(c for c in decomposed if not unicodedata.combining(c))
    return " ".join("".join(c if c.isalnum() else " " for c in letters).split())


def record_text(record: dict) -> str:
    """One comparable string per record."""
    return normalise(" ".join(str(value) for value in record.values()))


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

    pairs = []
    for i in range(len(vectors)):
        for j in range(i + 1, len(vectors)):
            score = sum(x * y for x, y in zip(vectors[i], vectors[j]))
            if score >= threshold:
                pairs.append((i, j, round(score, 3)))
    return sorted(pairs, key=lambda pair: (-pair[2], pair[0], pair[1]))
