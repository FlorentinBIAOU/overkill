"""
The corpus lives here, not in the snippet: the snippet shows a function, not a
demonstration. The same corpus and the same expected table appear in
n1.test.js, which is how the two languages are held to the same ranking.
"""

from n1 import article_text, build_neighbour_table

# Two pairs that belong together, two articles that belong with nothing, and
# an announcement. Bodies are short, which is the hard case for TF-IDF: there
# is little text for the weighting to work with.
ARTICLES = [
    {
        "id": "sourdough-starter",
        "title": "Keeping a sourdough starter alive",
        "body": (
            "A sourdough starter is flour, water and time. Feed the starter twice a day "
            "with equal weights of flour and water, discard half, and the dough will rise "
            "on wild yeast alone. A starter that smells of acetone is a starter that "
            "wants more flour."
        ),
    },
    {
        "id": "rye-bread",
        "title": "Baking a dense rye loaf",
        "body": (
            "Rye flour holds little gluten, so a rye loaf never rises like a wheat loaf. "
            "Build the dough on a lively sourdough starter, keep the dough wet, and let "
            "it proof slowly before baking. The crumb stays dense and the loaf keeps for "
            "a week."
        ),
    },
    {
        "id": "kimchi-at-home",
        "title": "Kimchi in a jar at home",
        "body": (
            "Salt the cabbage overnight, rinse it, then pack the cabbage into a jar with "
            "garlic, ginger and chilli. Leave the jar on the counter and let the cabbage "
            "ferment. The kimchi is ready when the brine turns cloudy and tastes sour."
        ),
    },
    {
        "id": "pickled-cucumbers",
        "title": "Pickled cucumbers in brine",
        "body": (
            "Pack small cucumbers into a jar with dill, garlic and a spoon of salt, then "
            "cover them with brine. Leave the jar on the counter for a week and let the "
            "cucumbers ferment. The brine turns cloudy, which is the sign that it worked."
        ),
    },
    {
        "id": "knife-sharpening",
        "title": "Sharpening a kitchen knife",
        "body": (
            "Hold the blade against a wet whetstone at a constant angle and count the "
            "strokes on each side. Finish on a fine stone until the edge catches on a "
            "fingernail. A sharp knife is safer than a blunt knife, because a sharp blade "
            "cuts where you aim it."
        ),
    },
    {
        "id": "cast-iron-care",
        "title": "Caring for a cast iron pan",
        "body": (
            "Wash the pan, dry the pan on the hob, and wipe a thin film of oil across the "
            "iron while the pan is hot. That film, baked on, is the seasoning. Rust means "
            "the pan went into a cupboard wet, and rust comes off with oil and a scourer."
        ),
    },
    {
        "id": "site-news",
        "title": "Site news",
        "body": "The archive is searchable again and the comment form is back.",
    },
]

# The stop list belongs to the corpus, not to the snippet: it is one per
# language, and this corpus happens to be in English.
ENGLISH_FILLER = (
    "an and are as at be but by for from in into is it its of on or so that "
    "the then this to until when while with you"
).split()

EXPECTED = {
    "sourdough-starter": [("rye-bread", 0.131)],
    "rye-bread": [("sourdough-starter", 0.131)],
    "kimchi-at-home": [("pickled-cucumbers", 0.3)],
    "pickled-cucumbers": [("kimchi-at-home", 0.3)],
    "knife-sharpening": [],
    "cast-iron-care": [],
    "site-news": [],
}

# Same subject, two languages. Nothing in common but the punctuation.
SAME_SUBJECT_TWO_LANGUAGES = [
    {
        "id": "sourdough-starter",
        "title": "Keeping a sourdough starter alive",
        "body": (
            "A sourdough starter is flour, water and time. Feed the starter twice a day "
            "with equal weights of flour and water, discard half, and the dough will rise "
            "on wild yeast alone."
        ),
    },
    {
        "id": "levain-naturel",
        "title": "Entretenir un levain naturel",
        "body": (
            "Un levain, c'est de la farine, de l'eau et du temps. Nourrissez-le deux fois "
            "par jour avec le même poids de farine et d'eau, jetez la moitié, et la pâte "
            "lèvera toute seule."
        ),
    },
    {
        "id": "office-move",
        "title": "The office is moving",
        "body": (
            "The office moves in June. The lift will be out of service for a day and the "
            "archive boxes go into storage until the move is done."
        ),
    },
]


def test_the_whole_table_is_built_at_once():
    assert build_neighbour_table(ARTICLES, stop_words=ENGLISH_FILLER) == EXPECTED


def test_the_title_counts_twice():
    text = article_text(ARTICLES[6])
    assert text == "Site news Site news " + ARTICLES[6]["body"]


def test_without_a_stop_list_ordinary_words_create_similarity():
    # An article about whetstones and an announcement about the comment form
    # share nothing but grammar, and still land above the floor. This is what
    # the stop list is for, and why the floor is not enough on its own.
    table = build_neighbour_table(ARTICLES)
    assert "site-news" in dict(table["knife-sharpening"])


def test_an_article_whose_body_is_empty_is_still_ranked_on_its_title():
    articles = [dict(article) for article in ARTICLES]
    articles[0]["body"] = ""
    table = build_neighbour_table(articles, stop_words=ENGLISH_FILLER)
    assert table["sourdough-starter"] == [("rye-bread", 0.082)]


def test_a_corpus_of_one_article():
    assert build_neighbour_table([ARTICLES[0]]) == {"sourdough-starter": []}


def test_k_caps_the_length_of_each_row():
    table = build_neighbour_table(ARTICLES, k=2)
    assert all(len(row) <= 2 for row in table.values())
    assert table["sourdough-starter"][0][0] == "rye-bread"


def test_limit_of_this_rung_the_same_subject_in_two_languages_scores_zero():
    """
    The breaking point the entry claims for this rung, and the reason it goes on
    to N2.

    TF-IDF compares strings. Two articles that say the same thing in two
    languages, or with two vocabularies, share no term at all, so their cosine
    is exactly zero: not low, zero. Meanwhile an office announcement that
    shares nothing but English grammar scores well above them both.

    No threshold rescues this. It needs a model that maps words onto meaning,
    which is what N2 buys, and what it is paid for.
    """
    # `minimum=-1.0` keeps every pair, so the zero is visible rather than
    # filtered out.
    scores = {
        article_id: dict(row)
        for article_id, row in build_neighbour_table(
            SAME_SUBJECT_TWO_LANGUAGES, minimum=-1.0
        ).items()
    }
    assert scores["sourdough-starter"]["levain-naturel"] == 0.0
    assert scores["sourdough-starter"]["office-move"] > 0.0

    # And so the twin never appears in the block, at any threshold above zero.
    table = build_neighbour_table(SAME_SUBJECT_TWO_LANGUAGES)
    assert "levain-naturel" not in dict(table["sourdough-starter"])
