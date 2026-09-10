"""
Parse an address with a self-hosted statistical parser.

Rung N2. libpostal is a parser trained on tens of millions of addresses from
open worldwide data. It labels a token from its context, like N1, but its
training set is the planet: the German number that comes after the street, the
British postcode that is not five digits, the Japanese order that starts with
the prefecture. It runs on your machine, so no address ever leaves it.

What you own on this rung is not the model. It is the batch, the size cap, the
mapping from its label set to yours, and the answer to « what does the code do
when the parser returns something we cannot use ». The model is a black box
with a fixed list of labels and no confidence score, and the last function
below is where that becomes your problem.
"""

from __future__ import annotations

# A postal address is a short line. Anything longer is a paste, and feeding it
# to the parser only produces confident nonsense more slowly.
MAX_CHARACTERS = 300

FIELDS = ("number", "street", "complement", "postcode", "city")

# libpostal's label set is its own, and wider than ours. Two of its labels can
# land in one of our fields, and everything unmapped is dropped on purpose: an
# unmapped label that silently became a field would be a surprise in a letter.
COMPONENTS = {
    "house_number": "number",
    "road": "street",
    "unit": "complement",
    "level": "complement",
    "staircase": "complement",
    "entrance": "complement",
    "postcode": "postcode",
    "city": "city",
}


class ParsingUnavailable(Exception):
    """The parser failed, or answered something no caller can act on."""


class LibpostalParser:
    """The real parser: a C library and its data files, loaded once."""

    def __init__(self) -> None:
        from postal.parser import parse_address  # a large local install

        self._parse_address = parse_address

    def predict(self, addresses: list[str]) -> list[dict]:
        """One label-to-value mapping per address, in the order given."""
        return [self._merge(self._parse_address(a)) for a in addresses]

    @staticmethod
    def _merge(components) -> dict:
        """libpostal yields (value, label) pairs, and repeats a label freely."""
        merged: dict[str, str] = {}
        for value, label in components:
            merged[label] = f"{merged.get(label, '')} {value}".strip()
        return merged


def parse_addresses(addresses, parser=None, *, attempts: int = 2) -> list[dict]:
    """
    Parse a batch of addresses into fields.

    `parser` is injected so this can be tested without installing the model. In
    production it defaults to the real one above.

    The whole batch goes in one call. Parsing addresses one by one is the usual
    way this rung is made slow, because the model is loaded once and a batch of
    a hundred is one pass through it.
    """
    parser = parser or LibpostalParser()
    batch = list(addresses)
    for address in batch:
        if len(address) > MAX_CHARACTERS:
            raise ValueError(f"address longer than {MAX_CHARACTERS} characters")
    if not batch:
        return []

    rows = _predict(parser, batch, attempts)
    if len(rows) != len(batch):
        raise ParsingUnavailable("the parser returned one row per address, and did not")
    return [_to_fields(row) for row in rows]


def _predict(parser, batch: list[str], attempts: int) -> list[dict]:
    """Retry once: loading the data files is the call that fails, and once."""
    last_error: Exception | None = None
    for _ in range(attempts):
        try:
            return parser.predict(batch)
        except Exception as error:  # noqa: BLE001 - any model failure is retried
            last_error = error
    raise ParsingUnavailable(str(last_error))


def _to_fields(row) -> dict:
    """Keep the labels we mapped, join those that share a field, drop the rest."""
    fields = dict.fromkeys(FIELDS, "")
    for label, value in (row or {}).items():
        field = COMPONENTS.get(label)
        if field and isinstance(value, str) and value.strip():
            fields[field] = f"{fields[field]} {value.strip()}".strip()
    return fields
