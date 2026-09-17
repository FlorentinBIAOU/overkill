"""
Extract dates by asking a general-purpose model.

Rung N3. Its request asks for relative dates, "jeudi prochain", to be
resolved: it sends a reference date along with the text, and asks for every
date as a calendar day. Rung N1 resolves the same expressions locally and for
nothing; this rung is worth its price only on the ones a parser misses.

The reference is the date of the document, not the day of the run: "jeudi
prochain" in an email received three weeks ago is not next Thursday. It has no
default here, on purpose, because a default would quietly be today and a
backlog reprocessed on Monday would move every deadline.

The cap on the input raises rather than truncating: a contract cut in half
would come back with a list of deadlines that looks complete. What a caller
does above the cap is split the document into overlapping chunks and merge the
answers; this snippet does not, on purpose, because it shows one call.

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
    "as 'next Thursday' against the date of the document, which is {reference}.\n"
    "If there is no date, answer with an empty list.\n\nText:\n{text}"
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


def extract_dates(text: str, client=None, *, reference: date, attempts: int = 3):
    """
    Return every date the model reports, as (what was written, what it means).

    `reference` is the date the relative expressions are resolved against: the
    date of the document. It has no default: it is a keyword argument the
    caller has to pass, because a default would quietly be today.

    `client` is injected so this function can be tested without a network call.
    In production it defaults to a real provider client.
    """
    if not isinstance(reference, date):
        raise TypeError("reference must be a date: the date of the document, not of the run")
    # The provider bills every token of the prompt. Refusing oversized input
    # before the call is a cost control; the cap counts characters, not tokens.
    if len(text) > MAX_CHARACTERS:
        raise ValueError(f"text longer than {MAX_CHARACTERS} characters")
    if not text.strip():
        return []  # nothing to read, so nothing to pay for
    client = client or ProviderClient()

    found = []
    for item in _ask(client, text, reference, attempts):
        try:
            # The same calendar check as N0, on the model's answer this time.
            value = date.fromisoformat(item["date"])
        except ValueError:
            continue  # a day that does not exist is not a date, however fluent
        written = item.get("text")
        found.append((written if isinstance(written, str) else "", value))
    return found


def _unfenced(answer: str) -> str:
    """
    Strip a code fence that wraps the whole answer, and nothing else.

    Models often hand back a JSON answer inside one fenced block, and refusing
    that form would pay for a second call for nothing. Any other departure —
    text before or after, two blocks, a fence never closed — is left alone, and
    fails to parse, which is the point.
    """
    stripped = answer.strip()
    if stripped.startswith("```") and stripped.endswith("```") and stripped.count("```") == 2:
        return stripped[3:-3].removeprefix("json")
    return stripped


def _is_usable(parsed) -> bool:
    """A list of objects, each with a `date` written YYYY-MM-DD, as the prompt asked."""
    return isinstance(parsed, list) and all(
        isinstance(item, dict) and isinstance(item.get("date"), str) and ISO_DAY.fullmatch(item["date"])
        for item in parsed
    )


def _ask(client, text: str, reference: date, attempts: int) -> list[dict]:
    last_error: Exception | None = None
    for _ in range(attempts):
        try:
            answer = client.complete(
                prompt=PROMPT.format(text=text, reference=reference.isoformat()),
                # Temperature zero: a date that changes between two identical
                # calls cannot be reviewed.
                temperature=0,
            )
            if answer is None:  # a refusal carries no content: unusable, not empty
                last_error = ValueError("the model returned no content")
                continue
            parsed = json.loads(_unfenced(answer))
            if _is_usable(parsed):
                return parsed
            # A list of anything else would read as "no date found", which it is not.
            last_error = ValueError("the model answered something other than a list of ISO days")
        except Exception as error:  # noqa: BLE001 - any provider failure is retried
            last_error = error
    raise ExtractionUnavailable(str(last_error))
