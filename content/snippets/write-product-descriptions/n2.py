"""
Write a product description with a small self-hosted generative model.

Rung N2. A sequence-to-sequence checkpoint that lives on your own disk,
fine-tuned on the descriptions your shop has already published, so that it
writes in your voice rather than in the average voice of the web. Nothing
leaves your machines and nothing is metered.

The prose is freer than a template's, and everything else on this rung is code
you now own: the source line the model was fine-tuned to read, the size cap,
the retry, the sentence a small model leaves half-finished when its token
budget runs out, and the check at the end.

That check is the point of this file. A generative model writes what sounds
right. Handed a bag, it will sooner or later call it waterproof, because the
sentences it learnt from ended that way, and nothing inside it distinguishes an
attribute of this product from a plausible attribute. So the copy is read back
against the record, term by term, and anything the record does not support is
refused. A shop that promises what it does not sell has a legal problem, not a
style problem.
"""

from __future__ import annotations

import re
import unicodedata

# One product record, written on one line. Longer than that, it is not a
# product record, and the model only wanders further from it.
MAX_CHARACTERS = 600

# Shorter than that, the model handed back a fragment and not a description.
MIN_CHARACTERS = 40


class DescriptionUnavailable(Exception):
    """The model failed, or answered something no shop can publish."""


class UngroundedDescription(DescriptionUnavailable):
    """The copy claims an attribute the product record does not carry."""


class LocalCopywriter:
    """The real model: a fine-tuned checkpoint on your disk, loaded once."""

    def __init__(self, checkpoint: str = "./models/catalogue-copy") -> None:
        from transformers import pipeline  # a large local install

        self._write = pipeline("text2text-generation", model=checkpoint)

    def generate(self, source: str, **options) -> str:
        return self._write(source, **options)[0]["generated_text"]


def describe(product: dict, model=None, *, vocabulary=(), attempts: int = 2) -> str:
    """
    Write the description of one product.

    `model` is injected so this can be tested without the checkpoint; in
    production it defaults to the real one above.

    `vocabulary` is the attribute words your catalogue uses — materials,
    finishes, features, claims. It is what makes the grounding check possible:
    a word of that list found in the copy and nowhere in the record is an
    invention. An empty vocabulary switches the check off, which is a decision,
    not a default to leave alone.
    """
    model = model or LocalCopywriter()
    source = _source(product)
    if len(source) > MAX_CHARACTERS:
        raise ValueError(f"product record longer than {MAX_CHARACTERS} characters")

    description = _whole_sentences(_generate(model, source, attempts))
    if len(description) < MIN_CHARACTERS:
        raise DescriptionUnavailable("the model answered a fragment")

    invented = [term for term in vocabulary if _says(description, term) and not _says(source, term)]
    if invented:
        raise UngroundedDescription(", ".join(invented))
    return description


def _source(product: dict) -> str:
    """The shape the model was fine-tuned on: one line of « field: value »."""
    fields = []
    for key, value in product.items():
        joined = ", ".join(str(item) for item in value) if isinstance(value, (list, tuple)) else str(value)
        if joined.strip():
            fields.append(f"{key}: {joined.strip()}")
    return " | ".join(fields)


def _generate(model, source: str, attempts: int) -> str:
    """Retry: on a machine that also serves the shop, the first call fails."""
    last_error: Exception | None = None
    for _ in range(attempts):
        try:
            return model.generate(source, max_new_tokens=90, num_beams=4)
        except Exception as error:  # noqa: BLE001 - any model failure is retried
            last_error = error
    raise DescriptionUnavailable(str(last_error))


def _whole_sentences(text) -> str:
    """
    Keep only what the model finished saying.

    A small model stops when its budget runs out, mid-sentence and sometimes
    mid-word. Publishing that is worse than publishing nothing at all.
    """
    text = " ".join(str(text).split())
    end = max(text.rfind(mark) for mark in ".!?")
    return text[: end + 1] if end >= 0 else ""


def _says(text: str, term: str) -> bool:
    """Whole-word search, case and accents set aside."""
    return re.search(rf"\b{re.escape(_fold(term))}\b", _fold(text)) is not None


def _fold(text: str) -> str:
    """Lowercase and drop accents, so « Étanche » meets « etanche »."""
    letters = unicodedata.normalize("NFD", str(text).lower())
    return "".join(char for char in letters if not unicodedata.combining(char))
