"""
These tests inject a local double instead of loading a real encoder.

What they prove: one string is built per article, the encoder is called once
with the whole corpus rather than once per article, the vectors that come back
become a correctly ordered neighbour table, a corpus too small to hold a pair
never reaches the model at all, and an encoder that fails or answers the wrong
shape raises instead of returning an empty table that reads like "this article
has no neighbours".

What they do not prove: that a real encoder puts the right articles close
together — and in particular that it closes the gap N1 leaves, since the
double matches words, exactly like N1. That is why this snippet is declared
`verification: stubbed` on the entry, and why the page says so next to the
code.
"""

import pytest

from _harness.fake_model import FakeEncoder
from n2 import EncodingFailed, article_text, build_neighbour_table

# Short bodies, the length of a standfirst. The corpus lives here, not in the
# snippet, and the same corpus and table appear in n2.test.js.
ARTICLES = [
    {
        "id": "sourdough-starter",
        "title": "Keeping a sourdough starter alive",
        "body": "Feeding flour and water to a sourdough starter, and reading its smell.",
    },
    {
        "id": "rye-bread",
        "title": "Baking a dense rye loaf",
        "body": "Rye flour, a sourdough starter, a long proof, a dense rye loaf.",
    },
    {
        "id": "kimchi-at-home",
        "title": "Kimchi in a jar at home",
        "body": "Salting cabbage, packing a jar, waiting for the ferment to turn sour.",
    },
    {
        "id": "pickled-cucumbers",
        "title": "Pickled cucumbers in brine",
        "body": "Cucumbers, dill and brine in a jar, left to ferment on the counter.",
    },
    {
        "id": "knife-sharpening",
        "title": "Sharpening a kitchen knife",
        "body": "Angle, whetstone and strokes: putting an edge back on a kitchen knife.",
    },
    {
        "id": "cast-iron-care",
        "title": "Caring for a cast iron pan",
        "body": "Oil, heat and seasoning: keeping rust off a cast iron pan.",
    },
]

# The two neighbours of every article, best first. Ties are broken by
# identifier, which is why knife-sharpening lists kimchi before rye.
EXPECTED = {
    "sourdough-starter": [("rye-bread", 0.416), ("cast-iron-care", 0.28)],
    "rye-bread": [("sourdough-starter", 0.416), ("kimchi-at-home", 0.273)],
    "kimchi-at-home": [("pickled-cucumbers", 0.421), ("rye-bread", 0.273)],
    "pickled-cucumbers": [("kimchi-at-home", 0.421), ("sourdough-starter", 0.18)],
    "knife-sharpening": [("kimchi-at-home", 0.261), ("rye-bread", 0.261)],
    "cast-iron-care": [("sourdough-starter", 0.28), ("rye-bread", 0.256)],
}

# Everything else an editor might publish in a year, in one article.
RAMBLING = (
    " The oven, the tin, the cooling rack, the knife, the board and the jar of jam all "
    "come into it, and so does the counter, the kitchen, the oil, the pan and the iron "
    "shelf above the hob."
)


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


def test_the_whole_table_is_built_at_once():
    assert build_neighbour_table(ARTICLES, encoder=encoder(), k=2) == EXPECTED


def test_the_corpus_is_encoded_in_one_batched_call():
    fake = encoder()
    build_neighbour_table(ARTICLES, encoder=fake)
    # One call holding every article, not one call per article. The difference
    # is the whole reason a batch exists.
    assert fake.calls == [[article_text(article) for article in ARTICLES]]
    assert len(fake.calls) == 1


def test_a_corpus_too_small_to_hold_a_pair_never_reaches_the_model():
    fake = encoder()
    assert build_neighbour_table([ARTICLES[0]], encoder=fake) == {"sourdough-starter": []}
    assert fake.calls == []


def test_k_caps_the_length_of_each_row():
    table = build_neighbour_table(ARTICLES, encoder=encoder(), k=1)
    assert table["sourdough-starter"] == [("rye-bread", 0.416)]


def test_a_model_that_cannot_run_raises():
    with pytest.raises(EncodingFailed):
        build_neighbour_table(ARTICLES, encoder=BrokenEncoder())


def test_a_truncated_batch_raises_rather_than_shifting_every_neighbour():
    # A missing vector would silently pair each article with the wrong one.
    with pytest.raises(EncodingFailed):
        build_neighbour_table(ARTICLES, encoder=TruncatedEncoder(dimensions=256))


def test_limit_of_this_rung_one_vector_per_article_dilutes_a_long_one():
    """
    Not the breaking point of the entry, which is N0's, but the wall this rung
    hits in production.

    An article gets one vector however long it is, so a piece that covers
    eight subjects has each of them at one eighth strength. Adding a rambling
    paragraph to the rye loaf article is enough to cost it its rightful first
    neighbour, and to hand that place to an article about frying pans.

    The double exaggerates the size of the effect, being a bag of words. The
    mechanism is the real one, and it is why serious pipelines cut long
    articles into passages and index the passages, which is more machinery
    again on top of a rung that already costs a model to host.
    """
    diluted = [dict(article) for article in ARTICLES]
    diluted[1]["body"] += RAMBLING

    before = build_neighbour_table(ARTICLES, encoder=encoder(), k=2)
    after = build_neighbour_table(diluted, encoder=encoder(), k=2)

    assert before["sourdough-starter"][0][0] == "rye-bread"
    assert after["sourdough-starter"][0][0] == "cast-iron-care"
    # The long article loses its own best neighbour too.
    assert after["rye-bread"][0][0] == "kimchi-at-home"
