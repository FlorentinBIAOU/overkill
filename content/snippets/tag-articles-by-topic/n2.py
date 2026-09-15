"""
Zero-shot tagging: compare the article with the labels themselves.

Rung N2. N1 needed a labelled corpus, and a new topic meant labelling it all
again. Here a topic is only a short description, encoded like any other text:
adding one costs a line, and the first article can be tagged the same day.

That is the whole appeal, and it is real. What it costs is a model file to
ship and keep in sync, a warm process to hold it, and a score that is a cosine
rather than a probability: it can be negative, the topics of one article do
not add up to one, and a single threshold has to serve every topic.
"""

from __future__ import annotations

import re

import numpy as np

MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

# The encoder reads 128 tokens and silently drops the rest (`max_seq_length`
# in the model's sentence_bert_config.json). With its tokenizer, 400 characters
# of French prose come to 110 tokens, so the article is encoded in passages of
# that size. Text the tokenizer cuts finer, code or a table, can still overflow.
PASSAGE_CHARACTERS = 400

SENTENCE_END = re.compile(r"(?<=[.!?])\s+|\s*\n\s*")


def load_encoder(name: str = MODEL_NAME):
    """The real encoder: fetched once, then held in memory and run locally."""
    from sentence_transformers import SentenceTransformer  # pragma: no cover

    return SentenceTransformer(name)


def build_labeller(topics: dict[str, str], encoder=None) -> dict:
    """
    Encode the topic descriptions once, and keep the encoder for the articles.

    `topics` maps a topic name to the sentence that stands for it. Write it as
    a human would say it out loud: the model card describes an encoder of
    sentences and paragraphs.

    `encoder` is injected so this can be tested without loading a model. Left
    alone, it is the real one above.
    """
    encoder = load_encoder() if encoder is None else encoder
    names = list(topics)
    vectors = _encode(encoder, [topics[name] for name in names])
    return {"topics": names, "vectors": vectors, "encoder": encoder}


def passages(article: str, size: int = PASSAGE_CHARACTERS) -> list[str]:
    """Consecutive sentences joined into pieces of at most `size` characters."""
    pieces: list[str] = []
    for sentence in filter(None, (s.strip() for s in SENTENCE_END.split(article.strip()))):
        if pieces and len(pieces[-1]) + 1 + len(sentence) <= size:
            pieces[-1] = f"{pieces[-1]} {sentence}"
        else:
            pieces.append(sentence)  # a sentence longer than `size` stays whole
    return pieces


def score(labeller: dict, article: str) -> dict[str, float]:
    """
    The best cosine, over the passages of the article, with each topic
    description: a topic covered in one paragraph counts.
    """
    pieces, known = passages(article), labeller["vectors"]
    if not pieces or not labeller["topics"]:
        return {topic: 0.0 for topic in labeller["topics"]}
    vectors = _encode(labeller["encoder"], pieces)
    if vectors.shape[1] != known.shape[1]:
        raise ValueError("the encoder returned vectors of another width for the article")
    # One row per passage, one column per topic: a matrix of cosines.
    best = (vectors @ known.T).max(axis=0)
    return {topic: float(value) for topic, value in zip(labeller["topics"], best)}


def tag(labeller: dict, article: str, threshold: float = 0.3) -> list[str]:
    """
    Every topic whose description is close enough, best first.

    Multi-label falls out of the shape of the thing: each topic is compared
    with the article on its own, so several can pass, or none.

    The threshold is not a probability. It is a cosine, it has no calibrated
    meaning, and choosing it by its effect on errors takes articles whose
    topics are already known — a labelled corpus, the very thing this rung was
    supposed to save you.
    """
    scored = score(labeller, article)
    kept = [topic for topic, value in scored.items() if value >= threshold]
    return sorted(kept, key=lambda topic: (-scored[topic], topic))


def _encode(encoder, texts: list[str]) -> np.ndarray:
    """
    One row of length one per text, or an error: a wrong count, a ragged
    table or a non-number is not a score. Cosine similarity is a dot product
    once both sides have length one.
    """
    raw = encoder.encode(texts)
    if len(raw) != len(texts):
        raise ValueError("the encoder returned a vector count that does not match the texts")
    if not texts:
        return np.zeros((0, 0))
    vectors = np.asarray(raw, dtype=float)  # raises on rows of different widths
    if vectors.ndim != 2 or not np.isfinite(vectors).all():
        raise ValueError("the encoder returned something that is not a table of finite numbers")
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    return vectors / np.where(norms == 0, 1.0, norms)
