"""
Parse a postal address into fields: regular expressions anchored on the
postcode.

Rung N0. Deterministic, standard library only.

Two things make this work.

First, the postcode is the anchor. Five digits in a row cut a French address in
two: what comes before is the street line, what comes after is the town. Trying
to recognise the town by its name would mean shipping a list of communes and
keeping it up to date.

Second, the street type is read from a dictionary rather than guessed, so the
abbreviations people actually type — "av.", "bd", "imp." — come out as one
canonical spelling.
"""

import re
import unicodedata

# The street types of a French address, with the abbreviations people type.
# This is trade knowledge, not example data, so it belongs in the snippet.
STREET_TYPES = {
    "r": "rue", "rue": "rue",
    "av": "avenue", "ave": "avenue", "avenue": "avenue",
    "bd": "boulevard", "bld": "boulevard", "boul": "boulevard", "boulevard": "boulevard",
    "imp": "impasse", "impasse": "impasse",
    "all": "allée", "allee": "allée",
    "ch": "chemin", "chemin": "chemin",
    "pl": "place", "place": "place",
    "rte": "route", "route": "route",
    "quai": "quai", "cours": "cours", "crs": "cours",
    "sq": "square", "square": "square",
    "voie": "voie", "passage": "passage", "sentier": "sentier",
    "chaussee": "chaussée", "fbg": "faubourg", "faubourg": "faubourg",
    "cite": "cité", "villa": "villa", "esplanade": "esplanade",
}

FIELDS = ("number", "street_type", "street", "postcode", "city")

# A house number or a range of them, and the repetition index that may follow:
# 8, 8-10, 8 bis, 12B. A lone letter counts only when it touches the number, so
# the "r" of "8 r des Lilas" stays a street type.
HOUSE_NUMBER = re.compile(r"^(\d{1,4}(?:-\d{1,4})?)(?:\s*(bis|ter|quater)\b|([a-z])\b)?", re.IGNORECASE)

# A French postcode: five digits standing alone.
POSTCODE = re.compile(r"\b\d{5}\b")


def normalise(text: str) -> str:
    """Reduce commas, line breaks, exotic spaces and byte order marks to a single plain space."""
    text = unicodedata.normalize("NFKC", text).replace(",", " ")
    return re.sub(r"[\s\ufeff]+", " ", text).strip()


def fold(word: str) -> str:
    """Lowercase, drop the accents and the trailing dot, for lookup only."""
    decomposed = unicodedata.normalize("NFD", word.lower())
    return "".join(c for c in decomposed if not unicodedata.combining(c)).rstrip(".")


def parse(address: str) -> dict:
    """
    Split an address into number, street type, street, postcode and town.

    Every field is a string, empty when the address does not carry it. Returning
    an empty string rather than nothing at all keeps the caller from having to
    test each field before printing it.
    """
    fields = dict.fromkeys(FIELDS, "")
    text = normalise(address)

    # The anchor. Take the last run of five digits: in a French address the
    # postcode and the town close the address, so a five-digit number earlier in
    # the line is not taken for the postcode.
    postcodes = list(POSTCODE.finditer(text))
    if postcodes:
        found = postcodes[-1]
        fields["postcode"] = found.group()
        fields["city"] = text[found.end():].strip()
        text = text[: found.start()].strip()

    number = HOUSE_NUMBER.match(text)
    if number:
        fields["number"] = " ".join(part for part in number.groups() if part)
        text = text[number.end():].strip()

    words = text.split()
    if words:
        canonical = STREET_TYPES.get(fold(words[0]))
        if canonical:
            # Rewrite the abbreviation, so two spellings of one street compare
            # equal downstream.
            fields["street_type"] = canonical
            words[0] = canonical
        fields["street"] = " ".join(words)
    return fields
