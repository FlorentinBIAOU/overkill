"""
Tag articles from a controlled vocabulary, matched after stripping common endings.

Rung N0. Deterministic, standard library only, and auditable: every tag can be
traced back to the term that produced it, which is what an editor asks for the
first time a tag looks wrong.

Two things make this work.

First, the article and the vocabulary go through the very same pipeline. A
stemmer that is applied to one side only will happily fail to match a word
with itself.

Second, tagging is multi-label by construction. An article covers several
topics, or none; a function that returns one topic per article is answering a
question nobody asked.
"""

import re
import unicodedata

# Endings stripped, longest of any two that overlap first. This is a
# plural-and-suffix stripper, not a lemmatiser: "embauchons" does not become
# "embaucher", "fiscaux" does not become "fiscal", and "poste" and "post" fold
# onto the same stem. Both sides of the comparison get the same treatment.
SUFFIXES = ("ements", "ement", "ations", "ation", "es", "s", "x", "e")

WORD = re.compile(r"[^\W_]+")


def normalise(text: str) -> str:
    """Lowercase and drop accents, so "Fiscalité" and "FISCALITE" meet."""
    # NFD does not split the ligatures, and a soft hyphen or a zero-width
    # space (format characters) would cut a word in two: both are handled here.
    text = text.lower().replace("œ", "oe").replace("æ", "ae")
    decomposed = unicodedata.normalize("NFD", text)
    return "".join(
        c for c in decomposed if not unicodedata.combining(c) and unicodedata.category(c) != "Cf"
    )


def lemmatise(word: str) -> str:
    """Strip one ending, and only when a stem of three letters is left."""
    for suffix in SUFFIXES:
        if word.endswith(suffix) and len(word) - len(suffix) >= 3:
            return word[: -len(suffix)]
    return word


def stems(text: str) -> str:
    """
    The text as a run of stems, padded with spaces at both ends.

    The padding is what lets a multi-word term be found with a plain substring
    search: "impot" can then never match inside "impotent".
    """
    return " " + " ".join(lemmatise(w) for w in WORD.findall(normalise(text))) + " "


def tag(article: str, vocabulary: dict[str, list[str]], min_terms: int = 1) -> list[str]:
    """
    Every topic whose terms appear in the article, best supported first.

    `vocabulary` maps a topic name to the terms that stand for it, single or
    multi-word. Keeping it a parameter is the point of this rung: the taxonomy
    belongs to whoever edits the articles, not to the code.

    `min_terms` is how many distinct terms a topic needs before it is claimed.
    Raise it when a single passing mention is not enough to file an article.
    """
    if min_terms < 1:
        raise ValueError("min_terms must be at least 1: a topic needs a term")
    haystack = stems(article)
    hits = {}
    for topic, terms in vocabulary.items():
        remaining, found = haystack, 0
        # Longest first, and a term found is removed from the text: "impot"
        # inside "credit d impot" is the same mention, not a second term.
        for term in sorted({stems(term) for term in terms}, key=len, reverse=True):
            if term.strip() and term in remaining:
                found += 1
                remaining = remaining.replace(term, " ")
        if found >= min_terms:
            hits[topic] = found
    # Best supported first, then by name once lowercased and stripped of
    # accents, the same order in both languages: a tagging run has to be
    # replayable, and a set has no order to replay.
    return sorted(hits, key=lambda topic: (-hits[topic], normalise(topic), topic))
