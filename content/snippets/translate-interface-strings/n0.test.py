"""
The memory below is what a project already has after one round of translation.
It lives here and not in the snippet: the snippet is a function, not a demo.
"""

from n0 import lookup, normalise, placeholders

MEMORY = {
    "Save": "Enregistrer",
    "Save changes": "Enregistrer les modifications",
    "Delete this item?": "Supprimer cet élément ?",
    "{count} items selected": "{count} éléments sélectionnés",
    "Your session has expired": "Votre session a expiré",
}


def test_an_exact_match_ships_as_it_is():
    result = lookup("Save changes", MEMORY)
    assert result["status"] == "exact"
    assert result["target"] == "Enregistrer les modifications"
    assert result["score"] == 1.0
    assert result["review"] is False


def test_a_fixed_capital_or_a_double_space_is_still_the_same_string():
    assert lookup("save   changes", MEMORY)["status"] == "exact"
    assert normalise("Élément  SUPPRIMÉ") == "element supprime"


def test_an_added_word_gives_an_approximate_match_flagged_for_review():
    result = lookup("Save all changes", MEMORY)
    assert result["status"] == "fuzzy"
    assert result["matched"] == "Save changes"
    assert result["target"] == "Enregistrer les modifications"
    assert round(result["score"], 3) == 0.857
    # The whole point of the rung: this comes back as a draft, not as a
    # finished translation.
    assert result["review"] is True


def test_the_threshold_decides_what_is_worth_showing_at_all():
    assert lookup("Save all changes", MEMORY, threshold=0.9)["status"] == "none"


def test_a_moved_variable_is_not_a_problem_but_a_lost_one_is():
    assert placeholders("Delete {count} of {total}") == placeholders("{total}: {count}")
    broken = {"{count} items selected": "Éléments sélectionnés"}
    result = lookup("{count} items selected", broken)
    # An exact hit, and still unusable: the interface would print a French
    # sentence with no number in it.
    assert result["status"] == "exact"
    assert result["review"] is True
    assert result["warnings"] == ["interpolation variables differ from the source string"]


def test_a_variable_added_since_last_year_is_reported_on_the_fuzzy_hit():
    result = lookup("{count} items selected", {"Items selected": "Éléments sélectionnés"})
    assert result["status"] == "fuzzy"
    assert round(result["score"], 3) == 0.778
    assert result["warnings"] == ["interpolation variables differ from the source string"]


def test_an_empty_string_and_an_empty_memory_return_nothing_rather_than_anything():
    assert lookup("", MEMORY)["status"] == "none"
    assert lookup("Save", {})["status"] == "none"
    assert lookup("Save", {})["target"] is None


def test_breaking_point_a_brand_new_string_has_no_match_at_all():
    """
    The breaking point claimed on the entry: a translation memory reuses, it
    does not translate. A feature nobody has written before is a string nobody
    has translated before, and no amount of fuzzy matching invents it.

    What matters here is what the function does *not* do. It has a French
    sentence about sessions on hand and it could hand it back with a low
    score. It returns nothing instead, and the string goes to a translator.
    """
    result = lookup("Two-factor authentication is required for administrators", MEMORY)
    assert result["status"] == "none"
    assert result["target"] is None
    assert result["matched"] is None
    assert result["score"] < 0.75
