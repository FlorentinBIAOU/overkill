"""
Repair the rows rung N0 refused, and only those, by asking a model.

Rung N3. The word that makes this rung defensible on this entry is "only".
The file may hold a hundred thousand rows; the journal of rung N0 holds the
handful that did not fit. One call per refused row, and none at all for the
rest. Hand the whole file to a model instead and you have paid for the
ninety-nine per cent that a regular expression had already dealt with.

Note what this code has to do that rung N0 did not: build a prompt, retry a
failed call, parse an answer that is only probably valid JSON, and put the
answer back through the coercion of N0 before believing a word of it. That
plumbing is the real cost of this rung, and it is the part the tests have to
cover, because the model itself is not testable.
"""

from __future__ import annotations

import json

from n0 import Rejected, coerce_row

PROMPT = (
    "A row of a CSV file was refused by a type check. Repair it.\n"
    "Columns, in order, with the type each one expects:\n"
    "{schema}\n"
    "The row was refused because: {reason}\n"
    "Its fields, as they were read: {fields}\n\n"
    "Answer with JSON only: one object, one key per column, every value a\n"
    "string in the expected format. Dates are written YYYY-MM-DD. If the row\n"
    "cannot be repaired, answer with an empty object."
)

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


def repair_rejected_rows(header, rejects, schema, client=None, *, attempts: int = 3) -> dict:
    """
    Return the rows that were repaired, and the ones that were not.

    `rejects` is the journal returned by `clean_csv` of rung N0. Nothing else
    from the file is read: one call per entry of that journal, and up to
    `attempts` for an entry whose calls fail.

    A row that cannot be repaired comes back in `unrepairable`, carrying its
    original line, column and fields, plus the reason the repair failed. It is
    never dropped: this rung exists because rung N0 refused to drop it either.

    `client` is injected so this function can be tested without a network
    call. In production it defaults to a real provider client.
    """
    if not rejects:
        return {"rows": [], "unrepairable": []}
    client = client or ProviderClient()

    described = "\n".join(f"- {name}: {schema.get(name, 'text')}" for name in header)
    rows, unrepairable = [], []
    for reject in rejects:
        prompt = PROMPT.format(
            schema=described,
            reason=reject["reason"],
            fields=json.dumps(reject["fields"], ensure_ascii=False),
        )
        answer = _ask(client, prompt, attempts)
        if answer is None:
            unrepairable.append({**reject, "reason": "the model did not return a usable object"})
        elif not answer:
            unrepairable.append({**reject, "reason": "the model could not repair the row"})
        else:
            # The answer is only a proposal. Every column has to come back as
            # text, and the refused value cannot come back empty: coercion
            # would read an empty cell as missing and let the row through.
            fields = [answer.get(name) for name in header]
            if not all(isinstance(value, str) for value in fields):
                unrepairable.append({**reject, "reason": "the answer does not give every column as text"})
                continue
            if reject["column"] and not answer[reject["column"]].strip():
                unrepairable.append({**reject, "reason": "the answer empties the refused value"})
                continue
            try:
                rows.append(coerce_row(header, fields, schema))
            except Rejected as refusal:
                unrepairable.append(
                    {
                        **reject,
                        "column": refusal.column,
                        "reason": f"the repair was refused too: {refusal.reason}",
                    }
                )
    return {"rows": rows, "unrepairable": unrepairable}


def _ask(client, prompt: str, attempts: int):
    """
    Return the decoded object, or None when nothing usable came back.

    A failed call is retried; an unusable answer is not, and its row goes to
    `unrepairable` for a person to look at.
    """
    for _ in range(attempts):
        try:
            # The lowest temperature: the SDK documents lower values as more
            # focused and deterministic.
            answer = client.complete(prompt=prompt, temperature=0)
        except Exception:  # noqa: BLE001 - any provider failure is worth one more try
            continue
        if not isinstance(answer, str):  # a refusal comes back as no content
            return None
        text = answer.strip()
        # A JSON answer wrapped whole in one code fence is read; nothing else is.
        if text.startswith("```") and text.endswith("```") and text.count("```") == 2:
            text = text[3:-3].removeprefix("json")
        try:
            parsed = json.loads(text)
        except ValueError:
            return None
        return parsed if isinstance(parsed, dict) else None
    return None
