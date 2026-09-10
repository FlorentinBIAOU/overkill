"""
These tests inject a local double instead of installing the real parser.

What they prove: the batch is sent in one call, an oversized address is refused
before anything is parsed, a failed call is retried, the parser's label set is
mapped onto ours, and an answer we cannot use raises rather than returning
fields that are quietly wrong.

What they do not prove: that libpostal labels addresses well. That is why this
snippet is declared `verification: stubbed` on the entry, and why the page says
so next to the code.
"""

import pytest

from _harness.fake_model import FakeClassifier
from n2 import MAX_CHARACTERS, ParsingUnavailable, parse_addresses

# Invented addresses, and the components libpostal would return for them, in
# its own vocabulary. The values are ours, so the test exercises our mapping
# and not the model's opinions.
FRENCH = "8 rue des Lilas, Appartement 12, 75011 Paris"
GERMAN = "Hauptstrasse 5, 10115 Berlin"
BRITISH = "42 Rowan Street, Bristol BS1 4TQ"

COMPONENTS = {
    FRENCH: {
        "house_number": "8",
        "road": "rue des lilas",
        "unit": "appartement 12",
        "postcode": "75011",
        "city": "paris",
    },
    GERMAN: {"house_number": "5", "road": "hauptstrasse", "postcode": "10115", "city": "berlin"},
    BRITISH: {"house_number": "42", "road": "rowan street", "postcode": "bs1 4tq", "city": "bristol"},
}


def test_parses_an_address_into_our_fields():
    parser = FakeClassifier(COMPONENTS)
    assert parse_addresses([FRENCH], parser) == [
        {
            "number": "8",
            "street": "rue des lilas",
            "complement": "appartement 12",
            "postcode": "75011",
            "city": "paris",
        }
    ]


def test_reads_the_foreign_addresses_that_broke_the_rungs_below():
    # The gain of this rung: the number after the street, and a postcode that
    # is not five digits, are conventions the model was trained on.
    parser = FakeClassifier(COMPONENTS)
    german, british = parse_addresses([GERMAN, BRITISH], parser)
    assert german["number"] == "5" and german["street"] == "hauptstrasse"
    assert british["postcode"] == "bs1 4tq" and british["city"] == "bristol"


def test_sends_the_whole_batch_in_one_call():
    parser = FakeClassifier(COMPONENTS)
    parse_addresses([FRENCH, GERMAN, BRITISH], parser)
    assert parser.calls == [[FRENCH, GERMAN, BRITISH]]


def test_joins_the_labels_that_share_one_field_and_drops_the_rest():
    # Two complements in one address, and a country we have no field for.
    parser = FakeClassifier({FRENCH: {"level": "étage 3", "unit": "porte b", "country": "france"}})
    parsed = parse_addresses([FRENCH], parser)[0]
    assert parsed["complement"] == "étage 3 porte b"
    assert set(parsed) == {"number", "street", "complement", "postcode", "city"}


def test_an_empty_answer_gives_empty_fields_rather_than_an_error():
    parser = FakeClassifier({FRENCH: {}})
    assert parse_addresses([FRENCH], parser) == [dict.fromkeys(
        ("number", "street", "complement", "postcode", "city"), ""
    )]


def test_an_empty_batch_never_reaches_the_parser():
    parser = FakeClassifier(COMPONENTS)
    assert parse_addresses([], parser) == []
    assert parser.calls == []


def test_refuses_an_oversized_address_before_parsing_anything():
    parser = FakeClassifier(COMPONENTS)
    with pytest.raises(ValueError):
        parse_addresses([FRENCH, "x" * (MAX_CHARACTERS + 1)], parser)
    assert parser.calls == []


def test_retries_a_failed_call():
    class FailingOnce:
        """The data files are mapped on the first call, and that is the one
        that fails when the machine is short of memory."""

        def __init__(self):
            self.calls = 0

        def predict(self, addresses):
            self.calls += 1
            if self.calls == 1:
                raise MemoryError("model not loaded")
            return [COMPONENTS[a] for a in addresses]

    parser = FailingOnce()
    assert parse_addresses([FRENCH], parser)[0]["postcode"] == "75011"
    assert parser.calls == 2


def test_a_lasting_failure_raises_rather_than_returning_nothing():
    class AlwaysFailing:
        def predict(self, addresses):
            raise MemoryError("model not loaded")

    with pytest.raises(ParsingUnavailable):
        parse_addresses([FRENCH], AlwaysFailing())


def test_a_short_answer_raises_rather_than_misaligning_the_addresses():
    class Truncating:
        def predict(self, addresses):
            return [COMPONENTS[FRENCH]]

    with pytest.raises(ParsingUnavailable):
        parse_addresses([FRENCH, GERMAN], Truncating())


def test_breaking_point_the_parser_always_answers_and_never_doubts():
    """
    The breaking point of this rung: it parses, it does not validate.

    libpostal returns labels, never a score and never a refusal. Handed a line
    that is not an address at all, it splits it into fields that look exactly
    like a real result, and nothing in the code below can tell the difference.
    A typo in a house number, an invented street, a postcode that belongs to
    another town: all come back as clean fields.

    Checking that an address exists is a different job, done against a
    reference file of streets, and this rung does not do it.
    """
    nonsense = "the meeting is at ten in room four"
    parser = FakeClassifier({nonsense: {"house_number": "ten", "road": "room four"}})
    parsed = parse_addresses([nonsense], parser)[0]
    assert parsed["number"] == "ten" and parsed["street"] == "room four"

    # Same shape, on an address that is plausible and simply wrong: nothing
    # distinguishes it from the correct one above.
    wrong_town = "8 rue des Lilas, 75011 Lyon"
    parser = FakeClassifier({wrong_town: {"road": "rue des lilas", "postcode": "75011", "city": "lyon"}})
    assert parse_addresses([wrong_town], parser)[0]["city"] == "lyon"
