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

One point over the limit is not an alert. On pure noise, one point in a
hundred to two in a hundred crosses the limit at the default settings: on a
metric sampled every minute that is ten to twenty pages a day, per metric, for
nothing. And a real step change crosses it for as many minutes as the window
takes to swallow it, which is a dozen pages for one incident. `episodes` is
what a pager should read: a run has to hold for `consecutive` points before it
counts, and an episode already open is not paged again. `anomalies` stays,
point by point, for a dashboard.
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
    """
    Every point over the limit, each one still carrying its numbers.

    This is the dashboard view, not the pager view: at the default settings a
    healthy metric puts one point in a hundred here. `episodes` is the pager
    view.
    """
    return [verdict for verdict in scan(series, window, threshold, min_spread) if verdict.is_anomaly]


@dataclass
class Episode:
    """A run of points over the limit, reported once."""

    start: int  # index of the first point of the run
    length: int  # how many points in a row stayed over the limit
    opened_by: Verdict  # the first point, with the numbers that judged it
    worst: Verdict  # the point that sat furthest outside its limit


def episodes(series: list[float], window: int = 24, threshold: float = 3.5,
             min_spread: float = 0.0, consecutive: int = 3) -> list[Episode]:
    """
    What a pager should see: one entry per run of points over the limit.

    Two rules, and they are the ones every on-call rota ends up adding. A run
    has to hold for `consecutive` points before it counts, which is what keeps
    the noise of a healthy metric off the phone. And a run is reported once,
    not once per minute, which is what keeps one step change from paging a
    dozen times.

    `consecutive = 1` covers every point of `anomalies`, runs of them grouped
    into one episode each.
    """
    if consecutive < 1:
        raise ValueError("consecutive must be at least one point")
    found, run = [], []
    for verdict in scan(series, window, threshold, min_spread) + [None]:
        if verdict is not None and verdict.is_anomaly:
            run.append(verdict)
            continue
        if len(run) >= consecutive:
            worst = max(run, key=lambda item: item.deviation - item.limit)
            found.append(Episode(run[0].index, len(run), run[0], worst))
        run = []
    return found
