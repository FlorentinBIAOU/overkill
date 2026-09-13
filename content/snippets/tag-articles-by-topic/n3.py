"""
Tag articles by asking a general-purpose model.

Rung N3. This is the option people reach for first, and on this entry it is
the only one that needs neither a term list, nor a labelled corpus, nor a
model file. It is here so you can see what it costs, not because this entry
recommends it.

Note what the code has to do that N0 did not: cap the input size, retry on
failure, parse an answer that is only probably valid JSON, and keep only the
topics that exist in your taxonomy. That last one is not optional — a model
will happily invent a plausible topic — and it is why the vocabulary stays a
parameter here, exactly as it was on the bottom rung.

That plumbing is the real cost of this rung, and it is the part your tests have
to cover, because the model itself is not testable.
"""

from __future__ import annotations

import json

PROMPT = (
    "Tag the article below with the topics it covers.\n"
    "Choose only from this list, and answer with the spellings given:\n"
    "{topics}\n"
    "An article may cover several topics, or none at all.\n"
    "Answer with JSON only: a list of topic names, empty if none apply.\n\n"
    "Article:\n{article}"
)

MAX_CHARACTERS = 12000


class TaggingUnavailable(Exception):
    """The provider could not be reached, or answered something unusable."""


def tag(article: str, topics: list[str], client=None, *, attempts: int = 3) -> list[str]:
    """
    The topics of the article, in the order of the taxonomy.

    `client` is injected so this function can be tested without a network call.
    In production it defaults to a real provider client.
    """
    if client is None:  # pragma: no cover - needs a key and a network
        from openai import OpenAI

        client = OpenAI()

    # A model charges by the token. Refusing oversized input is not an
    # optimisation, it is a cost control.
    if len(article) > MAX_CHARACTERS:
        raise ValueError(f"article longer than {MAX_CHARACTERS} characters")

    reported = _ask(client, article, topics, attempts)

    # Keep only what the taxonomy knows, and answer in the taxonomy's own
    # order. A model that invents "actualité juridique" must not create a
    # topic in your database, and two identical calls must file an article the
    # same way twice.
    answered = {name.strip().lower() for name in reported if isinstance(name, str)}
    return [topic for topic in topics if topic.lower() in answered]


def _ask(client, article: str, topics: list[str], attempts: int) -> list:
    prompt = PROMPT.format(
        topics="\n".join(f"- {topic}" for topic in topics), article=article
    )
    last_error: Exception | None = None
    for _ in range(attempts):
        try:
            answer = client.complete(prompt=prompt, temperature=0)
            parsed = json.loads(answer)
            if isinstance(parsed, list):
                return parsed
            last_error = ValueError("the model answered something that is not a list")
        except Exception as error:  # noqa: BLE001 - any provider failure is retried
            last_error = error
    raise TaggingUnavailable(str(last_error))
