"""
Forecast weekly sales with a moving average and seasonal coefficients.

Rung N0. Standard library only.

The idea is the oldest one in forecasting: sales are a level that moves
slowly, multiplied by a shape that repeats every year. Estimate the shape over
the whole history, divide it out, average what is left over the last few
weeks, then put the shape back.

What this deliberately does not model is a trend. A moving average only ever
looks backwards, so it follows a change of regime instead of anticipating it.
That is the limit of this rung, and the test says so out loud.
"""

import math
from statistics import fmean


def seasonal_coefficients(history: list[float], season_length: int) -> list[float]:
    """
    One multiplier per position in the cycle, averaged over the history.

    A coefficient of 1.2 for week 50 means that week 50 usually sells twenty
    per cent above the year's level. The coefficients are rescaled to average
    one, so putting the shape back neither inflates nor deflates the forecast.
    """
    level = fmean(history)
    if level == 0:
        return [1.0] * season_length
    raw = [fmean(history[phase::season_length]) / level for phase in range(season_length)]
    scale = fmean(raw)
    return [coefficient / scale for coefficient in raw]


def forecast(
    history: list[float], season_length: int = 52, window: int = 4, horizon: int = 1
) -> list[float]:
    """
    Predict the next `horizon` weeks from `history`.

    The history and the forecast share one clock: the week after the end of
    the history is position `len(history)` in the cycle. The caller never has
    to align the series on a January.

    `window` trades reactivity for stability. A short window reacts fast and
    trusts the last few weeks; a long one is steadier and slower to notice a
    change.
    """
    if len(history) < 2 * season_length:
        raise ValueError("a seasonal coefficient needs two full cycles at the very least")
    if window < 1:
        raise ValueError("the moving average needs a window of at least one week")
    # A missing week must be refused, not averaged into a NaN forecast.
    if not all(math.isfinite(value) for value in history):
        raise ValueError("every week of history needs a finite number")
    coefficients = seasonal_coefficients(history, season_length)
    # Divide the season out, so the average below measures the level alone.
    # A week closed every year has a zero coefficient and says nothing about the level.
    deseasonalised = [
        value / coefficients[week % season_length]
        for week, value in enumerate(history)
        if coefficients[week % season_length] != 0
    ]
    level = fmean(deseasonalised[-window:])
    start = len(history)
    return [level * coefficients[(start + step) % season_length] for step in range(horizon)]
