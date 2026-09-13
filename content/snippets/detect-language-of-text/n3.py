"""
Detect the language of a text by asking a general-purpose model.

Rung N3. This is the option people reach for first. It is here so you can see
what it costs, not because this entry recommends it.

Note what the code has to do that N0 did not: cap the input, send only an
excerpt, retry on failure, parse an answer that is only probably valid JSON,
normalise a code the model may write in half a dozen ways, and refuse an
answer that is outside the list it was given. That plumbing is the real cost
of this rung, and it is the part your tests have to cover, because the model
itself is not testable.

The one thing this rung genuinely adds is that it needs no sample of the
language. The one thing it cannot do is tell you it is wrong.
"""

from __future__ import annotations

import json
from collections.abc import Collection

PROMPT = (
    "Identify the language of the text below.\n"
    "Answer with JSON only: an object with keys `language` and `confidence`,\n"
    "where `language` is a two-letter ISO 639-1 code chosen from this list:\n"
    "{languages}, or `und` if the text is in none of them.\n\n"
    "Text:\n{excerpt}"
)

MAX_CHARACTERS = 8000

# A language is decided in the first few sentences. Sending the whole document
# is not thoroughness, it is paying by the token for nothing.
EXCERPT_CHARACTERS = 600


class DetectionUnavailable(Exception):
    """The provider could not be reached, or answered something unusable."""


def detect(text: str, languages: Collection[str], client=None, *, attempts: int = 3) -> str | None:
    """
    Return the code of the detected language, or None when the model says the
    text is in none of the languages it was offered.

    `client` is injected so this function can be tested without a network
    call. In production it defaults to a real provider client.
    """
    if client is None:  # pragma: no cover - needs a key and a network
        from openai import OpenAI

        client = OpenAI()

    # A model charges by the token. Refusing oversized input is not an
    # optimisation, it is a cost control.
    if len(text) > MAX_CHARACTERS:
        raise ValueError(f"text longer than {MAX_CHARACTERS} characters")

    answer = _ask(client, text[:EXCERPT_CHARACTERS], sorted(languages), attempts)

    # Models answer "fr", "FR", "fr-CA" and "French" for the same
    # thing. Everything but the first is a bug waiting to reach production.
    code = str(answer.get("language", "")).strip().lower().split("-")[0]
    if code == "und":
        return None
    if code not in languages:
        raise DetectionUnavailable(f"the model answered a language outside the list: {code!r}")
    return code


def _ask(client, excerpt: str, languages: list[str], attempts: int) -> dict:
    last_error: Exception | None = None
    for _ in range(attempts):
        try:
            answer = client.complete(
                prompt=PROMPT.format(languages=", ".join(languages), excerpt=excerpt),
                # Temperature zero, because a routing decision that changes
                # between two identical calls cannot be reviewed.
                temperature=0,
            )
            parsed = json.loads(answer)
            if isinstance(parsed, dict):
                return parsed
            last_error = ValueError("the model answered something that is not an object")
        except Exception as error:  # noqa: BLE001 - any provider failure is retried
            last_error = error
    raise DetectionUnavailable(str(last_error))
