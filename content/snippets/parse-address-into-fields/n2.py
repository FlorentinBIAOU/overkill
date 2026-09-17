"""
Parse an address with a self-hosted statistical parser.

Rung N2. libpostal is a parser trained on over a billion addresses from every
inhabited country. It labels a token from its context, like N1, but where N1
knows the eighteen French addresses it was tagged on, libpostal's training
covers the conventions of other countries too. Whether it reads a given one
right, nothing here measures. It runs on your machine, so no address leaves it.

What you own on this rung is not the model. It is the batch, the size cap, the
mapping from its label set to yours, and the answer to "what does the code do
when the parser returns something we cannot use". The model is a black box
with a fixed list of labels and no confidence score, and the last function
below is where that becomes your problem.
"""

from __future__ import annotations

# A postal address is short: La Poste's rules allow six lines of 38 characters,
# which is 228 characters plus the separators. The cap is set above that, at
# 300, so that a line written with generous punctuation still goes through;
# anything past it is not an address, and is refused before parsing.
MAX_CHARACTERS = 300

FIELDS = ("number", "street", "complement", "postcode", "city")

# libpostal's label set is its own, and wider than ours. Five of its labels
# land in our complement, "house" among them: libpostal's name for a building
# or a venue, where a French residence name goes. Everything unmapped is dropped
# on purpose: an unmapped label that silently became a field would be a
# surprise in a letter.
COMPONENTS = {
    "house_number": "number",
    "road": "street",
    "house": "complement",
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
    """The real parser: a C library and its data files, loaded once per process on import."""

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

    The whole batch goes to the parser object in one call, but libpostal has no
    batching: `LibpostalParser.predict` parses the addresses one after the other.
    """
    batch = list(addresses)
    for address in batch:
        if len(address) > MAX_CHARACTERS:
            raise ValueError(f"address longer than {MAX_CHARACTERS} characters")
    if not batch:
        return []
    parser = parser or LibpostalParser()

    rows = _predict(parser, batch, attempts)
    if len(rows) != len(batch):
        raise ParsingUnavailable("the parser returned one row per address, and did not")
    return [_to_fields(row) for row in rows]


def _predict(parser, batch: list[str], attempts: int) -> list[dict]:
    """
    Retry a failed parse once. Loading is not retried: a parser that cannot
    load its data files fails before this point, with its own error.
    """
    last_error: Exception | None = None
    for _ in range(attempts):
        try:
            return parser.predict(batch)
        except Exception as error:  # noqa: BLE001 - any model failure is retried
            last_error = error
    raise ParsingUnavailable(str(last_error))


def _to_fields(row) -> dict:
    """Keep the labels we mapped, join those that share a field, drop the rest."""
    if row is None:
        row = {}
    if not isinstance(row, dict):
        raise ParsingUnavailable(f"the parser returned a {type(row).__name__}, not a mapping")
    fields = dict.fromkeys(FIELDS, "")
    for label, value in row.items():
        field = COMPONENTS.get(label)
        if field and isinstance(value, str) and value.strip():
            fields[field] = f"{fields[field]} {value.strip()}".strip()
    return fields
