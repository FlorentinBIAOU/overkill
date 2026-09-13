from n1 import build_index, match

# A register the size of a small trade directory. Example data lives here,
# never in the snippet.
REGISTER = [
    "Boulangerie Martin SARL",
    "Boulangerie Dupont",
    "Menuiserie Dubois SA",
    "Dubois Menuiserie",
    "Café de la Gare",
    "SNCF",
    "Société Nationale des Chemins de fer Français",
]

INDEX = build_index(REGISTER)


def test_finds_the_right_company_first():
    name, score = match(INDEX, "Boulangerie Martin")[0]
    assert name == "Boulangerie Martin SARL"
    # Pinned to twelve decimals: the JavaScript snippet returns this number.
    assert round(score, 12) == 0.883177974427


def test_word_order_costs_nothing():
    """Where N0 collapses on a swap, n-grams inside word boundaries do not."""
    assert match(INDEX, "MARTIN BOULANGERIE") == match(INDEX, "Boulangerie Martin")


def test_a_rare_fragment_outweighs_a_common_one():
    # "boulangerie" is shared by two entries and settles nothing; the surname
    # is what separates them.
    ranked = dict(match(INDEX, "Boulangerie Martin", top_k=len(REGISTER)))
    assert ranked["Boulangerie Martin SARL"] > ranked["Boulangerie Dupont"]


def test_a_plural_and_a_swap_at_once():
    assert match(INDEX, "Menuiseries Dubois")[0][0] == "Dubois Menuiserie"


def test_an_empty_query_scores_nothing_anywhere():
    assert all(score == 0.0 for _, score in match(INDEX, "", top_k=len(REGISTER)))


def test_ties_come_back_in_register_order():
    """A matching run has to be replayable, so the sort is stable."""
    zeros = [name for name, score in match(INDEX, "", top_k=len(REGISTER))]
    assert zeros == REGISTER


def test_a_name_nobody_wrote_still_gets_a_ranking():
    # Cosine always answers. A top hit is a candidate, not a decision: the
    # caller keeps a floor under which nothing is accepted.
    name, score = match(INDEX, "Kwyjibo")[0]
    assert name in REGISTER
    assert score > 0.0


def test_breaking_point_the_acronym_that_n0_missed_is_still_missed():
    """
    The breaking point claimed on the entry, and N1 does not repair it.

    TF-IDF weighs fragments better than Jaro-Winkler ever did, but it still
    only sees fragments. The expanded name shares almost no character n-gram
    with its own acronym, so it does not even reach the top three. Two
    unrelated names beat it. That failure is the whole reason N2 exists.
    """
    expanded = "Société Nationale des Chemins de fer Français"
    assert dict(match(INDEX, "SNCF", top_k=len(REGISTER)))[expanded] < 0.05
    assert expanded not in [name for name, _ in match(INDEX, "SNCF", top_k=3)]
