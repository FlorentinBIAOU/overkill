"""
Add up a column of a file, exactly, and say what was left out.

Rung N0. Adding is what a computer did before it did anything else, so the
interesting part of this job is everywhere except the addition.

It is in the arithmetic, first. A column of money added as floating-point
numbers drifts: this entry's test adds one cent ten thousand times and shows
the result is not one hundred euros. So nothing here becomes a float. A value
is read as the digits that were written, all the values are lined up on the
same number of decimals, and the sum is an integer addition — exact, whatever
the length of the column.

It is in what is not a number, second. A real column has an empty cell, a
« n/a », a total line, a value with a currency symbol. Skipping them quietly is
how an average ends up being computed over eight hundred rows out of a
thousand without anyone noticing. Every value that could not be read comes back
with its row number and the reason.

And it is in the average, which is the only result that can need rounding: it
is returned two decimals beyond the data, rounded away from zero, and both the
exact sum and the count come back so a caller can round otherwise.
"""

from __future__ import annotations

import re

# What a number looks like in a file written for a program: a sign, digits, and
# at most one decimal separator. Grouping separators are not read here — the
# entry on extracting amounts from a text is where « 1 250,00 » is settled.
NUMBER = re.compile(r"\A[+-]?[0-9]+(?:[.,][0-9]+)?\Z")

# The two decimal signs this rung knows. The caller declares one; a value that
# uses the other is not misread, it is refused and counted.
SIGNS = (".", ",")

# How many decimals beyond the data's own the average is given with.
MEAN_EXTRA = 2


def aggregate(values, decimal_sign: str = ".") -> dict:
    """
    The count, the exact sum, the average and the bounds of a column.

    `values` is what a file gives: text, one item per row. Everything that is
    not a number comes back in `skipped` rather than being passed over.
    """
    if decimal_sign not in SIGNS:
        return _report(None, [], f"the decimal sign must be one of {' '.join(SIGNS)}")
    if not isinstance(values, (list, tuple)):
        # A text is iterable and is not a column: taken as one, it would be
        # read letter by letter.
        return _report(None, [], "expected a list of values")
    rows = list(values)

    read, skipped, scale = [], [], 0
    for index, value in enumerate(rows):
        # A boolean is an integer in Python and is not one anywhere else: it
        # is refused on both sides rather than counted as 0 or 1.
        numeric = isinstance(value, (int, float)) and not isinstance(value, bool)
        text = value.strip() if isinstance(value, str) else str(value) if numeric else None
        if text is None or not NUMBER.match(text) or _other_sign(text, decimal_sign):
            skipped.append({"row": index, "value": value, "why": _why(value, decimal_sign)})
            continue
        digits, places = _scaled(text, decimal_sign)
        read.append((digits, places))
        scale = max(scale, places)

    if not read:
        return _report({"count": 0, "sum": None, "mean": None, "minimum": None,
                        "maximum": None, "decimals": 0}, skipped, None)

    aligned = [digits * 10 ** (scale - places) for digits, places in read]
    total = sum(aligned)
    mean = _half_away(total * 10 ** MEAN_EXTRA, len(aligned))
    return _report({"count": len(aligned), "sum": _text(total, scale),
                    "mean": _text(mean, scale + MEAN_EXTRA),
                    "minimum": _text(min(aligned), scale),
                    "maximum": _text(max(aligned), scale),
                    "decimals": scale}, skipped, None)


def _scaled(text: str, sign: str):
    """The digits that were written, as an integer, and how many decimals."""
    whole, _, fraction = text.replace(sign, ".").partition(".")
    return int(f"{whole}{fraction}"), len(fraction)


def _other_sign(text: str, sign: str) -> bool:
    return any(other in text for other in SIGNS if other != sign)


def _why(value, sign: str) -> str:
    if not isinstance(value, str) and not (isinstance(value, (int, float))
                                           and not isinstance(value, bool)):
        return "not text"
    text = str(value).strip()
    if not text:
        return "empty"
    if _other_sign(text, sign):
        return f"written with « {SIGNS[0] if sign == SIGNS[1] else SIGNS[1]} » as the decimal sign"
    return "not a number"


def _half_away(numerator: int, denominator: int) -> int:
    """Rounded away from zero on a half, which is the rule stated in the docstring."""
    sign = -1 if numerator < 0 else 1
    return sign * ((2 * abs(numerator) + denominator) // (2 * denominator))


def _text(digits: int, places: int) -> str:
    """The integer written back with its decimal point, and no float on the way."""
    sign = "-" if digits < 0 else ""
    body = str(abs(digits)).rjust(places + 1, "0")
    return f"{sign}{body}" if places == 0 else f"{sign}{body[:-places]}.{body[-places:]}"


def _report(figures, skipped, reason) -> dict:
    return {"figures": figures, "skipped": skipped, "reason": reason}
