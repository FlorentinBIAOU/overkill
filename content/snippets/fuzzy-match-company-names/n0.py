"""
Match two company names: normalise, drop the legal form, then Jaro-Winkler.

Rung N0. Deterministic, standard library only. Two decisions carry the whole
result.

First, the legal form is removed rather than compared, and only where a legal
form is written: at the end of the name, or at the front for the forms French
filings put there. "Boulangerie Martin SARL" and "Boulangerie Martin SAS" are
one trading name under two statuses; leaving SARL and SAS inside the strings
would push them apart for a reason nobody cares about.

Second, the abbreviations a company register is full of are expanded before
anything is compared: "Ets Martin" and "Établissements Martin" are the same
company, and "&" and "et" are the same word.

Third, Jaro-Winkler rather than a plain edit distance. It rewards a shared
opening — which is a problem here, not a feature: a French company name opens
on its trade and differs at the tail, so two chemists of one town score higher
than a real pair. That is the breaking point of this rung, and the reason a
score above the threshold is a pair to read, never a merge.
"""

import re
import unicodedata

# Legal forms, French and foreign. This is business knowledge, not example
# data. No "spa": it is also a word of trading names, and dropping it would
# merge "Nordic Spa" with "Nordic SA".
LEGAL_FORMS = frozenset(("sarl sas sasu sa eurl sci snc scop selarl gie ltd limited "
                         "plc gmbh ag inc llc corp bv nv srl").split())

# The forms a French filing also writes in front of the name. "sa" is not among
# them: it is an article in Catalan and Corsican trading names, and dropping a
# leading one would merge "Sa Nostra" with "Nostra". Nor is "nv", for the same
# reason in "NV Energy".
LEADING_FORMS = frozenset("sarl sas sasu eurl sci snc scop selarl gie".split())

# What a company register writes short. Expanded before anything is compared,
# because "Ets Martin" and "Établissements Martin" are one company and Jaro
# scores them 0.68.
ABBREVIATIONS = {
    "ets": "etablissements", "etab": "etablissements", "etabs": "etablissements",
    "ste": "societe", "stes": "societes", "cie": "compagnie",
}

# Winkler looks at the first four characters only, and gives back a tenth of
# the score Jaro withheld for each of them that both names share.
PREFIX_LENGTH, PREFIX_SCALING = 4, 0.1


# Latin diacritics only. Dropping every combining mark would take the vowels of
# Devanagari and Thai with it, and "कमल उद्योग" and "कोमल उद्योग" would score 1.0.
_LATIN_MARKS = re.compile(r"[\u0300-\u036f]")


def _words(text: str) -> list[str]:
    r"""
    Runs of letters, digits and the marks that belong to them.

    The marks have to be kept, which a plain `\w` would not do: a Devanagari
    vowel sign is a combining mark, and dropping it would empty half the name.
    """
    found, current = [], []
    for char in text:
        if char.isalnum() or unicodedata.category(char).startswith("M"):
            current.append(char)
        elif current:
            found.append("".join(current))
            current = []
    return found + ["".join(current)] if current else found


def normalise(name: str) -> str:
    """Lowercase, expand the abbreviations, strip accents and punctuation, drop the legal form."""
    folded = _LATIN_MARKS.sub("", unicodedata.normalize("NFKD", name.lower()))
    # "&" is the same word as "et" in a company name, and punctuation is about
    # to be dropped, which would make the two spellings differ by one word.
    plain = folded.replace("&", " et ")
    # Letters and digits of every script: a Cyrillic or Japanese name is kept,
    # not emptied into a string that would match every other emptied name.
    words = [ABBREVIATIONS.get(w, w) for w in _words(plain)]
    kept = list(words)
    if len(kept) > 1 and kept[0] in LEADING_FORMS:
        kept = kept[1:]
    while len(kept) > 1 and kept[-1] in LEGAL_FORMS:
        kept = kept[:-1]
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
