import pytest

from n1 import learn_weights, pairs, rank

# A click log, the kind two weeks of traffic leaves behind. Each row is
# (text, availability, margin, popularity, clicked), and each page is one
# result list a shopper saw.
LOG = [
    [(1.0, 1.0, 0.30, 0.20, True), (0.5, 1.0, 0.55, 0.90, False), (0.0, 1.0, 0.60, 0.80, False)],
    [(1.0, 1.0, 0.25, 0.55, True), (0.5, 1.0, 0.50, 0.95, False), (0.0, 1.0, 0.45, 0.70, False)],
    [(0.5, 1.0, 0.35, 0.80, True), (0.5, 1.0, 0.65, 0.25, False)],
    [(1.0, 1.0, 0.20, 0.45, True), (1.0, 0.0, 0.60, 0.90, False)],
    [(1.0, 1.0, 0.40, 0.60, True), (0.5, 0.0, 0.55, 0.85, False), (0.0, 1.0, 0.50, 0.60, False)],
    [(0.5, 1.0, 0.30, 0.70, True), (0.5, 0.0, 0.45, 0.75, False)],
    [(1.0, 1.0, 0.45, 0.85, True), (1.0, 1.0, 0.30, 0.20, False)],
    [(0.5, 1.0, 0.25, 0.90, True), (0.0, 1.0, 0.70, 0.95, False)],
]


def page(rows):
    return [
        {"signals": dict(zip(("text", "availability", "margin", "popularity"), row[:4])),
         "clicked": row[4]}
        for row in rows
    ]


def impressions(log=LOG):
    return [page(rows) for rows in log]


def test_a_pair_becomes_two_rows_pointing_opposite_ways():
    rows, labels = pairs([page(LOG[3])])
    assert list(labels) == [1, 0]
    assert list(rows[0]) == pytest.approx([0.0, 1.0, -0.4, -0.45])
    assert list(rows[1]) == pytest.approx([0.0, -1.0, 0.4, 0.45])


def test_learns_that_relevance_and_stock_are_what_shoppers_follow():
    weights = learn_weights(impressions())
    assert weights["text"] > weights["availability"] > 0
    # Shoppers in this log follow relevance far more than popularity.
    assert weights["popularity"] < weights["text"]


def test_the_log_can_disagree_with_the_shop():
    # In this log the profitable products are the ones shoppers skip, so the
    # learnt margin weight comes out negative. That is not a bug to silence:
    # it is the arbitration between turnover and margin, arriving as a number
    # rather than as an opinion.
    assert learn_weights(impressions())["margin"] < 0


def test_the_learnt_weights_rank_a_new_page_the_way_the_log_would():
    weights = learn_weights(impressions())
    candidates = page([
        (0.0, 1.0, 0.70, 0.95, False),  # popular, profitable, off topic
        (1.0, 1.0, 0.20, 0.05, False),  # on topic, new, thin margin
    ])
    best = rank(candidates, weights)[0]["candidate"]
    assert best["signals"]["text"] == 1.0


def test_the_weights_are_on_a_readable_scale():
    weights = learn_weights(impressions())
    assert sum(abs(value) for value in weights.values()) == pytest.approx(1.0)


def test_a_log_without_a_single_click_teaches_nothing():
    silent = [page([row[:4] + (False,) for row in rows]) for rows in LOG]
    with pytest.raises(ValueError):
        learn_weights(silent)


def test_a_page_with_one_result_makes_no_pair():
    rows, _ = pairs([page([LOG[0][0]])])
    assert len(rows) == 0


def test_breaking_point_the_log_only_teaches_what_it_varied():
    """
    What this rung cannot do: learn about a signal the past ranking never
    moved. Margin here is identical on every product of every page, so every
    training row holds a nought in that column, and the fitted weight is
    exactly nought.

    The model is not wrong, it is blind: the log holds no evidence either way.
    At serving time a profitable product gets no credit for it, and no amount
    of extra traffic will change that. Only a change in what gets shown will,
    which is the awkward part of learning to rank from your own ranking.
    """
    flat_margin = [
        page([(row[0], row[1], 0.40, row[3], row[4]) for row in rows]) for rows in LOG
    ]
    weights = learn_weights(flat_margin)
    assert weights["margin"] == 0.0
    assert weights["text"] > 0.0

    # And so a page where margin is the only difference comes back untouched.
    candidates = page([(0.5, 1.0, 0.10, 0.50, False), (0.5, 1.0, 0.90, 0.50, False)])
    scores = [row["score"] for row in rank(candidates, weights)]
    assert scores[0] == scores[1]
