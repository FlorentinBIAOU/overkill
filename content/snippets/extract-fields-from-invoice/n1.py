"""
Label each line of the invoice, then read the value out of the line.

Rung N1. N0 asked « what does this line say ». This asks « where does this line
sit, and what does it look like »: how far down the page, how indented, how
wordy, how many amounts, and whether the value hangs on the right-hand side.

Those features survive a change of supplier, which is exactly what the labels
of N0 do not. Training is a few dozen labelled lines, the model is a few
kilobytes, and nothing is downloaded.
"""

import re

from sklearn.linear_model import LogisticRegression

AMOUNT = r"\d{1,3}(?:[\s.]\d{3})*[,.]\d{2}"
MONTHS = "janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre"
DATE = rf"\d{{1,2}}/\d{{1,2}}/\d{{2,4}}|\d{{1,2}}\s+(?:{MONTHS})\s+\d{{4}}"
REFERENCE = r"\b(?:[A-Za-z]{1,3}[-/])?\d[\dA-Za-z/-]{3,}"


def page_lines(text: str) -> list[str]:
    """The lines that carry something, indentation kept: it is a feature."""
    return [line for line in text.splitlines() if line.strip()]


def line_features(line: str, index: int, count: int) -> list[float]:
    """Where the line sits and what it looks like. Never what it says."""
    text = line.strip()
    amounts = re.findall(AMOUNT, text)
    letters = "".join(c for c in text if c.isalpha())
    return [
        index / max(count - 1, 1),                          # how far down the page
        1.0 if index == count - 1 else 0.0,                 # the very last line
        min(len(line) - len(line.lstrip()), 40) / 40,       # indentation
        min(len(text.split()), 12) / 12,                    # how wordy
        sum(c.isdigit() for c in text) / len(text),         # digit share
        min(len(amounts), 3) / 3,                           # how many amounts
        1.0 if re.search(DATE, text) else 0.0,
        1.0 if re.search(REFERENCE, text) else 0.0,
        # A value hanging on the right of the line, the way a totals block does.
        1.0 if amounts and text.rindex(amounts[-1]) > len(text) / 2 else 0.0,
        1.0 if letters and letters.isupper() else 0.0,
    ]


def train(documents: list[str], labels: list[list[str]]):
    """`labels` carries one label per non-blank line of each document."""
    rows, targets = [], []
    for document, document_labels in zip(documents, labels):
        lines = page_lines(document)
        rows += [line_features(line, i, len(lines)) for i, line in enumerate(lines)]
        targets += list(document_labels)
    model = LogisticRegression(class_weight="balanced", max_iter=1000)
    model.fit(rows, targets)
    return model


def _match(pattern: str):
    """Reads the first value of that shape out of a line, or nothing."""
    def read(line):
        found = re.search(pattern, line)
        return found.group(0) if found else None

    return read


def _amount(line):
    """The rightmost amount: an item line carries a quantity and a unit price."""
    amounts = re.findall(AMOUNT, line)
    if not amounts:
        return None
    cleaned = re.sub(r"[^\d,.]", "", amounts[-1]).replace(".", "").replace(",", ".")
    return float(cleaned)


READERS = {"invoice_number": _match(REFERENCE), "date": _match(DATE), "total": _amount}


def extract_fields(model, text: str) -> dict:
    """
    For each field, walk the lines from the most likely down.

    The model points at a line; reading a date or an amount out of it is still
    ours to do, and a line the model likes but that holds no value is not an
    answer.
    """
    lines = page_lines(text)
    if not lines:
        return {name: None for name in READERS}
    rows = [line_features(line, i, len(lines)) for i, line in enumerate(lines)]
    scores = model.predict_proba(rows)
    classes = list(model.classes_)
    fields = {}
    for name, read in READERS.items():
        column = classes.index(name)
        ranked = sorted(range(len(lines)), key=lambda i: -scores[i][column])
        fields[name] = next((v for v in (read(lines[i]) for i in ranked) if v is not None), None)
    return fields
