"""
Mask personal data by asking a general-purpose model.

Rung N3. This is the option people reach for first. It is here so you can see
what it costs, not because this entry recommends it.

Note what the code has to do that N0 did not: retry on failure, cap the input
size, parse an answer that is only probably valid JSON, and refuse to pass the
message through unmasked when the answer is unusable. That plumbing is the real
cost of this rung, and it is the part your tests have to cover, because the
model itself is not testable.
"""

from __future__ import annotations

import json

PROMPT = (
    "Find every piece of personal contact information in the message below.\n"
    "Answer with JSON only: a list of objects with keys `text` and `kind`,\n"
    "where `kind` is one of email, phone, iban, address.\n"
    "If there is none, answer with an empty list.\n\n"
    "Message:\n{message}"
)

MAX_CHARACTERS = 8000


class MaskingUnavailable(Exception):
    """The provider could not be reached, or answered something unusable."""


def mask(message: str, client=None, *, attempts: int = 3) -> str:
    """
    Replace contact details with a label naming what was removed.

    `client` is injected so this function can be tested without a network call.
    In production it defaults to a real provider client.
    """
    if client is None:  # pragma: no cover - needs a key and a network
        from openai import OpenAI

        client = OpenAI()

    # A model charges by the token. Refusing oversized input is not an
    # optimisation, it is a cost control.
    if len(message) > MAX_CHARACTERS:
        raise ValueError(f"message longer than {MAX_CHARACTERS} characters")

    found = _ask(client, message, attempts)

    # Replace the longest matches first, so a substring never eats its parent.
    for item in sorted(found, key=lambda i: len(i.get("text", "")), reverse=True):
        text, kind = item.get("text"), item.get("kind")
        if text and kind:
            message = message.replace(text, f"[{kind}]")
    return message


def _ask(client, message: str, attempts: int) -> list[dict]:
    last_error: Exception | None = None
    for _ in range(attempts):
        try:
            answer = client.complete(prompt=PROMPT.format(message=message), temperature=0)
            parsed = json.loads(answer)
            if isinstance(parsed, list):
                return parsed
            last_error = ValueError("the model answered something that is not a list")
        except Exception as error:  # noqa: BLE001 - any provider failure is retried
            last_error = error
    raise MaskingUnavailable(str(last_error))
