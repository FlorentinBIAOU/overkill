"""
Flag anomalies in a metric with a robust threshold on a sliding window.

Rung N0. Median and median absolute deviation, standard library only, and a
verdict that can be read at three in the morning.

The mean and the standard deviation are the wrong tools here. One incident
drags both, so a large enough spike widens the very band that was supposed to
catch it. The median and the median absolute deviation ignore up to half the
window, which is exactly the property an alert needs.

Every verdict carries the numbers it was made of. "Anomaly at 03:12" leaves
whoever was woken up to reconstruct the reasoning before they can act;
"measured 4800, usual 1200, allowed up to 1511" is already half the
diagnosis, and it is the same three numbers the threshold itself used.
"""

from dataclasses import dataclass
from statistics import median

# Scaling that puts the median absolute deviation on the same footing as a
# standard deviation for normally distributed data, so that a threshold of
# 3.5 keeps the meaning it has everywhere else.
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


def scan(series: list[float], window: int = 24, threshold: float = 3.5) -> list[Verdict]:
    """
    Judge every point against the `window` points that precede it.

    The first `window` points get no verdict at all. A point cannot be
    compared with a history that does not exist yet, and saying nothing is
    more honest than comparing it with a shorter, noisier window.
    """
    verdicts = []
    for index in range(window, len(series)):
        reference = series[index - window : index]
        usual = median(reference)
        spread = NORMAL_SCALE * median([abs(value - usual) for value in reference])
        deviation = abs(series[index] - usual)
        limit = threshold * spread
        verdicts.append(Verdict(index, series[index], usual, deviation, limit, deviation > limit))
    return verdicts


def anomalies(series: list[float], window: int = 24, threshold: float = 3.5) -> list[Verdict]:
    """The subset a pager should see, each one still carrying its numbers."""
    return [verdict for verdict in scan(series, window, threshold) if verdict.is_anomaly]
