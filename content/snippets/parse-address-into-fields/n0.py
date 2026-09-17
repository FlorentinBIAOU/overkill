"""
Parse a postal address into fields: regular expressions anchored on the
postcode.

Rung N0. Deterministic, standard library only.

Two things make this work.

First, the postcode is the anchor. Five digits in a row cut a French address in
two: what comes before is the street line, what comes after is the town. Trying
to recognise the town by its name would mean shipping a list of communes and
keeping it up to date.

Second, the street type and the complement are read from dictionaries rather
than guessed, so the abbreviations people actually type — "av.", "bd", "bât",
"appt" — come out as one canonical spelling. The complement is the part the
postal standard puts on lines of its own, and a one-line form receives mixed
into the street; its keywords are a closed list, which is why a dictionary
settles it.

What this does not do is check that the address exists. Splitting without
checking gives clean fields that can still be wrong: "8 rue des Lilas,
75011 Lyon" splits perfectly and names no real place. The national geocoding
service is what answers that, and it is a separate step.
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

# The complement keywords of a French address, with the abbreviations people
# type. Trade knowledge again, and a closed list: the postal standard gives
# each of these a line of its own, and a one-line form gets them mixed into the
# street.
COMPLEMENTS = {
    "bat": "bâtiment", "batt": "bâtiment", "batiment": "bâtiment", "immeuble": "immeuble",
    "esc": "escalier", "escalier": "escalier",
    "app": "appartement", "apt": "appartement", "appt": "appartement", "appartement": "appartement",
    "etage": "étage", "porte": "porte", "hall": "hall", "entree": "entrée",
    "res": "résidence", "residence": "résidence", "lotissement": "lotissement",
    "lieu-dit": "lieu-dit", "lieudit": "lieu-dit",
    "bp": "BP", "cs": "CS", "tsa": "TSA", "cedex": "CEDEX", "chez": "chez",
}

FIELDS = ("number", "street_type", "street", "complement", "postcode", "city")

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


def _is_designator(word: str) -> bool:
    """What follows a complement keyword: a number, a single letter, another keyword."""
    return word.isdigit() or (len(word) == 1 and word.isalpha()) or fold(word) in COMPLEMENTS


def _cut_complement(words: list[str]) -> tuple[list[str], list[str]]:
    """
    Take the complement out of the street line, and return the two parts.

    Mid-line, a complement keyword opens a complement that runs to the end of
    the line — "8 rue des Lilas Bât C Apt 12" — but only when it is followed by
    what a complement is followed by: a number, a single letter, another
    keyword. Without that condition "rue de la Porte Maillot" would lose half
    its name to the word "Porte".

    At the start of the line, the complement closes where the street opens: the
    first street type, and the house number in front of it if there is one.
    "Résidence du Parc 3 rue de la Paix" cuts before the 3. With no street type
    at all, the whole line is the complement: "Lieu-dit Les Granges".
    """
    opening = next(
        (i for i, word in enumerate(words)
         if fold(word) in COMPLEMENTS and (i == 0 or i == len(words) - 1 or _is_designator(words[i + 1]))),
        None,
    )
    if opening is None:
        return words, []
    if opening > 0:
        return words[:opening], words[opening:]

    street = next((i for i, word in enumerate(words[1:], 1) if fold(word) in STREET_TYPES), None)
    if street is None:
        return [], words
    closing = street - 1 if street > 1 and HOUSE_NUMBER.fullmatch(words[street - 1]) else street
    return words[closing:], words[:closing]


def parse(address: str) -> dict:
    """
    Split an address into number, street type, street, complement, postcode and
    town.

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

    words, complement = _cut_complement(text.split())
    fields["complement"] = " ".join(complement)
    text = " ".join(words)

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
