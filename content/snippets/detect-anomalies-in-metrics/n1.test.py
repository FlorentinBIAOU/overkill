import math

import pytest

from n1 import anomalies, score, train

# The score of a point depends on where the random cuts fell, so Python and
# JavaScript do not agree on the third decimal. They are expected to agree on
# what matters: which minutes come out above the threshold.
THRESHOLD = 0.65


def wobble(minute: int, metric: int) -> float:
    """A small deterministic spread, between minus a half and a half."""
    step = minute * (0.6180339887498949 + 0.1 * metric)
    return step - math.floor(step) - 0.5


def daytime(minute: int) -> list[float]:
    """Requests, errors, latency in milliseconds — the busy regime."""
    return [1000 + 80 * wobble(minute, 0), 10 + wobble(minute, 1), 130 + 10 * wobble(minute, 2)]


def nighttime(minute: int) -> list[float]:
    """The same three metrics in the quiet regime."""
    return [300 + 80 * wobble(minute, 3), 3 + wobble(minute, 4), 60 + 10 * wobble(minute, 5)]


def nighttime_with_daytime_errors(minute: int) -> list[float]:
    """Quiet traffic, quiet latency, and the error count of a busy hour."""
    return [320 + 80 * wobble(minute, 6), 9.6 + wobble(minute, 7), 62 + 10 * wobble(minute, 8)]


ORDINARY = [daytime(minute) for minute in range(45)] + [nighttime(minute) for minute in range(45)]
BROKEN_ERRORS = [320.0, 9.6, 62.0]  # night traffic, day errors
BROKEN_LATENCY = [980.0, 9.8, 63.0]  # day traffic, night latency
ROWS = ORDINARY + [BROKEN_ERRORS, BROKEN_LATENCY]


def test_flags_the_two_minutes_whose_combination_is_impossible():
    model = train(ROWS)
    assert anomalies(model, ROWS, THRESHOLD) == [90, 91]


def test_every_flagged_minute_is_ordinary_on_every_metric_taken_alone():
    """
    Why this rung exists. Each of the six numbers below sits inside the range
    the metric reaches in normal operation, so no threshold on a single series
    — N0's included — can ever ring for these two minutes. Only the
    combination is impossible.
    """
    for metric in range(3):
        column = [row[metric] for row in ORDINARY]
        for flagged in (BROKEN_ERRORS, BROKEN_LATENCY):
            assert min(column) <= flagged[metric] <= max(column)


def test_a_fleet_that_never_moves_has_no_anomalies():
    # Every observation identical: no cut can separate anything, every point
    # scores exactly one half, and nobody is woken up.
    flat = [[100.0, 5.0, 20.0]] * 40
    model = train(flat)
    assert score(model, flat[0]) == pytest.approx(0.5)
    assert anomalies(model, flat, THRESHOLD) == []


def test_the_threshold_is_yours_to_set():
    model = train(ROWS)
    assert len(anomalies(model, ROWS, 0.0)) == len(ROWS)
    assert anomalies(model, ROWS, 1.0) == []


def test_breaking_point_a_pattern_seen_often_enough_becomes_ordinary():
    """
    The limit of this rung, and it is the same one as N0's, moved up a floor.

    The forest knows nothing but the crowd it was trained on. Fifteen minutes
    of night traffic with daytime errors, inside the training data, are enough
    for the forest to call that combination a third regime. The very pattern
    flagged above is then flagged no longer, and nothing in the output says
    that anything changed.

    Retraining on last month's data is not free of consequences: it is the act
    of deciding what counts as normal.
    """
    habituated = ORDINARY + [nighttime_with_daytime_errors(minute) for minute in range(15)]
    model = train(habituated)

    assert anomalies(model, habituated, THRESHOLD) == []
    assert score(model, BROKEN_ERRORS) < THRESHOLD
