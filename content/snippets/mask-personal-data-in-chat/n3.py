"""
Mask personal data by asking a general-purpose model.

Rung N3. It is here so you can see what it costs, not because this entry
recommends it.

Note what the code has to do that N0 did not: retry on failure, cap the input
size, parse an answer that is only probably valid JSON, check every item of it
against the message, and refuse to pass the message through unmasked when the
answer is unusable. A prompt is only a request: nothing in it holds the model to
the format asked for. That plumbing is the real cost of this rung, and it is the
part your tests have to cover, because the model itself is not testable.
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
KINDS = ("email", "phone", "iban", "address")

MAX_CHARACTERS = 8000

# The provider named here is an example, not a recommendation: the reasoning
# holds for any general-purpose model API, and the client is swappable. Pass
# any object with a `complete(prompt=..., temperature=...)` method.
MODEL = "gpt-4.1-mini"  # an example id: check the parameters your model accepts


class MaskingUnavailable(Exception):
    """The provider could not be reached, or answered something unusable."""


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


def mask(message: str, client=None, *, attempts: int = 3) -> str:
    """
    Replace contact details with a label naming what was removed.

    `client` is injected so this function can be tested without a network call.
    In production it defaults to a real provider client.
    """
    client = client or ProviderClient()

    # The provider bills every token of the prompt. Refusing oversized input
    # before the call is a cost control; the cap counts characters, not tokens.
    if len(message) > MAX_CHARACTERS:
        raise ValueError(f"message longer than {MAX_CHARACTERS} characters")

    found = _ask(client, message, attempts)

    # Replace the longest matches first, so a substring never eats its parent.
    for item in sorted(found, key=lambda i: len(i["text"]), reverse=True):
        message = message.replace(item["text"], f"[{item['kind']}]")
    return message


def _is_usable(parsed, message: str) -> bool:
    """A list of {text, kind}, every text found as is in the message, every kind one we asked for."""
    return isinstance(parsed, list) and all(
        isinstance(item, dict)
        and isinstance(item.get("text"), str)
        and item["text"] != ""
        and item["text"] in message
        and item.get("kind") in KINDS
        for item in parsed
    )


def _unfenced(answer: str) -> str:
    """
    Strip a code fence that wraps the whole answer, and nothing else.

    Models often hand back `\u0060\u0060\u0060json …\u0060\u0060\u0060`, and refusing that form would
    pay for a second call for nothing. Any other departure — text before or
    after, two blocks, a fence never closed — is left alone, and fails to
    parse, which is the point.
    """
    text = answer.strip()
    if text.startswith("```") and text.endswith("```") and text.count("```") == 2:
        return text[3:-3].removeprefix("json")
    return text


def _ask(client, message: str, attempts: int) -> list[dict]:
    last_error: Exception | None = None
    for _ in range(attempts):
        try:
            answer = client.complete(prompt=PROMPT.format(message=message), temperature=0)
            if answer is None:  # a refusal carries no content: unusable, not empty
                last_error = ValueError("the model returned no content")
                continue
            parsed = json.loads(_unfenced(answer))
            if _is_usable(parsed, message):
                return parsed
            # An item the message does not contain would mask nothing, and the message would leave in clear.
            last_error = ValueError("the model answered something other than items found in the message")
        except Exception as error:  # noqa: BLE001 - any provider failure is retried
            last_error = error
    raise MaskingUnavailable(str(last_error))
