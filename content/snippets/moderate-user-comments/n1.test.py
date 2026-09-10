from n1 import is_abusive, score, train

# A corpus the size of one afternoon of labelling. The pejoratives are
# invented, which is all a term-shape model needs to be exercised.
ABUSIVE = [
    "you are a blorptard and everyone here knows it",
    "what a blorptard, go away",
    "typical bl0rptard behaviour on this forum",
    "shut up you zibbernaut",
    "only a zibbernaut would post that",
    "get lost you flarnwit",
    "this flarnwit ruins every thread",
    "nobody wants you here you blorptard",
    "another zibbernaut with an opinion nobody asked for",
    "you absolute flarnwit, learn to read",
    "stop posting zibbernaut nonsense",
    "the usual blorptard reply, well done",
]

# Ordinary comments also say "you". Without them the model would learn that
# the second person is an insult.
ORDINARY = [
    "great write-up, the third section helped a lot",
    "i disagree with the conclusion but the data is solid",
    "could you add a link to the source please",
    "thank you, this saved me an afternoon of work",
    "the second example does not compile on my machine",
    "i think there is a typo in the last paragraph",
    "has anyone tried this on a large corpus",
    "the diagram is much clearer than the text",
    "i had the same problem last week and your fix works",
    "looking forward to the next part of the series",
    "did you consider the case where the list is empty",
    "you are right about the second point, i was wrong",
]


def make_model():
    return train(ABUSIVE + ORDINARY, [1] * len(ABUSIVE) + [0] * len(ORDINARY))


def test_separates_the_corpus_it_was_trained_on():
    model = make_model()
    assert all(is_abusive(model, c) for c in ABUSIVE)
    assert not any(is_abusive(model, c) for c in ORDINARY)


def test_catches_the_spellings_that_defeat_a_term_list():
    """The reason to move up from N0: none of these are in the corpus."""
    model = make_model()
    for evasion in ("you are a total blorptardd", "what an obvious bl0rptard", "flarn-wit"):
        assert is_abusive(model, evasion), evasion


def test_leaves_an_unseen_ordinary_comment_alone():
    model = make_model()
    assert not is_abusive(model, "thanks for the detailed explanation")
    assert not is_abusive(model, "i still think the benchmark is misleading")


def test_score_is_a_probability():
    model = make_model()
    assert 0.0 <= score(model, "") <= 1.0
    assert score(model, ABUSIVE[0]) > score(model, ORDINARY[0])


def test_the_threshold_is_the_callers_to_set():
    model = make_model()
    calm = "the diagram is much clearer than the text"
    # At zero everything is abusive, which is exactly why the knob is exposed
    # rather than buried in the function.
    assert is_abusive(model, calm, threshold=0.0)
    assert not is_abusive(model, ABUSIVE[0], threshold=1.0)


def test_breaking_point_the_model_learns_vocabulary_not_intent():
    """
    N1 solves the first half of the N0 breaking point and not the second.

    Hostility that reuses no learnt shape scores below the line, and the same
    shape scores above it whatever the comment is doing with it: a user
    reporting the abuse they received is flagged like the attack itself.

    A bigger corpus moves the boundary. It does not change what the model is
    looking at, which is the surface of the comment and nothing else.
    """
    model = make_model()
    hostile_but_unseen = "people like you should not be allowed to have an account here"
    quotation = "he called me a blorptard, please remove his comment"
    assert not is_abusive(model, hostile_but_unseen)
    assert is_abusive(model, quotation)
