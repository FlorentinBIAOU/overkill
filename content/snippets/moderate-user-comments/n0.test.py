from n0 import normalise, review

# The list is policy, so it lives with the test, not with the code. The terms
# below are invented, which is enough to exercise a term filter.
TERMS = ["blorptard", "zibbernaut", "flarnwit"]


def test_flags_a_listed_term_and_shows_its_context():
    result = review("honestly this whole update is the work of a blorptard", TERMS)
    assert result["flagged"]
    assert result["matches"][0]["term"] == "blorptard"
    assert "work of a blorptard" in result["matches"][0]["context"]


def test_normalisation_folds_case_and_accents():
    assert normalise("BLÔRPTARD") == "blorptard"
    assert review("what a ZIBBERNAUT", TERMS)["flagged"]
    assert review("quel flarnwît celui-là", TERMS)["flagged"]


def test_leaves_an_ordinary_comment_alone():
    assert not review("great write-up, the third section helped a lot", TERMS)["flagged"]


def test_handles_an_empty_comment():
    assert review("", TERMS) == {"flagged": False, "matches": []}


def test_reports_every_hit_not_just_the_first():
    result = review("one blorptard, then another blorptard", TERMS)
    assert [m["position"] for m in result["matches"]] == [1, 4]


def test_the_window_is_clipped_at_the_edges_of_the_comment():
    result = review("blorptard", TERMS, window=5)
    assert result["matches"][0]["context"] == "blorptard"


def test_breaking_point_a_different_spelling_walks_straight_past():
    """
    First half of the breaking point claimed on the entry: the list matches
    spellings, and a determined commenter has an unbounded supply of them.

    Adding each variant to the list is a losing race, and each addition widens
    the second half of the problem below.
    """
    for evasion in ("bl0rptard", "b l o r p t a r d", "blorp-tard", "blorptardd"):
        assert not review(f"you are a {evasion}", TERMS)["flagged"], evasion


def test_breaking_point_quotation_and_irony_are_flagged_all_the_same():
    """
    Second half: the list sees the word, never the intent. A user reporting
    the abuse they received, and two friends teasing each other, are flagged
    exactly like the attack the list was written for.

    This is why the function returns the context window rather than a verdict.
    The window is what lets a human close these two cases in seconds; nothing
    in the rung itself can close them.
    """
    report = review("he called me a blorptard, please remove his comment", TERMS)
    banter = review("congratulations you absolute blorptard, well played", TERMS)
    attack = review("get off this forum you blorptard", TERMS)
    assert report["flagged"] and banter["flagged"] and attack["flagged"]
    # And nothing in the result tells them apart.
    assert report["matches"][0]["term"] == attack["matches"][0]["term"]
