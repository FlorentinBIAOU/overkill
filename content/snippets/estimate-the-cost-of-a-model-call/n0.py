"""
What a model call will cost, before making it, from figures you provide.

Rung N0. A provider bills tokens, publishes a price per million of them, and
the arithmetic between the two is a multiplication. What makes this worth a
page is not the multiplication: it is everything this code refuses to guess.

It never names a price. Prices change every quarter and differ per model, per
region and per contract; the two prices are parameters, and every amount that
comes back is in whatever unit you passed them in. A snippet that carried a
price would be wrong before it was read.

It says whether the tokens were counted or estimated. Counting them needs the
tokeniser your provider uses; estimating them from a character count needs a
ratio, and a ratio is not a constant of nature — it depends on the language,
on the punctuation, on whether the text is prose or JSON. Both are allowed
here, and the report says which one was used, because an estimate presented as
a count is the failure this page exists to avoid.

And it answers the question that decides: `break_even_items` is the number of
calls at which the bill reaches the one-off cost of the thing the call would
replace. That number, not the price per million, is what says whether the call
is worth making.
"""

from __future__ import annotations

import re

# A price or a ratio as it is written: digits, optionally a decimal point.
# Nothing becomes a float here — money is counted in integers.
NUMBER = re.compile(r"\A[0-9]+(?:\.[0-9]+)?\Z")

# The unit the published prices use. It is a parameter because it is a
# convention, not a law: some providers quote per thousand tokens.
PER = 1_000_000

# How many decimals the amounts come back with, unless the prices carry more.
DECIMALS = 6


def estimate_cost(items, tokens_in, tokens_out, price_in, price_out, *,
                  per: int = PER, fixed_alternative=None, decimals: int = DECIMALS) -> dict:
    """
    The tokens a job will use and what it will cost, in your own unit.

    `tokens_in` and `tokens_out` are either a whole number of tokens — counted
    with your provider's tokeniser — or a pair `{"characters": n,
    "characters_per_token": "4"}`, which is an estimate and is reported as one.
    """
    if not isinstance(items, int) or isinstance(items, bool) or items < 0:
        return _report(None, None, None, "items must be a whole number, zero or more")
    prices = {}
    for name, price in (("in", price_in), ("out", price_out)):
        parsed = _parse(price)
        if parsed is None:
            return _report(None, None, None, f"the {name} price must be written in digits")
        prices[name] = parsed
    if not isinstance(per, int) or per <= 0:
        return _report(None, None, None, "the price unit must be a whole number of tokens")

    counts, sources = {}, []
    for name, value in (("in", tokens_in), ("out", tokens_out)):
        count, source = _tokens(value)
        if count is None:
            return _report(None, None, None, f"the {name} tokens are neither a count nor an estimate")
        counts[name], _ = count, sources.append(source)

    scale = max(decimals, prices["in"][1], prices["out"][1])
    per_item = sum(_amount(counts[name], prices[name], per, scale) for name in ("in", "out"))
    total = per_item * items

    break_even = None
    if fixed_alternative is not None:
        fixed = _parse(fixed_alternative)
        if fixed is None:
            return _report(None, None, None, "the alternative's cost must be written in digits")
        if per_item > 0:
            fixed_scaled = fixed[0] * 10 ** (scale - fixed[1])
            break_even = -(-fixed_scaled // per_item)  # the first call that costs more

    tokens = {"in": counts["in"], "out": counts["out"],
              "total": counts["in"] + counts["out"],
              "source": sources[0] if sources[0] == sources[1] else "mixed"}
    cost = {"per_item": _text(per_item, scale), "total": _text(total, scale),
            "decimals": scale}
    return _report(tokens, cost, break_even, None)


def _tokens(value):
    """A counted number of tokens, or an estimate from a number of characters."""
    if isinstance(value, int) and not isinstance(value, bool) and value >= 0:
        return value, "counted"
    if isinstance(value, dict):
        characters = value.get("characters")
        ratio = _parse(value.get("characters_per_token"))
        if (isinstance(characters, int) and not isinstance(characters, bool)
                and characters >= 0 and ratio and ratio[0] > 0):
            # A part of a token is billed as a token: the estimate rounds up.
            return -(-characters * 10 ** ratio[1] // ratio[0]), "estimated"
    return None, None


def _amount(tokens: int, price, per: int, scale: int) -> int:
    digits, places = price
    numerator = tokens * digits * 10 ** (scale - places)
    return (2 * numerator + per) // (2 * per)  # rounded away from zero on a half


def _parse(value):
    """A written number as an integer and its number of decimals."""
    if isinstance(value, int) and not isinstance(value, bool) and value >= 0:
        return value, 0
    if not isinstance(value, str) or not NUMBER.match(value.strip()):
        return None
    whole, _, fraction = value.strip().partition(".")
    return int(f"{whole}{fraction}"), len(fraction)


def _text(digits: int, places: int) -> str:
    body = str(digits).rjust(places + 1, "0")
    return body if places == 0 else f"{body[:-places]}.{body[-places:]}"


def _report(tokens, cost, break_even, reason) -> dict:
    return {"tokens": tokens, "cost": cost, "break_even_items": break_even,
            "reason": reason}
