import pytest

from n1 import LABELS, parse, tokenise, train

# The training set of this rung: addresses tagged by hand, token by token.
# Every one is invented — none is the home of a real person, and none is the
# registered office of a real company. Written as segments rather than as one
# label per token, because that is the form a human can actually check.
TAGGED = [
    [("8", "number"), ("rue", "street_type"), ("des Lilas", "street"), ("75011", "postcode"), ("Paris", "city")],
    [("14", "number"), ("avenue", "street_type"), ("des Cerisiers", "street"), ("69003", "postcode"), ("Lyon", "city")],
    [("3", "number"), ("allée", "street_type"), ("du Château", "street"), ("33000", "postcode"), ("Bordeaux", "city")],
    [("27", "number"), ("boulevard", "street_type"), ("des Acacias", "street"), ("13006", "postcode"), ("Marseille", "city")],
    [("5", "number"), ("impasse", "street_type"), ("des Peupliers", "street"), ("44000", "postcode"), ("Nantes", "city")],
    [("2", "number"), ("place", "street_type"), ("des Tilleuls", "street"), ("31000", "postcode"), ("Toulouse", "city")],
    [("41", "number"), ("chemin", "street_type"), ("des Vignes", "street"), ("38000", "postcode"), ("Grenoble", "city")],
    [("9", "number"), ("route", "street_type"), ("de la Forêt", "street"), ("35000", "postcode"), ("Rennes", "city")],
    [("12 bis", "number"), ("rue", "street_type"), ("des Écoles", "street"), ("59000", "postcode"), ("Lille", "city")],
    [("6", "number"), ("quai", "street_type"), ("des Ormes", "street"), ("67000", "postcode"), ("Strasbourg", "city")],
    [("8", "number"), ("rue", "street_type"), ("des Lilas", "street"), ("Bâtiment C", "complement"), ("75011", "postcode"), ("Paris", "city")],
    [("14", "number"), ("avenue", "street_type"), ("des Cerisiers", "street"), ("Appartement 12", "complement"), ("69003", "postcode"), ("Lyon", "city")],
    [("Appartement 4", "complement"), ("3", "number"), ("allée", "street_type"), ("du Château", "street"), ("33000", "postcode"), ("Bordeaux", "city")],
    [("Bâtiment B", "complement"), ("Escalier 2", "complement"), ("27", "number"), ("boulevard", "street_type"), ("des Acacias", "street"), ("13006", "postcode"), ("Marseille", "city")],
    [("5", "number"), ("impasse", "street_type"), ("des Peupliers", "street"), ("Résidence Les Ormes", "complement"), ("44000", "postcode"), ("Nantes", "city")],
    [("2", "number"), ("place", "street_type"), ("des Tilleuls", "street"), ("Escalier A", "complement"), ("31000", "postcode"), ("Toulouse", "city")],
    [("41", "number"), ("chemin", "street_type"), ("des Vignes", "street"), ("Étage 3", "complement"), ("38000", "postcode"), ("Grenoble", "city")],
    [("9", "number"), ("route", "street_type"), ("de la Forêt", "street"), ("Porte 12", "complement"), ("35000", "postcode"), ("Rennes", "city")],
]


def expand(segments):
    """Turn segments into the (address, one label per token) pair `train` wants."""
    address = " ".join(text for text, _ in segments)
    labels = [label for text, label in segments for _ in tokenise(text)]
    return address, labels


def make_model():
    return train([expand(segments) for segments in TAGGED])


def test_tagging_helper_lines_labels_up_with_tokens():
    address, labels = expand(TAGGED[0])
    assert address == "8 rue des Lilas 75011 Paris"
    assert labels == ["number", "street_type", "street", "street", "postcode", "city"]


def test_parses_an_ordinary_address():
    assert parse(make_model(), "8 rue des Lilas, 75011 Paris") == {
        "number": "8",
        "street_type": "rue",
        "street": "rue des Lilas",
        "complement": "",
        "postcode": "75011",
        "city": "Paris",
    }


def test_separates_a_complement_that_n0_swallowed():
    # The gain of this rung, on the very address the rung below got wrong.
    parsed = parse(make_model(), "Appartement 12, Bâtiment C, 8 rue des Lilas, 75011 Paris")
    assert parsed["complement"] == "Appartement 12 Bâtiment C"
    assert parsed["number"] == "8"
    assert parsed["street"] == "rue des Lilas"


def test_reads_a_street_it_has_never_seen():
    # Neither the street nor the town is in the training set: the labels come
    # from the shape of the line, not from a list of names.
    parsed = parse(make_model(), "7 rue du Moulin, Résidence Les Charmes, 21000 Dijon")
    assert parsed["street"] == "rue du Moulin"
    assert parsed["complement"] == "Résidence Les Charmes"
    assert parsed["city"] == "Dijon"


def test_reads_capitals_and_accents():
    parsed = parse(make_model(), "6 QUAI DES ORMES 67000 STRASBOURG")
    assert parsed["number"] == "6"
    assert parsed["street"] == "QUAI DES ORMES"
    assert parsed["city"] == "STRASBOURG"


def test_handles_an_empty_string():
    assert parse(make_model(), "") == dict.fromkeys(LABELS, "")


def test_a_misaligned_example_is_rejected_rather_than_learnt():
    with pytest.raises(ValueError):
        train([("8 rue des Lilas", ["number", "street_type"])])


def test_breaking_point_a_convention_absent_from_the_training_set():
    """
    The breaking point of this rung: it knows the conventions it was shown.

    Every address tagged above puts the number first and five digits before the
    town. A German address puts the number last, a British one has no run of
    five digits at all, and the model has no way to say « I have never seen
    this ». It labels every token anyway, confidently and wrongly.

    Widening it costs another round of hand tagging, per country. That is the
    real price of this rung, and it is why the entry does not pretend the model
    generalises for free.
    """
    model = make_model()

    german = parse(model, "Hauptstrasse 5, 10115 Berlin")
    # The five digits and the town still land right; the street does not.
    assert german["postcode"] == "10115" and german["city"] == "Berlin"
    assert german["street"] == "" and german["number"] == "5"

    british = parse(model, "42 Rowan Street, Bristol BS1 4TQ")
    assert british["postcode"] == ""
    assert british["city"] != "Bristol"
    assert british["street"] == ""
