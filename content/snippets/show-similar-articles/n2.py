"""
Related articles from self-hosted document embeddings.

Rung N2. N1 compares words. Two articles that cover the same subject with two
vocabularies, or in two languages, share no term and score exactly zero. The
encoder named below is a multilingual one, trained so that a sentence and its
translation land close together: that is what could bring the French and the
English piece on sourdough together, which the test's local double does not do.
It reads only the start of a long article (128 tokens in Python, 512 in
JavaScript) and truncates the rest.

The table is still built offline, once per corpus change, and it has the same
shape as the one N0 and N1 return: the page-rendering code never changes.
What changes is what the build now runs: a model whose weights are downloaded
once, then loaded each time the table is built.

The encoder is a parameter with a real default, so the reader sees the loading
code while the test injects a local double.
"""

import math

MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"


class EncodingFailed(RuntimeError):
    """The encoder could not be run, or returned something unusable."""


def article_text(article: dict) -> str:
    """One string per article. An encoder wants a sentence, not a bag of words."""
    return f"{article['title'] or ''}. {article['body'] or ''}"  # a NULL column is empty


def unit(vector) -> list[float]:
    """Normalise once, so that a cosine is a dot product afterwards."""
    values = [float(value) for value in vector]
    norm = sum(value * value for value in values) ** 0.5
    return [value / norm for value in values] if norm else values


def build_neighbour_table(articles: list[dict], encoder=None, k: int = 5,
                          minimum: float = 0.0) -> dict:
    """Return `{article id: [(neighbour id, score), ...]}`, best neighbour first."""
    if len(articles) < 2:
        return {article["id"]: [] for article in articles}
    texts = [article_text(article) for article in articles]

    if encoder is None:  # pragma: no cover - downloads and loads the weights
        from sentence_transformers import SentenceTransformer

        encoder = SentenceTransformer(MODEL_NAME)

    # One batched call, over the whole corpus, every time the table is built.
    try:
        vectors = [unit(vector) for vector in encoder.encode(texts)]
    except Exception as error:  # noqa: BLE001 - a model failure is not the caller's fault
        raise EncodingFailed(str(error)) from error
    if len(vectors) != len(texts):
        raise EncodingFailed(f"{len(vectors)} vectors returned for {len(texts)} articles")
    # A NaN would silently empty the table, a short vector would score 1.0 with anything.
    if any(len(v) != len(vectors[0]) or not all(map(math.isfinite, v)) for v in vectors):
        raise EncodingFailed("vectors of different sizes, or values that are not finite numbers")

    table = {}
    for index, article in enumerate(articles):
        neighbours = []
        for position, other in enumerate(articles):
            if position == index:
                continue
            score = round(sum(x * y for x, y in zip(vectors[index], vectors[position])), 3)
            if score > minimum:
                neighbours.append((other["id"], score))
        # Ties broken by identifier, so that two builds give the same page.
        neighbours.sort(key=lambda neighbour: (-neighbour[1], neighbour[0]))
        table[article["id"]] = neighbours[:k]
    return table
