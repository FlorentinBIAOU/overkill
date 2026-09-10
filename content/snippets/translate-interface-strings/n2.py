"""
Translate with a self-hosted neural model, one pair of languages at a time.

Rung N2. This is the rung that actually translates: unlike the memory of N0,
it has an answer for a string nobody has ever written before. The price is a
model file per language pair to ship, keep in sync and hold in a warm process,
and an output nobody can explain.

Most of the code below is not about translating. It is about the interpolation
variables, and that is the honest picture of this rung. A translation model
sees `{count} items selected` as text, so it happily translates the word
inside the braces, drops it, or repeats it. The interface then prints a brace
where a number should be, and the bug reaches production because the string
looked fine to everyone who does not read that language.

So the variables are hidden behind neutral markers before the model sees the
string, put back afterwards, and counted. Moving a marker is allowed — word
order is the model's job. Losing or inventing one is reported, and the caller
gets a flagged draft instead of a broken interface.
"""

from __future__ import annotations

import re
from types import SimpleNamespace

MODEL_NAME = "Helsinki-NLP/opus-mt-en-fr"

# The variable forms an interface uses: {count}, {}, %s, %d, %(count)s,
# and the numbered variant of %s that Android and iOS string files carry.
PLACEHOLDER = re.compile(r"\{[A-Za-z0-9_]*\}|%(?:\([A-Za-z0-9_]+\)|\d+\$)?[sd]")

# The stand-in the model sees instead of a variable. Deliberately not a word.
MARK = "⟦{}⟧"


class TranslationUnavailable(Exception):
    """The model failed every attempt, or returned nothing usable."""


def load_translator(name: str = MODEL_NAME):
    """The real model: weights on disk, loaded once, run locally."""
    from transformers import pipeline  # pragma: no cover - needs the weights

    pipe = pipeline("translation", model=name)
    return SimpleNamespace(generate=lambda text: pipe(text)[0]["translation_text"])


def placeholders(text: str) -> list[str]:
    """The interpolation variables, in the order they appear."""
    return PLACEHOLDER.findall(text)


def translate(source: str, model=None, *, attempts: int = 2) -> dict:
    """
    Translate one interface string, and check what came back.

    `model` is injected so this can be tested without loading the weights.
    Left alone, it is the real one above.
    """
    model = load_translator() if model is None else model
    if not source.strip():
        return {"target": source, "review": False, "warnings": []}

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
        if output and output.strip():
            return output
        last_error = ValueError("the model returned an empty translation")
    raise TranslationUnavailable(str(last_error))
