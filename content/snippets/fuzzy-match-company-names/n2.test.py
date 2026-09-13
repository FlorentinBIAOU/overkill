"""
These tests inject a local double instead of loading a real encoder.

What they prove: the register is encoded once and not once per query, the
vectors are brought to length one, the cosine is computed and sorted the way
the snippet claims, ties are stable, and top_k caps the answer.

What they do not prove: that the model understands anything. The double is a
bag of words, so on the pair this rung exists for — an acronym against the
name it stands for — it scores exactly zero. That is asserted below rather
than hidden, and it is why the entry declares this snippet `stubbed`.
"""

from _harness.fake_model import FakeEncoder
from n2 import build_index, match

# A register where two neighbours share their generic words, and where one
# company is written twice, once in full and once short.
REGISTER = [
    "Boulangerie du Vieux Moulin",
    "Boulangerie du Vieux Port",
    "Le Vieux Moulin",
    "SNCF",
    "Société Nationale des Chemins de fer Français",
]

# The real encoder of this snippet returns 384 numbers per name; the double is
# asked for the same width, so the test exercises the shape the snippet will
# actually meet.
DIMENSIONS = 384


def make_index():
    return build_index(REGISTER, encoder=FakeEncoder(DIMENSIONS))


def test_finds_the_company_itself_first():
    name, score = match(make_index(), "Boulangerie du Vieux Moulin")[0]
    assert name == "Boulangerie du Vieux Moulin"
    assert round(score, 12) == 1.0


def test_case_costs_nothing_because_the_encoder_folds_it():
    assert match(make_index(), "BOULANGERIE DU VIEUX MOULIN") == \
        match(make_index(), "Boulangerie du Vieux Moulin")


def test_the_register_is_encoded_once_not_once_per_query():
    """The point of an index: the expensive call happens at build time."""
    encoder = FakeEncoder(DIMENSIONS)
    index = build_index(REGISTER, encoder=encoder)
    assert encoder.calls == [REGISTER]
    match(index, "Le Vieux Moulin")
    assert encoder.calls[1] == ["Le Vieux Moulin"]


def test_top_k_caps_the_answer():
    assert len(match(make_index(), "Le Vieux Moulin", top_k=2)) == 2


def test_a_name_sharing_nothing_scores_zero_rather_than_a_little():
    ranked = dict(match(make_index(), "Boulangerie du Vieux Moulin", top_k=len(REGISTER)))
    assert ranked["SNCF"] == 0.0


def test_ties_come_back_in_register_order():
    """A matching run has to be replayable, so the sort is stable."""
    names = [name for name, _ in match(make_index(), "", top_k=len(REGISTER))]
    assert names == REGISTER


def test_what_the_double_cannot_prove():
    """
    The reason this rung exists is the acronym pair, and the double scores it
    at zero because it is a bag of words, exactly like N0 and N1.

    Only the real encoder can close that gap. This test asserts the double's
    silence instead of implying a win nobody measured.
    """
    ranked = dict(match(make_index(), "SNCF", top_k=len(REGISTER)))
    assert ranked["Société Nationale des Chemins de fer Français"] == 0.0


def test_breaking_point_shared_generic_words_beat_identity():
    """
    A vector by meaning is not a vector by identity.

    "Boulangerie du Vieux Port" is a different company that happens to share
    three ordinary words. "Le Vieux Moulin" is the same company under its
    short name. The stranger ranks above the twin, and no threshold sorts that
    out — which is why this rung still ends in a human review queue.
    """
    ranked = dict(match(make_index(), "Boulangerie du Vieux Moulin", top_k=len(REGISTER)))
    assert ranked["Boulangerie du Vieux Port"] > ranked["Le Vieux Moulin"]
    assert round(ranked["Boulangerie du Vieux Port"], 12) == 0.75
