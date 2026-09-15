"""
Summarise a long document by choosing its own best sentences.

Rung N0. Extractive: every sentence of the summary appears verbatim in the
source, because this code never writes a word, it only selects.

Two classical signals, and nothing else.

Term frequency. A word the document keeps coming back to is what the document
is about, so a sentence dense in such words carries more of the subject than a
sentence made of connectives. Dividing by the length of the sentence measures
density rather than volume, which stops a long sentence from winning by size.

Position. An author states the subject early. A small bonus that decays with
the rank of the sentence encodes that habit, without handing the summary to
the opening paragraph outright.
"""

import re
import unicodedata

# A sentence ends at a full stop, question or exclamation mark followed by
# whitespace, or at a line break, so a transcript or a list without final
# punctuation is still cut into lines. Abbreviations will fool this, and so
# will prose hard-wrapped at a fixed width, which has to be unwrapped first; a
# real corpus needs a better splitter, a separate problem from choosing.
SENTENCE_END = re.compile(r"(?<=[.!?])\s+|\s*\n\s*")

# Letters and digits only: `[^\W_]` is `\w` without the underscore, so
# accented words survive and punctuation does not.
WORD = re.compile(r"[^\W_]+")


def words(sentence: str) -> list[str]:
    """Lowercase words, composed first: a decomposed `é` would split the word."""
    return WORD.findall(unicodedata.normalize("NFC", sentence).lower())

# Words too common to say anything about the subject of a document.
STOPWORDS = frozenset(
    "a an and are as at be been but by for from had has have in into is it its "
    "of on or that the their there they this to was were which will with".split()
)

# How much the opening of the document is worth. Large enough to break a tie
# between two equally dense sentences, too small to win on its own.
LEAD_BONUS = 0.15


def split_sentences(text: str) -> list[str]:
    """Cut the document into sentences, dropping empty ones."""
    parts = SENTENCE_END.split(text.strip())
    return [part.strip() for part in parts if part.strip()]


def _term_weights(sentences: list[str]) -> dict[str, float]:
    """Count content words, then scale so the most frequent one weighs one."""
    counts: dict[str, int] = {}
    for sentence in sentences:
        for word in words(sentence):
            if len(word) > 2 and word not in STOPWORDS:
                counts[word] = counts.get(word, 0) + 1
    if not counts:
        return {}
    most = max(counts.values())
    return {word: count / most for word, count in counts.items()}


def score_sentences(sentences: list[str]) -> list[float]:
    """Density in the document's own vocabulary, plus the position bonus."""
    weights = _term_weights(sentences)
    scores = []
    for index, sentence in enumerate(sentences):
        found = words(sentence)
        # Accumulated in a plain loop rather than with `sum`, which since
        # Python 3.12 compensates rounding error on floats. That is the better
        # answer, but it is not the answer JavaScript gives, and the two
        # versions of this snippet have to rank sentences identically.
        total = 0.0
        for word in found:
            total += weights.get(word, 0.0)
        density = total / len(found) if found else 0.0
        scores.append(density + LEAD_BONUS / (index + 1))
    return scores


def summarise(text: str, max_sentences: int = 3) -> str:
    """
    Return the best sentences, in the order the document puts them.

    Ordering the summary by score would read as a list of quotations. Keeping
    document order keeps the sequence the author chose, which is the only part
    of the argument an extractive summary can preserve.
    """
    if max_sentences < 0:
        raise ValueError("max_sentences cannot be negative")
    sentences = split_sentences(text)
    scores = score_sentences(sentences)
    # Sorting is stable, so two identical scores keep their document order.
    ranked = sorted(range(len(sentences)), key=lambda i: -scores[i])
    chosen = sorted(ranked[:max_sentences])
    return " ".join(sentences[index] for index in chosen)
