"""
Translate with a self-hosted neural model, one pair of languages at a time.

Rung N2. This is the rung that translates: unlike the memory of N0, it returns
an answer for a string that is in no memory. The price is one model per
language pair: this one reads English and writes French.

Most of the code below is not about translating. It is about the interpolation
variables. A translation model reads `{count}` as text: run against
opus-mt-en-fr, `{count} items selected` comes back as
`{compte} éléments sélectionnés`, and the interface prints a brace where a
number should be.

So each variable is swapped for a numbered marker before the model sees the
string, put back afterwards, and counted. Moving a marker is allowed — word
order is the model's job. Losing or inventing one is reported, and the caller
gets a flagged draft instead of a broken interface. An ICU plural or select
message always goes to review: its branches hold text to translate next to
keywords to keep, and one marker cannot separate the two.
"""

from __future__ import annotations

import re
from types import SimpleNamespace

MODEL_NAME = "Helsinki-NLP/opus-mt-en-fr"

# The variable forms an interface uses: {{count}} (i18next), {count}, {}, the
# head of an ICU argument such as {count, plural, ...}, %s, %d, %(count)s, the
# numbered %1$s of Android, and the %@, %1$@ and %ld of iOS.
PLACEHOLDER = re.compile(
    r"\{\{\s*[A-Za-z0-9_.]+\s*\}\}|\{[A-Za-z0-9_]*\}|\{\s*[A-Za-z0-9_]+\s*,\s*[A-Za-z]+"
    r"|%(?:\([A-Za-z0-9_]+\)|\d+\$)?l{0,2}[sd@]"
)

# The stand-in the model sees instead of a variable. Its pieces are in the
# model's vocabulary, so the model can write it back; a marker made of
# characters the vocabulary lacks is dropped. Check again if you change model.
MARK = "[{}]"


class TranslationUnavailable(Exception):
    """The model failed every attempt, or returned nothing usable."""


def load_translator(name: str = MODEL_NAME):
    """The real model: weights on disk, loaded once, run locally."""
    # transformers 5 removed the "translation" pipeline: call the model itself.
    from transformers import AutoModelForSeq2SeqLM, AutoTokenizer  # pragma: no cover

    tokenizer = AutoTokenizer.from_pretrained(name)
    model = AutoModelForSeq2SeqLM.from_pretrained(name)

    def generate(text: str) -> str:
        output = model.generate(**tokenizer([text], return_tensors="pt"))
        return tokenizer.decode(output[0], skip_special_tokens=True)

    return SimpleNamespace(generate=generate)


def placeholders(text: str) -> list[str]:
    """The interpolation variables, in the order they appear."""
    return PLACEHOLDER.findall(text)


def translate(source: str, model=None, *, attempts: int = 2) -> dict:
    """
    Translate one interface string, and check what came back.

    `model` is injected so this can be tested without loading the weights.
    Left alone, it is the real one above.
    """
    if not source.strip():
        return {"target": source, "review": False, "warnings": []}
    model = load_translator() if model is None else model

    variables = placeholders(source)
    masked = source
    for index, variable in enumerate(variables):
        masked = masked.replace(variable, MARK.format(index), 1)

    target = _generate(model, masked, attempts).strip()
    for index, variable in enumerate(variables):
        target = target.replace(MARK.format(index), variable)

    warnings = []
    found = placeholders(target)
    if sorted(found) != sorted(variables):
        warnings.append(
            "variables differ from the source: expected "
            + (" ".join(variables) or "none") + ", got " + (" ".join(found) or "none")
        )
    if any("," in variable for variable in variables):
        warnings.append("ICU message: check its branches by hand")
    return {"target": target, "review": bool(warnings), "warnings": warnings}


def _generate(model, text: str, attempts: int) -> str:
    """A local model still fails: out of memory, a worker that died, a batch."""
    last_error: Exception | None = None
    for _ in range(attempts):
        try:
            output = model.generate(text)
        except Exception as error:  # noqa: BLE001 - any model failure is retried
            last_error = error
            continue
        if isinstance(output, str) and output.strip():
            return output
        last_error = ValueError("the model returned no translation text")
    raise TranslationUnavailable(str(last_error))
