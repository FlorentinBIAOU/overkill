"""
Extract dates by asking a general-purpose model.

Rung N3. This is the option people reach for first, and it is the only one on
this entry that reads « jeudi prochain ». That is a real capability, and it is
why the rung is here.

Note what the code has to do that N0 did not: pass a reference date, because
the model has no idea what day it is; cap the input size; retry on failure;
parse an answer that is only probably valid JSON; and check the calendar
itself, because a model will answer 2024-02-31 in flawless JSON without
blinking. That plumbing is the real cost of the rung, and it is the part the
tests have to cover, because the model itself is not testable.
"""

import json
from datetime import date

PROMPT = (
    "Find every date mentioned in the text below. Answer with JSON only: a list\n"
    "of objects with keys `text` and `date`, where `text` is the words as written\n"
    "and `date` is the day in ISO format, YYYY-MM-DD. Resolve relative dates such\n"
    "as « next Thursday » against today, which is {today}. If there is no date,\n"
    "answer with an empty list.\n\nText:\n{text}"
)

MAX_CHARACTERS = 8000


class ExtractionUnavailable(Exception):
    """The provider could not be reached, or answered something unusable."""


def extract_dates(text: str, client=None, *, today: date | None = None, attempts: int = 3):
    """
    Return every date the model reports, as (what was written, what it means).

    `client` is injected so this function can be tested without a network call.
    In production it defaults to a real provider client.
    """
    if client is None:  # pragma: no cover - needs a key and a network
        from openai import OpenAI

        client = OpenAI()

    # A model charges by the token. Refusing oversized input is not an
    # optimisation, it is a cost control.
    if len(text) > MAX_CHARACTERS:
        raise ValueError(f"text longer than {MAX_CHARACTERS} characters")

    found = []
    for item in _ask(client, text, today or date.today(), attempts):
        try:
            # The same calendar check as N0, on the model's answer this time.
            value = date.fromisoformat(item["date"])
        except (TypeError, KeyError, ValueError):
            continue  # a day that does not exist is not a date, however fluent
        found.append((item.get("text", ""), value))
    return found


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
            parsed = json.loads(answer)
            if isinstance(parsed, list):
                return parsed
            last_error = ValueError("the model answered something that is not a list")
        except Exception as error:  # noqa: BLE001 - any provider failure is retried
            last_error = error
    raise ExtractionUnavailable(str(last_error))
