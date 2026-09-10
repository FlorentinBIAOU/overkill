"""
Find duplicate records: normalise, block, then compare inside a block only.

Rung N0. Deterministic, standard library only, and the only rung here that
stays fast when the file grows, because it never compares every pair.

Two things make this work.

First, normalisation removes what a human ignores when reading a name: case,
accents, punctuation, double spaces. Two spellings that only differ by those
become the same string, and cost nothing to detect.

Second, blocking. Comparing every pair of ten thousand records is fifty
million comparisons. Grouping them by a cheap key first, and comparing only
inside a group, turns that into a few thousand. The whole cost of the rung is
in the key you pick, and so is its blind spot.
"""

import unicodedata


def normalise(text: str) -> str:
    """Lower case, strip accents and punctuation, collapse spaces."""
    decomposed = unicodedata.normalize("NFKD", text.lower())
    letters = "".join(c for c in decomposed if not unicodedata.combining(c))
    return " ".join("".join(c if c.isalnum() else " " for c in letters).split())


def record_text(record: dict) -> str:
    """One comparable string per record."""
    return normalise(" ".join(str(value) for value in record.values()))


def blocking_key(record: dict) -> str:
    """
    Two records that do not share this key are never compared.

    Three letters of the family name and the postcode: short enough to group
    real duplicates together, specific enough to keep the groups small.
    """
    words = normalise(record["name"]).split()
    family_name = words[-1] if words else ""
    return f"{family_name[:3]}:{normalise(str(record['postcode']))}"


def edit_distance(a: str, b: str) -> int:
    """Levenshtein distance, two rows at a time rather than a full matrix."""
    previous = list(range(len(b) + 1))
    for i, char_a in enumerate(a, start=1):
        current = [i]
        for j, char_b in enumerate(b, start=1):
            cost = 0 if char_a == char_b else 1
            current.append(min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost))
        previous = current
    return previous[-1]


def similarity(a: str, b: str) -> float:
    """1.0 for identical strings, 0.0 for strings sharing nothing."""
    longest = max(len(a), len(b))
    return 1.0 if longest == 0 else 1.0 - edit_distance(a, b) / longest


def find_duplicates(records: list[dict], threshold: float = 0.85) -> list[tuple]:
    """
    Return the pairs `(i, j, score)` that look like the same record.

    The threshold is yours to set: towards 1.0 if merging two different
    customers is the worse outcome, towards 0.0 if missing a duplicate is.
    """
    blocks: dict[str, list[int]] = {}
    for index, record in enumerate(records):
        blocks.setdefault(blocking_key(record), []).append(index)

    pairs = []
    for indexes in blocks.values():
        for position, i in enumerate(indexes):
            for j in indexes[position + 1:]:
                score = similarity(record_text(records[i]), record_text(records[j]))
                if score >= threshold:
                    pairs.append((i, j, round(score, 3)))
    return sorted(pairs, key=lambda pair: (-pair[2], pair[0], pair[1]))
