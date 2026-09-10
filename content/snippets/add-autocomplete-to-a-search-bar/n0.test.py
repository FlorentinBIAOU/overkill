from n0 import build, normalise, suggest

# What a fortnight of search logs looks like once grouped: the term as it is
# spelled in the catalogue, and how often it was searched.
CATALOGUE = [
    ("chaussures de running", 900),
    ("chaussettes de sport", 400),
    ("étagère murale", 300),
    ("chemise en lin", 250),
    ("écharpe en laine", 120),
    ("échelle télescopique", 60),
]


def make_tree():
    return build(CATALOGUE)


def test_suggests_the_most_searched_terms_under_a_prefix():
    assert suggest(make_tree(), "cha") == [
        "chaussures de running",
        "chaussettes de sport",
    ]


def test_orders_by_usage_and_honours_the_limit():
    assert suggest(make_tree(), "ch", limit=2) == [
        "chaussures de running",
        "chaussettes de sport",
    ]


def test_an_empty_prefix_offers_the_most_searched_terms_overall():
    # What an empty search bar should show before a single key is pressed.
    assert suggest(make_tree(), "", limit=3) == [
        "chaussures de running",
        "chaussettes de sport",
        "étagère murale",
    ]


def test_ignores_accents_and_case():
    tree = make_tree()
    assert suggest(tree, "ech") == ["écharpe en laine", "échelle télescopique"]
    assert suggest(tree, "ÉCH") == suggest(tree, "ech")


def test_an_unknown_prefix_returns_nothing():
    assert suggest(make_tree(), "zzz") == []


def test_two_spellings_of_the_same_term_both_survive():
    # Folding case is what makes them collide; keeping a list at the leaf is
    # what stops one from silently replacing the other.
    tree = build([("Chaussures", 5), ("chaussures", 3)])
    assert suggest(tree, "chau") == ["Chaussures", "chaussures"]


def test_normalisation_folds_accents_without_touching_the_letters():
    assert normalise("Écharpe") == "echarpe"
    assert normalise("Étagère Murale") == "etagere murale"


def test_breaking_point_a_typo_on_the_first_character():
    """
    The breaking point claimed on the entry: the tree can only walk down the
    characters it was given. One wrong key at the start, and the walk leaves
    the tree on the first step, with nothing to fall back on.

    The pairs below differ by exactly one character, the first one, and the
    correct spelling is right there in the index.
    """
    tree = make_tree()
    assert suggest(tree, "echarpe") == ["écharpe en laine"]
    assert suggest(tree, "rcharpe") == []

    assert suggest(tree, "chauss") == [
        "chaussures de running",
        "chaussettes de sport",
    ]
    assert suggest(tree, "vhauss") == []
