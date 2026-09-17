"""
Read an invoice: the structured file first, the page only if there is none.

Rung N0. No model, no training set, no service.

Since 1 September 2026 every business in France has to be able to receive its
invoices in a structured electronic format, through an approved platform, and
the minimum set of formats is UBL, CII and Factur-X, all three carrying the
European semantic standard EN 16931. That changes the order of operations for
this job: when the invoice arrives structured, its fields are not extracted,
they are read, and the answer is exact. Extraction is for what is left — a
supplier outside France, a till receipt, an invoice from before the reform,
the backlog.

So this file has two doors and one rule: say which door the answer came
through. A number read from XML and a number read from a line of text are not
worth the same, and the caller has to be able to tell them apart.

Getting the XML out of a Factur-X PDF is not this file's job: it is an
attached file inside the PDF, and any PDF library lists it. What arrives here
is the XML itself, or the text of a page.
"""

import re
import xml.etree.ElementTree as ElementTree

# The five fields, named by their business term in EN 16931, then by the local
# name of the element and of its parent in each of the two syntaxes. One pair
# is enough to find them without carrying a page of namespace declarations.
SUMMATION = "SpecifiedTradeSettlementHeaderMonetarySummation"
STRUCTURED = {
    # BT-1, BT-2: /rsm:ExchangedDocument/ram:ID and /ram:IssueDateTime/udt:DateTimeString
    "invoice_number": (("ExchangedDocument", "ID"), ("Invoice", "ID")),
    "date": (("IssueDateTime", "DateTimeString"), ("Invoice", "IssueDate")),
    # BT-109, BT-110, BT-112
    "total_excluding_vat": ((SUMMATION, "TaxBasisTotalAmount"), ("LegalMonetaryTotal", "TaxExclusiveAmount")),
    "vat": ((SUMMATION, "TaxTotalAmount"), ("TaxTotal", "TaxAmount")),
    "total": ((SUMMATION, "GrandTotalAmount"), ("LegalMonetaryTotal", "TaxInclusiveAmount")),
}


class UnreadableInvoice(Exception):
    """The document is neither of the two syntaxes this reads."""


def read_structured(xml: bytes) -> dict:
    """
    Read the fields of a UBL or CII invoice, and check the one sum EN 16931
    makes a rule.

    That rule, BR-CO-15, is the cheapest guard there is against a reading that
    is well-formed and wrong: total with VAT = total without VAT + VAT. It
    does not apply to the extended profile, so a false `totals_agree` is a
    reason to look, not a reason to reject.
    """
    values = {}
    root = ElementTree.fromstring(xml)
    for parent in root.iter():
        for child in parent:
            values.setdefault((_local(parent.tag), _local(child.tag)), (child.text or "").strip())

    syntax = 0 if _local(root.tag) == "CrossIndustryInvoice" else 1
    if syntax == 1 and _local(root.tag) != "Invoice":
        raise UnreadableInvoice(f"neither CII nor UBL: {_local(root.tag)}")
    fields = {name: values.get(keys[syntax]) for name, keys in STRUCTURED.items()}
    if fields["invoice_number"] is None:
        raise UnreadableInvoice("no invoice number in the document")
    return {
        "source": "structured",
        "invoice_number": fields["invoice_number"],
        "date": _date(fields["date"]),
        **{name: _amount(fields[name]) for name in ("total_excluding_vat", "vat", "total")},
        "totals_agree": _totals_agree(fields),
    }


def _local(tag: str) -> str:
    """The name of an element without its namespace."""
    return tag.rpartition("}")[2]


def _date(raw: str | None) -> str | None:
    """CII writes 20260915, UBL writes 2026-09-15; the caller gets one shape."""
    if not raw:
        return None
    digits = re.sub(r"\D", "", raw)
    return f"{digits[:4]}-{digits[4:6]}-{digits[6:8]}" if len(digits) >= 8 else None


def _amount(raw: str | None) -> float | None:
    """An amount in the two syntaxes is a decimal point and nothing else."""
    try:
        return round(float(raw), 2)
    except (TypeError, ValueError):
        return None


def _totals_agree(fields: dict) -> bool | None:
    """None when the invoice does not carry the three amounts the rule needs."""
    amounts = [_amount(fields[name]) for name in ("total_excluding_vat", "vat", "total")]
    if any(value is None for value in amounts):
        return None
    without, vat, total = amounts
    return abs(without + vat - total) < 0.005


# ---------------------------------------------------------------------------
# The other door: a page of text, for what the reform does not cover
# ---------------------------------------------------------------------------

# An amount, signed or not, with two decimals: "1 234,56" and "1.234,56" in
# French, "1,234.56" in English. Exactly three digits per group keeps "2 38,50"
# apart, a quantity then a price; "2 380,50" still reads as one number. At most
# four groups, up to the trillions, so that a long run of digit groups is read
# in linear time.
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
    """
    Read the invoice number, the date and the total from extracted text.

    Three fields, and no arithmetic to check them against: what the structured
    door gets for nothing, this one cannot have.
    """
    fields = {"source": "text"}
    for name, (labels, pattern, read) in FIELDS.items():
        raw = find_after_label(text, labels, pattern)
        fields[name] = read(raw) if raw is not None else None
    return {**fields, "total_excluding_vat": None, "vat": None, "totals_agree": None}


def read_invoice(document) -> dict:
    """
    One invoice, whichever way it arrived, and the door it came through.

    `document` is the structured file when the platform delivered one — bytes
    of UBL or CII, or the `factur-x.xml` your PDF library handed you — and the
    text of the page when it did not. Nothing here decides that for you: the
    type of what you pass in does.
    """
    if isinstance(document, (bytes, bytearray)):
        return read_structured(bytes(document))
    return extract_fields(document)
