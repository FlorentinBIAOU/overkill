"""
Detect the language of a text: character trigram profiles, rank distance.

Rung N0. Deterministic, standard library only, and the whole model is a few
hundred short strings per language.

The idea is older than most of the field. Every language repeats its own
trigrams: "ent", "les", "eur" in French, "the", "ing" in English,
"que", "los" in Spanish. Rank those trigrams by frequency in a sample of
the language, rank them again in the text to identify, and compare the two
orderings. The language whose ordering is closest wins.

Two details make it work.

First, words are padded with spaces before being cut, so a trigram carries
the information that it opens or closes a word. "les" inside a word is not
the article.

Second, the comparison is on ranks, not on frequencies. A rank survives a
sample four times longer, and a text four times shorter, unchanged.
"""

import re
import unicodedata
from collections import Counter

PROFILE_SIZE = 300

# Letters only. Digits, punctuation and symbols say nothing about a language,
# and a text full of them would drown the trigrams that do.
WORDS = re.compile(r"[^\W\d_]+")


def trigrams(text: str):
    """Yield the padded trigrams of every word, in reading order."""
    lowered = unicodedata.normalize("NFC", text.lower())
    for word in WORDS.findall(lowered):
        padded = f" {word} "
        for i in range(len(padded) - 2):
            yield padded[i:i + 3]


def profile(sample: str, size: int = PROFILE_SIZE) -> dict[str, int]:
    """
    Build a language profile from a sample: trigram to rank, most frequent
    first.

    Ties are broken alphabetically, so the same sample always gives the same
    profile. A language model you cannot reproduce is a language model you
    cannot debug.
    """
    counts = Counter(trigrams(sample))
    ordered = sorted(counts.items(), key=lambda item: (-item[1], item[0]))
    return {gram: rank for rank, (gram, _) in enumerate(ordered[:size])}


def distance(text: str, reference: dict[str, int], size: int = PROFILE_SIZE) -> float:
    """
    Out-of-place distance between the text and one language profile.

    Every trigram of the text costs how far it moved in the ranking. A
    trigram the language never uses costs the maximum, which is what makes an
    unrelated language expensive rather than merely different.

    Dividing by the number of trigrams keeps a long text and a short one on
    the same scale.
    """
    text_profile = profile(text, size)
    if not text_profile:
        return float(size)
    total = 0
    for gram, rank in text_profile.items():
        reference_rank = reference.get(gram)
        total += size if reference_rank is None else abs(rank - reference_rank)
    return total / len(text_profile)


def ranked(text: str, profiles: dict[str, dict[str, int]]) -> list[tuple[str, float]]:
    """
    Every candidate language, closest first.

    The caller gets the gap between the first two, which is the only honest
    measure of how sure this is.
    """
    scores = [(name, distance(text, reference)) for name, reference in profiles.items()]
    return sorted(scores, key=lambda item: (item[1], item[0]))


def detect(text: str, profiles: dict[str, dict[str, int]]) -> str:
    """The closest language. It always returns one, even when it should not."""
    return ranked(text, profiles)[0][0]
