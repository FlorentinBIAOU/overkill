"""
These tests inject a local double instead of calling a provider.

What they prove: the request is built correctly, the answer is decoded
correctly, an oversized batch is refused before anything is spent, failures are
retried, and an answer that does not respect the request is rejected instead of
being handed to the caller as data.

What they do not prove: that the model writes anything worth reading. That is
why this snippet is declared `verification: stubbed` on the entry, and why the
page says so next to the code.
"""

import json

import pytest

from _harness.fake_llm import FakeLLM
from n3 import MAX_ROWS, GenerationUnavailable, build_prompt, write_rows

FIELDS = ["display_name", "job_title", "support_message"]

# What a well-behaved answer looks like. Every value is invented and matches no
# real person.
TWO_ROWS = json.dumps(
    [
        {
            "display_name": "Iris Fontaine",
            "job_title": "warehouse supervisor",
            "support_message": "the label printer stopped mid batch, do i reprint the whole lot?",
        },
        {
            "display_name": "Marek Villeneuve",
            "job_title": "night dispatcher",
            "support_message": "Can't log in since the update. Tried twice. Second time it froze.",
        },
    ]
)


def test_returns_the_rows_the_model_wrote():
    client = FakeLLM(response=TWO_ROWS)
    rows = write_rows(FIELDS, 2, unique_field="display_name", client=client)
    assert [row["display_name"] for row in rows] == ["Iris Fontaine", "Marek Villeneuve"]
    assert rows[0]["support_message"].startswith("the label printer")


def test_asks_for_what_it_checks():
    client = FakeLLM(response=TWO_ROWS)
    write_rows(FIELDS, 2, unique_field="display_name", client=client)
    prompt = client.last_request["prompt"]
    for field in FIELDS:
        assert field in prompt
    assert "2 rows" in prompt
    assert "display_name" in build_prompt(FIELDS, 2, "display_name")
    # Varied prose is the only reason to be on this rung, so the temperature is
    # not zero here, unlike every other snippet that calls a model.
    assert client.last_request["temperature"] > 0


def test_refuses_an_oversized_batch_before_spending_anything():
    client = FakeLLM(response=TWO_ROWS)
    with pytest.raises(ValueError):
        write_rows(FIELDS, MAX_ROWS + 1, client=client)
    with pytest.raises(ValueError):
        write_rows(FIELDS, 0, client=client)
    assert client.call_count == 0


def test_retries_a_provider_failure():
    client = FakeLLM(response=TWO_ROWS, fail_times=2)
    write_rows(FIELDS, 2, unique_field="display_name", client=client, attempts=3)
    assert client.call_count == 3


def test_an_unusable_answer_raises_rather_than_returning_nothing():
    # Prose where JSON was asked for. Returning an empty list here would leave
    # a suite running against no data at all, and passing.
    client = FakeLLM(response="Of course! Here are two fictional support tickets:")
    with pytest.raises(GenerationUnavailable):
        write_rows(FIELDS, 2, client=client)


def test_breaking_point_the_model_respects_neither_the_schema_nor_uniqueness():
    """
    The risk this rung carries: the answer is plausible and wrong.

    Both answers below are valid JSON, and both would slip through a decoder
    that only calls `json.loads`. The first renamed a key and dropped a row;
    the second gave two rows the same name, which would turn a test about
    duplicate accounts into a test that always passes.

    The code checks it itself, because nothing upstream will. The call count
    shows it retried and then refused, rather than returning what it got.
    """
    renamed = json.dumps([{"name": "Iris Fontaine", "job_title": "supervisor"}])
    client = FakeLLM(response=renamed)
    with pytest.raises(GenerationUnavailable):
        write_rows(FIELDS, 2, unique_field="display_name", client=client, attempts=2)
    assert client.call_count == 2

    repeated = json.dumps([dict(json.loads(TWO_ROWS)[0], job_title="clerk")] * 2)
    client = FakeLLM(response=repeated)
    with pytest.raises(GenerationUnavailable):
        write_rows(FIELDS, 2, unique_field="display_name", client=client, attempts=2)

    # Without the uniqueness requirement the very same answer is accepted: the
    # check exists because the caller asked for it, not because the model did.
    accepted = write_rows(FIELDS, 2, client=FakeLLM(response=repeated))
    assert accepted[0]["display_name"] == accepted[1]["display_name"]
