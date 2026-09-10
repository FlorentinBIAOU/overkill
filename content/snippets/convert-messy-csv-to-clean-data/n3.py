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


def repair_rejected_rows(header, rejects, schema, client=None, *, attempts: int = 3) -> dict:
    """
    Return the rows that were repaired, and the ones that were not.

    `rejects` is the journal returned by `clean_csv` of rung N0. Nothing else
    from the file is read, and the number of calls made is exactly the length
    of that journal.

    A row that cannot be repaired comes back in `unrepairable`, carrying its
    original line, column and fields, plus the reason the repair failed. It is
    never dropped: this rung exists because rung N0 refused to drop it either.

    `client` is injected so this function can be tested without a network
    call. In production it defaults to a real provider client.
    """
    if client is None:  # pragma: no cover - needs a key and a network
        from openai import OpenAI

        client = OpenAI()

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
            # The answer is only a proposal. It goes through the same coercion
            # every other row went through, and it is refused on the same terms.
            fields = [str(answer.get(name, "")) for name in header]
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

    A failed call is retried; an unusable answer is not. At temperature zero
    the same prompt gives the same answer, so asking a second time buys
    nothing but a second bill.
    """
    for _ in range(attempts):
        try:
            answer = client.complete(prompt=prompt, temperature=0)
        except Exception:  # noqa: BLE001 - any provider failure is worth one more try
            continue
        try:
            parsed = json.loads(answer)
        except ValueError:
            return None
        return parsed if isinstance(parsed, dict) else None
    return None
