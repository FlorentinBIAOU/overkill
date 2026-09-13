"""
These tests inject a local double instead of calling a provider.

What they prove: the request is built correctly, the answer is decoded
correctly, oversized input is refused, failures are retried, and neither an
impossible date nor an unusable answer reaches the caller as if it were a fact.

What they do not prove: that the model reads dates well. That is why this
snippet is declared `verification: stubbed` on the entry, and why the page says
so next to the code.
"""

import json
from datetime import date

import pytest

from _harness.fake_llm import FakeLLM
from n3 import MAX_CHARACTERS, ExtractionUnavailable, extract_dates

TODAY = date(2024, 3, 12)


def test_decodes_what_the_model_reports():
    client = FakeLLM(response='[{"text": "12/03/2024", "date": "2024-03-12"}]')
    assert extract_dates("réunion le 12/03/2024", client=client, today=TODAY) == [
        ("12/03/2024", date(2024, 3, 12))
    ]


def test_reads_the_relative_dates_that_stop_n0():
    # This is what the rung buys, and the only reason it is on the entry.
    client = FakeLLM(response='[{"text": "jeudi prochain", "date": "2024-03-14"}]')
    assert extract_dates("on se voit jeudi prochain", client=client, today=TODAY) == [
        ("jeudi prochain", date(2024, 3, 14))
    ]


def test_sends_the_text_and_the_reference_day_in_the_prompt():
    client = FakeLLM(response="[]")
    extract_dates("on se voit jeudi prochain", client=client, today=TODAY)
    # Without a reference day, "jeudi prochain" cannot be resolved at all.
    assert "on se voit jeudi prochain" in client.last_request["prompt"]
    assert "2024-03-12" in client.last_request["prompt"]
    assert client.last_request["temperature"] == 0


def test_an_empty_result_is_an_empty_list():
    client = FakeLLM(response="[]")
    assert extract_dates("rien à signaler", client=client, today=TODAY) == []


def test_refuses_oversized_input_before_spending_anything():
    client = FakeLLM(response="[]")
    with pytest.raises(ValueError):
        extract_dates("x" * (MAX_CHARACTERS + 1), client=client, today=TODAY)
    assert client.call_count == 0


def test_retries_a_provider_failure():
    client = FakeLLM(response="[]", fail_times=2)
    extract_dates("hello", client=client, today=TODAY, attempts=3)
    assert client.call_count == 3


def test_breaking_point_a_confident_answer_the_calendar_refuses():
    """
    The breaking point of this rung: fluency is not correctness.

    The model can return 31 February in flawless JSON, and a date the model
    invented outright. Nothing in the answer marks either one as wrong, so the
    calendar check of N0 has to stay, here as well. Only the impossible day is
    dropped; the invented one gets through, and no amount of plumbing catches it.
    """
    client = FakeLLM(
        response=json.dumps(
            [
                {"text": "31 février 2024", "date": "2024-02-31"},
                {"text": "hier", "date": "2024-03-11"},
            ]
        )
    )
    assert extract_dates("31 février 2024, hier", client=client, today=TODAY) == [
        ("hier", date(2024, 3, 11))
    ]


def test_breaking_point_an_unusable_answer_raises_rather_than_returning_nothing():
    """
    Asked for JSON, the model can answer prose. Returning an empty list here
    would tell the caller that the text holds no date, which is a different
    statement, and a false one. It raises instead, and the caller decides.
    """
    client = FakeLLM(response="Sure! Here are the dates I found:")
    with pytest.raises(ExtractionUnavailable):
        extract_dates("réunion le 12/03/2024", client=client, today=TODAY)
