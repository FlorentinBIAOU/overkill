"""
Write the text fields of a test data set by asking a general-purpose model.

Rung N3. This is the option people reach for first, and it does buy something
real: a support ticket that reads like a support ticket, with the typos, the
capitals and the two questions in one sentence that no template produces.

It also gives up the property the lower rungs were built on. There is no seed
here. Two calls with the same prompt return different rows, so the data set has
to be generated once and then stored, like a fixture, not rebuilt on demand.

And the model guarantees nothing: not the keys you asked for, not the number of
rows, not the uniqueness of an identifier. Look at how much of this file is
checking rather than asking. That plumbing is the real cost of the rung, and it
is the part the tests can cover, because the model itself is not testable.
"""

from __future__ import annotations

import json

MAX_ROWS = 50  # beyond that the answer comes back truncated more often than not


class GenerationUnavailable(Exception):
    """The provider could not be reached, or never returned a usable data set."""


def build_prompt(fields: list[str], count: int, unique_field: str | None) -> str:
    """The instructions, kept next to the checks that verify they were followed."""
    lines = [
        f"Write {count} rows of test data for a fictional application.",
        "Each row is a JSON object with exactly these keys, and string values:",
        ", ".join(fields) + ".",
        "Invent every value: it must match no real person, company or address.",
        f"Answer with JSON only: a list of {count} objects, and nothing else.",
    ]
    if unique_field:
        lines.insert(3, f"Every value of `{unique_field}` must differ from the others.")
    return "\n".join(lines)


def check(rows, fields: list[str], count: int, unique_field: str | None) -> None:
    """
    Verify what the model was asked for. Nothing here is redundant.

    Each of these failures is one this rung produces in practice: a row short,
    a key renamed to its plural, an empty string, the same name twice.
    """
    if not isinstance(rows, list) or len(rows) != count:
        raise ValueError(f"expected a list of {count} rows")
    for row in rows:
        if not isinstance(row, dict) or set(row) != set(fields):
            raise ValueError(f"a row does not carry exactly the keys {fields}")
        if not all(isinstance(value, str) and value.strip() for value in row.values()):
            raise ValueError("a value is empty, or is not a string")
    if unique_field:
        values = [row[unique_field] for row in rows]
        if len(set(values)) != len(values):
            raise ValueError(f"the model repeated a value of {unique_field!r}")


def write_rows(
    fields: list[str],
    count: int,
    *,
    unique_field: str | None = None,
    client=None,
    attempts: int = 3,
    temperature: float = 1.0,
) -> list[dict]:
    """
    Return `count` rows of invented text, or raise rather than return junk.

    `client` is injected so this function can be tested without a network call.
    In production it defaults to a real provider client.

    The temperature is high on purpose: varied prose is the only reason to be
    on this rung at all. It is also why the answer has to be checked, and why
    the same call twice gives two different data sets.
    """
    if client is None:  # pragma: no cover - needs a key and a network
        from openai import OpenAI

        client = OpenAI()

    # A model charges by the token. Refusing an oversized batch before calling
    # is not an optimisation, it is a cost control.
    if not 0 < count <= MAX_ROWS:
        raise ValueError(f"ask for between one and {MAX_ROWS} rows at a time")

    prompt = build_prompt(fields, count, unique_field)
    last_error: Exception | None = None
    for _ in range(attempts):
        try:
            answer = client.complete(prompt=prompt, temperature=temperature)
            rows = json.loads(answer)
            check(rows, fields, count, unique_field)
            return rows
        except Exception as error:  # noqa: BLE001 - a bad answer is retried like a failure
            last_error = error
    raise GenerationUnavailable(str(last_error))
