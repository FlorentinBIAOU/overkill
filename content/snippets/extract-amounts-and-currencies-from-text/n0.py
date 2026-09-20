"""
Find the amounts quoted in a text, with the currency written next to them.

Rung N0. An amount in running text is a number with a mark beside it — a
symbol, an ISO 4217 code, or the word in the reader's language. That mark is
what tells an amount from the invoice number three words earlier, and looking
for the number without it is what makes an extractor return « 2026 » as a
total.

The reference tool is `price-parser` in Python. It reads one price out of one
string, which is what a scraped price field is, and this entry's test shows
where that stops: on a French invoice line that carries a document number, a
date and a total, it returns the document number; and on a document whose
heading reads « Montants en euros » while the line quotes a sum in dollars, it
hands back the euro of the heading. In JavaScript nothing maintained does even
that much.

The one thing a text cannot settle is the separator. « 1,859 » is a thousands
group under one convention and three decimals under the other, and both are
ordinary — a rounded sum on one side, a fuel price on the other. So the caller
declares the convention their documents are written in, and any number whose
reading depends on that declaration comes back marked `ambiguous`. Nothing is
guessed in silence, and nothing is turned into a float on the way: the value is
the digits that were written.
"""

from __future__ import annotations

import re

# The decimal sign each convention uses. The caller declares one; there is no
# default, because a default is precisely the silent guess this entry exists
# to refuse.
CONVENTIONS = {"fr": ",", "en": "."}

# What a currency mark can look like, and what it may stand for. A symbol that
# several currencies share is not resolved here: the candidates are returned.
SYMBOLS = {"€": ["EUR"], "£": ["GBP"], "₹": ["INR"], "¥": ["JPY", "CNY"],
           "$": ["USD", "CAD", "AUD", "NZD", "SGD", "HKD"],
           "kr": ["SEK", "NOK", "DKK"]}
CODES = ["EUR", "GBP", "USD", "CHF", "JPY", "CAD", "AUD", "CNY", "SEK", "NOK",
         "DKK", "INR", "PLN", "CZK"]
WORDS = {"euro": ["EUR"], "euros": ["EUR"], "livre sterling": ["GBP"],
         "livres sterling": ["GBP"], "pound": ["GBP"], "pounds": ["GBP"],
         "franc suisse": ["CHF"], "francs suisses": ["CHF"], "yen": ["JPY"],
         "dollar": SYMBOLS["$"], "dollars": SYMBOLS["$"]}

# A number as it is written: groups separated by spaces, dots, commas or
# apostrophes. The shapes are checked afterwards, not here. The digits are
# written out rather than taken from « \\d », which matches every Unicode digit
# in Python and only the ten in JavaScript — and « ١٢٣ » is not a value this
# rung knows how to hand to an accountant.
NUMBER = re.compile(r"[0-9][0-9 \u00a0\u202f.,']*[0-9]|[0-9]")

# A code or a word only counts when it stands on its own; a symbol always
# does. « (?<![^\W_]) » is « not preceded by a letter or a digit », written
# without \b so that the JavaScript side can say exactly the same thing.
MARK = re.compile("|".join([re.escape(s) for s in sorted(SYMBOLS, key=len, reverse=True)]
                           + [rf"(?<![^\W_]){w}(?![^\W_])" for w in
                              CODES + sorted(WORDS, key=len, reverse=True)]),
                  re.IGNORECASE)

SPACES = str.maketrans({"\u00a0": " ", "\u202f": " ", "'": " "})

# How far a mark may sit from its number: one space, or none. A mark further
# away belongs to something else — a heading, the sentence before.
GAP = r"[ \u00a0\u202f]?"


def extract_amounts(text, convention: str) -> dict:
    """
    Every number in `text` that carries a currency mark, read exactly.

    `convention` is « fr » or « en » — the decimal sign the caller's documents
    use. It is required: without it, a number written « 1,234 » has two
    readings a thousand apart and the code would have to pick one alone.
    """
    if not isinstance(text, str):
        return {"amounts": [], "unmarked": 0,
                "reason": f"expected text, not {type(text).__name__}"}
    if convention not in CONVENTIONS:
        return {"amounts": [], "unmarked": 0,
                "reason": f"declare a convention among {sorted(CONVENTIONS)}"}

    amounts, unmarked = [], 0
    for match in NUMBER.finditer(text):
        codes, mark = _mark_beside(text, match)
        if codes is None:
            # A number with no mark beside it. It may be an amount whose
            # currency is written once in a heading, and it may be a date or a
            # reference; counting them is all this rung can honestly say.
            unmarked += 1
            continue
        value, ambiguous = read_number(match.group(), convention)
        if value is None:
            continue
        amounts.append({"text": match.group(), "value": value, "mark": mark,
                        "currency": codes[0] if len(codes) == 1 else None,
                        "currency_candidates": codes, "ambiguous": ambiguous,
                        "start": match.start(), "end": match.end()})
    return {"amounts": amounts, "unmarked": unmarked, "reason": None}


def _mark_beside(text: str, match):
    """The currency mark touching this number, before it or after it."""
    before = text[max(0, match.start() - 24):match.start()]
    for mark in MARK.finditer(before):
        if re.fullmatch(GAP, before[mark.end():]):
            return codes_of(mark.group()), mark.group()
    after = text[match.end():match.end() + 24]
    mark = MARK.match(after, re.match(GAP, after).end())
    if mark:
        return codes_of(mark.group()), mark.group()
    return None, None


def codes_of(mark: str):
    upper = mark.upper()
    if upper in CODES:
        return [upper]
    return SYMBOLS.get(mark) or WORDS[mark.lower()]


def read_number(raw: str, convention: str):
    """
    The digits that were written, as a decimal string, and whether the reading
    depended on the declared convention.
    """
    decimal_sign = CONVENTIONS[convention]
    raw = raw.translate(SPACES)
    kinds = {c for c in raw if c in " .,"}
    if not kinds:
        return raw, False

    last = max(raw.rfind(c) for c in kinds)
    tail = len(raw) - last - 1
    if len(kinds) > 1 or raw.count(raw[last]) > 1 or raw[last] == " ":
        # Several kinds of separator, or the same one twice: the last one is
        # the decimal sign and the others group the thousands. A space never
        # is a decimal sign.
        decimal, ambiguous = raw[last] != " ", False
    elif tail != 3:
        # A thousands group is exactly three digits, always.
        decimal, ambiguous = True, False
    else:
        # « 1,234 » — three digits behind one separator. Only the convention
        # the caller declared can read this, and the caller is told.
        decimal, ambiguous = raw[last] == decimal_sign, True

    parts = re.split(r"[ .,]", raw[:last] if decimal else raw)
    if not parts[0] or (len(parts) > 1
                        and (len(parts[0]) > 3 or any(len(p) != 3 for p in parts[1:]))):
        return None, False  # not a number: « 3, 4 », « 12 5 », « 1,2345,6 »
    whole = "".join(parts)
    return (f"{whole}.{raw[last + 1:]}" if decimal else whole), ambiguous
