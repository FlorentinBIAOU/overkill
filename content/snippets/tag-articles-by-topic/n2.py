"""
Zero-shot tagging: compare the article with the labels themselves.

Rung N2. N1 needed a labelled corpus, and a new topic meant labelling it all
again. Here a topic is only a short description, encoded like any other text:
adding one costs a line, and the first article can be tagged the same day.

That is the whole appeal, and it is real. What it costs is a model file to
ship and keep in sync, a warm process to hold it, and a score that is a cosine
rather than a probability — see the test for what that means when you have to
pick one threshold for every topic.
"""

from __future__ import annotations

MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"


def load_encoder(name: str = MODEL_NAME):
    """The real encoder: fetched once, then held in memory and run locally."""
    from sentence_transformers import SentenceTransformer  # pragma: no cover

    return SentenceTransformer(name)


def build_labeller(topics: dict[str, str], encoder=None) -> dict:
    """
    Encode the topic descriptions once, and keep the encoder for the articles.

    `topics` maps a topic name to the sentence that stands for it. Write it as
    a human would say it out loud: the encoder was trained on sentences, and a
    bare keyword gives it very little to work with.

    `encoder` is injected so this can be tested without loading a model. Left
    alone, it is the real one above.
    """
    encoder = load_encoder() if encoder is None else encoder
    names = list(topics)
    vectors = [_unit(v) for v in encoder.encode([topics[name] for name in names])]
    return {"topics": names, "vectors": vectors, "encoder": encoder}


def score(labeller: dict, article: str) -> dict[str, float]:
    """The cosine between the article and each topic description."""
    vector = _unit(labeller["encoder"].encode([article])[0])
    return {
        topic: _dot(known, vector)
        for topic, known in zip(labeller["topics"], labeller["vectors"])
    }


def tag(labeller: dict, article: str, threshold: float = 0.3) -> list[str]:
    """
    Every topic whose description is close enough, best first.

    Multi-label falls out of the shape of the thing: each topic is compared
    with the article on its own, so several can pass, or none.

    The threshold is not a probability. It is a cosine, it has no calibrated
    meaning, and the only way to set it is to try it on articles you have
    already tagged by hand — which is a labelled corpus, the very thing this
    rung was supposed to save you.
    """
    scored = score(labeller, article)
    kept = [topic for topic, value in scored.items() if value >= threshold]
    return sorted(kept, key=lambda topic: (-scored[topic], topic))


def _unit(vector) -> list[float]:
    """Cosine similarity is a dot product once both sides have length one."""
    values = [float(v) for v in vector]
    norm = sum(v * v for v in values) ** 0.5
    return [v / norm for v in values] if norm else values


def _dot(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))
