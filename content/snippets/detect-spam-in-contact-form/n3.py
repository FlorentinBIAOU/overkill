"""
Sort a contact form submission by asking a general-purpose model.

Rung N3. It is here so you can see what it costs, not because this entry
recommends it.

Note what the code has to do that N0 did not: refuse an empty or oversized
input before paying for a call, ask again when the provider fails or answers
something unusable, every attempt being billed, parse an answer that is only
probably valid JSON, and refuse to guess when none of the attempts is usable.
That plumbing is the real cost of this rung, and it is the part your tests have
to cover, because a test against a double says nothing of how the model judges.

Note too what it cannot do. The message goes into the same prompt as the
instructions, and nothing in the protocol tells the model which of the two to
obey.
"""

from __future__ import annotations

import json

PROMPT = (
    "You moderate the contact form of a small company.\n"
    "Decide whether the submission below is unsolicited commercial spam.\n"
    'Answer with JSON only: {{"spam": true or false, "reason": "one short sentence"}}\n\n'
    "Submission:\n{message}"
)

MAX_CHARACTERS = 4000

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


class ClassificationUnavailable(Exception):
    """The provider could not be reached, or answered something unusable."""


def classify(message: str, client=None, *, attempts: int = 3) -> dict:
    """
    Return `{"spam": bool, "reason": str}` for one form submission.

    `client` is injected so this function can be tested without a network call.
    In production it defaults to a real provider client.
    """
    if not message.strip():
        raise ValueError("empty submission: there is nothing to classify")
    # A model charges by the token, and a form field is a place where anyone
    # can paste a novel. Refusing oversized input is not an optimisation, it is
    # a cost control.
    if len(message) > MAX_CHARACTERS:
        raise ValueError(f"submission longer than {MAX_CHARACTERS} characters")

    client = client or ProviderClient()
    verdict = _ask(client, message, attempts)
    reason = verdict.get("reason")
    return {"spam": verdict["spam"], "reason": "" if reason is None else str(reason)}


def _ask(client, message: str, attempts: int) -> dict:
    last_error: Exception | None = None
    for _ in range(attempts):
        try:
            # Temperature zero, the low end of the range, which the provider
            # documents as more focused and deterministic. It does not promise
            # that two identical calls agree.
            answer = client.complete(prompt=PROMPT.format(message=message), temperature=0)
        except Exception as error:  # noqa: BLE001 - any provider failure is retried
            last_error = error
            continue
        verdict = _parse(answer)
        if verdict is not None:
            return verdict
        last_error = ValueError("the model answered without a usable verdict")
    raise ClassificationUnavailable(str(last_error))


def _parse(answer) -> dict | None:
    """The verdict in `answer`, or None: no text, not JSON, or no boolean `spam`."""
    if not isinstance(answer, str):  # the SDK types the content as optional
        return None
    # A Markdown code fence around the JSON is unwrapped, not counted as a failure.
    text = answer.strip().removeprefix("```json").removeprefix("```").removesuffix("```")
    try:
        parsed = json.loads(text)
    except (ValueError, RecursionError):
        return None
    return parsed if isinstance(parsed, dict) and isinstance(parsed.get("spam"), bool) else None
