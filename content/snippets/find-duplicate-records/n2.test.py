"""
These tests inject a local double instead of loading a real encoder.

What they prove: the records are normalised the same way for every rung, the
encoder is called once with the whole batch, the vectors that come back are
turned into pairs correctly, and an encoder that fails or answers the wrong
shape raises rather than returning an empty result that reads like "no
duplicates found".

What they do not prove: that a real encoder puts the right records close
together. That is why this snippet is declared `verification: stubbed` on the
entry, and why the page says so next to the code.
"""

import pytest

from _harness.fake_model import FakeEncoder
from n2 import EncodingFailed, find_duplicates, record_text

CUSTOMERS = [
    {"name": "Jean Dupont", "address": "12 rue des Lilas", "postcode": "75011", "city": "Paris"},
    {"name": "Dupont Jean", "address": "12 rue des Lilas", "postcode": "75011", "city": "Paris"},
    {"name": "Marie Martin", "address": "5 avenue Victor Hugo", "postcode": "69003", "city": "Lyon"},
]

# A catalogue: one product entered twice in two different wordings, and a
# third product that differs from the first by one character.
CATALOGUE = [
    {"name": "Câble HDMI 2 m", "brand": "Belkin"},
    {"name": "HDMI lead, 2 metres, black", "brand": "Belkin"},
    {"name": "Câble HDMI 3 m", "brand": "Belkin"},
]


def encoder():
    # Wide enough that two different words never land in the same dimension.
    return FakeEncoder(dimensions=256)


class TruncatedEncoder(FakeEncoder):
    """A model that silently drops the last item of a batch."""

    def encode(self, texts):
        return super().encode(texts)[:-1]


class BrokenEncoder:
    """A model that cannot be run at all."""

    def encode(self, texts):
        raise RuntimeError("out of memory while loading the model")


def test_finds_the_duplicate_pair():
    assert find_duplicates(CUSTOMERS, encoder=encoder()) == [(0, 1, 1.0)]


def test_encodes_the_whole_file_in_one_batched_call():
    fake = encoder()
    find_duplicates(CUSTOMERS, encoder=fake)
    assert fake.calls == [[record_text(record) for record in CUSTOMERS]]


def test_a_file_too_small_to_hold_a_pair_never_reaches_the_model():
    fake = encoder()
    assert find_duplicates([CUSTOMERS[0]], encoder=fake) == []
    assert fake.calls == []


def test_the_threshold_is_yours_to_set():
    loose = find_duplicates(CUSTOMERS, encoder=encoder(), threshold=0.0)
    assert [(i, j) for i, j, _ in loose] == [(0, 1), (0, 2), (1, 2)]


def test_blank_records_do_not_divide_by_zero():
    blanks = [{"name": "", "city": ""}, {"name": "", "city": ""}]
    assert find_duplicates(blanks, encoder=encoder(), threshold=0.0) == [(0, 1, 0.0)]


def test_a_truncated_batch_raises_rather_than_losing_a_record():
    with pytest.raises(EncodingFailed):
        find_duplicates(CUSTOMERS, encoder=TruncatedEncoder(dimensions=256))


def test_a_model_that_cannot_run_raises():
    with pytest.raises(EncodingFailed):
        find_duplicates(CUSTOMERS, encoder=BrokenEncoder())


def test_breaking_point_one_token_of_difference_barely_moves_the_vector():
    """
    The breaking point of this rung: a record is encoded as a whole, so the
    one token that tells two records apart is a small part of a vector built
    from everything they share. Two products one character apart score higher
    than the same product written twice in different words.

    The double here is a bag of words, which makes the second half of that
    sentence sharper than a real encoder would; the first half is the one real
    encoders show too, and it is the one that merges two catalogue lines.
    """
    scores = {(i, j): s for i, j, s in find_duplicates(CATALOGUE, encoder=encoder(), threshold=0.0)}
    assert scores[(0, 2)] > scores[(0, 1)]

    found = [(i, j) for i, j, _ in find_duplicates(CATALOGUE, encoder=encoder())]
    assert found == [(0, 2)]  # the two different cables, merged; the real pair, missed
