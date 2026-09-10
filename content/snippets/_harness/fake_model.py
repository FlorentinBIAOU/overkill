"""
Local double for a self-hosted specialised model (rung N2).

Snippets on rung N2 load a real model: a distilled encoder, an embedding
model, an OCR engine, a translation model. Those weigh hundreds of megabytes
and cannot be downloaded on every build.

The snippet therefore takes its model as an injectable parameter with a real
default, so the reader sees the real loading code. The test injects one of the
doubles below.

Snippets tested this way are declared `verification: stubbed`.
"""

from __future__ import annotations

from typing import Any, Callable, Sequence


class FakeClassifier:
    """
    A classifier whose decisions are given, not learnt.

    Lets a test exercise thresholding, label mapping, batching and error
    handling in the snippet, without a real model.
    """

    def __init__(self, scores: dict[str, dict[str, float]], default: dict[str, float] | None = None):
        self.scores = scores
        self.default = default or {}
        self.calls: list[Sequence[str]] = []

    def predict(self, texts: Sequence[str]) -> list[dict[str, float]]:
        self.calls.append(list(texts))
        return [self.scores.get(t, self.default) for t in texts]


class FakeEncoder:
    """
    Deterministic sentence encoder.

    Same text gives the same vector; texts sharing words land closer together.
    Enough to exercise similarity, ranking and nearest-neighbour code paths.
    """

    def __init__(self, dimensions: int = 32):
        self.dimensions = dimensions
        self.calls: list[Sequence[str]] = []

    def encode(self, texts: Sequence[str]) -> list[list[float]]:
        self.calls.append(list(texts))
        return [self._vector(t) for t in texts]

    def _vector(self, text: str) -> list[float]:
        vector = [0.0] * self.dimensions
        for word in _words(text):
            vector[stable_hash(word) % self.dimensions] += 1.0
        norm = sum(v * v for v in vector) ** 0.5
        return [v / norm for v in vector] if norm else vector


class FakeSeq2Seq:
    """A translation or summarisation model whose outputs are given."""

    def __init__(self, outputs: dict[str, str], default: str = ""):
        self.outputs = outputs
        self.default = default
        self.calls: list[str] = []

    def generate(self, text: str, **_: Any) -> str:
        self.calls.append(text)
        return self.outputs.get(text, self.default)


class FakeOCR:
    """An OCR engine whose reading of each image is given."""

    def __init__(self, pages: dict[str, str], confidence: float = 0.92):
        self.pages = pages
        self.confidence = confidence
        self.calls: list[str] = []

    def read(self, image_path: str) -> dict[str, Any]:
        self.calls.append(image_path)
        return {"text": self.pages.get(image_path, ""), "confidence": self.confidence}


def stable_hash(word: str) -> int:
    """Stable across runs, unlike the built-in hash of a string."""
    h = 2166136261
    for char in word:
        h = ((h ^ ord(char)) * 16777619) & 0xFFFFFFFF
    return h


def _words(text: str) -> list[str]:
    return [w for w in "".join(c if c.isalnum() else " " for c in text.lower()).split() if w]


def loader_returning(model: Any) -> Callable[..., Any]:
    """Turns an object into a loader, for snippets that take a loader."""
    return lambda *_args, **_kwargs: model
