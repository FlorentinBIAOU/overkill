import math

import pytest

from n0 import forecast, seasonal_coefficients

SEASON = 52


def steady_shop(week: int) -> float:
    """
    Three years of a shop whose level never moves.

    A thousand euros a week, a yearly wave that peaks in the spring, and a
    small weekday-like ripple so the series is not a perfect sine. Every value
    comes out of this formula: no random draw, no data file.
    """
    return 1000 + 200 * math.sin(2 * math.pi * week / SEASON) + 10 * ((week % 5) - 2)


HISTORY = [steady_shop(week) for week in range(3 * SEASON)]
NEXT_WEEK_IN_TRUTH = steady_shop(3 * SEASON)


def test_forecasts_the_next_week_within_a_couple_of_per_cent():
    predicted = forecast(HISTORY)[0]
    assert abs(predicted - NEXT_WEEK_IN_TRUTH) / NEXT_WEEK_IN_TRUTH < 0.02


def test_both_languages_agree_to_the_sixth_decimal():
    """
    The same number is asserted in n0.test.js. The two implementations are the
    same arithmetic in two languages, and they are expected to stay that way.
    """
    assert forecast(HISTORY)[0] == pytest.approx(1003.624843, abs=1e-6)


def test_the_seasonal_shape_is_read_off_the_history():
    coefficients = seasonal_coefficients(HISTORY, SEASON)
    # Week 13 is the peak of the wave, week 39 its trough.
    assert coefficients[13] > 1.15
    assert coefficients[39] < 0.85
    # Rescaled to average one, so putting the shape back is level-preserving.
    assert sum(coefficients) / SEASON == pytest.approx(1.0)


def test_a_horizon_returns_one_value_per_week():
    assert len(forecast(HISTORY, horizon=3)) == 3


def test_a_flat_series_forecasts_the_same_flat_value():
    assert forecast([750.0] * (2 * SEASON))[0] == pytest.approx(750.0)


def test_refuses_a_history_shorter_than_two_cycles():
    # One year of history gives one observation per week of the year, which is
    # not an average of anything. Refusing beats pretending.
    with pytest.raises(ValueError):
        forecast(HISTORY[:SEASON])


def test_breaking_point_a_trend_break():
    """
    The breaking point claimed on the entry. A competitor opens and the last
    eight weeks fall five per cent each. A moving average has no slope to
    extrapolate: it forecasts the average of a decline it has already seen,
    not the decline going on.
    """
    declining = [steady_shop(week) for week in range(148)]
    declining += [steady_shop(week) * 0.95 ** (week - 147) for week in range(148, 156)]
    truth = steady_shop(156) * 0.95**9

    predicted = forecast(declining)[0]
    assert predicted > 1.25 * truth  # more than a quarter too high, and it will stay so


def test_breaking_point_an_exceptional_promotion():
    """
    The other half of the same breaking point. One promotion week enters the
    moving average as if it were ordinary trade, and lifts next week's
    forecast by more than ten per cent. The model has no notion of an event.
    """
    with_promotion = list(HISTORY)
    with_promotion[-1] *= 2

    assert forecast(with_promotion)[0] > 1.10 * forecast(HISTORY)[0]
