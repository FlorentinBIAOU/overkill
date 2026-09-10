"""
These tests inject a local double instead of loading the checkpoint.

What they prove: the record reaches the model in the shape it was fine-tuned
on, an oversized record is refused before anything is generated, a failed call
is retried, a half-finished sentence is never published, and copy that claims
an attribute the record does not carry is refused.

What they do not prove: that the model writes well. Nothing in a test can
prove that, which is why this snippet is declared `verification: stubbed` on
the entry, and why the page says so next to the code.
"""

import pytest

from _harness.fake_model import FakeSeq2Seq
from n2 import MAX_CHARACTERS, DescriptionUnavailable, UngroundedDescription, describe

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
    "sangle ventrale",
    "garanti à vie",
)

COPY = (
    "Aurore 500 accompagne les randonneurs à la journée. Sa toile recyclée "
    "encaisse les ronces, et sa sangle ventrale reporte la charge sur les hanches."
)


def test_writes_the_copy_the_model_returned():
    model = FakeSeq2Seq({}, COPY)
    assert describe(PRODUCT, model, vocabulary=VOCABULARY) == COPY


def test_sends_the_product_attributes_to_the_model():
    model = FakeSeq2Seq({}, COPY)
    describe(PRODUCT, model)
    source = model.calls[0]
    # Everything the copy may talk about has to be in the source line, in the
    # « field: value » shape the fine-tuning used.
    assert "category: sac à dos" in source
    assert "material: toile recyclée" in source
    assert "features: poche pour ordinateur, sangle ventrale" in source
    assert "\n" not in source


def test_keeps_only_the_sentences_the_model_finished():
    # A small model stops when its token budget runs out, mid-word.
    model = FakeSeq2Seq({}, "Aurore 500 accompagne les randonneurs à la journée. Sa toile recy")
    assert describe(PRODUCT, model) == "Aurore 500 accompagne les randonneurs à la journée."


def test_a_fragment_is_refused_rather_than_published():
    with pytest.raises(DescriptionUnavailable):
        describe(PRODUCT, FakeSeq2Seq({}, "Aurore 500."))
    # And an answer with no finished sentence at all is a fragment too.
    with pytest.raises(DescriptionUnavailable):
        describe(PRODUCT, FakeSeq2Seq({}, "un sac à dos solide et bien pensé pour la journée"))


def test_refuses_an_oversized_record_before_generating_anything():
    model = FakeSeq2Seq({}, COPY)
    oversized = {"name": "Aurore 500", "features": ["détail interminable " * 40]}
    assert len(str(oversized["features"][0])) > MAX_CHARACTERS
    with pytest.raises(ValueError):
        describe(oversized, model)
    assert model.calls == []


def test_retries_a_failed_call():
    class FailingOnce:
        """Loading the weights into memory is the call that fails, and once."""

        def __init__(self):
            self.calls = 0

        def generate(self, source, **options):
            self.calls += 1
            if self.calls == 1:
                raise MemoryError("checkpoint not loaded")
            return COPY

    model = FailingOnce()
    assert describe(PRODUCT, model, attempts=2) == COPY
    assert model.calls == 2


def test_a_lasting_failure_raises_rather_than_returning_nothing():
    class AlwaysFailing:
        def generate(self, source, **options):
            raise MemoryError("checkpoint not loaded")

    with pytest.raises(DescriptionUnavailable):
        describe(PRODUCT, AlwaysFailing())


def test_breaking_point_the_model_claims_what_the_product_does_not_have():
    """
    The breaking point of this rung, and the reason the check exists.

    The copy below is well written, in the shop's voice, and grammatical. It
    also says the bag is waterproof. Nothing in the record says so: the model
    wrote « étanche » because thousands of bag descriptions end that way. On a
    shelf, that sentence is a claim the shop has to honour.

    The double is what makes this demonstrable at all — a real model invents on
    its own schedule, which is precisely the problem. What the test proves is
    that when it does, the code refuses instead of publishing.
    """
    invented = (
        "Aurore 500 suit les randonneurs par tous les temps. Sa toile recyclée "
        "est entièrement étanche, et sa sangle ventrale reporte la charge."
    )
    with pytest.raises(UngroundedDescription) as refused:
        describe(PRODUCT, FakeSeq2Seq({}, invented), vocabulary=VOCABULARY)
    assert "étanche" in str(refused.value)

    # The same sentence, for a product whose record does carry the claim,
    # goes through: the check reads the record, not the wording.
    waterproof = {**PRODUCT, "features": [*PRODUCT["features"], "étanche"]}
    assert describe(waterproof, FakeSeq2Seq({}, invented), vocabulary=VOCABULARY) == invented


def test_an_empty_vocabulary_checks_nothing_and_says_so_by_letting_it_pass():
    # The default is not a safe default. It is the caller's decision, and this
    # test is here so that nobody discovers it in production.
    invented = (
        "Aurore 500 suit les randonneurs par tous les temps. Sa toile recyclée "
        "est entièrement étanche, et sa sangle ventrale reporte la charge."
    )
    assert describe(PRODUCT, FakeSeq2Seq({}, invented)) == invented
