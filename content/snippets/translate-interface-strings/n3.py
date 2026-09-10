"""
Translate by asking a general-purpose model, with the interface context.

Rung N3. What this rung buys over a translation model is the context: a
translator model gets a string and nothing else, while a general-purpose model
can be told that `Save` is the label of a button and not the verb in a
sentence, that the interface is addressed to a customer rather than an
administrator, and that there is no room for a full sentence. That is exactly
the information a translation team asks for and rarely gets.

What it costs is everything around the call: a key, a provider that answers
prose when JSON was asked for, retries, a cap on the input, and the same
variable check as the rung below, because being asked to keep `{count}`
verbatim is not the same as doing it.
"""

from __future__ import annotations

import json
import re

PROMPT = (
    "Translate the user interface string below into {language}.\n"
    "Where it appears in the interface: {context}\n"
    "Keep these interpolation variables exactly as written: {variables}\n"
    "Keep the length of an interface label, not of a sentence.\n"
    'Answer with JSON only: {{"translation": "..."}}\n\n'
    "String:\n{source}"
)

# An interface string that no longer fits on one screen is not an interface
# string. Refusing it here is a cost control, not an optimisation.
MAX_CHARACTERS = 2000

# The variable forms an interface uses: {count}, {}, %s, %d, %(count)s,
# and the numbered variant of %s that Android and iOS string files carry.
PLACEHOLDER = re.compile(r"\{[A-Za-z0-9_]*\}|%(?:\([A-Za-z0-9_]+\)|\d+\$)?[sd]")


class TranslationUnavailable(Exception):
    """The provider could not be reached, or answered something unusable."""


def placeholders(text: str) -> list[str]:
    """The interpolation variables, sorted so a moved one still matches."""
    return sorted(PLACEHOLDER.findall(text))


def translate(source: str, language: str, *, context: str = "",
              client=None, attempts: int = 3) -> dict:
    """
    Translate one interface string, with what the model needs to know about it.

    `client` is injected so this function can be tested without a network
    call. In production it defaults to a real provider client.
    """
    if client is None:  # pragma: no cover - needs a key and a network
        from openai import OpenAI

        client = OpenAI()
    if len(source) > MAX_CHARACTERS:
        raise ValueError(f"string longer than {MAX_CHARACTERS} characters")

    variables = placeholders(source)
    prompt = PROMPT.format(
        language=language,
        context=context or "not given",
        variables=" ".join(variables) or "none",
        source=source,
    )
    target = _ask(client, prompt, attempts)

    warnings = []
    if placeholders(target) != variables:
        warnings.append("the model did not keep the interpolation variables")
    return {"target": target, "review": bool(warnings), "warnings": warnings}


def _ask(client, prompt: str, attempts: int) -> str:
    last_error: Exception | None = None
    for _ in range(attempts):
        try:
            # Temperature zero: two identical strings must not come back
            # translated two different ways in the same interface.
            answer = client.complete(prompt=prompt, temperature=0)
            parsed = json.loads(answer)
            target = parsed.get("translation") if isinstance(parsed, dict) else None
            if isinstance(target, str) and target.strip():
                return target.strip()
            last_error = ValueError("the model answered without a translation")
        except Exception as error:  # noqa: BLE001 - any provider failure is retried
            last_error = error
    raise TranslationUnavailable(str(last_error))
