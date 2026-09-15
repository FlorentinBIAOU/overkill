"""
Write a product description with a small self-hosted generative model.

Rung N2. A sequence-to-sequence checkpoint that lives on your own disk,
fine-tuned on the descriptions your shop has already published. Nothing
leaves your machines and nothing is metered.

Around the model, everything on this rung is code you now own: the source line
the model was fine-tuned to read, the size cap, the retry, the sentence a small
model leaves half-finished when its token budget runs out, and the check at the
end.

That check is the point of this file. The E2E generation challenge found that
sequence-to-sequence models without a semantic control often fail to express
the attributes they are given correctly. So the copy is read back against the record, term by term, and
anything the record does not support is refused. A shop that promises what it
does not sell has a legal problem, not a style problem.
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
        # transformers 5 removed the "text2text-generation" pipeline: the
        # tokenizer and the model are called directly.
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer  # a large local install

        self._tokenizer = AutoTokenizer.from_pretrained(checkpoint)
        self._model = AutoModelForSeq2SeqLM.from_pretrained(checkpoint)

    def generate(self, source: str, **options) -> str:
        output = self._model.generate(**self._tokenizer([source], return_tensors="pt"), **options)
        return self._tokenizer.decode(output[0], skip_special_tokens=True)


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
    source = _source(product)
    if not source:
        raise ValueError("empty product record: nothing to describe")
    if len(source) > MAX_CHARACTERS:
        raise ValueError(f"product record longer than {MAX_CHARACTERS} characters")
    model = model or LocalCopywriter()

    description = _whole_sentences(_generate(model, source, attempts))
    if len(description) < MIN_CHARACTERS:
        raise DescriptionUnavailable("the model answered a fragment")

    invented = [term for term in vocabulary if _states(description, term) and not _states(source, term)]
    if invented:
        raise UngroundedDescription(", ".join(invented))
    return description


def _source(product: dict) -> str:
    """The shape the model was fine-tuned on: one line of « field: value »."""
    fields = []
    for key, value in product.items():
        items = value if isinstance(value, (list, tuple)) else [value]
        joined = ", ".join(str(item) for item in items if item is not None)  # None: a NULL column
        if joined.strip():
            fields.append(f"{key}: {joined.strip()}")
    return " | ".join(fields)


def _generate(model, source: str, attempts: int) -> str:
    """Retry: on a machine that also serves the shop, the first call fails."""
    last_error: Exception | None = None
    for _ in range(attempts):
        try:
            text = model.generate(source, max_new_tokens=90, num_beams=4)
        except Exception as error:  # noqa: BLE001 - any model failure is retried
            last_error = error
            continue
        if isinstance(text, str):
            return text
        last_error = TypeError("the model returned no text")
    raise DescriptionUnavailable(str(last_error))


def _whole_sentences(text) -> str:
    """
    Keep only what the model finished saying.

    A small model stops when its budget runs out, mid-sentence and sometimes
    mid-word. Publishing that is worse than publishing nothing at all. A
    sentence ends on a mark followed by the end of the text or by a capital,
    so « 1.2 kg » is not an end; « M. Dupont » still is.
    """
    text = " ".join(text.split())
    end = 0
    for mark in re.finditer(r"[.!?]", text):
        after = text[mark.end():mark.end() + 2]
        if after == "" or (after[0] == " " and after[1:].isupper()):
            end = mark.end()
    return text[:end]


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
    """Lowercase and drop accents, so « Étanche » meets « etanche »."""
    letters = unicodedata.normalize("NFD", str(text).lower())
    return "".join(char for char in letters if not unicodedata.combining(char))
