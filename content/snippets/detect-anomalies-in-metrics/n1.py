"""
Spot anomalies in several metrics at once with an isolation forest.

Rung N1. The robust threshold of N0 watches one metric at a time, and some
incidents are invisible that way: every metric stays inside its usual range,
and only the combination is impossible. Night-time traffic with daytime
errors is one such minute, and no single-series threshold will ever ring for
it.

An isolation forest cuts the space at random and measures how few cuts it
takes to leave a point on its own. A point in the middle of the crowd needs
many; a point out on its own needs three or four. There is nothing to label,
and the only real knob is the size of the forest.

What this rung costs is the thing N0 was good at. The output is a rank
between zero and one, not a measured gap against a stated limit. Whoever is
woken up is told that the minute was unusual, not in what way.
"""

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
    model = IsolationForest(n_estimators=trees, random_state=seed)
    return model.fit(rows)


def score(model: IsolationForest, row: list[float]) -> float:
    """
    Between zero and one. Above one half, the point took fewer cuts to isolate
    than the crowd did, which is the whole definition of an anomaly here.
    """
    return float(-model.score_samples([row])[0])


def anomalies(model: IsolationForest, rows: list[list[float]], threshold: float = 0.6) -> list[int]:
    """
    The indices worth looking at, and the threshold is yours to set.

    Move it towards one to be woken up less often and miss more; towards zero
    for the opposite trade. There is no value of it that turns the score into
    an explanation.
    """
    return [index for index, row in enumerate(rows) if score(model, row) > threshold]
