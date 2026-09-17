"""
Find duplicate records: normalise, block on several keys, compare field by
field.

Rung N0. Deterministic, standard library only. It compares only the records
that share at least one blocking key: every pair inside a group, none across
groups.

Three things make this work.

First, normalisation removes what a human ignores when reading a name: case,
accents, punctuation, double spaces. Two spellings that only differ by those
become the same string, and cost nothing to detect.

Second, blocking. Comparing every pair of ten thousand records is fifty
million comparisons. Grouping them by a cheap key first, and comparing only
inside a group, leaves the pairs of each group: few when the groups are small,
all of them when every record lands in the same group. A key that misses a
duplicate is answered with a second key, not with the removal of the key: the
pairs of several keys are unioned, and the cost stays the sum of small groups.

Third, comparison field by field, each field weighed. Two sources rarely fill
the same columns: one holds a phone number, the other does not. A field only
one of the two carries is not a difference, and a record compared as one long
string would count that silence as one — and would give the same weight to a
town shared by two million people as to an email address.
"""

import unicodedata

# Fields compared for equality rather than by edit distance. Two different
# addresses at the same domain share most of their characters, and an edit
# distance would call them close; so would two postcodes of the same town.
IDENTIFYING = frozenset({"email", "phone", "postcode", "siret", "siren", "vat"})

# How much agreement on a field is worth. Agreeing on a town says almost
# nothing — thousands of people live in it — while agreeing on an email
# address says nearly everything. This is the crude end of the Fellegi-Sunter
# model, where the weight of a field comes from how often two unrelated
# records agree on it; here the numbers are declared rather than estimated,
# and they are yours to change for your file.
WEIGHTS = {"email": 3.0, "phone": 3.0, "siret": 3.0, "name": 3.0, "postcode": 1.0,
           "city": 0.3, "country": 0.1}
DEFAULT_WEIGHT = 1.0


def normalise(text: str | None) -> str:
    """Lower case, strip accents, invisible characters and punctuation, collapse spaces."""
    decomposed = unicodedata.normalize("NFKD", (str(text) if text is not None else "").lower())
    # A zero-width space is a format character: dropped, it does not split a word.
    letters = "".join(c for c in decomposed if not unicodedata.combining(c) and unicodedata.category(c) != "Cf")
    return " ".join("".join(c if c.isalnum() else " " for c in letters).split())


def record_text(record: dict) -> str:
    """
    One comparable string per record, columns in a stable order.

    Sorted by column name, so that two exports of the same data give the same
    text whatever order their columns come in. An empty cell adds nothing.
    """
    return normalise(" ".join(str(record[key]) for key in sorted(record) if record[key] is not None))


def blocking_key(record: dict) -> str:
    """
    Three letters of the family name and the postcode.

    Short enough to group real duplicates together, specific enough to keep
    the groups small. A record missing either half produces no key, and is
    then grouped by the other keys or not at all.
    """
    words = normalise(record.get("name")).split()
    family_name = words[-1] if words else ""
    postcode = normalise(record.get("postcode")).replace(" ", "")
    return f"{family_name[:3]}:{postcode}" if family_name and postcode else ""


def field_key(field: str):
    """
    A blocking key made of one identifying field: an email, a phone number.

    This is the second rule that answers a first one which missed: a mistyped
    postcode breaks `blocking_key`, and the pair still comes back through the
    email the two records share.
    """

    def key(record: dict) -> str:
        value = normalise(record.get(field)).replace(" ", "")
        return f"{field}:{value}" if value else ""

    return key


DEFAULT_KEYS = (blocking_key, field_key("email"), field_key("phone"))


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


def _equal(a: str, b: str) -> float:
    """Equal once the spaces are out, or not equal at all."""
    return 1.0 if a.replace(" ", "") == b.replace(" ", "") else 0.0


def compare_records(a: dict, b: dict, weights: dict | None = None) -> float | None:
    """
    Score two records on the fields both of them fill, and only those.

    A weighted mean of the per-field scores. Two things matter here, and
    comparing the whole record as one string gets both wrong: a field only one
    of the two carries is skipped rather than counted as a difference, and a
    field everybody shares counts for little.

    Returns None when the two records share no filled field.
    """
    weights = WEIGHTS if weights is None else weights
    total, weighed = 0.0, 0.0
    for field in sorted(set(a) & set(b)):
        left, right = normalise(a[field]), normalise(b[field])
        if not left or not right:
            continue
        score = _equal(left, right) if field in IDENTIFYING else similarity(left, right)
        weight = weights.get(field, DEFAULT_WEIGHT)
        total, weighed = total + weight * score, weighed + weight
    return total / weighed if weighed else None


def find_duplicates(records: list[dict], threshold: float = 0.85, keys=DEFAULT_KEYS,
                    weights: dict | None = None) -> list[tuple]:
    """
    Return the pairs `(i, j, score)` that look like the same record.

    `keys` is the list of blocking rules. A pair that any one of them groups
    is compared, once: the pairs are unioned, not intersected, so adding a
    rule can only find more duplicates.

    `weights` says what agreement on each field is worth; see WEIGHTS.

    The threshold is yours to set: towards 1.0 if merging two different
    customers is the worse outcome, towards 0.0 if missing a duplicate is.
    """
    pairs, seen = [], set()
    for key in keys:
        blocks: dict[str, list[int]] = {}
        for index, record in enumerate(records):
            group = key(record)
            if group:
                blocks.setdefault(group, []).append(index)
        for indexes in blocks.values():
            for position, i in enumerate(indexes):
                for j in indexes[position + 1:]:
                    if (i, j) in seen:
                        continue
                    seen.add((i, j))
                    score = compare_records(records[i], records[j], weights)
                    if score is not None and score >= threshold:
                        pairs.append((i, j, round(score, 3)))
    return sorted(pairs, key=lambda pair: (-pair[2], pair[0], pair[1]))
