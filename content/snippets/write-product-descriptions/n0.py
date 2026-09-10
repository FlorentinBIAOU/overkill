"""
Write a product description by filling slot templates.

Rung N0. Deterministic, standard library only. A template is not the poor
relation of a model: it never claims a feature the product does not have, it
renders in the time it takes to read a dictionary, and every sentence it can
possibly produce was written and approved by a human being before it shipped.

Three things separate a template that survives a real catalogue from the one
everybody writes in ten minutes and throws away in a week.

First, a missing attribute must not leave a hole in a sentence. Each block of
the description offers several wordings; only those whose slots are all filled
are eligible, and the ones using the most attributes are preferred. A product
with no colour list simply gets no colour sentence, instead of « Disponible
en . ».

Second, agreement is not optional in a sales page. The markers `{un}`, `{e}`
and `{s}` carry the grammatical gender of the category noun and the number of
the enumerated list, so « Garantie deux ans » and « Points forts » come out
right without a second template per case.

Third, an enumeration is written with commas and one conjunction at the end,
never dumped as a comma-separated list.

What this cannot do is the subject of the breaking-point test next to it.
"""

from __future__ import annotations

import re

# A slot in a wording: an attribute name, or one of the grammar markers.
SLOT = re.compile(r"\{(\w+)\}")

# The description is built block by block, in this order. Inside a block, the
# wordings say the same thing with different attributes and different words:
# the ones that can be filled are kept, the most informative of those win, and
# the product draws one of them.
BLOCKS = (
    (  # What the product is.
        "{name} : {un} {category} en {material}, pensé{e} pour {audience}.",
        "{name}, {un} {category} en {material} pour {audience}.",
        "{name} : {un} {category} en {material}.",
        "{name}, {un} {category} en {material}.",
        "{name} : {un} {category} pour {audience}.",
        "{name} : {un} {category}.",
        "{name}, {un} {category}.",
    ),
    (  # What it brings.
        "Point{s} fort{s} : {features}.",
        "Au programme : {features}.",
        "Côté équipement : {features}.",
    ),
    (  # What there is to choose.
        "Disponible en {colours}.",
        "À choisir en {colours}.",
        "Existe en {colours}.",
    ),
    (  # What you are promised.
        "Garanti{e} {warranty}.",
        "La garantie court sur {warranty}.",
        "Livré{e} avec {warranty} de garantie.",
    ),
)

# The three markers above that carry grammar rather than an attribute value.
GRAMMAR = ("un", "e", "s")


def describe(product: dict, *, conjunction: str = "et") -> str:
    """
    Render the description of one product.

    `product` maps an attribute name to a string or to a list of strings. Only
    the attributes actually present are used. `gender` holds the grammatical
    gender of the category noun and defaults to masculine, which is the only
    piece of grammar a product database never stores and a French sentence
    always needs.
    """
    values, plural = _slots(product, conjunction)
    feminine = str(product.get("gender", "m")).lower().startswith("f")
    sentences = []
    for wordings in BLOCKS:
        usable = _usable(wordings, values)
        if usable:
            drawn = usable[_variant(str(product.get("name", "")), len(usable))]
            sentences.append(_fill(drawn, values, plural, feminine))
    return " ".join(sentences)


def _usable(wordings: tuple, values: dict) -> list:
    """
    The wordings that can be filled, and among those the most informative.

    A wording is dropped as soon as one of its slots has no value. Of those
    that remain, only the ones using the most attributes are kept: an attribute
    the shop took the trouble to fill in must not be left out because the draw
    fell on a shorter sentence. Several wordings usually tie, and that tie is
    where the variety of this rung lives.
    """
    scored = []
    for wording in wordings:
        slots = [slot for slot in SLOT.findall(wording) if slot not in GRAMMAR]
        if all(slot in values for slot in slots):
            scored.append((len(slots), wording))
    best = max((count for count, _ in scored), default=0)
    return [wording for count, wording in scored if count == best]


def _slots(product: dict, conjunction: str) -> tuple[dict, set]:
    """Attribute values as insertable text, and the names that are plural."""
    values: dict[str, str] = {}
    plural: set[str] = set()
    for key, value in product.items():
        if isinstance(value, (list, tuple)):
            items = [str(item).strip() for item in value if str(item).strip()]
            if len(items) > 1:
                plural.add(key)
            value = _enumerate(items, conjunction)
        if str(value).strip():
            values[key] = str(value).strip()
    return values, plural


def _enumerate(items: list[str], conjunction: str) -> str:
    """« ardoise, sable et bronze » : commas, then the conjunction once."""
    if len(items) < 2:
        return items[0] if items else ""
    return f"{', '.join(items[:-1])} {conjunction} {items[-1]}"


def _fill(wording: str, values: dict, plural: set, feminine: bool) -> str:
    """Write the attributes and the grammar markers into one wording."""
    slots = SLOT.findall(wording)
    # The grammar markers are written last, so an attribute called `s` or `e`
    # cannot quietly take their place.
    filled = {
        **values,
        "un": "une" if feminine else "un",
        "e": "e" if feminine else "",
        "s": "s" if any(slot in plural for slot in slots) else "",
    }
    return SLOT.sub(lambda match: filled[match.group(1)], wording)


def _variant(seed: str, count: int) -> int:
    """
    Draw one wording out of `count`, the same one for the same product.

    Summing the code points is deliberately crude. It has one job: give the
    same answer as the JavaScript version of this snippet, so a catalogue
    rendered by either reads identically.
    """
    return sum(ord(char) for char in seed) % count
