"""
Spot anomalies in several metrics at once with an isolation forest.

Rung N1. The robust threshold of N0 watches one metric at a time, each against
its own recent window. An isolation forest watches the metrics together,
against everything it was trained on: night-time traffic with daytime errors
is a minute whose values each sit inside the range the service has known, and
whose combination does not. A threshold on each series rings for such a minute
only if one of its values leaves that series' own window.

An isolation forest cuts the space at random and measures how few cuts it
takes to leave a point on its own. A point in the middle of the crowd needs
many; a point out on its own needs three or four. There is nothing to label,
and the knob that changes what rings is the threshold, not the size of the
forest.

What this rung costs is the thing N0 was good at. The output is a rank
between zero and one, not a measured gap against a stated limit. Whoever is
woken up is told that the minute was unusual, not in what way.
"""

import math

from sklearn.ensemble import IsolationForest

# Trees are grown on random cuts, so the seed is part of the contract: an
# alert that changes between two runs on the same data is not an alert.
SEED = 0


def train(rows: list[list[float]], trees: int = 100, seed: int = SEED) -> IsolationForest:
    """
    `rows` is one observation per minute, the metrics always in the same order.

    Nothing is labelled and nothing is scaled: the cuts are drawn between the
    smallest and the largest value of each metric, so a metric counted in
    milliseconds and one counted in requests weigh the same.
    """
    model = IsolationForest(n_estimators=trees, random_state=seed).fit(rows)
    # The range each metric was seen in, missing values left out.
    columns = [[value for value in column if not math.isnan(value)] for column in zip(*rows)]
    model.bounds_ = [(min(c), max(c)) if c else (-math.inf, math.inf) for c in columns]
    return model


def scores(model: IsolationForest, rows: list[list[float]]) -> list[float]:
    """
    Between zero and one. Above one half, the point took fewer cuts to isolate
    than the crowd did, which is the whole definition of an anomaly here.

    A value past the range its metric was trained on scores one: no cut was
    ever drawn out there, and the forest would file it with the largest values
    it saw.
    """
    ranks = -model.score_samples(rows)  # one call for all the rows
    return [
        1.0 if any(v < low or v > high for v, (low, high) in zip(row, model.bounds_)) else float(rank)
        for row, rank in zip(rows, ranks)
    ]


def score(model: IsolationForest, row: list[float]) -> float:
    """The score of a single row."""
    return scores(model, [row])[0]


def anomalies(model: IsolationForest, rows: list[list[float]], threshold: float = 0.6) -> list[int]:
    """
    The indices worth looking at, and the threshold is yours to set.

    Move it towards one to be woken up less often and miss more; towards zero
    for the opposite trade. There is no value of it that turns the score into
    an explanation.
    """
    return [index for index, value in enumerate(scores(model, rows)) if value > threshold]
