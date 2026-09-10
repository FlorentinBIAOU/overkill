"""
Tell spam from a real enquiry with a linear classifier on character n-grams.

Rung N1. The rules of N0 look for the words a spammer used last year. This
looks at how the message is written: a few hundred labelled submissions, the
kind an inbox already holds, and the model learns the register rather than the
vocabulary list.

Character n-grams rather than words, for two reasons. They survive the
spellings a sender uses to dodge a word list, `b a c k l i n k s`, `backl1nks`,
and they need no tokeniser that would have to be tuned per language.

The model is a few kilobytes and its decision is a weighted sum. You can print
the features that pushed a message over the line, which matters the first time
someone asks why their enquiry was rejected.
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
        # Balanced, because a real inbox holds far more spam than enquiries and
        # the rare class is the one worth getting right. `C` above one because
        # a few hundred examples with a heavy regulariser leave every score
        # sitting near a half, which makes the threshold below meaningless.
        LogisticRegression(class_weight="balanced", C=10.0, max_iter=1000),
    )
    model.fit([fold(m) for m in messages], labels)
    return model


def spam_score(model, message: str) -> float:
    """Probability that the submission is spam, between zero and one."""
    return float(model.predict_proba([fold(message)])[0][1])


def is_spam(model, message: str, threshold: float = 0.5) -> bool:
    """
    Returns a decision, and the threshold is yours to set.

    Move it towards 1 when losing a real enquiry is the expensive mistake.
    Move it towards 0 when a spam message reaching a human is the expensive one.
    """
    return spam_score(model, message) >= threshold
