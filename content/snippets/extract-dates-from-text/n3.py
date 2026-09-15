"""
Extract dates by asking a general-purpose model.

Rung N3. It is the only rung on this entry whose request asks for relative
dates, "jeudi prochain", to be resolved: it sends today's date along with the
text, and asks for every date as a calendar day.

Note what the code has to do that N0 did not: pass a reference date, because
the model is not told what day it is otherwise; cap the input size; retry on
failure; parse an answer that is only probably valid JSON; and check the
calendar itself, because nothing in the request stops the answer from holding
2024-02-31. That plumbing is the real cost of the rung, and it is the part the
tests have to cover, because the model itself is not testable.
"""

import json
import re
from datetime import date

PROMPT = (
    "Find every date mentioned in the text below. Answer with JSON only: a list\n"
    "of objects with keys `text` and `date`, where `text` is the words as written\n"
    "and `date` is the day in ISO format, YYYY-MM-DD. Resolve relative dates such\n"
    "as 'next Thursday' against today, which is {today}. If there is no date,\n"
    "answer with an empty list.\n\nText:\n{text}"
)
ISO_DAY = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}")

MAX_CHARACTERS = 8000

# The provider named here is an example, not a recommendation: the reasoning
# holds for any general-purpose model API, and the client is swappable. Pass
# any object with a `complete(prompt=..., temperature=...)` method.
MODEL = "gpt-4.1-mini"  # an example id: check the parameters your model accepts


class ExtractionUnavailable(Exception):
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


def extract_dates(text: str, client=None, *, today: date | None = None, attempts: int = 3):
    """
    Return every date the model reports, as (what was written, what it means).

    `client` is injected so this function can be tested without a network call.
    In production it defaults to a real provider client.
    """
    # The provider bills every token of the prompt. Refusing oversized input
    # before the call is a cost control; the cap counts characters, not tokens.
    if len(text) > MAX_CHARACTERS:
        raise ValueError(f"text longer than {MAX_CHARACTERS} characters")
    if not text.strip():
        return []  # nothing to read, so nothing to pay for
    client = client or ProviderClient()

    found = []
    for item in _ask(client, text, today or date.today(), attempts):
        try:
            # The same calendar check as N0, on the model's answer this time.
            value = date.fromisoformat(item["date"])
        except ValueError:
            continue  # a day that does not exist is not a date, however fluent
        written = item.get("text")
        found.append((written if isinstance(written, str) else "", value))
    return found


def _is_usable(parsed) -> bool:
    """A list of objects, each with a `date` written YYYY-MM-DD, as the prompt asked."""
    return isinstance(parsed, list) and all(
        isinstance(item, dict) and isinstance(item.get("date"), str) and ISO_DAY.fullmatch(item["date"])
        for item in parsed
    )


def _ask(client, text: str, today: date, attempts: int) -> list[dict]:
    last_error: Exception | None = None
    for _ in range(attempts):
        try:
            answer = client.complete(
                prompt=PROMPT.format(text=text, today=today.isoformat()),
                # Temperature zero: a date that changes between two identical
                # calls cannot be reviewed.
                temperature=0,
            )
            if answer is None:  # a refusal carries no content: unusable, not empty
                last_error = ValueError("the model returned no content")
                continue
            parsed = json.loads(answer)
            if _is_usable(parsed):
                return parsed
            # A list of anything else would read as "no date found", which it is not.
            last_error = ValueError("the model answered something other than a list of ISO days")
        except Exception as error:  # noqa: BLE001 - any provider failure is retried
            last_error = error
    raise ExtractionUnavailable(str(last_error))
