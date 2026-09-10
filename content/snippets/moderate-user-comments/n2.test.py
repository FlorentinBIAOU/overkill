"""
These tests inject a local double instead of loading the real model.

What they prove: the batch is sent in one call, the scores are decoded into
the right decision, the thresholds are honoured, and an answer the caller
cannot act on sends the comment to a human rather than publishing it.

What they do not prove: that the model scores comments well. That is why this
snippet is declared `verification: stubbed` on the entry, and why the page
says so next to the code.
"""

import pytest

from _harness.fake_model import FakeClassifier
from n2 import ModerationUnavailable, moderate

ATTACK = "get off this forum you blorptard"
BORDERLINE = "that was a spectacularly bad take, honestly"
CALM = "the diagram is much clearer than the text"

# The labels are the ones a toxicity model actually exposes; the scores are
# ours, so the test exercises our thresholds and not the model's opinions.
SCORES = {
    ATTACK: {"toxicity": 0.96, "insult": 0.91, "threat": 0.04},
    BORDERLINE: {"toxicity": 0.71, "insult": 0.35, "threat": 0.01},
    CALM: {"toxicity": 0.02, "insult": 0.01, "threat": 0.0},
}


def test_routes_each_comment_to_its_decision():
    classifier = FakeClassifier(SCORES)
    actions = [d["action"] for d in moderate([ATTACK, BORDERLINE, CALM], classifier)]
    assert actions == ["block", "review", "allow"]


def test_keeps_the_strongest_label_so_a_reviewer_knows_why():
    classifier = FakeClassifier(SCORES)
    decision = moderate([ATTACK], classifier)[0]
    assert decision["label"] == "toxicity"
    assert decision["score"] == 0.96


def test_sends_the_whole_batch_in_one_call():
    classifier = FakeClassifier(SCORES)
    moderate([ATTACK, BORDERLINE, CALM], classifier)
    assert classifier.calls == [[ATTACK, BORDERLINE, CALM]]


def test_thresholds_are_the_callers_to_set():
    classifier = FakeClassifier(SCORES)
    strict = moderate([BORDERLINE], classifier, {"block": 0.7, "review": 0.3})[0]
    lenient = moderate([BORDERLINE], classifier, {"block": 0.99, "review": 0.95})[0]
    assert strict["action"] == "block"
    assert lenient["action"] == "allow"


def test_an_unusable_row_goes_to_a_human_rather_than_through():
    # An empty mapping, and a score that is not a number: two shapes of the
    # same failure. Neither may end in "allow".
    classifier = FakeClassifier({ATTACK: {}, BORDERLINE: {"toxicity": "very"}})
    decisions = moderate([ATTACK, BORDERLINE], classifier)
    assert [d["action"] for d in decisions] == ["review", "review"]
    assert decisions[0]["score"] is None


def test_a_short_answer_raises_rather_than_misaligning_the_comments():
    class TruncatingClassifier:
        def predict(self, comments):
            return [{"toxicity": 0.99}]

    with pytest.raises(ModerationUnavailable):
        moderate([ATTACK, CALM], TruncatingClassifier())


def test_an_empty_batch_never_reaches_the_model():
    classifier = FakeClassifier(SCORES)
    assert moderate([], classifier) == []


def test_breaking_point_the_label_list_is_the_policy_you_get():
    """
    The breaking point of this rung: you inherit someone else's taxonomy.

    The model scores toxicity, insult and threat. A comment that publishes
    someone's home address, or that quietly organises a pile-on, is not any of
    those, so it scores low everywhere and is allowed. Nothing in the code is
    wrong; the harm simply has no label.

    Widening the policy here means fine-tuning and a labelled corpus of your
    own, which is the cost N2 is usually assumed not to have.
    """
    doxxing = "he lives at the corner of rue des Lilas by the way, go and say hello"
    classifier = FakeClassifier({doxxing: {"toxicity": 0.08, "insult": 0.03, "threat": 0.06}})
    assert moderate([doxxing], classifier)[0]["action"] == "allow"
