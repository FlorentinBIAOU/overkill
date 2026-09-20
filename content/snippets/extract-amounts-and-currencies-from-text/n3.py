"""
Read the amounts of a document whose currency is written once, in a heading.

Rung N3. It exists for the case rung N0 reports and cannot settle: a table
whose column is headed « Montant (en euros) », a contract that says once that
all sums are in euros, and then three pages of numbers with nothing beside
them. No mark touches those numbers, and attaching the heading to them is a
question about the layout, not about the digits.

The guard keeps the reading verifiable, and it is worth more than the prompt.
The model is asked for spans, not values: each amount it returns must appear in
the document, character for character, and the currency it gives must be named
somewhere in the document. What survives is then read by the same function as
rung N0 — the arithmetic stays where it can be tested, and the model never
hands back a number nobody wrote.

Two operating conditions. The document is cut to a budget, so a contract longer
than the budget is read up to it and no further. And the cost is a call per
document: this rung is for the documents rung N0 reports numbers it could not
mark, not for a mailbox of invoices that carry their symbol.
"""

from __future__ import annotations

import json
import re

from n0 import CODES, MARK, codes_of, read_number

# The budget, in characters. A document that does not fit is cut, not refused.
MAX_CHARACTERS = 6000

# A single code fence around the whole answer is a common shape, and refusing
# it would buy another call for nothing.
FENCE = re.compile(r"\A\s*```(?:json)?\s*(.*?)\s*```\s*\Z", re.DOTALL)

MODEL = "gpt-4.1-mini"  # an example id: check the parameters your model accepts

PROMPT = (
    "Read this document and list the sums of money it quotes.\n"
    "Answer with JSON only: {{\"amounts\": [{{\"text\": \"…\", \"currency\": \"…\"}}]}}.\n"
    "Copy `text` from the document, character for character, and give `currency`"
    " as an ISO 4217 code.\n\n"
    "Document:\n{document}"
)


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


class ReadingUnavailable(Exception):
    """The provider could not be reached, or answered something unusable."""


def read_amounts(text: str, convention: str, client=None, *, attempts: int = 3) -> dict:
    """
    The amounts a model finds, kept only where the document backs them.

    `client` is injected so this function can be tested without a network call.
    In production it defaults to a real provider client.
    """
    client = client or ProviderClient()
    document = text[:MAX_CHARACTERS]
    answer = _ask(client, document, attempts)
    named = {code for mark in MARK.finditer(document) for code in codes_of(mark.group())}

    amounts, dropped = [], []
    for item in answer.get("amounts", []) if isinstance(answer, dict) else []:
        written = str(item.get("text", "")) if isinstance(item, dict) else ""
        currency = str(item.get("currency", "")).upper() if isinstance(item, dict) else ""
        value = read_number(written, convention)[0] if written else None
        if not written or written not in document:
            dropped.append({"text": written, "why": "not in the document"})
        elif currency not in CODES:
            dropped.append({"text": written, "why": f"{currency} is not a code this rung knows"})
        elif currency not in named:
            dropped.append({"text": written, "why": f"{currency} is named nowhere in the document"})
        elif value is None:
            dropped.append({"text": written, "why": "not a number this rung can read"})
        else:
            amounts.append({"text": written, "value": value, "currency": currency,
                            "start": document.index(written)})
    return {"source": "model", "amounts": amounts, "dropped": dropped,
            "characters_sent": len(document)}


def _ask(client, document: str, attempts: int) -> dict:
    prompt = PROMPT.format(document=document)
    last_error: Exception | None = None
    for _ in range(attempts):
        try:
            answer = client.complete(prompt=prompt, temperature=0)
            if not isinstance(answer, str):  # a refusal comes back as no content
                last_error = ValueError("the model answered no text")
                continue
            fenced = FENCE.match(answer)
            return json.loads(fenced.group(1) if fenced else answer)
        except Exception as error:  # noqa: BLE001 - any provider failure is retried
            last_error = error
    raise ReadingUnavailable(str(last_error))
