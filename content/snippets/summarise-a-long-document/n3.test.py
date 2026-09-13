"""
These tests inject a local double instead of calling a provider.

What they prove: the document reaches the prompt, the sentence budget reaches
the prompt, the answer is decoded, an oversized document is refused before
anything is spent, a provider failure is retried, and an answer of the wrong
shape raises instead of returning a silently empty summary.

What they do not prove: that the summary is true of the document. The last test
shows how far that goes. This snippet is declared `verification: stubbed` on
the entry, and the page says so next to the code.
"""

import json

import pytest

from _harness.fake_llm import FakeLLM
from n3 import MAX_CHARACTERS, SummaryUnavailable, summarise

REPORT = (
    "The support team migrated the ticketing system to a new platform in March. "
    "Every agent was trained during the two weeks before the switch. "
    "The old platform stayed available in read-only mode for a month afterwards."
)

ANSWER = json.dumps(
    {
        "summary": "The ticketing system moved to a new platform in March.",
        "key_points": ["agents trained beforehand", "old platform kept read-only"],
    }
)


def test_decodes_the_summary_and_the_key_points():
    client = FakeLLM(response=ANSWER)
    result = summarise(REPORT, client=client)
    assert result["summary"] == "The ticketing system moved to a new platform in March."
    assert result["key_points"] == ["agents trained beforehand", "old platform kept read-only"]


def test_sends_the_document_and_the_sentence_budget_in_the_prompt():
    client = FakeLLM(response=ANSWER)
    summarise(REPORT, client=client, max_sentences=5)
    prompt = client.last_request["prompt"]
    assert REPORT in prompt
    assert "at most 5 sentences" in prompt
    assert client.last_request["temperature"] == 0


def test_key_points_default_to_an_empty_list():
    client = FakeLLM(response=json.dumps({"summary": "One line."}))
    assert summarise(REPORT, client=client) == {"summary": "One line.", "key_points": []}


def test_an_empty_document_costs_nothing():
    client = FakeLLM(response=ANSWER)
    assert summarise("", client=client) == {"summary": "", "key_points": []}
    assert summarise("   \n ", client=client) == {"summary": "", "key_points": []}
    assert client.call_count == 0


def test_refuses_an_oversized_document_before_spending_anything():
    client = FakeLLM(response=ANSWER)
    with pytest.raises(ValueError):
        summarise("x" * (MAX_CHARACTERS + 1), client=client)
    assert client.call_count == 0


def test_retries_a_provider_failure():
    client = FakeLLM(response=ANSWER, fail_times=2)
    summarise(REPORT, client=client, attempts=3)
    assert client.call_count == 3


def test_prose_where_json_was_asked_for_raises():
    client = FakeLLM(response="Sure! Here is a summary of your document:")
    with pytest.raises(SummaryUnavailable):
        summarise(REPORT, client=client)


def test_valid_json_of_the_wrong_shape_raises():
    """
    The awkward case: the answer parses, so a naive `json.loads` is happy, and
    the caller would get a summary that is silently empty.
    """
    for wrong in ("[]", '{"key_points": ["a", "b"]}', '{"summary": "   "}',
                  '{"summary": "fine", "key_points": "a, b"}'):
        client = FakeLLM(response=wrong)
        with pytest.raises(SummaryUnavailable):
            summarise(REPORT, client=client, attempts=1)


def test_breaking_point_the_model_writes_what_the_document_does_not_say():
    """
    The risk this rung buys, and the one nothing in n3.py catches.

    The prompt says "use only what the document says". That is a request,
    not a constraint: the answer the double is told to give below is
    well-formed JSON, the right shape, the right length, fluent, and it states
    a figure and a decision that appear nowhere in the document.

    Every check in n3.py passes, because every check in n3.py is about shape.
    Whether a summary follows from its source is a question about meaning, and
    no amount of parsing answers it. If that matters for your use, the answer
    is not a better prompt: it is a human reading the source next to the
    summary, or a rung that cannot invent, which is what N0 and N1 are for.
    """
    client = FakeLLM(
        response=json.dumps(
            {
                "summary": "The migration cut ticket handling time by a third,"
                " and the board approved a second phase for the autumn.",
                "key_points": ["a third faster", "second phase approved"],
            }
        )
    )
    result = summarise(REPORT, client=client)

    # It came back clean, and it is not in the document.
    assert "board" in result["summary"]
    assert "board" not in REPORT
    assert "third" not in REPORT
