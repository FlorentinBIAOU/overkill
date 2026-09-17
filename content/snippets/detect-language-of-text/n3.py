"""
Detect the language of a text by asking a general-purpose model.

Rung N3. This is the option people reach for first. It is here so you can see
what it costs, not because this entry recommends it.

Note what the code has to do that N0 did not: send only an excerpt, retry on
failure, parse an answer that is only probably valid JSON, normalise a code the
model may write in capitals, with a region or with stray spaces, and refuse an
answer that is outside the list it was given. That plumbing is the real cost of
this rung, and it is the part your tests have to cover, because the model
itself is not testable.

The one thing this rung genuinely adds is that it needs no sample of the
language. The one thing it cannot do is tell you it is wrong.
"""

from __future__ import annotations

import json
from collections.abc import Collection

# The provider named here is an example, not a recommendation: the reasoning
# holds for any general-purpose model API, and the client is swappable. Pass
# any object with a `complete(prompt=..., temperature=...)` method.
MODEL = "gpt-4.1-mini"  # an example id: check the parameters your model accepts

PROMPT = (
    "Identify the language of the text below.\n"
    "Answer with JSON only: an object with the key `language`, whose value is\n"
    "a two-letter ISO 639-1 code chosen from this list:\n"
    "{languages}, or `und` if the text is in none of them.\n\n"
    "Text:\n{excerpt}"
)

# Only the first characters are sent, a few sentences: N0 and N1 already name
# the language of a single sentence, and the model bills every token past it.
# That excerpt is the whole cost control — there is no cap on the input, because
# a cap would refuse a long email that costs exactly the same as a short one.
EXCERPT_CHARACTERS = 600


class DetectionUnavailable(Exception):
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


def detect(text: str, languages: Collection[str], client=None, *, attempts: int = 3) -> str | None:
    """
    Return the code of the detected language, or None when the text is blank
    or the model says it is in none of the languages it was offered.

    `client` is injected so this function can be tested without a network
    call. In production it defaults to a real provider client.
    """
    # A blank text costs nothing to refuse and cannot say anything. A long one
    # is not refused: only its first characters are ever sent.
    if not text.strip():
        return None

    client = client or ProviderClient()
    answer = _ask(client, text[:EXCERPT_CHARACTERS], sorted(languages), attempts)

    # "fr", "FR", "fr-CA" and the locale form "fr_CA" are all read as "fr". A
    # language name such as "French" is not a code, and is refused below.
    code = str(answer.get("language", "")).strip().lower().replace("_", "-").split("-")[0]
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
            # No content at all (a refusal) is as unusable as prose.
            parsed = json.loads(answer) if isinstance(answer, str) else None
            if isinstance(parsed, dict):
                return parsed
            last_error = ValueError("the model answered something that is not an object")
        except (TypeError, NameError, AttributeError):
            # A programming error in this file is not a provider failure:
            # retrying it would pay three bills for one bug.
            raise
        except Exception as error:  # noqa: BLE001 - any provider failure is retried
            last_error = error
    raise DetectionUnavailable(str(last_error))
