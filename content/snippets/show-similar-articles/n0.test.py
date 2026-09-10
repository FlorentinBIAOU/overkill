"""
The corpus lives here, not in the snippet: the snippet shows a function, not a
demonstration. The same corpus and the same expected table appear in
n0.test.js, which is how the two languages are held to the same ranking.
"""

from n0 import build_neighbour_table, similarity, tag_weights

# A small blog. Every article carries "blog", the way every article on a real
# site carries the tag someone added on the first day and never removed.
ARTICLES = [
    {"id": "kimchi-at-home", "tags": ["blog", "fermentation", "vegetables"]},
    {"id": "cast-iron-care", "tags": ["blog", "tools", "maintenance", "cast-iron"]},
    {"id": "knife-sharpening", "tags": ["blog", "tools", "maintenance"]},
    {"id": "rye-bread", "tags": ["blog", "baking", "sourdough", "rye"]},
    {"id": "site-news", "tags": ["blog"]},
    {"id": "sourdough-starter", "tags": ["blog", "baking", "sourdough", "fermentation"]},
]

EXPECTED = {
    "kimchi-at-home": [("sourdough-starter", 0.302)],
    "cast-iron-care": [("knife-sharpening", 0.655)],
    "knife-sharpening": [("cast-iron-care", 0.655)],
    "rye-bread": [("sourdough-starter", 0.535)],
    "site-news": [],
    "sourdough-starter": [("rye-bread", 0.535), ("kimchi-at-home", 0.302)],
}


def test_the_whole_table_is_built_at_once():
    assert build_neighbour_table(ARTICLES) == EXPECTED


def test_a_tag_every_article_carries_weighs_nothing():
    weights = tag_weights(ARTICLES)
    assert weights["blog"] == 0.0
    assert weights["rye"] > weights["sourdough"] > 0.0


def test_rarity_beats_a_count_of_shared_tags():
    # Two articles share two ordinary tags; a third shares one rare tag. A
    # plain count of shared tags puts the wrong one first, which is exactly
    # what this rung is about.
    corpus = [
        {"id": "sourdough-hydration", "tags": ["news", "guide", "sourdough"]},
        {"id": "seo-checklist", "tags": ["news", "guide", "seo"]},
        {"id": "sourdough-troubles", "tags": ["news", "sourdough"]},
        {"id": "css-grid", "tags": ["news", "guide", "css"]},
        {"id": "hiring-process", "tags": ["news", "guide", "hiring"]},
    ]
    neighbours = build_neighbour_table(corpus)["sourdough-hydration"]
    assert neighbours[0][0] == "sourdough-troubles"

    shared = {"seo-checklist": 2, "sourdough-troubles": 1}
    assert shared["seo-checklist"] > shared["sourdough-troubles"]


def test_an_article_with_no_tags_has_no_neighbours_and_is_nobody_s():
    corpus = ARTICLES + [{"id": "untagged-draft", "tags": []}]
    table = build_neighbour_table(corpus)
    assert table["untagged-draft"] == []
    assert all("untagged-draft" not in dict(row) for row in table.values())


def test_a_corpus_of_one_article():
    assert build_neighbour_table([ARTICLES[0]]) == {"kimchi-at-home": []}


def test_k_caps_the_length_of_each_row():
    table = build_neighbour_table(ARTICLES, k=1)
    assert table["sourdough-starter"] == [("rye-bread", 0.535)]


def test_similarity_of_an_article_with_itself_is_one():
    weights = tag_weights(ARTICLES)
    assert round(similarity(ARTICLES[0]["tags"], ARTICLES[0]["tags"], weights), 6) == 1.0


def test_breaking_point_a_badly_tagged_corpus_produces_no_similarity():
    """
    The breaking point claimed on the entry.

    Badly tagged means two things, and both end here. Tags so generic that
    every article carries them weigh exactly zero, so no pair has anything to
    share. Tags so specific that no two articles share one leave every pair
    with nothing in common. Either way the table is empty, and the block does
    not appear on a single page.

    This is not a bug to be tuned away: the tags are the whole input, and this
    rung cannot invent a signal that nobody entered. It is the reason the
    entry goes on to N1, which reads the article instead of its labels.
    """
    too_generic = [
        {"id": "first", "tags": ["blog", "article"]},
        {"id": "second", "tags": ["blog", "article"]},
        {"id": "third", "tags": ["blog", "article"]},
    ]
    assert build_neighbour_table(too_generic) == {"first": [], "second": [], "third": []}

    too_specific = [
        {"id": "first", "tags": ["2024-retrospective"]},
        {"id": "second", "tags": ["march-release"]},
        {"id": "third", "tags": ["office-move"]},
    ]
    assert build_neighbour_table(too_specific) == {"first": [], "second": [], "third": []}
