"""
Add a vector leg to the full-text search you already have.

Rung N2. N0 and N1 match words. A reader who asks for "vacances" where the
handbook says "congés payés" gets nothing, and that gap is what this rung
exists to close: a self-hosted sentence encoder, built for semantic search,
maps each text to a dense vector, and texts are compared on those vectors
rather than on the words they share.

It closes it in addition, not instead. Keyword search finds what shares the
words and stays silent otherwise; vector search ranks every document, always.
Fusing the two rankings keeps the first keyword result ahead of any page the
keywords did not find, and borrows the reach of the vectors; further down the
list, each leg weighs as much as the other.

What the rung really costs is not the arithmetic below. It is the deployment:
weights to download and load, a process to keep warm, and document vectors to
recompute when a document changes — next to a full-text index the database
already maintains for free.
"""

from __future__ import annotations

import functools
import math
import weakref

# A multilingual model: its card lists French among its languages, and the
# handbook in the tests is French.
MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

# Per encoder, the unit vector of each document text seen in the last search:
# a document is encoded again only once its text has changed.
_document_vectors: weakref.WeakKeyDictionary = weakref.WeakKeyDictionary()


class EncodingFailed(RuntimeError):
    """The encoder could not be run, or returned something unusable."""


@functools.cache
def default_encoder():  # pragma: no cover - loads the weights
    """Loaded once per process, then kept warm."""
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer(MODEL_NAME)


def unit(vector) -> list[float]:
    """Normalise once, so that a cosine is a dot product afterwards."""
    values = [float(v) for v in vector]
    norm = sum(v * v for v in values) ** 0.5
    return [v / norm for v in values] if norm else values


def vector_ranking(query: str, documents: list[dict], encoder) -> list[str]:
    """Rank every document by cosine similarity to the query."""
    texts = [f"{d['title']} {d['body']}" for d in documents]
    known = _document_vectors.get(encoder, {})
    missing = [text for text in dict.fromkeys(texts) if text not in known]
    try:
        # One batched call: the query travels with the documents not yet encoded.
        vectors = [unit(v) for v in encoder.encode(missing + [query])]
    except Exception as error:  # noqa: BLE001 - a model failure is not the caller's fault
        raise EncodingFailed(str(error)) from error
    if len(vectors) != len(missing) + 1:
        raise EncodingFailed(f"{len(vectors)} vectors returned for {len(missing) + 1} texts")
    *fresh, query_vector = vectors
    known = {**known, **dict(zip(missing, fresh))}
    kept = {text: known[text] for text in texts}
    size = len(query_vector)
    if not all(len(v) == size and all(map(math.isfinite, v)) for v in [*kept.values(), query_vector]):
        raise EncodingFailed("vectors of different sizes, or values that are not finite numbers")
    _document_vectors[encoder] = kept

    similarities = [
        (document["id"], sum(x * y for x, y in zip(kept[text], query_vector)))
        for document, text in zip(documents, texts)
    ]
    # Ties are broken on the identifier, so two runs give the same order.
    similarities.sort(key=lambda pair: (-pair[1], pair[0]))
    return [doc_id for doc_id, _ in similarities]


def hybrid_search(query, documents, keyword_ids, encoder=None, *, limit=5, k=60) -> list[dict]:
    """Fuse the ranking your full-text search returned with a vector ranking.

    `keyword_ids` is what N0 already gave you, best first.
    """
    if not documents:
        return []
    if encoder is None:
        encoder = default_encoder()

    # Reciprocal rank fusion: each list votes with 1/(k + rank). Nothing has to
    # be rescaled, because a BM25 score and a cosine are never comparable, and
    # k says how much being second is worth compared with being first.
    scores: dict[str, float] = {}
    for ranking in (list(keyword_ids), vector_ranking(query, documents, encoder)):
        for rank, doc_id in enumerate(ranking, start=1):
            scores[doc_id] = scores.get(doc_id, 0.0) + 1.0 / (k + rank)
    ranked = sorted(scores.items(), key=lambda item: (-item[1], item[0]))
    return [{"id": doc_id, "score": round(score, 6)} for doc_id, score in ranked[:limit]]
