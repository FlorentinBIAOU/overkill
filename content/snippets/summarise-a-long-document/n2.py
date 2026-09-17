"""
Summarise a long document with a self-hosted abstractive model.

Rung N2. The first rung that writes. N0 and N1 choose sentences and can only
ever return what the author already wrote; this one produces sentences that
were not in the document.

That gain has a price, and the price is in this file rather than in the model.
A sequence-to-sequence summariser reads a fixed-size window. A long document
does not fit, so it has to be cut at sentence boundaries, summarised piece by
piece, and the notes summarised again, in as many passes as it takes to fit
one window. Every one of those calls can fail or come back empty, and a
summary that is silently half a document is worse than no summary at all.

What this file cannot do, at any price: check that what the model wrote is
what the document said. Nothing in this plumbing can. See the test.

Nor does it check the language. The checkpoint named below declares
`language: en` on its card and was fine-tuned on English newswire; on a French
note it will write something, and nothing here will stop it. A multilingual
summariser exists — mT5 fine-tuned on XL-Sum, forty-five languages, French
among them — under CC BY-SA-NC 4.0, which rules out commercial use. Read the
card before you pick, and read it for the language first.
"""

from __future__ import annotations

import functools
import re

# A full stop, question or exclamation mark followed by whitespace, or a line
# break: a transcript without final punctuation is still cut into lines.
SENTENCE_END = re.compile(r"(?<=[.!?])\s+|\s*\n\s*")

# The same weights in both languages: JavaScript loads their ONNX conversion.
# English only: its card says `language: en`, and it is distilled from a model
# fine-tuned on CNN/DailyMail and XSum, which are English newswire.
MODEL_NAME = "sshleifer/distilbart-cnn-12-6"

# What one call to the model is given to read. The window is 1,024 tokens, and
# characters are not tokens: with this model's tokenizer, 3,000 characters of
# French prose come to 1,091 tokens, 2,000 to 727. A piece that still
# overflows, code or a table, is refused by the model below, not truncated.
CHUNK_CHARACTERS = 2000

# What the whole function is allowed to read. A self-hosted model costs
# machine time rather than money, but a document nobody meant to send is still
# better refused than churned through in silence.
MAX_CHARACTERS = 200_000


class SummaryUnavailable(Exception):
    """The model failed, or returned nothing usable."""


class LocalSummariser:
    """The real model, loaded from local weights and run on this machine."""

    def __init__(self, name: str = MODEL_NAME) -> None:  # pragma: no cover - loads weights
        # transformers 5 removed the "summarization" pipeline: call the model itself.
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

        self._tokenizer = AutoTokenizer.from_pretrained(name)
        self._model = AutoModelForSeq2SeqLM.from_pretrained(name)
        # The generation settings the checkpoint was published with.
        self._settings = self._model.config.task_specific_params["summarization"]

    def generate(self, text: str) -> str:  # pragma: no cover - loads weights
        inputs = self._tokenizer(text, return_tensors="pt")
        # Refused rather than truncated: a summary of the start of a piece
        # reads exactly like a summary of all of it.
        if inputs["input_ids"].shape[1] > self._tokenizer.model_max_length:
            raise ValueError("this piece is longer than the model's window")
        output = self._model.generate(**inputs, **self._settings)
        return self._tokenizer.decode(output[0], skip_special_tokens=True)


@functools.cache
def default_model() -> LocalSummariser:  # pragma: no cover - loads weights
    """Loaded once and kept for the life of the process: the loading is the slow part."""
    return LocalSummariser()


def pack(units: list[str], size: int = CHUNK_CHARACTERS) -> list[str]:
    """Join consecutive units into pieces of at most `size` characters."""
    pieces: list[str] = []
    current = ""
    for unit in units:
        if current and len(current) + 1 + len(unit) > size:
            pieces.append(current)
            current = unit
        else:
            current = f"{current} {unit}".strip()
    if current:
        pieces.append(current)
    return pieces


def chunk(text: str, size: int = CHUNK_CHARACTERS) -> list[str]:
    """
    Cut the document into pieces that fit the model's window, at sentence
    boundaries.

    A sentence longer than the window on its own is passed whole. Cutting
    mid-sentence would hand the model half a clause, which is a worse thing to
    summarise.
    """
    sentences = (part.strip() for part in SENTENCE_END.split(text.strip()))
    return pack([sentence for sentence in sentences if sentence], size)


def summarise(text: str, model=None, *, attempts: int = 2) -> str:
    """
    `model` is injected so this function can be tested without loading weights.
    In production it defaults to the real model.
    """
    if len(text) > MAX_CHARACTERS:
        raise ValueError(f"document longer than {MAX_CHARACTERS} characters")
    pieces = chunk(text)
    if not pieces:
        return ""
    model = model or default_model()

    while True:
        notes = [_generate(model, piece, attempts) for piece in pieces]
        if len(notes) == 1:
            return notes[0]
        # Next pass: the model reads back its own notes, packed to the window
        # like the document was. It never reads the document again.
        packed = pack(notes)
        if len(packed) >= len(pieces):
            raise SummaryUnavailable("the notes are no shorter than what they summarise")
        pieces = packed


def _generate(model, text: str, attempts: int) -> str:
    last_error: Exception | None = None
    for _ in range(attempts):
        try:
            written = (model.generate(text) or "").strip()
            if written:
                return written
            # An empty answer is a failure, not a summary. Returning it would
            # leave a hole in the middle of the document with no trace.
            last_error = ValueError("the model returned an empty summary")
        except Exception as error:  # noqa: BLE001 - any model failure is retried
            last_error = error
    raise SummaryUnavailable(str(last_error))
