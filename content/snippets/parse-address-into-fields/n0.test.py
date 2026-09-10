from n0 import fold, normalise, parse

# Every address below is invented. None is the home of a real person, and none
# is the registered office of a real company.


def test_parses_an_ordinary_address():
    assert parse("8 rue des Lilas, 75011 Paris") == {
        "number": "8",
        "street_type": "rue",
        "street": "rue des Lilas",
        "postcode": "75011",
        "city": "Paris",
    }


def test_expands_an_abbreviated_street_type():
    # Two spellings of one street have to compare equal downstream.
    for written in ("12 av. des Cerisiers", "12 avenue des Cerisiers", "12 AV DES CERISIERS"):
        parsed = parse(f"{written} 69003 Lyon")
        assert parsed["street_type"] == "avenue", written


def test_keeps_the_repetition_index_with_the_number():
    assert parse("12 bis rue des Lilas 75011 Paris")["number"] == "12 bis"
    assert parse("12B rue des Lilas 75011 Paris")["number"] == "12 B"


def test_reads_accents_case_and_punctuation():
    # The address as a form actually receives it: two lines, commas, accents.
    parsed = parse("3, Allée du Château\n33000 BORDEAUX")
    assert parsed["street_type"] == "allée"
    assert parsed["street"] == "allée du Château"
    assert parsed["city"] == "BORDEAUX"


def test_handles_an_empty_string():
    assert parse("") == dict.fromkeys(("number", "street_type", "street", "postcode", "city"), "")


def test_normalisation_and_folding():
    assert normalise("8 rue  des Lilas,\n75011 Paris") == "8 rue des Lilas 75011 Paris"
    assert fold("Av.") == "av"


def test_keeps_a_cedex_mention_with_the_town():
    # Losing it would send the letter to the wrong sorting office.
    assert parse("2 place des Tilleuls 31081 Toulouse Cedex 9")["city"] == "Toulouse Cedex 9"


def test_breaking_point_complements_foreign_addresses_and_reversed_order():
    """
    The breaking point claimed on the entry, in its three shapes.

    A complement has no anchor of its own, so it is swallowed by whichever
    field it touches. A foreign address may still hand five digits to the
    anchor, or none at all. And an address written town first turns the anchor
    upside down. In every case the parser answers confidently and wrongly,
    which is worse than answering nothing.
    """
    # A complement after the street lands inside the street name.
    swallowed = parse("8 rue des Lilas Bâtiment C Appartement 12, 75011 Paris")
    assert swallowed["street"] == "rue des Lilas Bâtiment C Appartement 12"

    # A complement before the street takes the place of the house number.
    hidden = parse("Appartement 12, Bâtiment C, 8 rue des Lilas, 75011 Paris")
    assert hidden["number"] == ""
    assert hidden["street"].startswith("Appartement 12")

    # German: five digits, so the anchor fires, but the house number comes
    # after the street and the street type is inside the word.
    german = parse("Hauptstrasse 5, 10115 Berlin")
    assert german["postcode"] == "10115" and german["city"] == "Berlin"
    assert german["number"] == "" and german["street"] == "Hauptstrasse 5"

    # British: no run of five digits at all, so nothing is anchored and the
    # town ends up inside the street.
    british = parse("42 Rowan Street, Bristol BS1 4TQ")
    assert british["postcode"] == "" and british["city"] == ""
    assert british["street"] == "Rowan Street Bristol BS1 4TQ"

    # Town first: everything after the postcode is taken for the town.
    reversed_order = parse("75011 Paris, 8 rue des Lilas")
    assert reversed_order["street"] == ""
    assert reversed_order["city"] == "Paris 8 rue des Lilas"
