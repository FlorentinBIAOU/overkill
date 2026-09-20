"""
The parcel references an email carries, and how far each one can be trusted.

Rung N0. A tracking number is not free text: it is an identifier whose shape a
standard fixes, and the international one — UPU S10, used by every postal
operator and therefore by Colissimo and Chronopost — puts a check digit in it.
Two letters, eight digits, a check digit, two letters for the country: the
eleventh character is computed from the eight before it, and a number with one
digit wrong fails. That is the difference between finding a candidate and
identifying a reference.

Everything else is shape. « 1Z » followed by sixteen characters is a UPS
number, and the prefix is distinctive enough to be worth returning; ten bare
digits is the shape of a DHL Express air waybill, and it is also the shape of
an order number, a customer number and a phone number without its leading zero.
Those families are declared and named, but they are not searched unless the
caller asks for them, because a rung that returns every ten-digit number of an
email as a parcel reference is worse than one that returns nothing.

What comes back therefore says three things: what was found, which family it
belongs to, and whether anything was actually verified. A candidate is never
handed back as an identification.
"""

from __future__ import annotations

import re

# The service indicators the standard reserves: a valid S10 identifier never
# starts with one of them.
RESERVED = ("J", "K", "S", "T", "W")

# The weighting factors of the S10 check digit, in the order of the serial
# number's eight digits.
WEIGHTS = (8, 6, 4, 2, 3, 5, 9, 7)

# Each family: what it looks like, who uses it, and whether anything in the
# number itself can be verified.
FAMILIES = {
    "upu-s10": {
        "pattern": re.compile(r"(?<![0-9A-Za-z])([A-Z]{2})([0-9]{8})([0-9])([A-Z]{2})(?![0-9A-Za-z])"),
        "carriers": ["La Poste", "Colissimo", "Chronopost", "postal operators"],
        "verifiable": True,
    },
    "ups": {
        "pattern": re.compile(r"(?<![0-9A-Za-z])1Z[0-9A-Z]{16}(?![0-9A-Za-z])"),
        "carriers": ["UPS"],
        "verifiable": False,
    },
    "ten-digits": {
        "pattern": re.compile(r"(?<![0-9A-Za-z])[0-9]{10}(?![0-9A-Za-z])"),
        "carriers": ["DHL Express", "and anything else written on ten digits"],
        "verifiable": False,
    },
}

# The families searched when the caller does not say. The one left out is the
# one that matches an order number as readily as a parcel.
DEFAULT_FAMILIES = ("upu-s10", "ups")


def find_tracking_numbers(text, families=DEFAULT_FAMILIES) -> dict:
    """
    Every parcel reference candidate in `text`, with what could be verified.

    `families` is declared by the caller. Adding « ten-digits » finds DHL
    Express numbers, and every other ten-digit number in the same message.
    """
    if not isinstance(text, str):
        return {"found": [], "reason": f"expected text, not {type(text).__name__}"}
    unknown = [name for name in families if name not in FAMILIES]
    if unknown:
        return {"found": [], "reason": f"unknown families: {', '.join(sorted(unknown))}"}

    found = []
    for name in families:
        family = FAMILIES[name]
        for match in family["pattern"].finditer(text):
            checked, why = _verify(name, match)
            if why == "reserved":
                continue  # not an S10 identifier at all, whatever it looks like
            found.append({"text": match.group(), "family": name,
                          "carriers": list(family["carriers"]), "checked": checked,
                          "why": why, "start": match.start(), "end": match.end()})
    found.sort(key=lambda item: (item["start"], item["family"]))
    return {"found": found, "reason": None}


def _verify(name: str, match):
    """What the number itself proves, which is nothing outside S10."""
    if name != "upu-s10":
        return False, "shape only: this family carries nothing to check"
    service, serial, digit, _country = match.groups()
    if service[0] in RESERVED:
        return False, "reserved"
    if check_digit(serial) != int(digit):
        return False, "the check digit does not match the serial number"
    return True, None


def check_digit(serial: str) -> int:
    """
    The S10 check digit of an eight-digit serial number.

    Weighted modulus 11, as the standard describes it: the weighted sum is
    subtracted from eleven, 10 becomes 0 and 11 becomes 5.
    """
    total = sum(int(figure) * weight for figure, weight in zip(serial, WEIGHTS))
    remainder = 11 - total % 11
    return {10: 0, 11: 5}.get(remainder, remainder)
