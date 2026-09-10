"""
These tests inject a local double instead of calling a provider.

What they prove: the request is built correctly, the answer is decoded
correctly, an oversized address is refused before anything is spent, a failure
is retried, an invented field is dropped, and an unusable answer raises rather
than returning fields nobody can trust.

What they do not prove: that the model splits addresses well. That is why this
snippet is declared `verification: stubbed` on the entry, and why the page says
so next to the code.
"""

import json

import pytest

from _harness.fake_llm import FakeLLM
from n3 import FIELDS, MAX_CHARACTERS, ParsingUnavailable, parse

# Invented addresses. None is the home of a real person, and none is the
# registered office of a real company.
FRENCH = "8 rue des Lilas, Appartement 12, 75011 Paris"


def test_decodes_the_fields_the_model_returns():
    client = FakeLLM(
        response=json.dumps(
            {
                "number": "8",
                "street": "rue des Lilas",
                "complement": "Appartement 12",
                "postcode": "75011",
                "city": "Paris",
            }
        )
    )
    assert parse(FRENCH, client=client) == {
        "number": "8",
        "street": "rue des Lilas",
        "complement": "Appartement 12",
        "postcode": "75011",
        "city": "Paris",
    }


def test_sends_the_address_inside_the_prompt():
    client = FakeLLM(response="{}")
    parse(FRENCH, client=client)
    assert FRENCH in client.last_request["prompt"]
    # Temperature zero, because an address that splits differently between two
    # identical calls cannot be reconciled with anything.
    assert client.last_request["temperature"] == 0


def test_a_missing_field_comes_back_empty():
    client = FakeLLM(response='{"street": "rue des Lilas", "city": "Paris"}')
    parsed = parse("rue des Lilas, Paris", client=client)
    assert parsed["number"] == "" and parsed["postcode"] == ""
    assert set(parsed) == set(FIELDS)


def test_accepts_the_case_and_spacing_the_model_changed():
    # Rewriting the case is the model tidying up; rewriting the words is not.
    client = FakeLLM(response='{"city": "PARIS", "street": "Rue  des Lilas"}')
    parsed = parse(FRENCH, client=client)
    assert parsed["city"] == "PARIS"
    assert parsed["street"] == "Rue  des Lilas"


def test_drops_a_field_the_model_invented():
    # The address carries no postcode. The model supplies a plausible one, and
    # a plausible postcode is worse than an empty field: nothing downstream
    # would ever question it.
    client = FakeLLM(response='{"street": "rue des Lilas", "postcode": "75011", "city": "Paris"}')
    parsed = parse("rue des Lilas, Paris", client=client)
    assert parsed["postcode"] == ""
    assert parsed["street"] == "rue des Lilas" and parsed["city"] == "Paris"


def test_refuses_an_oversized_address_before_spending_anything():
    client = FakeLLM(response="{}")
    with pytest.raises(ValueError):
        parse("x" * (MAX_CHARACTERS + 1), client=client)
    assert client.call_count == 0


def test_retries_a_provider_failure():
    client = FakeLLM(response="{}", fail_times=2)
    parse(FRENCH, client=client, attempts=3)
    assert client.call_count == 3


def test_an_unusable_answer_raises_rather_than_returning_empty_fields():
    # Prose where JSON was asked for, and a list where an object was asked for.
    # Returning five empty fields would look exactly like an address that has
    # no fields, and the caller would never know the difference.
    for answer in ("Sure! Here is the address split into fields:", '["8", "rue des Lilas"]'):
        with pytest.raises(ParsingUnavailable):
            parse(FRENCH, client=FakeLLM(response=answer))


def test_breaking_point_the_check_covers_provenance_not_correctness():
    """
    The breaking point of this rung: the guard proves where a value came from,
    and nothing more.

    Here the model has swapped the street and the town. Both values were copied
    from the address, so both pass the check, and the answer comes back neatly
    structured and wrong. Catching this would take a reference file of streets
    and towns — which is another rung's job, and a cost this one is usually
    assumed not to have.
    """
    address = "12 rue de Lille, 59000 Lille"
    client = FakeLLM(response='{"number": "12", "street": "Lille", "city": "rue de Lille"}')
    parsed = parse(address, client=client)
    assert parsed["street"] == "Lille"
    assert parsed["city"] == "rue de Lille"
