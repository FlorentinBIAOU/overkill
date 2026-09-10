"""
Local double for a general-purpose LLM API.

Snippets on rung N3 call a real provider. Their tests cannot: that would cost
money, need a key, and break the build whenever the provider is down. So the
test injects this double instead.

What the resulting test actually proves: the request is built correctly, the
response is decoded correctly, and error paths are handled. That is where the
bugs in this kind of code live.

What it does not prove: that the model answers well. Snippets tested this way
are declared `verification: stubbed` on their entry, and the page says so.
"""

from __future__ import annotations

import json
from typing import Any


class FakeLLMError(Exception):
    """Raised by the double when it is told to simulate a provider failure."""


class FakeLLM:
    """
    Records what it is asked and returns what it was told to return.

    >>> client = FakeLLM(response="hello")
    >>> client.complete(prompt="say hi")
    'hello'
    >>> client.last_request["prompt"]
    'say hi'
    """

    def __init__(
        self,
        response: str | dict[str, Any] = "",
        *,
        fail_times: int = 0,
        model: str = "fake-model",
    ) -> None:
        self.response = response
        self.model = model
        self.requests: list[dict[str, Any]] = []
        self._fail_times = fail_times

    @property
    def last_request(self) -> dict[str, Any]:
        if not self.requests:
            raise AssertionError("the snippet never called the client")
        return self.requests[-1]

    @property
    def call_count(self) -> int:
        return len(self.requests)

    def _record(self, **kwargs: Any) -> None:
        self.requests.append(kwargs)
        if self._fail_times > 0:
            self._fail_times -= 1
            raise FakeLLMError("simulated provider failure")

    def complete(self, **kwargs: Any) -> str:
        """Text completion. Mirrors the shape of a chat completion call."""
        self._record(**kwargs)
        if isinstance(self.response, dict):
            return json.dumps(self.response)
        return self.response

    def complete_json(self, **kwargs: Any) -> Any:
        """Structured output. Returns the response already decoded."""
        self._record(**kwargs)
        if isinstance(self.response, dict):
            return self.response
        return json.loads(self.response)

    def embed(self, texts: list[str], **kwargs: Any) -> list[list[float]]:
        """
        Deterministic pseudo-embeddings.

        Same text gives the same vector, and texts sharing words land closer
        together, which is enough to exercise a nearest-neighbour code path.
        """
        self._record(texts=texts, **kwargs)
        return [_bag_of_words_vector(t) for t in texts]


def _bag_of_words_vector(text: str, dimensions: int = 16) -> list[float]:
    vector = [0.0] * dimensions
    for word in text.lower().split():
        vector[hash_word(word) % dimensions] += 1.0
    norm = sum(v * v for v in vector) ** 0.5
    return [v / norm for v in vector] if norm else vector


def hash_word(word: str) -> int:
    """Stable across runs, unlike the built-in hash of a string."""
    h = 2166136261
    for char in word:
        h = ((h ^ ord(char)) * 16777619) & 0xFFFFFFFF
    return h
