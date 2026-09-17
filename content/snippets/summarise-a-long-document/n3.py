"""
Summarise a long document by asking a general-purpose model.

Rung N3. It is here so you can see what it costs, not because this entry
recommends it.

What it buys over N2 is real: no weights to host, no machine to keep warm, and
an output shape set in the prompt — three sentences, a list of points, or both
— instead of trained into the weights. Whether the answer respects that shape
is checked below, not assumed.

What it costs is in this file. Cap the input, because the provider charges by
the token and a document nobody meant to send is money gone. Retry, because
the call goes over a network. Parse an answer that is only probably the JSON
you asked for. Refuse an answer of the wrong shape rather than passing half of
one to the caller. That plumbing is what your tests can cover.

What no test here can cover: whether the summary is true of the document.
Nothing below can tell a fluent sentence the document never supported from a
good one. See the test.
"""

from __future__ import annotations

import json

PROMPT = (
    "Summarise the document below in at most {sentences} sentences.\n"
    "Use only what the document says, and add nothing to it.\n"
    "Answer with JSON only: an object with the key `summary`, a string, and\n"
    "the key `key_points`, a list of short strings.\n\n"
    "Document:\n{document}"
)

MAX_CHARACTERS = 40000

# The provider named here is an example, not a recommendation: the reasoning
# holds for any general-purpose model API, and the client is swappable. Pass
# any object with a `complete(prompt=..., temperature=...)` method.
MODEL = "gpt-4.1-mini"  # an example id: check the parameters your model accepts


class ProviderClient:
    """The one call this snippet makes, on top of the provider's SDK."""

    def __init__(self, sdk=None, model: str = MODEL):
        if sdk is None:  # pragma: no cover - needs a key and a network
            from openai import OpenAI

            sdk = OpenAI()
        self.sdk, self.model = sdk, model

    def complete(self, *, prompt: str, temperature: float) -> str:
        response = self.sdk.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=temperature,
        )
        return response.choices[0].message.content


class SummaryUnavailable(Exception):
    """The provider could not be reached, or answered something unusable."""


def summarise(document: str, client=None, *, max_sentences: int = 3, attempts: int = 3) -> dict:
    """
    Return `{"summary": str, "key_points": list[str]}`.

    `client` is injected so this function can be tested without a network call.
    In production it defaults to a real provider client.
    """
    # Refusing an oversized document is not an optimisation, it is a cost
    # control: the provider bills the input whether the answer is useful or not.
    if len(document) > MAX_CHARACTERS:
        raise ValueError(f"document longer than {MAX_CHARACTERS} characters")
    if max_sentences < 1:
        raise ValueError("max_sentences must be at least 1")

    # An empty document has no summary, and asking for one costs the same as
    # asking for a real one.
    if not document.strip():
        return {"summary": "", "key_points": []}

    prompt = PROMPT.format(sentences=max_sentences, document=document)
    return _ask(client or ProviderClient(), prompt, attempts)


def _ask(client, prompt: str, attempts: int) -> dict:
    last_error: Exception | None = None
    for _ in range(attempts):
        try:
            # Temperature zero, the low end of the range, which the provider
            # documents as more focused and deterministic. It does not promise
            # that two identical calls agree.
            answer = client.complete(prompt=prompt, temperature=0)
        except Exception as error:  # noqa: BLE001 - any provider failure is retried
            last_error = error
            continue
        try:
            return _decode(answer)
        except ValueError as error:  # an unusable answer is asked for again
            last_error = error
    raise SummaryUnavailable(str(last_error))


def _decode(answer) -> dict:
    """
    Accept only the shape that was asked for.

    Returning a half-built answer would hand the caller a summary that is
    silently empty, which reads exactly like a document with nothing in it.
    """
    if not isinstance(answer, str):  # the SDK types the content as optional
        raise ValueError("the model returned no text")
    # A JSON answer wrapped whole in one code fence is read; nothing else is:
    # a fence opened and never closed, or prose around it, is a failed answer.
    text = answer.strip()
    if text.startswith("```") and text.endswith("```") and text.count("```") == 2:
        text = text[3:-3].removeprefix("json")
    try:
        parsed = json.loads(text)
    except RecursionError as error:
        raise ValueError("the answer is nested too deep to read") from error
    if not isinstance(parsed, dict):
        raise ValueError("the model answered something that is not an object")
    summary = parsed.get("summary")
    if not isinstance(summary, str) or not summary.strip():
        raise ValueError("the model answered without a summary")
    points = parsed.get("key_points", [])
    if not isinstance(points, list) or not all(isinstance(point, str) for point in points):
        raise ValueError("the model answered with key points that are not a list of strings")
    return {"summary": summary.strip(), "key_points": points}
