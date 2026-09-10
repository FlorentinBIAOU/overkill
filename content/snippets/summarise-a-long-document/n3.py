"""
Summarise a long document by asking a general-purpose model.

Rung N3. This is the option people reach for first. It is here so you can see
what it costs, not because this entry recommends it.

What it buys over N2 is real: no weights to host, no machine to keep warm, and
an answer that follows an instruction — three sentences, or a list of points,
or both — without anyone fine-tuning anything.

What it costs is in this file. Cap the input, because the provider charges by
the token and a document nobody meant to send is money gone. Retry, because
the call goes over a network. Parse an answer that is only probably the JSON
you asked for. Refuse an answer of the wrong shape rather than passing half of
one to the caller. That plumbing is what your tests can cover.

What no test here can cover: whether the summary is true of the document. The
model will write a fluent, plausible sentence the document never supported, and
nothing below can tell that sentence from a good one. See the test.
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


class SummaryUnavailable(Exception):
    """The provider could not be reached, or answered something unusable."""


def summarise(document: str, client=None, *, max_sentences: int = 3, attempts: int = 3) -> dict:
    """
    Return `{"summary": str, "key_points": list[str]}`.

    `client` is injected so this function can be tested without a network call.
    In production it defaults to a real provider client.
    """
    if client is None:  # pragma: no cover - needs a key and a network
        from openai import OpenAI

        client = OpenAI()

    # Refusing an oversized document is not an optimisation, it is a cost
    # control: the provider bills the input whether the answer is useful or not.
    if len(document) > MAX_CHARACTERS:
        raise ValueError(f"document longer than {MAX_CHARACTERS} characters")

    # An empty document has no summary, and asking for one costs the same as
    # asking for a real one.
    if not document.strip():
        return {"summary": "", "key_points": []}

    prompt = PROMPT.format(sentences=max_sentences, document=document)
    return _ask(client, prompt, attempts)


def _ask(client, prompt: str, attempts: int) -> dict:
    last_error: Exception | None = None
    for _ in range(attempts):
        try:
            # Temperature zero: two identical documents that summarise
            # differently cannot be reviewed, and cannot be cached either.
            answer = client.complete(prompt=prompt, temperature=0)
            return _decode(json.loads(answer))
        except Exception as error:  # noqa: BLE001 - any provider failure is retried
            last_error = error
    raise SummaryUnavailable(str(last_error))


def _decode(parsed) -> dict:
    """
    Accept only the shape that was asked for.

    Returning a half-built answer would hand the caller a summary that is
    silently empty, which reads exactly like a document with nothing in it.
    """
    if not isinstance(parsed, dict):
        raise ValueError("the model answered something that is not an object")
    summary = parsed.get("summary")
    if not isinstance(summary, str) or not summary.strip():
        raise ValueError("the model answered without a summary")
    points = parsed.get("key_points", [])
    if not isinstance(points, list):
        raise ValueError("the model answered with key points that are not a list")
    return {
        "summary": summary.strip(),
        "key_points": [str(point) for point in points],
    }
