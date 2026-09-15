"""
Translate by asking a general-purpose model, with the interface context.

Rung N3. What this rung buys over a translation model is the context: a
translator model gets a string and nothing else, while a general-purpose model
can be told that `Save` is the label of a button and not the verb in a
sentence, that the interface is addressed to a customer rather than an
administrator, and that there is no room for a full sentence.

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
# string. Refusing it here, and a context as long, is a cost control.
MAX_CHARACTERS = 2000

# The variable forms an interface uses: {{count}} (i18next), {count}, {}, the
# head of an ICU argument such as {count, plural, ...}, %s, %d, %(count)s, the
# numbered %1$s of Android, and the %@, %1$@ and %ld of iOS.
PLACEHOLDER = re.compile(
    r"\{\{\s*[A-Za-z0-9_.]+\s*\}\}|\{[A-Za-z0-9_]*\}|\{\s*[A-Za-z0-9_]+\s*,\s*[A-Za-z]+"
    r"|%(?:\([A-Za-z0-9_]+\)|\d+\$)?l{0,2}[sd@]"
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
    if len(source) > MAX_CHARACTERS or len(context) > MAX_CHARACTERS:
        raise ValueError(f"string or context longer than {MAX_CHARACTERS} characters")
    if not source.strip():  # nothing to translate is not worth a call
        return {"target": source, "review": False, "warnings": []}
    client = client or ProviderClient()

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
    if any("," in variable for variable in variables):
        warnings.append("ICU message: check its branches by hand")
    return {"target": target, "review": bool(warnings), "warnings": warnings}


def _ask(client, prompt: str, attempts: int) -> str:
    last_error: Exception | None = None
    for _ in range(attempts):
        try:
            # The lowest temperature: the SDK documents lower values as more
            # focused and deterministic.
            answer = client.complete(prompt=prompt, temperature=0)
            if not isinstance(answer, str):  # a refusal comes back as no content
                last_error = ValueError("the model answered no text")
                continue
            text = answer.strip()
            # A JSON answer wrapped whole in one code fence is read; nothing else is.
            if text.startswith("```") and text.endswith("```") and text.count("```") == 2:
                text = text[3:-3].removeprefix("json")
            parsed = json.loads(text)
            target = parsed.get("translation") if isinstance(parsed, dict) else None
            if isinstance(target, str) and target.strip():
                return target.strip()
            last_error = ValueError("the model answered without a translation")
        except Exception as error:  # noqa: BLE001 - any provider failure is retried
            last_error = error
    raise TranslationUnavailable(str(last_error))
