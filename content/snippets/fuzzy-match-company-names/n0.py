"""
Match two company names: normalise, drop the legal form, then Jaro-Winkler.

Rung N0. Deterministic, standard library only. Two decisions carry the whole
result.

First, the legal form is removed rather than compared. "Boulangerie Martin
SARL" and "Boulangerie Martin SAS" are one trading name under two statuses;
leaving SARL and SAS inside the strings would push them apart for a reason
nobody cares about.

Second, Jaro-Winkler rather than a plain edit distance. It rewards a shared
opening, which suits names that differ at the tail: a form, a city, a scrap of
punctuation after the same brand.
"""

import re
import unicodedata

# Legal forms, French and foreign. This is business knowledge, not example
# data. No "spa": it is also a word of trading names, and dropping it would
# merge "Nordic Spa" with "Nordic SA".
LEGAL_FORMS = frozenset(("sarl sas sasu sa eurl sci snc ltd limited plc gmbh "
                         "ag inc llc corp bv nv srl").split())

# Winkler looks at the first four characters only, and gives back a tenth of
# the score Jaro withheld for each of them that both names share.
PREFIX_LENGTH, PREFIX_SCALING = 4, 0.1


def normalise(name: str) -> str:
    """Lowercase, strip accents and punctuation, drop the legal form."""
    folded = unicodedata.normalize("NFKD", name.lower())
    plain = "".join(c for c in folded if not unicodedata.category(c).startswith("M"))
    # Letters and digits of every script: a Cyrillic or Japanese name is kept,
    # not emptied into a string that would match every other emptied name.
    words = re.findall(r"[^\W_]+", plain)
    kept = [w for w in words if w not in LEGAL_FORMS]
    # A name made of nothing but a legal form keeps it. Emptying it would make
    # it match every other emptied name perfectly, which is worse than useless.
    return " ".join(kept or words)


def _jaro(a: str, b: str) -> float:
    """
    Share of characters found on both sides, discounted by their disorder.

    A character counts as found only if its twin sits less than half the length
    of the longer name away: at most that half, minus one. That window is what separates Jaro from a plain count
    of common letters.
    """
    if a == b:
        return 1.0
    if not a or not b:
        return 0.0
    window = max(max(len(a), len(b)) // 2 - 1, 0)
    hit_a, hit_b = [False] * len(a), [False] * len(b)
    for i, char in enumerate(a):
        for j in range(max(0, i - window), min(len(b), i + window + 1)):
            if not hit_b[j] and b[j] == char:
                hit_a[i] = hit_b[j] = True
                break
    matched_a = [c for c, hit in zip(a, hit_a) if hit]
    matched_b = [c for c, hit in zip(b, hit_b) if hit]
    if not matched_a:
        return 0.0
    m = len(matched_a)
    swaps = sum(x != y for x, y in zip(matched_a, matched_b)) // 2
    return (m / len(a) + m / len(b) + (m - swaps) / m) / 3


def jaro_winkler(a: str, b: str) -> float:
    """Jaro, raised towards 1 in proportion to the shared opening."""
    score = _jaro(a, b)
    prefix = 0
    for x, y in zip(a[:PREFIX_LENGTH], b[:PREFIX_LENGTH]):
        if x != y:
            break
        prefix += 1
    return score + prefix * PREFIX_SCALING * (1 - score)


def similarity(left: str, right: str) -> float:
    """Similarity of two company names, from 0 to 1."""
    return jaro_winkler(normalise(left), normalise(right))
