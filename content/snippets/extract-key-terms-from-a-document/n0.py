"""
The terms a document keeps coming back to, taken from the document alone.

Rung N0. The method is the one RAKE made common: the words a language uses to
build sentences — articles, prepositions, auxiliaries — are also what separates
one idea from the next, so cutting the text at every stop word leaves the
candidate phrases whole. Each candidate is then scored by how often its words
appear and how long the phrases they appear in are, which favours a phrase that
is repeated and specific over a word that is merely frequent.

The stop list is not shipped here, and that is the point. It is the whole job,
it is different in every language, and it belongs to the caller who knows what
language their documents are in — the same stance as the entry on showing
similar articles. Without one, the key terms of any French text are « de »,
« la » and « le », so an empty list is refused rather than served.

What this rung cannot do is in its name: it reads one document, so it can tell
what that document repeats, never what makes it different from the four hundred
others in the same folder. Every contract in a folder of contracts says
« conditions générales de vente », and nothing here knows that. Rung N1 does.

The tools that do this in one call: `yake` in Python, whose stop lists cover
some forty languages, and, in JavaScript, `keyword-extractor`, whose published
package declares no licence.
"""

from __future__ import annotations

import re
import unicodedata

# A word starts with a letter: « 14 » is not a key term of anything, « 14
# jours » may be. The hyphen stays inside, so « porte-monnaie » is one word.
WORD = re.compile(r"[^\W\d_][\w-]*", re.UNICODE)

# Two words belong to the same candidate only when nothing but space
# separates them. Punctuation ends a candidate, and so does anything this
# pattern does not list — the apostrophe among them, because French elides
# on it and « l'entreprise » is a stop word followed by a term.
SPACES = re.compile(r"[ \t\r\n\f\v\u00a0\u202f\u2028\u2029]+")

# Longer than this and it is a sentence, not a term.
MAX_WORDS = 4


def extract_key_terms(text, stop_words, *, top: int = 8) -> dict:
    """
    The phrases this document repeats, ranked without any other document.

    `stop_words` is a per-language list, required: it is what cuts the text
    into candidates, and no list means no language declared.
    """
    if not isinstance(text, str):
        return {"terms": [], "reason": f"expected text, not {type(text).__name__}"}
    stop = {_fold(word) for word in stop_words or []}
    if not stop:
        return {"terms": [], "reason": "a stop list is required, one per language"}

    candidates = _candidates(text, stop)
    degree, frequency = {}, {}
    for words in candidates:
        for word in words:
            key = _fold(word)
            degree[key] = degree.get(key, 0) + len(words)
            frequency[key] = frequency.get(key, 0) + 1

    seen = {}
    for words in candidates:
        key = " ".join(_fold(word) for word in words)
        entry = seen.setdefault(key, {"text": " ".join(words), "key": key, "count": 0,
                                      "score": sum(degree[_fold(w)] / frequency[_fold(w)]
                                                   for w in words)})
        entry["count"] += 1

    # Sorted on three keys so that two phrases of equal score always come back
    # in the same order, in both languages.
    terms = sorted(seen.values(), key=lambda t: (-t["score"], -t["count"], t["key"]))
    return {"terms": terms[:top], "reason": None}


def candidates_of(text: str, stop_words) -> list[str]:
    """The candidate phrases, keyed and deduplicated — what rung N1 ranks."""
    stop = {_fold(word) for word in stop_words or []}
    return sorted({" ".join(_fold(w) for w in words) for words in _candidates(text, stop)})


def _candidates(text: str, stop: set) -> list[list[str]]:
    """Runs of words with no stop word and no punctuation inside them."""
    # NFC once, on the whole text: in the decomposed form the accent is a
    # character of its own, and « société » would be cut in two.
    text = unicodedata.normalize("NFC", text)
    phrases, current, end = [], [], 0
    for match in WORD.finditer(text):
        if current and not SPACES.fullmatch(text[end:match.start()]):
            phrases.append(current)
            current = []
        end = match.end()
        if match.group().lower() in stop:
            if current:
                phrases.append(current)
            current = []
        elif len(current) < MAX_WORDS:
            current.append(match.group())
            if len(current) == MAX_WORDS:
                phrases.append(current)
                current = []
    if current:
        phrases.append(current)
    return phrases


def _fold(word: str) -> str:
    """One spelling per term; the text has already been normalised to NFC."""
    return unicodedata.normalize("NFC", word).lower()
