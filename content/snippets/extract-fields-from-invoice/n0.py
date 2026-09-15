"""
Read the header fields of an invoice from text that has already been
extracted: keyword anchors, then regular expressions.

Rung N0. No model, no training set, no service. It reads the invoices of the
supplier whose labels it was written for.

The method is the one anybody reaches for: find the line carrying the label,
then read the value that follows it on that line. The labels are ordered from
the most specific to the least, because "Total TTC" and "Total HT" are one
word apart and the wrong one is a plausible number.

That ordering is also where the approach ends. See the test.
"""

import re

# An amount, signed or not, with two decimals: "1 234,56" and "1.234,56" in French,
# "1,234.56" in English. Exactly three digits per group keeps "2 38,50" apart,
# a quantity then a price; "2 380,50" still reads as one number. At most four
# groups, up to the trillions, so that a long run of digit groups is read in
# linear time.
AMOUNT = r"[-\u2212]?(?<![\d.,])\d{1,3}(?:(?:[\s.]\d{3}){0,4},|(?:[\s,]\d{3}){0,4}\.)\d{2}(?![.,]?\d)"
DATE = r"\d{1,2}/\d{1,2}/\d{2,4}"
REFERENCE = r"\b(?:[A-Za-z]{1,3}[-/])?\d[\dA-Za-z/-]{3,}"


def parse_amount(raw: str) -> float:
    """Turn a written amount into a number the caller can compute with."""
    # An AMOUNT match always ends on two decimals: whatever the separators, the
    # last two digits are the cents.
    cents = int(re.sub(r"\D", "", raw)) / 100
    return -cents if raw.lstrip()[:1] in ("-", "\u2212") else cents


# Per field: the labels to look for, most specific first, the pattern the value
# must match after the label, and how to read the match.
FIELDS = {
    "invoice_number": (("facture n°", "facture no", "n° facture"), REFERENCE, str.strip),
    "date": (("date",), DATE, str.strip),
    "total": (("total ttc", "montant ttc", "total"), AMOUNT, parse_amount),
}


def find_after_label(text: str, labels: tuple[str, ...], pattern: str) -> str | None:
    """
    First value matching `pattern` after one of `labels`, on the same line.

    A label that appears on a line holding no value is skipped rather than
    accepted, because a column heading is a label too.
    """
    # Every run of spaces, a non-breaking one included, reads as one space.
    lines = [re.sub(r"\s+", " ", line) for line in text.splitlines()]
    for label in labels:
        for line in lines:
            position = line.lower().find(label)
            if position == -1:
                continue
            match = re.search(pattern, line[position + len(label):])
            if match:
                return match.group(0)
    return None


def extract_fields(text: str) -> dict:
    """Read the invoice number, the date and the total from extracted text."""
    fields = {}
    for name, (labels, pattern, read) in FIELDS.items():
        raw = find_after_label(text, labels, pattern)
        fields[name] = read(raw) if raw is not None else None
    return fields
