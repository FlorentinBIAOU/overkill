"""
Summarise a long document with a self-hosted abstractive model.

Rung N2. The first rung that writes. N0 and N1 choose sentences and can only
ever return what the author already wrote; this one produces a sentence that
was not in the document, which is the only way to state a conclusion drawn
from two passages ten pages apart.

That gain has a price, and the price is in this file rather than in the model.
A sequence-to-sequence summariser reads a fixed-size window. A long document
does not fit, so it has to be cut at sentence boundaries, summarised piece by
piece, and the pieces summarised again. Every one of those calls can fail or
come back empty, and a summary that is silently half a document is worse than
no summary at all.

What this file cannot do, at any price: check that what the model wrote is
what the document said. Nothing in this plumbing can. See the test.
"""

from __future__ import annotations

import re

SENTENCE_END = re.compile(r"(?<=[.!?])\s+")

MODEL_NAME = "facebook/bart-large-cnn"

# What one pass of the model is allowed to read. Beyond its window the model
# truncates without saying so, and a summary of the first half of a chunk is
# indistinguishable from a summary of all of it.
CHUNK_CHARACTERS = 3000

# What the whole function is allowed to read. A self-hosted model costs
# machine time rather than money, but a document nobody meant to send is still
# better refused than churned through in silence.
MAX_CHARACTERS = 200_000


class SummaryUnavailable(Exception):
    """The model failed, or returned nothing usable."""


class LocalSummariser:
    """
    The real model, loaded from local weights. Loaded once and kept for the
    life of the process: it is the loading that is slow, not the summarising.
    """

    def __init__(self, name: str = MODEL_NAME) -> None:  # pragma: no cover - loads weights
        from transformers import pipeline

        self._pipeline = pipeline("summarization", model=name)

    def generate(self, text: str) -> str:  # pragma: no cover - loads weights
        return self._pipeline(text, truncation=True)[0]["summary_text"]


def chunk(text: str, size: int = CHUNK_CHARACTERS) -> list[str]:
    """
    Cut the document into pieces that fit the model's window, at sentence
    boundaries.

    A sentence longer than the window on its own is passed whole and the model
    will truncate it. Cutting mid-sentence to avoid that would hand the model
    half a clause, which is a worse thing to summarise.
    """
    pieces: list[str] = []
    current = ""
    for sentence in SENTENCE_END.split(text.strip()):
        sentence = sentence.strip()
        if not sentence:
            continue
        if current and len(current) + 1 + len(sentence) > size:
            pieces.append(current)
            current = sentence
        else:
            current = f"{current} {sentence}".strip()
    if current:
        pieces.append(current)
    return pieces


def summarise(text: str, model=None, *, attempts: int = 2) -> str:
    """
    `model` is injected so this function can be tested without loading weights.
    In production it defaults to the real model.
    """
    if model is None:  # pragma: no cover - loads weights
        model = LocalSummariser()

    if len(text) > MAX_CHARACTERS:
        raise ValueError(f"document longer than {MAX_CHARACTERS} characters")

    pieces = chunk(text)
    if not pieces:
        return ""

    notes = [_generate(model, piece, attempts) for piece in pieces]
    if len(notes) == 1:
        return notes[0]

    # Second pass: the model reads back its own notes. Concatenating them
    # instead would give a text as long as the number of chunks, which is not
    # a summary of the document but a summary of each of its parts.
    return _generate(model, " ".join(notes), attempts)


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
