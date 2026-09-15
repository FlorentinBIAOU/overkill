"""
Local double with the surface of the provider SDK the N3 snippets name.

`FakeLLM` stands in for the snippet's own `complete` call. This one stands in
for the SDK underneath: it lets a test run the snippet's default adapter,
`ProviderClient(sdk=...)`, without the package installed and without a network.

The surface mirrors the published `openai` package (3.x), checked against it
with its HTTP transport replaced (docs/lot15/verification-sdk/):

- `sdk.chat.completions.create(model=..., messages=[...], temperature=...)`,
  answer read from `choices[0].message.content`, which may be `None`;
- `sdk.embeddings.create(model=..., input=[...])`, vectors read from
  `data[i].embedding`, each item carrying its `index`.

It has no `complete` method, on purpose: the real SDK has none either.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any, Sequence


class FakeSDKError(Exception):
    """Raised by the double when it is told to simulate a provider failure."""


class FakeSDK:
    def __init__(
        self,
        content: str | None = "",
        *,
        fail_times: int = 0,
        vectors: Sequence[Sequence[float]] | None = None,
        shuffle_embeddings: bool = False,
    ) -> None:
        self.content = content
        self.vectors = vectors
        self.shuffle_embeddings = shuffle_embeddings
        self.requests: list[dict[str, Any]] = []
        self._fail_times = fail_times
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._chat))
        self.embeddings = SimpleNamespace(create=self._embed)

    @property
    def last_request(self) -> dict[str, Any]:
        if not self.requests:
            raise AssertionError("the adapter never called the SDK")
        return self.requests[-1]

    def _record(self, kind: str, kwargs: dict[str, Any]) -> None:
        self.requests.append({"endpoint": kind, **kwargs})
        if self._fail_times > 0:
            self._fail_times -= 1
            raise FakeSDKError("simulated provider failure")

    def _chat(self, **kwargs: Any) -> SimpleNamespace:
        self._record("chat.completions", kwargs)
        message = SimpleNamespace(role="assistant", content=self.content)
        choice = SimpleNamespace(index=0, message=message, finish_reason="stop")
        return SimpleNamespace(choices=[choice])

    def _embed(self, **kwargs: Any) -> SimpleNamespace:
        self._record("embeddings", kwargs)
        texts = kwargs["input"]
        vectors = self.vectors or [[float(len(t)), 1.0] for t in texts]
        items = [SimpleNamespace(index=i, embedding=list(v)) for i, v in enumerate(vectors)]
        if self.shuffle_embeddings:
            items.reverse()
        return SimpleNamespace(data=items)
