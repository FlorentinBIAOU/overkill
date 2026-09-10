"""
Split an address by asking a general-purpose model.

Rung N3. This is the option people reach for first. It is here so you can see
what it costs, not because this entry recommends it.

Note what the code has to do that N0 did not: cap the input size, retry on
failure, parse an answer that is only probably valid JSON, and check that the
fields it hands back were actually in the address. That last point is specific
to extraction: a model asked for a postcode and given none will happily supply
a plausible one, and a plausible postcode is worse than an empty field because
nothing downstream will ever question it.

That plumbing is the real cost of this rung, and it is the part your tests have
to cover, because the model itself is not testable.
"""

from __future__ import annotations

import json
import re
import unicodedata

FIELDS = ("number", "street", "complement", "postcode", "city")

PROMPT = (
    "Split the postal address below into fields.\n"
    "Answer with JSON only: an object with the keys `number`, `street`,\n"
    "`complement`, `postcode` and `city`. Copy the text exactly as it is\n"
    "written, and leave a key empty when the address does not carry it.\n\n"
    "Address:\n{address}"
)

# An address is a short line. A cap is not an optimisation here, it is a cost
# control: a model charges by the token, on the way in as well as out.
MAX_CHARACTERS = 300


class ParsingUnavailable(Exception):
    """The provider could not be reached, or answered something unusable."""


def parse(address: str, client=None, *, attempts: int = 3) -> dict:
    """
    Split an address into number, street, complement, postcode and town.

    `client` is injected so this function can be tested without a network call.
    In production it defaults to a real provider client.
    """
    if client is None:  # pragma: no cover - needs a key and a network
        from openai import OpenAI

        client = OpenAI()

    if len(address) > MAX_CHARACTERS:
        raise ValueError(f"address longer than {MAX_CHARACTERS} characters")

    answer = _ask(client, address, attempts)
    source = _fold(address)
    fields = dict.fromkeys(FIELDS, "")
    for key in FIELDS:
        value = answer.get(key)
        if isinstance(value, str) and value.strip() and _fold(value) in source:
            # Kept only if the model copied it from the address. What it made
            # up is dropped, and an empty field is a question a human can see.
            fields[key] = value.strip()
    return fields


def _ask(client, address: str, attempts: int) -> dict:
    last_error: Exception | None = None
    for _ in range(attempts):
        try:
            answer = client.complete(prompt=PROMPT.format(address=address), temperature=0)
            parsed = json.loads(answer)
            if isinstance(parsed, dict):
                return parsed
            last_error = ValueError("the model answered something that is not an object")
        except Exception as error:  # noqa: BLE001 - any provider failure is retried
            last_error = error
    raise ParsingUnavailable(str(last_error))


def _fold(text: str) -> str:
    """Case and spacing are the model's to change; the words are not."""
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", text).lower()).strip()
