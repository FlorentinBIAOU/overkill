"""
Score sentences with a classifier trained on surface features.

Rung N1. Same extractive shape as N0 — the summary is still made of the
document's own sentences — but the weights are learnt instead of guessed.

N0 fixes the trade between position and term density by hand, once, for every
document in the world. That constant is a guess. Here, documents whose summary
sentences someone has ticked off set the weights of five features instead, and
the model learns nothing those five cannot express. Position is coded as
1 / (rank + 1): the model can learn that early sentences count for more or for
less, never that the last one counts. A closing sentence gains only through
what it carries, a figure or a cue word such as `overall`.

The features are deliberately surface-level. They describe where a sentence
sits and what it looks like, not what it means. That is the ceiling of this
rung, and the reason the entry does not stop here.
"""

import re
import unicodedata

import numpy as np
from sklearn.linear_model import LogisticRegression

# A full stop, question or exclamation mark followed by whitespace, or a line
# break: the same splitter as N0, with the same limits.
SENTENCE_END = re.compile(r"(?<=[.!?])\s+|\s*\n\s*")
WORD = re.compile(r"[^\W_]+")

STOPWORDS = frozenset(
    "a an and are as at be been but by for from had has have in into is it its "
    "of on or that the their there they this to was were which will with".split()
)

# Words an author uses when about to state the point of what came before.
CUES = frozenset(
    "overall therefore total conclusion result summary altogether finally "
    "consequently".split()
)

# Sentences longer than this are already long; the feature saturates rather
# than letting one outlier stretch the scale for every other sentence.
LONG_SENTENCE = 25


def words(sentence: str) -> list[str]:
    """Lowercase words, composed first: a decomposed `é` would split the word."""
    return WORD.findall(unicodedata.normalize("NFC", sentence).lower())


def split_sentences(text: str) -> list[str]:
    """Cut the document into sentences, dropping empty ones."""
    parts = SENTENCE_END.split(text.strip())
    return [part.strip() for part in parts if part.strip()]


def sentence_features(sentences: list[str], index: int) -> list[float]:
    """
    Five things a reader notices before reading: where the sentence sits, how
    long it is, whether it carries a figure, whether it announces a conclusion,
    and how much of the opening it repeats.
    """
    sentence = sentences[index]
    found = words(sentence)
    opening = set(words(sentences[0]))
    content = [w for w in found if len(w) > 2 and w not in STOPWORDS]
    shared = sum(1 for word in content if word in opening)
    return [
        1.0 / (index + 1),
        min(len(found) / LONG_SENTENCE, 1.0),
        1.0 if any(c in "0123456789" for c in sentence) else 0.0,
        1.0 if any(word in CUES for word in found) else 0.0,
        shared / len(content) if content else 0.0,
    ]


def train(documents: list[list[str]], labels: list[list[int]]) -> LogisticRegression:
    """
    `documents` are lists of sentences; `labels[d][i]` is 1 when sentence `i`
    of document `d` belongs in the summary.

    The ticked sentences are the entire training set. Nothing here needs a GPU.
    """
    rows, targets = [], []
    for sentences, marks in zip(documents, labels):
        for index in range(len(sentences)):
            rows.append(sentence_features(sentences, index))
            targets.append(marks[index])
    return LogisticRegression(max_iter=2000).fit(np.array(rows), np.array(targets))


def summarise(model: LogisticRegression, text: str, max_sentences: int = 3) -> str:
    """Return the best-scored sentences, in the order the document puts them."""
    if max_sentences < 0:
        raise ValueError("max_sentences cannot be negative")
    sentences = split_sentences(text)
    if not sentences:
        return ""
    rows = np.array([sentence_features(sentences, i) for i in range(len(sentences))])
    scores = model.predict_proba(rows)[:, 1]
    # Sorting is stable, so two identical scores keep their document order.
    ranked = sorted(range(len(sentences)), key=lambda i: -scores[i])
    chosen = sorted(ranked[:max_sentences])
    return " ".join(sentences[index] for index in chosen)
