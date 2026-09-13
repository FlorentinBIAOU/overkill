from n0 import jaro_winkler, normalise, similarity

THRESHOLD = 0.85  # the cut a real deduplication run would use


def test_the_same_company_under_two_spellings():
    assert similarity("Boulangerie Martin SARL", "BOULANGERIE MARTIN") == 1.0


def test_accents_case_and_punctuation_are_ignored():
    assert similarity("Café de la Gare SAS", "CAFE DE LA GARE") == 1.0
    assert similarity("Établissements Léon & Fils SA", "ETABLISSEMENTS LEON ET FILS") > THRESHOLD


def test_a_plural_and_a_dropped_form_still_match():
    assert similarity("Menuiserie Dubois", "Menuiseries Dubois SA") > THRESHOLD


def test_two_different_companies_in_one_trade_land_above_the_threshold():
    """
    Not the headline failure, but the one that bites first in production.

    "Boulangerie Martin" and "Boulangerie Dupont" share a long opening,
    which is exactly what Jaro-Winkler is built to reward. The score sails
    over any threshold that also catches genuine variants, so a pair above
    the cut is a candidate for review, never a decision.
    """
    assert similarity("Boulangerie Martin SARL", "Boulangerie Dupont SARL") > THRESHOLD


def test_normalisation_drops_the_legal_form():
    assert normalise("Boulangerie Martin SARL") == "boulangerie martin"
    # A name that is nothing but a legal form keeps it, rather than emptying
    # out and matching every other emptied name perfectly.
    assert normalise("SARL") == "sarl"


def test_an_empty_name_matches_nothing():
    assert similarity("", "Martin SARL") == 0.0
    # Two empty names are identical by definition. The caller filters them
    # out before matching; the function will not decide that for you.
    assert similarity("", "") == 1.0


def test_jaro_winkler_rewards_a_shared_opening():
    assert jaro_winkler("martin", "martix") > jaro_winkler("nartin", "xartin")


def test_breaking_point_an_acronym_against_the_name_it_stands_for():
    """
    The breaking point claimed on the entry: two names of one company with no
    characters in common.

    Jaro-Winkler compares characters. It has no idea that SNCF is built from
    the initials below it, so the true pair scores low — and, worse, lower
    than an unrelated company that merely starts with the same letter. No
    threshold can be placed that keeps the first and rejects the second.
    """
    expanded = "Société Nationale des Chemins de fer Français"
    assert similarity("SNCF", expanded) < THRESHOLD
    assert similarity("SNCF", "Sanofi") > similarity("SNCF", expanded)
