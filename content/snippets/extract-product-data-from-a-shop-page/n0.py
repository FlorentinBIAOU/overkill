"""
Read the product a shop page already publishes about itself.

Rung N0. Almost every shop built on a commerce platform emits its product as
JSON-LD, in a `<script type="application/ld+json">` block, because search
engines ask for it. The name, the reference, the brand, the price, the currency
and the availability are already there, named by schema.org, typed, and written
by the shop itself. Reading them is parsing JSON.

That is the whole of this rung, and it is why writing selectors — or sending
the page to a model — is the most documented piece of over-engineering in web
scraping: both go looking in the rendering for what the page states in plain
text a few lines above.

Two things are refused rather than guessed. A page may carry several products —
the one it is about, and the carousel of related items — and nothing in the
format says which is which, so every one found is returned and the caller
chooses. And a price written « 1 234,56 » is not a number for schema.org, which
asks for a dot: rather than read it as one thousand or as one, `price` comes
back as None with the text the shop wrote in `price_text`.

No number in the document is turned into a float, `price` included. A shop that
writes `"price": 24.90` — as a JSON number, which several platforms do — has
written two decimals, and a float has no way to remember that: it comes back
`24.9`, from the very field whose job is to keep the cents. So the parser is
told to hand every number over as the digits it read, and `price` is a string
of digits the caller turns into whatever its own money type is.

An offer is picked the same way a product is not: a page may publish several —
one per size, per colour, per merchant — and only the first is read. `offers`
in the report says how many there were, so a caller that sees more than one
knows the price it got is one of several.
"""

from __future__ import annotations

import json
import re

# schema.org writes availability as a URL, a bare name, or an http URL from
# before the site moved to https. All three mean the same thing.
AVAILABILITY = re.compile(r"^(?:https?://schema\.org/)?(\w+)$")

# A price is a number with a dot, says schema.org. Anything else is text.
PRICE = re.compile(r"^-?\d+(?:\.\d+)?$")

# Which of the three GTIN keys answered. Their length is an information of its
# own — eight, thirteen or fourteen digits — and « what is not read is named »
# applies to what is read too.
GTIN_KEYS = ("gtin", "gtin14", "gtin13", "gtin12", "gtin8")


def read_products(html) -> dict:
    """
    Every schema.org Product the page declares, in the order they appear.

    `source` says where the answer came from, so a caller that finds nothing
    knows whether the page is silent or whether its JSON-LD is broken.
    """
    if not isinstance(html, str):
        return {"source": None, "products": [], "reason": f"expected HTML, not {type(html).__name__}"}

    nodes, broken = [], 0
    for block in _blocks(html):
        try:
            # `parse_float=str` and `parse_int=str`: no number in this
            # document becomes a float. See the header — a price written 24.90
            # must come back as 24.90.
            nodes.extend(_flatten(json.loads(block, parse_float=str, parse_int=str)))
        except (ValueError, RecursionError):
            broken += 1

    products = [_product(node) for node in nodes if _is_product(node)]
    if products:
        return {"source": "json-ld", "products": products, "reason": None}
    reason = "the JSON-LD on this page could not be parsed" if broken else "no JSON-LD product"
    return {"source": None, "products": [], "reason": reason}


def _blocks(html: str) -> list:
    """
    The JSON-LD script blocks, scanned rather than matched.

    A regular expression would do it in one line and would be a denial of
    service on a page you did not write: « <script type="application/ld+json"> »
    repeated twenty thousand times with no closing tag makes the engine retry
    from every opening. This walks the string once.
    """
    found, cursor, lower = [], 0, html.lower()
    while True:
        start = lower.find("<script", cursor)
        if start < 0:
            return found
        opening = lower.find(">", start)
        closing = lower.find("</script", opening) if opening >= 0 else -1
        if opening < 0 or closing < 0:
            return found
        if "application/ld+json" in lower[start:opening]:
            found.append(html[opening + 1:closing])
        cursor = closing + len("</script")


def _flatten(value, depth: int = 0):
    """Every node of the document: a graph, a list of blocks, or one object."""
    if depth > 8:
        return []
    if isinstance(value, list):
        return [n for item in value for n in _flatten(item, depth + 1)]
    if not isinstance(value, dict):
        return []
    found = [value]
    for key in ("@graph", "mainEntity", "itemListElement", "item"):
        if key in value:
            found.extend(_flatten(value[key], depth + 1))
    return found


def _is_product(node) -> bool:
    kinds = node.get("@type")
    kinds = kinds if isinstance(kinds, list) else [kinds]
    return "Product" in kinds


def _product(node) -> dict:
    offers = _flatten(node.get("offers"))
    offer = offers[0] if offers else {}
    raw_price = offer.get("price")
    price = str(raw_price) if raw_price is not None else None
    brand = node.get("brand")
    availability = offer.get("availability")
    match = AVAILABILITY.match(availability) if isinstance(availability, str) else None
    gtin_key = next((k for k in GTIN_KEYS if _text(node.get(k))), None)
    return {
        "name": _text(node.get("name")),
        "sku": _text(node.get("sku")),
        "gtin": _text(node.get(gtin_key)) if gtin_key else None,
        "gtin_key": gtin_key,
        "brand": _text(brand.get("name") if isinstance(brand, dict) else brand),
        # None when the shop did not write a schema.org number, with the text
        # it did write beside it: a price read wrong is worse than a price not
        # read. Digits, never a float — see the header.
        "price": price if price and PRICE.match(price) else None,
        "price_text": price,
        "currency": _text(offer.get("priceCurrency")),
        "availability": match.group(1) if match else _text(availability),
        # How many offers the page published for this product. Only the first
        # is read; a caller that sees more than one knows it.
        "offers": len(offers),
    }


def _text(value):
    return value.strip() if isinstance(value, str) else None
