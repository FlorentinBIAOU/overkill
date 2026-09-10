"""
Sort a contact form submission by asking a general-purpose model.

Rung N3. This is the option people reach for first. It is here so you can see
what it costs, not because this entry recommends it.

Note what the code has to do that N0 did not: cap the input size, retry a
provider that failed, parse an answer that is only probably valid JSON, and
refuse to guess when the answer is unusable. That plumbing is the real cost of
this rung, and it is the part your tests have to cover, because the model
itself is not testable.

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


class ClassificationUnavailable(Exception):
    """The provider could not be reached, or answered something unusable."""


def classify(message: str, client=None, *, attempts: int = 3) -> dict:
    """
    Return `{"spam": bool, "reason": str}` for one form submission.

    `client` is injected so this function can be tested without a network call.
    In production it defaults to a real provider client.
    """
    if client is None:  # pragma: no cover - needs a key and a network
        from openai import OpenAI

        client = OpenAI()

    # A model charges by the token, and a form field is a place where anyone
    # can paste a novel. Refusing oversized input is not an optimisation, it is
    # a cost control.
    if len(message) > MAX_CHARACTERS:
        raise ValueError(f"submission longer than {MAX_CHARACTERS} characters")

    verdict = _ask(client, message, attempts)
    return {"spam": verdict["spam"], "reason": str(verdict.get("reason", ""))}


def _ask(client, message: str, attempts: int) -> dict:
    last_error: Exception | None = None
    for _ in range(attempts):
        try:
            # Temperature zero, because a moderation decision that changes
            # between two identical calls cannot be reviewed.
            answer = client.complete(prompt=PROMPT.format(message=message), temperature=0)
            parsed = json.loads(answer)
            if isinstance(parsed, dict) and isinstance(parsed.get("spam"), bool):
                return parsed
            last_error = ValueError("the model answered without a usable verdict")
        except Exception as error:  # noqa: BLE001 - any provider failure is retried
            last_error = error
    raise ClassificationUnavailable(str(last_error))
