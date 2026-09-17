"""
Tag articles by asking a general-purpose model.

Rung N3. On this entry it is the only rung that needs neither a term list, nor
a labelled corpus, nor a model file. It is here so you can see what it costs,
not because this entry recommends it.

Note what the code has to do that N0 did not: cap the input size, retry on
failure, parse an answer that is only probably valid JSON, and keep only the
topics that exist in your taxonomy. That last one is not optional — nothing
stops a model from answering a name that is not on the list — and it is why
the vocabulary stays a parameter here, exactly as it was on the bottom rung.

That plumbing is the real cost of this rung, and it is the part your tests have
to cover, because a test against a double says nothing of how the model tags.
"""

from __future__ import annotations

import json
import unicodedata

PROMPT = (
    "Tag the article below with the topics it covers.\n"
    "Choose only from this list, and answer with the spellings given:\n"
    "{topics}\n"
    "An article may cover several topics, or none at all.\n"
    "Answer with JSON only: a list of topic names, empty if none apply.\n\n"
    "Article:\n{article}"
)

MAX_CHARACTERS = 12000

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


class TaggingUnavailable(Exception):
    """The provider could not be reached, or answered something unusable."""


def tag(article: str, topics: list[str], client=None, *, attempts: int = 3) -> list[str]:
    """
    The topics of the article, in the order of the taxonomy.

    `client` is injected so this function can be tested without a network call.
    In production it defaults to a real provider client.
    """
    # A model charges by the token. Refusing oversized input is not an
    # optimisation, it is a cost control.
    if len(article) > MAX_CHARACTERS:
        raise ValueError(f"article longer than {MAX_CHARACTERS} characters")
    # No text or no topic: the answer is known, and asking would still be billed.
    if not article.strip() or not topics:
        return []
    return _ask(client or ProviderClient(), article, topics, attempts)


def _key(name: str) -> str:
    """The same name whatever its case, its spacing or its Unicode form."""
    return unicodedata.normalize("NFC", name).strip().casefold()


def _ask(client, article: str, topics: list[str], attempts: int) -> list[str]:
    prompt = PROMPT.format(topics="\n".join(f"- {topic}" for topic in topics), article=article)
    last_error: Exception | None = None
    for _ in range(attempts):
        try:
            # Temperature zero, the low end of the range, which the provider
            # documents as more focused and deterministic. It does not promise
            # that two identical calls agree.
            answer = client.complete(prompt=prompt, temperature=0)
        except Exception as error:  # noqa: BLE001 - any provider failure is retried
            last_error = error
            continue
        try:
            return _decode(answer, topics)
        except ValueError as error:  # an unusable answer is asked for again
            last_error = error
    raise TaggingUnavailable(str(last_error))


def _decode(answer, topics: list[str]) -> list[str]:
    """
    Keep only what the taxonomy knows, in the taxonomy's own order. A model
    that answers "actualité juridique" must not create a topic in your
    database, and the order of its answer must not decide the order of yours.
    """
    if not isinstance(answer, str):  # the SDK types the content as optional
        raise ValueError("the model returned no text")
    # A JSON answer wrapped whole in one code fence is read; nothing else is:
    # a fence opened and never closed, or prose around it, is a failed answer.
    text = answer.strip()
    if text.startswith("```") and text.endswith("```") and text.count("```") == 2:
        text = text[3:-3].removeprefix("json")
    try:
        parsed = json.loads(text)
    except RecursionError as error:
        raise ValueError("the answer is nested too deep to read") from error
    # A list of anything but names, or of names none of which is on the list,
    # must not pass for the legitimate empty answer.
    if not isinstance(parsed, list) or not all(isinstance(name, str) for name in parsed):
        raise ValueError("the model answered something that is not a list of names")
    answered = {_key(name) for name in parsed}
    kept = [topic for topic in topics if _key(topic) in answered]
    if parsed and not kept:
        raise ValueError("the model answered only names that are not in the taxonomy")
    return kept
