"""
Read the header fields of an invoice from text that has already been
extracted: keyword anchors, then regular expressions.

Rung N0. No model, no training set, no service. Two hours of work and you can
read every invoice from the supplier you wrote it for.

The method is the one anybody reaches for: find the line carrying the label,
then read the value that follows it on that line. The labels are ordered from
the most specific to the least, because « Total TTC » and « Total HT » are one
word apart and the wrong one is a plausible number.

That ordering is also where the approach ends. See the test.
"""

import re

# French amounts: a comma before the decimals, a space or a dot every three
# digits. Requiring exactly three digits per group is what keeps the pattern
# from swallowing a quantity and a unit price as one number.
AMOUNT = r"\d{1,3}(?:[\s.]\d{3})*[,.]\d{2}"
DATE = r"\d{1,2}/\d{1,2}/\d{2,4}"
REFERENCE = r"[A-Za-z]{0,3}[-/ ]?\d[\dA-Za-z/-]{3,}"


def parse_amount(raw: str) -> float:
    """Turn a written amount into a number the caller can compute with."""
    cleaned = re.sub(r"[^\d,.]", "", raw)
    # A comma means French spelling: the dots left are thousands separators.
    if "," in cleaned:
        cleaned = cleaned.replace(".", "").replace(",", ".")
    return float(cleaned)


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
    lines = text.splitlines()
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
