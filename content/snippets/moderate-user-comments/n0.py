"""
Flag a comment against a term list, after normalisation, with context.

Rung N0. Deterministic, standard library only, and auditable: every decision
can be traced back to one entry in a list you control.

Two things make it usable rather than merely simple.

First, normalisation. Case, accents and compatibility forms (full-width
letters, ligatures, superscripts) are spellings of the same word, so they are
folded before matching. Look-alikes are not: a 0 stays a 0, which is why
bl0rptard walks past.

Second, the context window. A term list cannot decide anything on its own, so
the function returns the words around each hit. A human reads the window and
decides. A moderation tool that returns a bare boolean hides the one piece of
evidence its reviewer needs.
"""

import unicodedata

# Latin combining accents. Only those are dropped when folding: a Devanagari
# vowel sign is a mark too, and dropping it would turn one word into another.
LATIN_MARKS = ("\u0300", "\u036f")


def normalise(text: str) -> str:
    """Fold compatibility forms, then case, then Latin accents."""
    # Decomposed before folding, and again after: 𝐁𝐋𝐎𝐑𝐏𝐓𝐀𝐑𝐃 has to become
    # BLORPTARD before the case fold can see it, and folding can itself produce
    # a compatibility form.
    decomposed = unicodedata.normalize("NFKD", text)
    folded = unicodedata.normalize("NFKD", decomposed.casefold())
    return "".join(c for c in folded if not LATIN_MARKS[0] <= c <= LATIN_MARKS[1])


def _words(text: str) -> list[str]:
    """
    Letters, digits, and the marks that spell them; anything else separates.

    A regular expression does this in JavaScript, which has a class for marks;
    Python's does not, and its word class leaves marks out, so a Devanagari
    vowel sign would cut a word in two. Composed first, so an accent typed as a
    separate mark stays in its word.
    """
    words, current = [], []
    for char in unicodedata.normalize("NFC", text):
        if char.isalnum() or unicodedata.category(char).startswith("M"):
            current.append(char)
        elif current:
            words.append("".join(current))
            current = []
    if current:
        words.append("".join(current))
    return words


def review(text: str, terms, window: int = 3) -> dict:
    """
    Return every listed term found in `text`, with the words around it.

    A term of several words matches those words in a row, whatever punctuation
    separates them in the comment.

    `terms` is yours: the list is policy, not code, and it belongs outside the
    function that applies it.

    `window` is a number of words on each side. Widen it when your reviewers
    keep asking what the comment was about.
    """
    listed = {tuple(normalise(w) for w in _words(t)) for t in terms}
    longest = max(map(len, listed), default=0)
    words = _words(text)
    folded = [normalise(w) for w in words]
    matches = []
    for position in range(len(words)):
        for size in range(1, min(longest, len(words) - position) + 1):
            if tuple(folded[position:position + size]) in listed:
                matches.append({
                    "term": " ".join(folded[position:position + size]),
                    "position": position,
                    "context": " ".join(words[max(0, position - window):position + size + window]),
                })
    return {"flagged": bool(matches), "matches": matches}
