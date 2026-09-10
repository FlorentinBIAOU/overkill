import math

import pytest

from n1 import fit, forecast

SEASON = 52


def growing_shop(week: int) -> float:
    """
    Three years of a shop that grows by two hundred and eight a year.

    A level, a straight trend, a yearly wave with a second harmonic, and a
    small ripple so the series is not exactly the model's own shape. Every
    value comes out of this formula: no random draw, no data file.
    """
    return (
        800
        + 4 * week
        + 150 * math.sin(2 * math.pi * week / SEASON)
        + 60 * math.cos(4 * math.pi * week / SEASON)
        + 20 * ((week % 7) - 3)
    )


HISTORY = [growing_shop(week) for week in range(3 * SEASON)]
NEXT_WEEK_IN_TRUTH = growing_shop(3 * SEASON)


def test_forecasts_the_next_week_within_a_couple_of_per_cent():
    predicted = forecast(fit(HISTORY))[0]
    assert abs(predicted - NEXT_WEEK_IN_TRUTH) / NEXT_WEEK_IN_TRUTH < 0.02


def test_both_languages_agree_to_the_sixth_decimal():
    """
    The same number is asserted in n1.test.js. One side solves the least
    squares with numpy, the other by Gaussian elimination on the normal
    equations; they are expected to land on the same forecast anyway.
    """
    assert forecast(fit(HISTORY))[0] == pytest.approx(1481.923623, abs=1e-6)


def test_reads_the_growth_back_out_of_the_series():
    # The series was built growing by 4 a week, so 208 a cycle. The
    # coefficient is the number to show a shopkeeper before any forecast.
    assert fit(HISTORY)["coefficients"][1] == pytest.approx(208, abs=2)


def test_extrapolates_the_trend_where_the_moving_average_of_n0_cannot():
    # Six months ahead, a level-only model would still forecast today's level.
    six_months = forecast(fit(HISTORY), horizon=26)
    assert six_months[-1] - six_months[0] > 80


def test_a_flat_series_forecasts_the_same_flat_value_and_no_growth():
    model = fit([750.0] * (2 * SEASON))
    assert forecast(model)[0] == pytest.approx(750.0)
    assert model["coefficients"][1] == pytest.approx(0.0, abs=1e-6)


def test_refuses_a_history_shorter_than_the_number_of_features():
    # Six features, so six weeks at the very least. Below that the fit is not
    # underdetermined by a little, it is arbitrary.
    with pytest.raises(ValueError):
        fit(HISTORY[:5])


def test_breaking_point_a_regime_change_is_averaged_away():
    """
    The limit of this rung. Least squares weighs a week from three years ago
    exactly as much as last week. When a competitor opens and the last twenty
    weeks settle thirty per cent lower, the fit splits the difference between
    the old world and the new one, and forecasts a level the shop has not seen
    in five months.

    Nothing in the model is wrong; the assumption that one straight line
    describes the whole history is.
    """
    changed = [growing_shop(week) * (0.7 if week >= 136 else 1.0) for week in range(3 * SEASON)]
    truth = growing_shop(156) * 0.7

    assert forecast(fit(changed))[0] > 1.25 * truth
