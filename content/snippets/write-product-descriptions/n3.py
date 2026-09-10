"""
Write a product description by asking a general-purpose model.

Rung N3. On most entries of this site this rung is the expensive answer to a
question that did not need it. Here it is the one that wins: turning a bag of
attributes into prose that reads differently for every product is precisely
what a general-purpose model does better than anything below it, and no amount
of template writing closes that gap.

What it costs is visible in the code, and none of it is the model's doing: the
request, the size cap, the retry, an answer that is only probably JSON, and a
temperature above zero — because variety is the thing being bought here, so
two runs on the same product will not agree, and nothing can be reviewed once
and trusted afterwards.

Which is why the last check is the one from the rung below. A model that writes
freely also claims freely. The copy is read back against the record, term by
term, and anything the record does not support is refused rather than
published.
"""

from __future__ import annotations

import json
import re
import unicodedata

# The instructions are written in the language of the shop: a model asked in
# English for French copy answers in French with an English cadence.
PROMPT = (
    "Tu rédiges la présentation d'un article pour une boutique en ligne.\n"
    "Écris deux phrases en français, sans superlatif, et n'affirme rien qui ne\n"
    "figure pas dans les caractéristiques ci-dessous.\n"
    "Réponds par un objet JSON et rien d'autre : {\"description\": \"…\"}.\n"
    "\n"
    "Caractéristiques :"
)

# A model charges by the token. Refusing an oversized record is not an
# optimisation, it is a cost control.
MAX_CHARACTERS = 600

# Shorter than that, the model answered a fragment and not a description.
MIN_CHARACTERS = 40


class DescriptionUnavailable(Exception):
    """The provider failed, or answered something no shop can publish."""


class UngroundedDescription(DescriptionUnavailable):
    """The copy claims an attribute the product record does not carry."""


def describe(
    product: dict,
    client=None,
    *,
    vocabulary=(),
    attempts: int = 3,
    temperature: float = 0.7,
) -> str:
    """
    Write the description of one product.

    `client` is injected so this can be tested without a network call; in
    production it defaults to a real provider client.

    `vocabulary` is the attribute words your catalogue uses — materials,
    finishes, features, claims. A word of that list found in the copy and
    nowhere in the record is an invention, and refused. An empty vocabulary
    switches the check off, which is a decision, not a default to leave alone.
    """
    if client is None:  # pragma: no cover - needs a key and a network
        from openai import OpenAI

        client = OpenAI()

    attributes = _attributes(product)
    if len(attributes) > MAX_CHARACTERS:
        raise ValueError(f"product record longer than {MAX_CHARACTERS} characters")

    description = _ask(client, f"{PROMPT}\n{attributes}", attempts, temperature)
    if len(description) < MIN_CHARACTERS:
        raise DescriptionUnavailable("the model answered a fragment")

    invented = [
        term for term in vocabulary if _says(description, term) and not _says(attributes, term)
    ]
    if invented:
        raise UngroundedDescription(", ".join(invented))
    return description


def _attributes(product: dict) -> str:
    """One « field: value » line per attribute, which is what the model reads."""
    lines = []
    for key, value in product.items():
        joined = ", ".join(str(item) for item in value) if isinstance(value, (list, tuple)) else str(value)
        if joined.strip():
            lines.append(f"- {key} : {joined.strip()}")
    return "\n".join(lines)


def _ask(client, prompt: str, attempts: int, temperature: float) -> str:
    """Call the provider, decode the answer, and retry what can be retried."""
    last_error: Exception | None = None
    for _ in range(attempts):
        try:
            answer = json.loads(client.complete(prompt=prompt, temperature=temperature))
            written = answer.get("description", "") if isinstance(answer, dict) else ""
            if written.strip():
                return " ".join(written.split())
            last_error = ValueError("the model answered without a description")
        except Exception as error:  # noqa: BLE001 - any provider failure is retried
            last_error = error
    raise DescriptionUnavailable(str(last_error))


def _says(text: str, term: str) -> bool:
    """Whole-word search, case and accents set aside."""
    return re.search(rf"\b{re.escape(_fold(term))}\b", _fold(text)) is not None


def _fold(text: str) -> str:
    """Lowercase and drop accents, so « À vie » meets « a vie »."""
    letters = unicodedata.normalize("NFD", str(text).lower())
    return "".join(char for char in letters if not unicodedata.combining(char))
