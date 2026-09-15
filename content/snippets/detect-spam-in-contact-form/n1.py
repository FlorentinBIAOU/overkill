"""
Tell spam from a real enquiry with a linear classifier on character n-grams.

Rung N1. The rules of N0 look for the words on a list. This one scores
the character fragments of a message, with weights learnt from labelled
submissions, taken from those the inbox has already received.

Character n-grams rather than words, so `backlink`, `backlinks` and
`backlinking` share most of their features. A word spelt out letter by letter,
`b a c k l i n k s`, shares none: no n-gram crosses a space.

The decision is a weighted sum, so you can print the features that pushed a
message over the line, which matters the first time someone asks why their
enquiry was rejected.
"""

import unicodedata

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline


def fold(text: str) -> str:
    """Lowercase and strip accents, so casing never doubles the feature space."""
    stripped = unicodedata.normalize("NFKD", text)
    return "".join(c for c in stripped if not unicodedata.combining(c)).casefold()


def train(messages: list[str], labels: list[int]):
    """`labels` is 1 when the submission is spam, 0 when it is a real enquiry."""
    model = make_pipeline(
        # `char_wb` keeps n-grams inside word boundaries, so the model learns
        # word shapes rather than the way two neighbours happen to collide.
        TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), sublinear_tf=True, min_df=1),
        # Balanced, so whichever class is rarer in your labels weighs as much
        # as the other. `C` above one because, on a small labelled set, a
        # heavy regulariser leaves every score sitting near a half, which
        # makes the threshold below meaningless.
        LogisticRegression(class_weight="balanced", C=10.0, max_iter=1000),
    )
    model.fit([fold(m) for m in messages], labels)
    return model


def spam_score(model, message: str) -> float:
    """Probability that the submission is spam, between zero and one."""
    folded = fold(message)
    # Nothing to read: without this, the model's bias alone would decide.
    if not folded.strip():
        return 0.0
    return float(model.predict_proba([folded])[0][1])


def is_spam(model, message: str, threshold: float = 0.5) -> bool:
    """
    Returns a decision, and the threshold is yours to set.

    Move it towards 1 when losing a real enquiry is the expensive mistake.
    Move it towards 0 when a spam message reaching a human is the expensive one.
    """
    return spam_score(model, message) >= threshold
