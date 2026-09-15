"""
Split an address by asking a general-purpose model.

Rung N3. It is here so you can see what it costs, not because this entry
recommends it.

Note what the code has to do that N0 did not: cap the input size, retry on
failure, parse an answer that is only probably valid JSON, and check that the
fields it hands back were actually in the address. That last point is specific
to extraction: a value the address does not contain is dropped, because a
plausible postcode is worse than an empty field — nothing downstream will ever
question it.

That plumbing is the real cost of this rung, and it is the part your tests have
to cover, because the model itself is not testable.
"""

from __future__ import annotations

import json
import re
import unicodedata

# The provider named here is an example, not a recommendation: the reasoning
# holds for any general-purpose model API, and the client is swappable. Pass
# any object with a `complete(prompt=..., temperature=...)` method.
MODEL = "gpt-4.1-mini"  # an example id: check the parameters your model accepts

FIELDS = ("number", "street", "complement", "postcode", "city")

PROMPT = (
    "Split the postal address below into fields.\n"
    "Answer with JSON only: an object with the keys `number`, `street`,\n"
    "`complement`, `postcode` and `city`. Copy the text exactly as it is\n"
    "written, and leave a key empty when the address does not carry it.\n\n"
    "Address:\n{address}"
)

# An address is a short line. The cap is a cost control: the provider bills the
# tokens of the prompt as well as those of the answer.
MAX_CHARACTERS = 300


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


class ParsingUnavailable(Exception):
    """The provider could not be reached, or answered something unusable."""


def parse(address: str, client=None, *, attempts: int = 3) -> dict:
    """
    Split an address into number, street, complement, postcode and town.

    `client` is injected so this function can be tested without a network call.
    In production it defaults to a real provider client.
    """
    if len(address) > MAX_CHARACTERS:
        raise ValueError(f"address longer than {MAX_CHARACTERS} characters")
    client = client or ProviderClient()

    answer = _ask(client, address, attempts)
    source = _words(address)
    taken = [False] * len(source)
    values = {key: _text(answer.get(key)) for key in FIELDS}
    fields = dict.fromkeys(FIELDS, "")
    # Kept only if the model copied it from the address, as whole words not
    # already claimed by another field. Longest first, so a postcode "12" cannot
    # take its digits out of "Appartement 12". What it made up is dropped, and an empty
    # field is a question a human can see.
    for key in sorted(FIELDS, key=lambda k: -len(_words(values[k]))):
        words = _words(values[key])
        for start in range(len(source) - len(words) + 1) if words else ():
            end = start + len(words)
            if source[start:end] == words and not any(taken[start:end]):
                taken[start:end] = [True] * len(words)
                fields[key] = values[key].strip()
                break
    return fields


def _ask(client, address: str, attempts: int) -> dict:
    last_error: Exception | None = None
    for _ in range(attempts):
        try:
            # Temperature zero, because an address that splits differently
            # between two identical calls cannot be reconciled with anything.
            answer = client.complete(prompt=PROMPT.format(address=address), temperature=0)
            # No content (a refusal) is as unusable as prose.
            parsed = json.loads(answer) if isinstance(answer, str) else None
            if isinstance(parsed, dict):
                return parsed
            last_error = ValueError("the model answered something that is not an object")
        except Exception as error:  # noqa: BLE001 - any provider failure is retried
            last_error = error
    raise ParsingUnavailable(str(last_error))


def _text(value) -> str:
    """A string as it came, a whole number as its digits (75011), anything else as nothing."""
    if isinstance(value, (int, float)) and not isinstance(value, bool) and float(value).is_integer():
        return str(int(value))
    return value if isinstance(value, str) else ""


def _words(text: str) -> list[str]:
    """Case, spacing and punctuation are the model's to change; the words are not."""
    return re.findall(r"[^\W_]+", unicodedata.normalize("NFKC", text).lower())
