"""
Score a comment with a linear classifier trained on a labelled corpus.

Rung N1. The term list of N0 matches spellings. This matches shapes: character
n-grams, so `bl0rptard` and `blorptardd` share most of their features with the
form the model was shown, and a variant nobody added to a list still scores.

The whole model is a vector of weights over character n-grams. It is small
enough to keep beside the code, it trains while you read this docstring, and
every weight can be printed next to the n-gram it belongs to. Someone will ask
why their comment was hidden.
"""

import unicodedata

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline


def fold(comment: str) -> str:
    """NFKC then lowercase, so full-width letters and ligatures read as the plain ones."""
    return unicodedata.normalize("NFKC", comment).lower()


def train(comments: list[str], labels: list[int]):
    """
    `labels` is 1 when the comment breaks the policy, 0 when it does not.

    Character n-grams rather than words, because abuse is spelled creatively
    and a word-level model only knows the exact tokens it was shown.

    `class_weight="balanced"` because a real moderation corpus is mostly
    ordinary comments, and an unweighted model learns to say no to everything.
    """
    model = make_pipeline(
        TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), preprocessor=fold),
        # `C` above one because a couple of dozen short examples under the
        # default regulariser leave every score sitting near a half, which
        # makes the threshold in `is_abusive` meaningless.
        LogisticRegression(class_weight="balanced", C=10.0, max_iter=1000),
    )
    model.fit(comments, labels)
    return model


def score(model, comment: str) -> float:
    """
    How strongly the model reads this comment as breaking the policy. A comment
    with no n-gram to read scores 0: the intercept alone is not evidence.
    """
    if model[0].transform([comment]).nnz == 0:
        return 0.0
    return float(model.predict_proba([comment])[0][1])


def is_abusive(model, comment: str, threshold: float = 0.5) -> bool:
    """
    Return a decision, and keep the threshold in the caller's hands.

    Moderation has no neutral setting. Move it towards 1 and you silence fewer
    innocent people while letting more abuse through; move it towards 0 and you
    do the opposite. Someone has to choose, and it should not be this function.
    """
    return score(model, comment) >= threshold
