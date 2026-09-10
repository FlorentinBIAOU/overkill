"""
These tests inject a local double instead of calling a provider.

What they prove: the request carries the comment and the categories, the
answer is decoded, the thresholds are honoured, an oversized comment is
refused before anything is spent, a failure is retried, and an unusable answer
raises instead of becoming a decision.

What they do not prove: that the provider judges comments well. That is why
this snippet is declared `verification: stubbed` on the entry, and why the
page says so next to the code.
"""

import json

import pytest

from _harness.fake_llm import FakeLLM
from n3 import CATEGORIES, MAX_CHARACTERS, ModerationUnavailable, moderate

ATTACK = "get off this forum you blorptard"
CALM = "the diagram is much clearer than the text"


def scored(**values):
    return json.dumps({name: values.get(name, 0.0) for name in CATEGORIES})


def test_blocks_what_the_endpoint_scores_high():
    client = FakeLLM(response=scored(harassment=0.97))
    decision = moderate(ATTACK, client=client)
    assert decision["action"] == "block"
    assert decision["category"] == "harassment"


def test_allows_what_it_scores_low():
    client = FakeLLM(response=scored())
    assert moderate(CALM, client=client)["action"] == "allow"


def test_sends_the_comment_and_the_categories_at_temperature_zero():
    client = FakeLLM(response=scored())
    moderate(ATTACK, client=client)
    prompt = client.last_request["prompt"]
    assert ATTACK in prompt
    assert all(name in prompt for name in CATEGORIES)
    # Temperature zero, because a moderation decision that changes between two
    # identical calls cannot be explained to the person it was applied to.
    assert client.last_request["temperature"] == 0


def test_thresholds_are_the_callers_to_set():
    client = FakeLLM(response=scored(harassment=0.7))
    assert moderate(ATTACK, client=client)["action"] == "review"
    assert moderate(ATTACK, client=client, thresholds={"block": 0.5, "review": 0.2})["action"] == "block"


def test_ignores_invented_categories_and_scores_out_of_range():
    client = FakeLLM(response=json.dumps({"harassment": 0.4, "sarcasm": 0.99, "hate": 7.5}))
    decision = moderate(ATTACK, client=client)
    assert decision["scores"] == {"harassment": 0.4}


def test_refuses_an_oversized_comment_before_spending_anything():
    client = FakeLLM(response=scored())
    with pytest.raises(ValueError):
        moderate("x" * (MAX_CHARACTERS + 1), client=client)
    assert client.call_count == 0


def test_retries_a_provider_failure():
    client = FakeLLM(response=scored(), fail_times=2)
    moderate(CALM, client=client, attempts=3)
    assert client.call_count == 3


def test_an_unusable_answer_raises_rather_than_allowing_the_comment():
    # Prose where JSON was asked for. Shrugging and returning "allow" would
    # publish everything the provider fails to answer about.
    client = FakeLLM(response="Sure! This comment looks a bit rude to me.")
    with pytest.raises(ModerationUnavailable):
        moderate(ATTACK, client=client)


def test_breaking_point_the_score_is_asserted_not_measured():
    """
    The breaking point of this rung: the number is the provider's opinion, and
    the code has nothing to check it against.

    Here a plainly harmless comment comes back scored as harassment, and the
    function blocks it, correctly by its own logic. There is no feature to
    inspect, no weight to print, and no answer to give the user beyond the
    provider's number. The endpoint changes on their schedule, not yours.
    """
    client = FakeLLM(response=scored(harassment=0.95))
    decision = moderate(CALM, client=client)
    assert decision["action"] == "block"
    assert decision["scores"]["harassment"] == 0.95
