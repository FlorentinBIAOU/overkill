"""
These tests inject a local double instead of calling a provider.

What they prove: the record reaches the prompt, the temperature asked for is
the one sent, an oversized record is refused before a token is spent, a failure
is retried, an unusable answer raises instead of returning something, and copy
that claims an attribute the record does not carry is refused.

What they do not prove: that the model writes well, and that it writes the same
way tomorrow. That is why this snippet is declared `verification: stubbed` on
the entry, and why the page says so next to the code.
"""

import json

import pytest

from _harness.fake_llm import FakeLLM
from n3 import MAX_CHARACTERS, DescriptionUnavailable, UngroundedDescription, describe

# An invented product: no existing brand, no existing catalogue.
PRODUCT = {
    "name": "Aurore 500",
    "category": "sac à dos",
    "material": "toile recyclée",
    "audience": "les randonneurs",
    "features": ["poche pour ordinateur", "sangle ventrale"],
    "colours": ["ardoise", "sable"],
    "warranty": "deux ans",
}

# The words the shop's catalogue uses, gathered from the attribute values of
# every product on the shelf. The grounding check is exactly as good as this
# list: a claim it does not contain is a claim nobody is watching.
VOCABULARY = (
    "toile recyclée",
    "cuir pleine fleur",
    "étanche",
    "poche pour ordinateur",
    "garanti à vie",
)

COPY = (
    "Aurore 500 tient la journée de marche sans se rappeler à vous. Sa toile "
    "recyclée encaisse les ronces, et sa poche pour ordinateur rentre au bureau le lundi."
)


def answer(description: str) -> str:
    return json.dumps({"description": description})


def test_writes_the_copy_the_model_returned():
    client = FakeLLM(response=answer(COPY))
    assert describe(PRODUCT, client, vocabulary=VOCABULARY) == COPY


def test_sends_the_attributes_and_the_temperature_asked_for():
    client = FakeLLM(response=answer(COPY))
    describe(PRODUCT, client, temperature=0.4)
    prompt = client.last_request["prompt"]
    # Everything the copy may talk about has to be in the prompt.
    assert "- category : sac à dos" in prompt
    assert "- material : toile recyclée" in prompt
    assert "- features : poche pour ordinateur, sangle ventrale" in prompt
    # Variety is what this rung is bought for, so the temperature is not zero
    # by default — and whatever the caller asked for is what is sent.
    assert client.last_request["temperature"] == 0.4


def test_collapses_the_line_breaks_a_model_leaves_in_its_prose():
    client = FakeLLM(response=answer(f"  {COPY}\n\n  "))
    assert describe(PRODUCT, client) == COPY


def test_refuses_an_oversized_record_before_spending_anything():
    client = FakeLLM(response=answer(COPY))
    oversized = {"name": "Aurore 500", "features": ["détail interminable " * 40]}
    assert len(oversized["features"][0]) > MAX_CHARACTERS
    with pytest.raises(ValueError):
        describe(oversized, client)
    assert client.call_count == 0


def test_retries_a_provider_failure():
    client = FakeLLM(response=answer(COPY), fail_times=2)
    assert describe(PRODUCT, client, attempts=3) == COPY
    assert client.call_count == 3


def test_an_answer_that_is_not_json_raises_rather_than_being_published():
    # The model can answer anything, including a polite preamble where JSON was
    # asked for. Publishing that on a product page is worse than an empty page.
    client = FakeLLM(response="Bien sûr ! Voici une proposition de description :")
    with pytest.raises(DescriptionUnavailable):
        describe(PRODUCT, client, attempts=2)
    assert client.call_count == 2


def test_json_without_a_description_raises_too():
    client = FakeLLM(response=json.dumps({"titre": "Aurore 500"}))
    with pytest.raises(DescriptionUnavailable):
        describe(PRODUCT, client, attempts=1)


def test_a_fragment_is_refused():
    client = FakeLLM(response=answer("Un sac à dos."))
    with pytest.raises(DescriptionUnavailable):
        describe(PRODUCT, client)


def test_breaking_point_the_model_promises_what_the_shop_does_not_sell():
    """
    The breaking point of this rung: fluency is not truthfulness.

    The copy below is better than anything the template rung can write. It is
    also a commercial commitment the shop never made — the record says two
    years, the sentence says for life — and it is written with exactly the same
    confidence as the true sentence beside it. There is no wording, no
    temperature and no instruction that removes this risk, because the model
    has no way of telling an attribute of this product from an attribute that
    belongs in a sentence of this shape.

    So the code checks. Every term of the catalogue vocabulary found in the
    copy has to be found in the record too, or the description does not ship.
    """
    invented = (
        "Aurore 500 tient la journée de marche sans se rappeler à vous. Sa toile "
        "recyclée encaisse les ronces, et le sac est garanti à vie contre les défauts de couture."
    )
    client = FakeLLM(response=answer(invented))
    with pytest.raises(UngroundedDescription) as refused:
        describe(PRODUCT, client, vocabulary=VOCABULARY)
    assert "garanti à vie" in str(refused.value)

    # The check reads the record, not the wording: the same sentence goes
    # through for a product whose warranty really is unlimited.
    for_life = {**PRODUCT, "warranty": "garanti à vie"}
    assert describe(for_life, FakeLLM(response=answer(invented)), vocabulary=VOCABULARY) == invented


def test_the_same_product_gets_a_different_description_at_each_run():
    """
    The other half of the bargain, and what the rungs below give you in
    exchange for their limits.

    Two calls, two answers, both acceptable. That is what is being bought here,
    and it is also what makes review impossible: nothing you approved yesterday
    is what a customer reads today. The double stands in for the model, so what
    this test shows is the shape of the problem, not its frequency.
    """
    first = describe(PRODUCT, FakeLLM(response=answer(COPY)), vocabulary=VOCABULARY)
    second_copy = (
        "Aurore 500 part en week-end sans y penser. Sa toile recyclée passe la pluie "
        "et les ronces, et son ardoise discrète se fait oublier en réunion."
    )
    second = describe(PRODUCT, FakeLLM(response=answer(second_copy)), vocabulary=VOCABULARY)
    assert first != second
