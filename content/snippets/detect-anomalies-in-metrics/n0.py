"""
Flag anomalies in a metric with a robust threshold on a sliding window.

Rung N0. Median and median absolute deviation, standard library only, and a
verdict that can be read at three in the morning.

The mean and the standard deviation are the wrong tools here. One incident
drags both, so a large enough spike widens the very band that was supposed to
catch it. The median and the median absolute deviation hold while outliers fill
less than half the window: the usual value stays among ordinary values, and
the tolerated gap widens as the outliers pile up instead of jumping with the
first one. That is the property an alert needs.

Every verdict carries the numbers it was made of. "Anomaly at 03:12" leaves
whoever was woken up to reconstruct the reasoning before they can act;
"measured 4800, usual 1200, allowed up to 1511" is already half the
diagnosis, and it is the same three numbers the threshold itself used.
"""

from dataclasses import dataclass
from statistics import median

# Scaling that puts the median absolute deviation on the same footing as a
# standard deviation for normally distributed data. Estimated on a short
# window it is noisy: pure Gaussian noise crosses 3.5 of these far more often
# than it crosses 3.5 true standard deviations, and the tests measure how often.
NORMAL_SCALE = 1.4826


@dataclass
class Verdict:
    """One judged point, and the whole reasoning behind the judgement."""

    index: int
    value: float
    usual: float  # median of the window that came before
    deviation: float  # how far the point sits from that median
    limit: float  # how far it was allowed to sit
    is_anomaly: bool


def scan(series: list[float], window: int = 24, threshold: float = 3.5,
         min_spread: float = 0.0) -> list[Verdict]:
    """
    Judge every point against the `window` points that precede it.

    The first `window` points get no verdict at all. A point cannot be
    compared with a history that does not exist yet, and saying nothing is
    more honest than comparing it with a shorter, noisier window.

    `min_spread` is the smallest spread the metric may have, in its own unit.
    A count that is zero most minutes, such as errors, has a median absolute
    deviation of zero, and every single error would ring: pass 1 for it.
    """
    if window < 1:
        raise ValueError("window must hold at least one point")
    verdicts = []
    for index in range(window, len(series)):
        reference = series[index - window : index]
        usual = median(reference)
        spread = max(NORMAL_SCALE * median([abs(value - usual) for value in reference]), min_spread)
        deviation = abs(series[index] - usual)
        limit = threshold * spread
        verdicts.append(Verdict(index, series[index], usual, deviation, limit, deviation > limit))
    return verdicts


def anomalies(series: list[float], window: int = 24, threshold: float = 3.5,
              min_spread: float = 0.0) -> list[Verdict]:
    """The subset a pager should see, each one still carrying its numbers."""
    return [verdict for verdict in scan(series, window, threshold, min_spread) if verdict.is_anomaly]
