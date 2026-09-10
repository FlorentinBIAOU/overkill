from n0 import DEFAULT_WEIGHTS, rank, signals, text_match

# An autumn catalogue, small enough to reason about by hand. Margin and
# popularity are shares between nought and one, as the snippet expects.
CATALOGUE = [
    {"title": "Chaussures de course Route 5", "tags": ["running", "bitume"],
     "in_stock": True, "margin": 0.35, "popularity": 0.80},
    {"title": "Chaussures de course Trail 3", "tags": ["running", "sentier"],
     "in_stock": True, "margin": 0.42, "popularity": 0.30},
    {"title": "Chaussettes de running", "tags": ["running"],
     "in_stock": True, "margin": 0.60, "popularity": 0.55},
    {"title": "Montre GPS Crème", "tags": ["running", "montre"],
     "in_stock": False, "margin": 0.25, "popularity": 0.70},
    {"title": "Sac à dos de randonnée", "tags": ["randonnée"],
     "in_stock": True, "margin": 0.48, "popularity": 0.20},
]

# The order the two language versions of the snippet must both produce. The
# same list appears in n0.test.js.
EXPECTED_ORDER = [
    "Chaussures de course Route 5",
    "Chaussures de course Trail 3",
    "Chaussettes de running",
    "Sac à dos de randonnée",
    "Montre GPS Crème",
]


def titles(ranked):
    return [row["product"]["title"] for row in ranked]


def test_ranks_the_matching_products_first():
    assert titles(rank(CATALOGUE, "chaussures de course")) == EXPECTED_ORDER


def test_a_prefix_is_enough():
    assert text_match("chauss", CATALOGUE[0]) == 1.0
    assert text_match("chaussures course", CATALOGUE[2]) == 0.0


def test_accents_and_case_are_ignored():
    assert text_match("CRÈME", CATALOGUE[3]) == 1.0
    assert text_match("creme", CATALOGUE[3]) == 1.0
    assert text_match("randonnee", CATALOGUE[4]) == 1.0


def test_the_ranking_says_why():
    top = rank(CATALOGUE, "chaussures de course")[0]
    assert top["signals"] == {"text": 1.0, "availability": 1.0, "margin": 0.35, "popularity": 0.80}
    assert 0.0 <= top["score"] <= 1.0


def test_out_of_stock_is_pushed_down_but_not_removed():
    ranked = titles(rank(CATALOGUE, "montre"))
    assert "Montre GPS Crème" in ranked
    # The only product matching the query is last, because it cannot be sold.
    assert ranked[0] == "Chaussures de course Route 5"


def test_weights_are_arguments_not_hidden_constants():
    greedy = {"text": 1.0, "availability": 0.0, "margin": 9.0, "popularity": 0.0}
    assert titles(rank(CATALOGUE, "chaussures de course", greedy))[0] == "Chaussettes de running"
    # And the default puts relevance first again, on the same catalogue.
    assert titles(rank(CATALOGUE, "chaussures de course", DEFAULT_WEIGHTS))[0] == EXPECTED_ORDER[0]


def test_an_empty_query_leaves_the_business_signals_in_charge():
    ranked = rank(CATALOGUE, "")
    assert all(row["signals"]["text"] == 0.0 for row in ranked)
    assert titles(ranked)[0] == "Chaussettes de running"


def test_an_empty_catalogue_gives_an_empty_ranking():
    assert rank([], "chaussures") == []


def test_the_sort_is_stable_on_a_tie():
    twin_a = dict(CATALOGUE[1], title="Trail 3 bleu")
    twin_b = dict(CATALOGUE[1], title="Trail 3 rouge")
    ranked = titles(rank([twin_a, twin_b], "trail"))
    # Identical signals, so the catalogue order decides, both here and in
    # JavaScript. Without a stable sort the two would swap between page loads.
    assert ranked == ["Trail 3 bleu", "Trail 3 rouge"]
    assert titles(rank([twin_b, twin_a], "trail")) == ["Trail 3 rouge", "Trail 3 bleu"]


def test_breaking_point_hand_set_weights_age_with_the_catalogue():
    """
    The breaking point claimed on the entry: the weights are set by hand and
    grow stale without anyone noticing.

    These weights were tuned on the autumn catalogue, where the popular
    products were also the relevant ones. They are right there. Spring brings
    in a range that has sold nothing yet, and the very same weights, on the
    very same unchanged code, bury it under last season's bestseller.

    Nothing raises an alarm: no exception, no failing test, no error in a log.
    Only the sales figures of a range nobody sees, three months later.
    """
    tuned = {"text": 3.0, "availability": 2.0, "margin": 1.0, "popularity": 6.0}

    # Autumn: the weights are doing their job.
    assert titles(rank(CATALOGUE, "chaussures de course", tuned))[0] == EXPECTED_ORDER[0]

    spring = [
        {"title": "Sandales de randonnée Ultra", "tags": ["randonnée", "été"],
         "in_stock": True, "margin": 0.40, "popularity": 0.05},
        *CATALOGUE,
    ]
    # Spring, same weights, same code: the new range loses to the old bestseller.
    assert titles(rank(spring, "sandales randonnée", tuned))[0] == "Chaussures de course Route 5"

    # Someone has to notice, and move a number. That is the maintenance cost.
    retuned = dict(tuned, text=12.0)
    assert titles(rank(spring, "sandales randonnée", retuned))[0] == "Sandales de randonnée Ultra"
