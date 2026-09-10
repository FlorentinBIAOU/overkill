from n1 import learn, rerank

# A slice of a click log: what was typed, and which suggestion was chosen.
# The kind of file a search bar already writes without being asked.
CLICKS = (
    [("cha", "chaussettes de sport")] * 4
    + [("chau", "chaussettes de sport")] * 2
    + [("ch", "chemise en lin")]
    + [("e", "étagère murale")] * 3
    + [("ÉCHA", "écharpe en laine")]
)

# What the prefix tree of the previous rung hands over: candidates already
# ordered by how often the term is searched.
BY_FREQUENCY = ["chaussures de running", "chaussettes de sport"]


def make_model():
    return learn(CLICKS)


def test_a_clicked_term_moves_above_a_more_searched_one():
    assert rerank(make_model(), "cha", BY_FREQUENCY) == [
        "chaussettes de sport",
        "chaussures de running",
    ]


def test_a_prefix_never_typed_falls_back_on_a_shorter_one():
    # "chaus" is absent from the log; "chau" is not, and it carries the clicks.
    assert rerank(make_model(), "chaus", BY_FREQUENCY) == [
        "chaussettes de sport",
        "chaussures de running",
    ]


def test_an_empty_prefix_ranks_on_the_whole_log():
    candidates = ["chaussures de running", "chemise en lin", "chaussettes de sport"]
    assert rerank(make_model(), "", candidates) == [
        "chaussettes de sport",
        "chemise en lin",
        "chaussures de running",
    ]


def test_ignores_accents_and_case_like_the_prefix_tree():
    model = make_model()
    candidates = ["échelle télescopique", "écharpe en laine"]
    assert rerank(model, "echa", candidates) == [
        "écharpe en laine",
        "échelle télescopique",
    ]
    assert rerank(model, "ÉCHA", candidates) == rerank(model, "echa", candidates)


def test_honours_the_limit():
    assert rerank(make_model(), "cha", BY_FREQUENCY, limit=1) == ["chaussettes de sport"]


def test_terms_nobody_ever_clicked_keep_their_incoming_order():
    # The cold start: on a term with no click behind it the model stays silent
    # and the frequency ordering stands.
    untouched = ["chaussures de running", "échelle télescopique"]
    assert rerank(make_model(), "cha", untouched) == untouched


def test_an_empty_log_changes_nothing():
    assert rerank(learn([]), "cha", BY_FREQUENCY) == BY_FREQUENCY


def test_breaking_point_reranking_cannot_rescue_what_was_never_retrieved():
    """
    This rung reorders a list; it does not lengthen one. The typo on the first
    character that empties the prefix tree, the breaking point claimed on the
    entry, empties this rung too, however many clicks the term has behind it.
    """
    model = make_model()
    # A click is on record for this term, and the prefix tree still hands over nothing.
    assert model[("echa", "écharpe en laine")] == 1
    assert rerank(model, "rcharpe", []) == []
    assert rerank(model, "vhauss", []) == []
