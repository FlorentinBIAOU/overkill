import pytest

from n0 import anomalies, scan


RESTING = 1200


def quiet_metric(minute: int) -> float:
    """
    A metric that is doing nothing wrong: twelve hundred requests a minute,
    with a small repeating wobble. Built by a formula, so the numbers below
    are the same on every machine and in both languages.
    """
    return RESTING + 40 * ((minute % 7) - 3)


QUIET = [quiet_metric(minute) for minute in range(60)]


def test_flags_a_spike_and_nothing_else():
    series = list(QUIET)
    series[40] = 4800.0

    flagged = anomalies(series)
    assert [verdict.index for verdict in flagged] == [40]


def test_the_verdict_carries_the_reasoning_not_just_a_boolean():
    """
    The argument of this rung. Whoever is woken up gets the measured value,
    what the last twenty-four minutes called usual, the gap between them, and
    the gap that would have been tolerated. The same four numbers are asserted
    in n0.test.js.
    """
    series = list(QUIET)
    series[40] = 4800.0
    verdict = anomalies(series)[0]

    assert verdict.value == 4800.0
    assert verdict.usual == pytest.approx(1200.0)
    assert verdict.deviation == pytest.approx(3600.0)
    assert verdict.limit == pytest.approx(311.346, abs=1e-9)
    # And the decision is nothing more than the comparison of the last two.
    assert verdict.is_anomaly == (verdict.deviation > verdict.limit)


def test_a_first_spike_does_not_hide_the_second():
    # The point of the median: one outlier already inside the window neither
    # moves the usual value nor widens the band. A mean and a standard
    # deviation would have done both.
    series = list(QUIET)
    series[40] = 4800.0
    series[41] = 4700.0

    assert [verdict.index for verdict in anomalies(series)] == [40, 41]


def test_a_series_shorter_than_the_window_yields_no_verdict():
    # Judging a point against four minutes of history is worse than saying
    # nothing, because it would look like an answer.
    assert scan([1.0, 2.0, 3.0]) == []


def test_a_constant_metric_is_never_an_anomaly_until_it_moves():
    assert anomalies([500.0] * 30) == []

    # On a perfectly flat window the tolerated gap is zero, so the smallest
    # change is an anomaly. That is the honest behaviour for a metric that has
    # never moved, and it is worth knowing before deploying on one.
    moved = [500.0] * 29 + [501.0]
    verdict = anomalies(moved)[0]
    assert verdict.limit == 0.0
    assert verdict.deviation == 1.0


def test_breaking_point_a_slow_drift_becomes_the_new_normal():
    """
    The breaking point claimed on the entry, built here on purpose.

    The metric leaves its resting level and climbs by forty a minute for over
    an hour. Each step is far inside the tolerated gap, and every step the
    window has already swallowed the ones before it. Not one point is ever
    flagged, and the metric ends up more than three times where it started.

    The same total rise, delivered in one step, is caught immediately — for a
    dozen minutes, until it too becomes the new normal.
    """
    total_rise = 40 * 72
    drifting = [quiet_metric(m) if m < 48 else quiet_metric(m) + 40 * (m - 47) for m in range(120)]
    stepping = [quiet_metric(m) if m < 48 else quiet_metric(m) + total_rise for m in range(120)]

    assert drifting[-1] == quiet_metric(119) + total_rise == stepping[-1]
    assert drifting[-1] > 3 * RESTING

    assert anomalies(drifting) == []
    assert [verdict.index for verdict in anomalies(stepping)][0] == 48
