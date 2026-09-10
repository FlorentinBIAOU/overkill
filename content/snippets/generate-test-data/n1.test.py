from collections import Counter

import pytest

from n1 import sample_rows

# The distributions live in the test, never in the snippet. These are the shape
# a `GROUP BY city` and a bucketed count would return: raw observed counts, not
# probabilities, and no need to make them sum to anything in particular.
#
# The figures below are invented for the example, and the postcodes are those
# of the cities they sit next to, nothing more.
SESSIONS = {
    "city": {"type": "categorical", "counts": {"Paris": 4120, "Lyon": 980, "Nantes": 410, "Lille": 190}},
    "postcode": {"type": "categorical", "counts": {"75011": 4120, "69003": 980, "44000": 410, "59000": 190}},
    # Most baskets hold one item; the long tail is real but thin.
    "items": {"type": "histogram", "edges": [1, 2, 3, 6, 21], "counts": [6900, 1800, 900, 400]},
    "delay_days": {"type": "histogram", "edges": [0, 1, 3, 8, 31], "counts": [5200, 2400, 1600, 800]},
}

# The exact rows expected for one seed. The same literal appears in n1.test.js,
# which is what pins the two implementations to each other.
GOLDEN = [
    {"city": "Lyon", "postcode": "69003", "items": 2, "delay_days": 4},
    {"city": "Paris", "postcode": "75011", "items": 2, "delay_days": 0},
    {"city": "Nantes", "postcode": "75011", "items": 1, "delay_days": 0},
]

SEED = "sessions-week-24"


def test_produces_the_expected_rows():
    assert sample_rows(SESSIONS, 3, SEED) == GOLDEN


def test_the_sampled_shares_follow_the_observed_ones():
    """
    This is what the rung is for: the common case stays common.

    A uniform draw over the same four cities would put a quarter of the traffic
    in Lille, and every page laid out on that data would be laid out wrong.
    """
    rows = sample_rows(SESSIONS, 4000, SEED)
    seen = Counter(row["city"] for row in rows)
    total = sum(SESSIONS["city"]["counts"].values())
    for city, observed in SESSIONS["city"]["counts"].items():
        assert abs(seen[city] / 4000 - observed / total) < 0.02, city

    # And the same for the numeric column: single-item baskets dominate.
    one_item = sum(1 for row in rows if row["items"] == 1) / 4000
    assert abs(one_item - 6900 / 10000) < 0.02


def test_values_stay_inside_the_observed_buckets():
    rows = sample_rows(SESSIONS, 2000, SEED)
    # The buckets are half-open, so the last edge is never reached.
    assert min(row["items"] for row in rows) == 1
    assert max(row["items"] for row in rows) <= 20
    assert min(row["delay_days"] for row in rows) == 0
    assert max(row["delay_days"] for row in rows) <= 30


def test_the_same_seed_gives_the_same_data_and_another_seed_does_not():
    assert sample_rows(SESSIONS, 50, SEED) == sample_rows(SESSIONS, 50, SEED)
    assert sample_rows(SESSIONS, 50, SEED) != sample_rows(SESSIONS, 50, "sessions-week-25")


def test_a_category_observed_zero_times_is_never_drawn():
    # It did not happen in production, so it does not happen here either.
    counts = {"type": "categorical", "counts": {"Paris": 100, "Ajaccio": 0}}
    rows = sample_rows({"city": counts}, 200, SEED)
    assert {row["city"] for row in rows} == {"Paris"}


def test_no_distribution_and_a_single_row():
    assert sample_rows({}, 2, SEED) == [{}, {}]
    assert sample_rows(SESSIONS, 0, SEED) == []
    assert len(sample_rows(SESSIONS, 1, SEED)) == 1


def test_a_distribution_that_cannot_be_sampled_is_refused():
    with pytest.raises(ValueError):
        # Nothing was observed, so there is nothing to sample from. Falling
        # back to a uniform draw here would quietly invent a distribution.
        sample_rows({"city": {"type": "categorical", "counts": {"Paris": 0}}}, 1, SEED)
    with pytest.raises(ValueError):
        sample_rows({"items": {"type": "histogram", "edges": [1, 5], "counts": [10, 2]}}, 1, SEED)
    with pytest.raises(ValueError):
        sample_rows({"items": {"type": "gaussian", "mean": 3}}, 1, SEED)


def test_breaking_point_the_marginals_are_right_and_the_rows_are_impossible():
    """
    Each column is sampled on its own, so the joint distribution is gone.

    In production every Paris session carries a Paris postcode: the two columns
    are one fact written twice. Sampled independently, they disagree in almost
    half the rows, and those rows describe sessions that cannot exist.

    Which means this data set proves nothing about any code that reads two
    columns at once — a delivery-zone rule, a tax rule, a fraud rule. The
    marginals being right is exactly what makes that easy to miss.
    """
    postcode_of = {"Paris": "75011", "Lyon": "69003", "Nantes": "44000", "Lille": "59000"}
    rows = sample_rows(SESSIONS, 2000, SEED)
    impossible = [row for row in rows if postcode_of[row["city"]] != row["postcode"]]
    assert len(impossible) > 800

    # The rule a real row always satisfies, and that this fixture cannot test.
    assert any(row["city"] == "Nantes" and row["postcode"] == "75011" for row in rows)
