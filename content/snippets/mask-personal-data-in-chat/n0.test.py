from n0 import mask, normalise


def test_masks_an_email():
    assert mask("write to me at jean.dupont@example.com") == "write to me at [email]"


def test_masks_a_phone_number_however_it_is_spaced():
    for written in ("0612345678", "06 12 34 56 78", "06.12.34.56.78", "+33 6 12 34 56 78"):
        assert "[phone]" in mask(f"call me on {written}"), written


def test_masks_an_iban_spaced_or_not():
    for written in ("FR7630006000011234567890189", "FR76 3000 6000 0112 3456 7890 189"):
        assert "[iban]" in mask(f"account {written} please"), written


def test_leaves_ordinary_text_alone():
    text = "The meeting is at 10, room 4, bring the 2024 report."
    assert mask(text) == text


def test_handles_an_empty_string():
    assert mask("") == ""


def test_normalisation_collapses_typographic_spaces():
    # Narrow no-break space, the one French typography puts inside numbers.
    assert normalise("06\u202f12") == "06 12"
    assert normalise("06\u00a012") == "06 12"


def test_breaking_point_deliberate_obfuscation():
    """
    The breaking point claimed on the entry: spelled-out digits and lookalike
    characters walk straight past the pattern. Asserting the failure here keeps
    the claim on the page honest.
    """
    spelled = "call me on zero six twelve thirty-four"
    assert mask(spelled) == normalise(spelled)
    assert "[phone]" not in mask("O6 I2 34 56 78")
