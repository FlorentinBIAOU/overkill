"""
Score a comment with a linear classifier trained on a labelled corpus.

Rung N1. The term list of N0 matches spellings. This matches shapes: character
n-grams, so `bl0rptard` and `blorptardd` share most of their features with the
form the model was shown, and a variant nobody added to a list still scores.

The whole model is a vector of weights over character n-grams. It is small
enough to keep beside the code, it trains while you read this docstring, and
every weight can be printed and argued about. That last property is worth more in
moderation than a point of accuracy: someone will ask why a comment was hidden.
"""

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline


def train(comments: list[str], labels: list[int]):
    """
    `labels` is 1 when the comment breaks the policy, 0 when it does not.

    Character n-grams rather than words, because abuse is spelled creatively
    and a word-level model only knows the exact tokens it was shown.

    `class_weight="balanced"` because a real moderation corpus is mostly
    ordinary comments, and an unweighted model learns to say no to everything.
    """
    model = make_pipeline(
        TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), min_df=1),
        LogisticRegression(class_weight="balanced", max_iter=1000),
    )
    model.fit(comments, labels)
    return model


def score(model, comment: str) -> float:
    """How strongly the model reads this comment as breaking the policy."""
    return float(model.predict_proba([comment])[0][1])


def is_abusive(model, comment: str, threshold: float = 0.5) -> bool:
    """
    Return a decision, and keep the threshold in the caller's hands.

    Moderation has no neutral setting. Move it towards 1 and you silence fewer
    innocent people while letting more abuse through; move it towards 0 and you
    do the opposite. Someone has to choose, and it should not be this function.
    """
    return score(model, comment) >= threshold
