"""
Learn the ranking weights from past interactions instead of setting them by hand.

Rung N1. The score is built on the same four signals as N0, each between
nought and one. What changes is where the four weights come from: a
merchandiser's judgement on N0, the click log here.

The method is pairwise, and only one kind of pair counts: a clicked product
against a product that was shown **above** it and passed over. That is the
"Click > Skip Above" strategy of Joachims et al., and the reason for it is the
position bias they measured: a product shown below the click may never have
been looked at, so pairing it with the click teaches nothing about the
products and everything about the order the previous ranking already produced.
The model would learn to reproduce N0, which is the opposite of why one climbs
here.

Each surviving pair becomes one training row, the difference between the two
signal vectors, and a logistic regression on those differences gives back the
weights of the original score. The signals shown to the shop stay the same;
the score does not. Learned weights can be negative, so the score is a plain
sum over weights whose absolute values add up to one, between minus one and
one, where N0 takes a mean of weights that cannot be negative.

Every pair is added in both directions, one labelled a win and one a loss.
That keeps the two classes balanced, and it is why the model carries no
intercept: a constant would shift both directions of the same pair the same
way, which is meaningless when comparing two products of one result page.
"""

import math

import numpy as np
from sklearn.linear_model import LogisticRegression

SIGNALS = ("text", "availability", "margin", "popularity")


def _in_scale(value) -> bool:
    """A finite number between 0 and 1, the scale N0 serves the signals on."""
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        return False
    return math.isfinite(value) and 0.0 <= value <= 1.0


def pairs(impressions: list[list[dict]]) -> tuple[np.ndarray, np.ndarray]:
    """
    Turn result pages into training rows.

    `impressions` is one entry per result page shown to a shopper, **in the
    order the page displayed them**, each item holding the signals logged at
    serving time and whether it was clicked. That order is the whole point:
    only the products above a click are paired with it.

    Logging the signals rather than recomputing them later matters too: a
    product that has since gone out of stock must be trained on the
    availability it had on the day, not on today's.

    A log where the first result is always clicked produces no pair at all,
    and `learn_weights` says so rather than inventing weights.
    """
    rows, labels = [], []
    for page in impressions:
        # The type is checked, not only the range: a signal logged as None or
        # as a string is a broken log, not a value to be cleaned up here.
        if not all(_in_scale(item["signals"][name]) for item in page for name in SIGNALS):
            raise ValueError("every logged signal must lie between 0 and 1")
        for position, item in enumerate(page):
            if not item["clicked"]:
                continue
            winner = item["signals"]
            for above in page[:position]:
                if above["clicked"]:
                    continue  # two clicks say nothing about each other
                difference = [winner[name] - above["signals"][name] for name in SIGNALS]
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
        raise ValueError(
            "no click with an ignored product above it in the log: nothing to learn from"
        )
    model = LogisticRegression(C=regularisation, fit_intercept=False, max_iter=1000)
    model.fit(rows, labels)
    learnt = model.coef_[0]
    scale = float(np.abs(learnt).sum())
    if scale == 0:
        raise ValueError("clicked and ignored products never differ in the log: nothing to learn from")
    return {name: float(value) / scale for name, value in zip(SIGNALS, learnt)}


def rank(candidates: list[dict], weights: dict) -> list[dict]:
    """
    Score candidates whose signals were computed by the serving pipeline.

    A sum weighted over the same signals, the same stable sort, the signals
    handed back with each candidate. Not N0's mean: dividing by the signed
    total of learned weights would reverse the order when that total is
    negative, and wipe it out when it is nought.
    """
    scored = []
    for candidate in candidates:
        total = 0.0
        for name in SIGNALS:
            total += weights[name] * candidate["signals"][name]
        scored.append({"candidate": candidate, "score": total})
    scored.sort(key=lambda row: -row["score"])
    return scored
