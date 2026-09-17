"""
Build a test data set from a schema and a seed.

Rung N0. Standard library only, no file written: the function returns a list of
rows that a test can hand straight to the code under test.

Determinism is the whole point. The same seed and the same schema give exactly
the same rows, in Python as in JavaScript, for as long as this code is left
unchanged. That is what
makes a failing test replayable and a regression reproducible: the seed printed
next to a failure is enough to rebuild the data that caused it.

Which is why the generator is written out here instead of being taken from the
platform. Python's `random` takes a seed, JavaScript's `Math.random` does not,
so a data set built on them cannot be handed from one language to the other,
nor compared between a back end and a front end. A library like Faker would
not settle it either: its own documentation says the values a given seed
produces may change from one version to the next.

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
ESCAPE = "\x1e"  # stands in for UNIT inside a part, and is escaped itself


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


def _part(text: str) -> str:
    """Keep UNIT out of a part, so that two different cells never share a key."""
    return str(text).replace(ESCAPE, ESCAPE + "0").replace(UNIT, ESCAPE + "1")


def finalise(digest: int) -> int:
    """
    Scramble the low bits of a hash, the `fmix32` of MurmurHash3.

    FNV-1a leaves its last byte close to the last byte it was fed. Here the
    last byte fed is the last digit of the row number, and everything before it
    is the same for a whole column: without this step, `draw(…, row) % 2` is
    just the parity of the row, one column alternates strictly, and two columns
    that should be independent come out perfectly anticorrelated.

    Three shifts and two multiplications on 32 bits, written the same way in
    both languages so that a seed gives the same data in each.
    """
    digest ^= digest >> 16
    digest = (digest * 0x85EBCA6B) & MASK32
    digest ^= digest >> 13
    digest = (digest * 0xC2B2AE35) & MASK32
    return digest ^ (digest >> 16)


def draw(seed: str, field: str, row: int) -> int:
    """The single source of randomness: one 32-bit integer per cell."""
    return finalise(stable_hash(f"{_part(seed)}{UNIT}{_part(field)}{UNIT}{row}"))


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
        if not isinstance(span, int) or span < 1:
            raise ValueError(f"a date field needs a whole number of days from 1, not {span!r}")
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
