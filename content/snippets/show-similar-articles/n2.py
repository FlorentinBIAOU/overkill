"""
Related articles from self-hosted document embeddings.

Rung N2. N1 compares words. Two articles that cover the same subject with two
vocabularies, or in two languages, share no term and score exactly zero. An
encoder maps each article to a vector where meaning, not spelling, decides the
distance, so the French and the English piece on sourdough can land together.

The table is still built offline, once per corpus change, and it has the same
shape as the one N0 and N1 return: the page-rendering code never changes.
What changes is what you now run — a few hundred megabytes of weights, a
process to keep warm, and a vector index once the corpus outgrows a list.

The encoder is a parameter with a real default, so the reader sees the loading
code while the test injects a local double.
"""

MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"


class EncodingFailed(RuntimeError):
    """The encoder could not be run, or returned something unusable."""


def article_text(article: dict) -> str:
    """One string per article. An encoder wants a sentence, not a bag of words."""
    return f"{article['title']}. {article['body']}"


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

    if encoder is None:  # pragma: no cover - loads several hundred megabytes
        from sentence_transformers import SentenceTransformer

        encoder = SentenceTransformer(MODEL_NAME)

    # One batched call. Encoding article by article wastes most of the machine,
    # and this runs over the whole corpus every time an article is published.
    try:
        vectors = [unit(vector) for vector in encoder.encode(texts)]
    except Exception as error:  # noqa: BLE001 - a model failure is not the caller's fault
        raise EncodingFailed(str(error)) from error
    if len(vectors) != len(texts):
        raise EncodingFailed(f"{len(vectors)} vectors returned for {len(texts)} articles")

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
