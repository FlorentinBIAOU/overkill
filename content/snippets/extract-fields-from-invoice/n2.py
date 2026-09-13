"""
Tag the lines of the invoice with a self-hosted document model.

Rung N2. Same idea as N1 — label the lines, then read the value out of them —
except that the features are no longer yours. A document encoder fine-tuned on
invoices reads the line, its neighbours and its place on the page at once, and
it keeps reading them when a supplier moves its totals block.

What you own on this rung is not the model, it is everything around it: the
page geometry you hand it, the threshold under which a field goes to a human,
and the answer to "what does the code do when the model says nothing usable".
The weights stay on your machine, which is why an invoice never leaves it.
"""

from __future__ import annotations

import re

# A base encoder is a starting point, not an extractor: this rung assumes the
# checkpoint was fine-tuned on invoices, yours or someone else's.
MODEL_NAME = "microsoft/layoutlmv3-base"

DEFAULT_THRESHOLD = 0.75

# One pass reads one page. Beyond that the model would truncate in silence.
MAX_LINES = 120

AMOUNT = r"\d{1,3}(?:[\s.]\d{3})*[,.]\d{2}"
MONTHS = "janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre"
DATE = rf"\d{{1,2}}/\d{{1,2}}/\d{{2,4}}|\d{{1,2}}\s+(?:{MONTHS})\s+\d{{4}}"
REFERENCE = r"\b(?:[A-Za-z]{1,3}[-/])?\d[\dA-Za-z/-]{3,}"


class ExtractionUnavailable(Exception):
    """The model answered something no caller can act on."""


class LayoutModel:
    """The real model, loaded once and kept in memory for the process."""

    def __init__(self, name: str = MODEL_NAME) -> None:
        from transformers import pipeline  # a large download, done once

        self._pipe = pipeline("token-classification", model=name)

    def predict(self, lines: list[str]) -> list[dict[str, float]]:
        """One label-to-score mapping per line, in the order given."""
        rows = self._pipe({"words": lines, "boxes": boxes_for(lines)})
        return [{r["entity_group"]: r["score"] for r in row} for row in rows]


def boxes_for(lines: list[str]) -> list[list[int]]:
    """
    A box per line, on the thousandth-of-a-page grid these models expect.

    Extracted text keeps its geometry in two places only: how far a line is
    indented, and how far down the page it sits. That is what the model gets,
    and it is already more than a bag of words has.
    """
    height = max(len(lines), 1)
    return [
        [min(len(line) - len(line.lstrip()), 80) * 12, i * 1000 // height, 1000, (i + 1) * 1000 // height]
        for i, line in enumerate(lines)
    ]


def extract_fields(text: str, model=None, *, threshold: float = DEFAULT_THRESHOLD, attempts: int = 2) -> dict:
    """
    Read the fields, and say for each one whether a human should look.

    `model` is injected so this can be tested without downloading the weights.
    In production it defaults to the real model above.
    """
    model = model or LayoutModel()
    lines = [line for line in text.splitlines() if line.strip()]
    if len(lines) > MAX_LINES:
        raise ValueError(f"document longer than {MAX_LINES} lines")
    tagged = _tag(model, lines, attempts) if lines else []
    if len(tagged) != len(lines):
        raise ExtractionUnavailable("the model owed one row per line, and did not")
    return {field: _read(field, lines, tagged, threshold) for field in READERS}


def _tag(model, lines: list[str], attempts: int) -> list[dict]:
    """The whole page in one pass, and a failed pass is retried, not swallowed."""
    last_error: Exception | None = None
    for _ in range(attempts):
        try:
            return model.predict(lines)
        except Exception as error:  # noqa: BLE001 - any model failure is retried
            last_error = error
    raise ExtractionUnavailable(str(last_error))


def _read(field: str, lines: list[str], tagged: list[dict], threshold: float) -> dict:
    """
    Keep the best-scoring line for the field, then read the value out of it.

    The model points at a line; turning that line into a date or an amount is
    still ours, and so is deciding what happens when it cannot be done.
    """
    score, index = max(((_score(row, field), i) for i, row in enumerate(tagged)), default=(0.0, -1))
    if score <= 0.0:
        return {"value": None, "score": 0.0, "review": True}
    value = READERS[field](lines[index])
    # A doubtful field is not thrown away: it goes to a human with the score
    # that earned the doubt.
    return {"value": value, "score": score, "review": value is None or score < threshold}


def _score(row, field: str) -> float:
    """A number the caller can act on, rather than whatever came back."""
    value = (row or {}).get(field)
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return 0.0
    return float(value) if 0.0 <= value <= 1.0 else 0.0


def _match(pattern: str):
    def read(line: str):
        found = re.search(pattern, line)
        return found.group(0) if found else None

    return read


def _amount(line: str):
    """The rightmost amount: an item line carries a quantity and a unit price."""
    amounts = re.findall(AMOUNT, line)
    if not amounts:
        return None
    cleaned = re.sub(r"[^\d,.]", "", amounts[-1])
    if "," in cleaned:
        cleaned = cleaned.replace(".", "").replace(",", ".")
    return float(cleaned)


READERS = {"invoice_number": _match(REFERENCE), "date": _match(DATE), "total": _amount}
