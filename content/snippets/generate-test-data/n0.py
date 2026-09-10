"""
Build a test data set from a schema and a seed.

Rung N0. Standard library only, no file written: the function returns a list of
rows that a test can hand straight to the code under test.

Determinism is the whole point. The same seed and the same schema give exactly
the same rows, on every machine, in both languages, for ever. That is what
makes a failing test replayable and a regression reproducible: the seed printed
next to a failure is enough to rebuild the data that caused it.

Which is why the generator is written out here instead of being taken from the
platform. The standard generators of Python and JavaScript produce different
sequences from the same seed, so a data set built with them cannot be handed
from one language to the other, nor compared between a back end and a front end.

Each cell is drawn from a hash of (seed, field, row) rather than from a running
stream. Adding a field to the schema therefore leaves every other column
untouched, instead of shifting the whole set by one draw.
"""

from datetime import date, timedelta

# FNV-1a, the same constants as the rest of the catalogue, so that a given
# string hashes identically wherever it is hashed.
FNV_OFFSET = 2166136261
FNV_PRIME = 16777619
MASK32 = 0xFFFFFFFF

UNIT = "\x1f"  # separates the parts of a cell key, and appears in none of them


def stable_hash(text: str) -> int:
    """
    FNV-1a on 32 bits.

    Not the built-in hash: that one is salted per process, so the same seed
    would give different data after every restart.
    """
    digest = FNV_OFFSET
    for char in text:
        digest = ((digest ^ ord(char)) * FNV_PRIME) & MASK32
    return digest


def draw(seed: str, field: str, row: int) -> int:
    """The single source of randomness: one 32-bit integer per cell."""
    return stable_hash(f"{seed}{UNIT}{field}{UNIT}{row}")


def _value(spec: dict, number: int, row: int):
    """Turn one drawn integer into one value that satisfies the field spec."""
    kind = spec["type"]
    if kind == "int":
        low, high = spec["min"], spec["max"]
        if low > high:
            raise ValueError(f"impossible range: min {low} is above max {high}")
        return low + number % (high - low + 1)
    if kind == "choice":
        values = spec["values"]
        if not values:
            raise ValueError("a choice field needs at least one value")
        return values[number % len(values)]
    if kind == "bool":
        # Percentages, not probabilities: an observed rate is read off a
        # dashboard as a percentage, and copied here as one.
        return number % 100 < spec.get("true_percent", 50)
    if kind == "date":
        span = spec.get("days", 1)
        return (date.fromisoformat(spec["start"]) + timedelta(days=number % span)).isoformat()
    if kind == "sequence":
        # Unique by construction, because an identifier that repeats turns a
        # test about duplicates into a test about the generator.
        rank = f"{row + spec.get('start', 1):0{spec.get('width', 4)}d}"
        return f"{spec.get('prefix', '')}{rank}{spec.get('suffix', '')}"
    raise ValueError(f"unknown field type {kind!r}")


def generate_rows(schema: dict, count: int, seed: str) -> list[dict]:
    """
    Return `count` rows, each field drawn independently from its own spec.

    `schema` maps a field name to a spec: {"type": "int", "min": …, "max": …},
    {"type": "choice", "values": […]}, {"type": "bool", "true_percent": …},
    {"type": "date", "start": "YYYY-MM-DD", "days": …} or
    {"type": "sequence", "prefix": …, "width": …, "suffix": …}.
    """
    return [
        {field: _value(spec, draw(seed, field, row), row) for field, spec in schema.items()}
        for row in range(count)
    ]
