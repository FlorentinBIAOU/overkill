"""
Forecast weekly sales with a linear model on calendar features.

Rung N1. The moving average of N0 has no notion of a trend: it can only
repeat the recent past, which is exactly what it gets wrong when the business
is growing or shrinking. Here the level, the slope and the seasonal shape are
estimated together, by least squares, over the whole history.

The features are calendar arithmetic and nothing else: a constant, the number
of cycles elapsed, and a few sine and cosine pairs whose period is the season.
Two pairs are enough to place a Christmas peak and a summer dip; a peak only
a few weeks wide needs more pairs to reach its full height.

Counting the trend in cycles rather than in weeks is not cosmetic. It keeps
the columns of the design matrix on comparable scales, and it makes the
coefficient readable on its own: it is the growth per cycle, per year with
the default 52-week season. Less than one full cycle of history cannot tell
the trend from the season, so it is refused.
"""

import math

import numpy as np


def calendar_features(week: int, season_length: int, harmonics: int) -> list[float]:
    """The row of the design matrix for one week. This is the whole model."""
    row = [1.0, week / season_length]
    for k in range(1, harmonics + 1):
        angle = 2 * math.pi * k * week / season_length
        row += [math.sin(angle), math.cos(angle)]
    return row


def fit(history: list[float], season_length: int = 52, harmonics: int = 2) -> dict:
    """
    Least squares over the whole history. Returns a model you can inspect.

    `coefficients[1]` is the growth per cycle, in the unit of the series. That
    number is worth reading before any forecast is: a model that has found a
    trend nobody in the company recognises is a model to distrust.
    """
    if len(history) < 2 + 2 * harmonics:
        raise ValueError("fewer weeks of history than features to estimate")
    if len(history) < season_length:
        raise ValueError("a trend cannot be told apart from the season on less than one full cycle")
    sales = np.array(history, dtype=float)  # a missing week (None) becomes NaN here
    if not np.all(np.isfinite(sales)):
        raise ValueError("every week of history needs a finite number")
    design = [calendar_features(week, season_length, harmonics) for week in range(len(history))]
    coefficients, *_ = np.linalg.lstsq(np.array(design), sales, rcond=None)
    return {
        "coefficients": [float(c) for c in coefficients],
        "season_length": season_length,
        "harmonics": harmonics,
        "start": len(history),
    }


def forecast(model: dict, horizon: int = 1) -> list[float]:
    """Predict the `horizon` weeks that follow the history the model was fitted on."""
    weeks = []
    for step in range(horizon):
        row = calendar_features(model["start"] + step, model["season_length"], model["harmonics"])
        weeks.append(sum(c * x for c, x in zip(model["coefficients"], row)))
    return weeks
