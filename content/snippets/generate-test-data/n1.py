"""
Sample a test data set from the distributions observed in production.

Rung N1. Standard library only, no file written, and still no network: the
distributions come from the caller, as the result of a `GROUP BY` would.

What this buys over N0. A schema says a quantity is between one and nine; it
does not say that most orders are for one item and almost none for nine. Data
drawn uniformly inside the bounds gives every rare case the same weight as the
common one, so a cache hit rate measured on it means nothing, a page laid out
for it looks nothing like the real one, and the slow query stays fast.

What is sampled here is the marginal distribution of each column, one column at
a time: the observed count per category, and the observed count per bucket of a
numeric column. Nothing is fitted and nothing is learnt — the observed table is
the model. Which also means the joint distribution is lost, and the tests next
to this file show what that costs.

Determinism works exactly as in N0, and for the same reason: a data set that is
only reproducible on average is not reproducible.
"""

FNV_OFFSET = 2166136261
FNV_PRIME = 16777619
MASK32 = 0xFFFFFFFF

UNIT = "\x1f"


def stable_hash(text: str) -> int:
    """FNV-1a on 32 bits, identical to the JavaScript version of this file."""
    digest = FNV_OFFSET
    for char in text:
        digest = ((digest ^ ord(char)) * FNV_PRIME) & MASK32
    return digest


def draw(seed: str, field: str, row: int) -> int:
    """One 32-bit integer per cell, independent of the other cells."""
    return stable_hash(f"{seed}{UNIT}{field}{UNIT}{row}")


def pick(counts: list[int], number: int) -> int:
    """
    Index of the bucket a drawn integer falls into, in proportion to `counts`.

    Cumulating integers rather than normalising to probabilities keeps the
    result exact, and identical in both languages: no floating point is
    involved anywhere in the decision.
    """
    total = sum(counts)
    if total <= 0:
        raise ValueError("a distribution needs at least one observation")
    target = number % total
    for index, count in enumerate(counts):
        if target < count:
            return index
        target -= count
    raise AssertionError("unreachable: the target is below the total")


def _sampler(spec: dict, seed: str, field: str):
    """Read one column's distribution once, and return what draws its value for a row."""
    kind = spec["type"]
    if kind == "categorical":
        # `counts` is a label to observed-count mapping, straight out of a
        # `GROUP BY`. A label seen zero times is never drawn, which is the
        # honest behaviour: it did not happen.
        #
        # The labels are sorted rather than taken in the order the query
        # returned them, so the same observed table always gives the same data.
        # It is also what keeps the two languages together: a JavaScript object
        # reorders its numeric-looking keys, and a postcode is one of those. The
        # key sorts by UTF-16 code unit, as JavaScript's `sort` does, or an emoji
        # and a full-width letter would come out in a different order. Sorting
        # once per column, not once per cell, keeps thousands of postcodes cheap.
        labels = sorted(spec["counts"], key=lambda label: label.encode("utf-16-be", "surrogatepass"))
        weights = [spec["counts"][label] for label in labels]
        return lambda row: labels[pick(weights, draw(seed, field, row))]
    if kind == "histogram":
        edges, counts = spec["edges"], spec["counts"]
        if len(edges) != len(counts) + 1:
            raise ValueError("a histogram needs one more edge than it has buckets")

        def within(row: int):
            bucket = pick(counts, draw(seed, field, row))
            low, high = edges[bucket], edges[bucket + 1]
            # A second, independent draw places the value inside its bucket. Within
            # a bucket the shape is unknown, so uniform is the only honest choice.
            return low + draw(seed, f"{field}{UNIT}within", row) % max(high - low, 1)

        return within
    raise ValueError(f"unknown distribution type {kind!r}")


def sample_rows(distributions: dict, count: int, seed: str) -> list[dict]:
    """
    Return `count` rows, each column sampled from its own observed distribution.

    `distributions` maps a field name to either
    {"type": "categorical", "counts": {label: observed count}} or
    {"type": "histogram", "edges": [...], "counts": [...]}, where the edges are
    integers, the buckets are half-open and `edges` holds one more value than
    `counts`.
    """
    samplers = {field: _sampler(spec, seed, field) for field, spec in distributions.items()}
    return [{field: sample(row) for field, sample in samplers.items()} for row in range(count)]
