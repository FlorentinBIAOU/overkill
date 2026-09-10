"""
Learn the ranking weights from past interactions instead of setting them by hand.

Rung N1. The score is the one of N0, a weighted sum of the same four signals.
What changes is where the four numbers come from: a merchandiser's judgement
on N0, the click log here.

The method is pairwise. What a log really says is never « this product
deserves 0.8 », it is « shown these two side by side, a shopper took that
one ». Each such pair becomes one training row, the difference between the two
signal vectors, and a logistic regression on those differences gives back the
weights of the original score. Nothing else changes: the serving code, the
explanation shown to the shop, the scale of the score, all stay as they were.

Every pair is added in both directions, one labelled a win and one a loss.
That keeps the two classes balanced, and it is why the model carries no
intercept: a constant would shift both directions of the same pair the same
way, which is meaningless when comparing two products of one result page.
"""

import numpy as np
from sklearn.linear_model import LogisticRegression

SIGNALS = ("text", "availability", "margin", "popularity")


def pairs(impressions: list[list[dict]]) -> tuple[np.ndarray, np.ndarray]:
    """
    Turn result pages into training rows.

    `impressions` is one entry per result page shown to a shopper, each item
    holding the signals logged at serving time and whether it was clicked.
    Logging the signals rather than recomputing them later matters: a product
    that has since gone out of stock must be trained on the availability it
    had on the day, not on today's.
    """
    rows, labels = [], []
    for page in impressions:
        clicked = [item["signals"] for item in page if item["clicked"]]
        ignored = [item["signals"] for item in page if not item["clicked"]]
        for winner in clicked:
            for loser in ignored:
                difference = [winner[name] - loser[name] for name in SIGNALS]
                rows.append(difference)
                labels.append(1)
                rows.append([-value for value in difference])
                labels.append(0)
    return np.array(rows, dtype=float), np.array(labels)


def learn_weights(impressions: list[list[dict]], regularisation: float = 1.0) -> dict:
    """
    Fit the weights, and hand them back on the scale of the hand-set ones.

    Dividing by the total absolute weight makes the result readable next to
    the numbers of N0, and comparable between two months of log. It changes no
    ranking: scaling every weight scales every score the same way.
    """
    rows, labels = pairs(impressions)
    if len(rows) == 0:
        raise ValueError("no clicked and ignored pair in the log: nothing to learn from")
    model = LogisticRegression(C=regularisation, fit_intercept=False, max_iter=1000)
    model.fit(rows, labels)
    learnt = model.coef_[0]
    scale = float(np.abs(learnt).sum())
    return {name: float(value) / scale for name, value in zip(SIGNALS, learnt)}


def rank(candidates: list[dict], weights: dict) -> list[dict]:
    """
    Score candidates whose signals were computed by the serving pipeline.

    Same weighted sum as N0, same stable sort, same explanation returned: only
    the provenance of the weights differs.
    """
    scored = []
    for candidate in candidates:
        total = 0.0
        for name in SIGNALS:
            total += weights[name] * candidate["signals"][name]
        scored.append({"candidate": candidate, "score": total})
    scored.sort(key=lambda row: -row["score"])
    return scored
