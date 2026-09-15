"""
Write a product description by asking a general-purpose model.

Rung N3. On most entries of this site this rung is the expensive answer to a
question that did not need it. Here it is the one that wins: the template of
rung N0 draws every sentence from a list written in advance, and its test
counts the frames that repeat, while this rung asks for new prose on every
call.

What it costs is visible in the code, and none of it is the model's doing: the
request, the size cap, the retry, an answer that is only probably JSON, and a
temperature above zero — variety is the thing being bought here, and the SDK
documents higher temperatures as making the output more random, so nothing can
be reviewed once and trusted afterwards.

Which is why the last check is the one from the rung below. A model that writes
freely also claims freely. The copy is read back against the record, term by
term, and anything the record does not support is refused rather than
published.
"""

from __future__ import annotations

import json
import re
import unicodedata

# The instructions are written in the language of the shop, like the copy.
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
    attributes = _attributes(product)
    if not attributes:
        raise ValueError("empty product record: nothing to describe")
    if len(attributes) > MAX_CHARACTERS:
        raise ValueError(f"product record longer than {MAX_CHARACTERS} characters")
    client = client or ProviderClient()

    description = _ask(client, f"{PROMPT}\n{attributes}", attempts, temperature)
    if len(description) < MIN_CHARACTERS:
        raise DescriptionUnavailable("the model answered a fragment")

    invented = [
        term for term in vocabulary if _states(description, term) and not _states(attributes, term)
    ]
    if invented:
        raise UngroundedDescription(", ".join(invented))
    return description


def _attributes(product: dict) -> str:
    """One « field: value » line per attribute, which is what the model reads."""
    lines = []
    for key, value in product.items():
        items = value if isinstance(value, (list, tuple)) else [value]
        joined = ", ".join(str(item) for item in items if item is not None)  # None: a NULL column
        if joined.strip():
            lines.append(f"- {key} : {joined.strip()}")
    return "\n".join(lines)


def _ask(client, prompt: str, attempts: int, temperature: float) -> str:
    """Call the provider, decode the answer, and retry what can be retried."""
    last_error: Exception | None = None
    for _ in range(attempts):
        try:
            answer = _decode(client.complete(prompt=prompt, temperature=temperature))
            written = answer.get("description") if isinstance(answer, dict) else None
            if isinstance(written, str) and written.strip():
                return " ".join(written.split())
            last_error = ValueError("the model answered without a description")
        except Exception as error:  # noqa: BLE001 - any provider failure is retried
            last_error = error
    raise DescriptionUnavailable(str(last_error))


def _decode(answer):
    """JSON, or JSON wrapped whole in one code fence. No text (a refusal) is unusable."""
    if not isinstance(answer, str):
        raise ValueError("the model returned no text")
    text = answer.strip()
    if text.startswith("```") and text.endswith("```") and text.count("```") == 2:
        text = text[3:-3].removeprefix("json")
    return json.loads(text)


# A term right after one of these words is denied, not stated: « non étanche ».
NEGATIONS = frozenset({"non", "pas", "sans", "ni", "aucun", "aucune"})


def _states(text: str, term: str) -> bool:
    """
    Whether the text states the term: whole words, case and accents set aside,
    each word allowed the agreement endings e, s and es (« garantie à vie »
    states « garanti à vie »), and not right after a negation.
    """
    folded = _fold(text)
    words = r"\s+".join(re.escape(word) + "(?:e|s|es)?" for word in _fold(term).split())
    for found in re.finditer(rf"(?<!\w){words}(?!\w)", folded):
        before = re.findall(r"\w+", folded[: found.start()])
        if not before or before[-1] not in NEGATIONS:
            return True
    return False


def _fold(text: str) -> str:
    """Lowercase and drop accents, so « À vie » meets « a vie »."""
    letters = unicodedata.normalize("NFD", str(text).lower())
    return "".join(char for char in letters if not unicodedata.combining(char))
