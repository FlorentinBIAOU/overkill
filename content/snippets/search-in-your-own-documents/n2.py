"""
Add a vector leg to the full-text search you already have.

Rung N2. N0 and N1 match words. A reader who asks for "vacances" where the
handbook says "congés payés" gets nothing, and that gap is what this rung
exists to close: a self-hosted encoder maps text to vectors where two ways of
saying the same thing land close together.

It closes it in addition, not instead. Keyword search is exact when the words
match and silent when they do not; vector search always answers, and is vague.
Fusing the two rankings keeps the precision of the first and borrows the reach
of the second, which is why the entry calls this a complement.

What the rung really costs is not the arithmetic below. It is the deployment: a
few hundred megabytes of weights, a process kept warm, vectors recomputed
whenever a document changes, and a vector index as soon as they stop fitting in
a list — next to a full-text index the database already maintains for free.
"""

from __future__ import annotations

# A multilingual model, because a handbook is rarely written in English.
MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"


class EncodingFailed(RuntimeError):
    """The encoder could not be run, or returned something unusable."""


def unit(vector) -> list[float]:
    """Normalise once, so that a cosine is a dot product afterwards."""
    values = [float(v) for v in vector]
    norm = sum(v * v for v in values) ** 0.5
    return [v / norm for v in values] if norm else values


def vector_ranking(query: str, documents: list[dict], encoder) -> list[str]:
    """Rank every document by cosine similarity to the query."""
    texts = [f"{d['title']} {d['body']}" for d in documents]
    try:
        # One batched call: the query travels with the documents.
        vectors = encoder.encode(texts + [query])
    except Exception as error:  # noqa: BLE001 - a model failure is not the caller's fault
        raise EncodingFailed(str(error)) from error
    if len(vectors) != len(texts) + 1:
        raise EncodingFailed(f"{len(vectors)} vectors returned for {len(texts) + 1} texts")

    *document_vectors, query_vector = [unit(v) for v in vectors]
    similarities = [
        (document["id"], sum(x * y for x, y in zip(vector, query_vector)))
        for document, vector in zip(documents, document_vectors)
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
    if encoder is None:  # pragma: no cover - loads several hundred megabytes
        from sentence_transformers import SentenceTransformer

        encoder = SentenceTransformer(MODEL_NAME)

    # Reciprocal rank fusion: each list votes with 1/(k + rank). Nothing has to
    # be rescaled, because a BM25 score and a cosine are never comparable, and
    # k says how much being second is worth compared with being first.
    scores: dict[str, float] = {}
    for ranking in (list(keyword_ids), vector_ranking(query, documents, encoder)):
        for rank, doc_id in enumerate(ranking, start=1):
            scores[doc_id] = scores.get(doc_id, 0.0) + 1.0 / (k + rank)
    ranked = sorted(scores.items(), key=lambda item: (-item[1], item[0]))
    return [{"id": doc_id, "score": round(score, 6)} for doc_id, score in ranked[:limit]]
