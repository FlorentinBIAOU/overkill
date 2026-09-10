"""
Tag articles from a controlled vocabulary, matched after simple lemmatisation.

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

# Endings stripped, longest first. This is a plural-and-suffix stripper, not a
# linguist's lemmatiser. It only has to fold the spellings of one word onto
# each other, and both sides of the comparison get the same treatment.
SUFFIXES = ("ements", "ement", "ations", "ation", "es", "s", "x", "e")

WORD = re.compile(r"[^\W_]+")


def normalise(text: str) -> str:
    """Lowercase and drop accents, so « Fiscalité » and « FISCALITE » meet."""
    decomposed = unicodedata.normalize("NFD", text.lower())
    return "".join(c for c in decomposed if not unicodedata.combining(c))


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
    search: « impot » can then never match inside « impotent ».
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
    haystack = stems(article)
    hits = {}
    for topic, terms in vocabulary.items():
        found = sum(1 for term in terms if stems(term) in haystack)
        if found >= min_terms:
            hits[topic] = found
    # Best supported first, ties in alphabetical order: a tagging run has to be
    # replayable, and a set has no order to replay.
    return sorted(hits, key=lambda topic: (-hits[topic], topic))
