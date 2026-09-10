"""
These tests inject a local double instead of calling a provider.

What they prove: the request is built with what the journal of rung N0 holds,
the answer is decoded, one call is made per refused row and not one more,
a failed call is retried, an unusable answer is recorded rather than swallowed,
and a repair that still does not coerce is refused again.

What they do not prove: that the model repairs a row correctly. It cannot be
proved here, and the last test shows exactly how little the code can do about
it. That is why this snippet is declared `verification: stubbed` on the entry,
and why the page says so next to the code.
"""

import json

from _harness.fake_llm import FakeLLM
from n0 import clean_csv
from n3 import repair_rejected_rows

HEADER = ["id", "name", "joined", "amount", "active"]
SCHEMA = {
    "id": "integer",
    "name": "text",
    "joined": "date",
    "amount": "number",
    "active": "boolean",
}

REJECT = {
    "line": 4,
    "column": "joined",
    "reason": "not a real date",
    "fields": ["3", "Carol", "31/02/2024", "3.5", "yes"],
}

GOOD_ANSWER = json.dumps(
    {"id": "3", "name": "Carol", "joined": "2024-03-02", "amount": "3.5", "active": "yes"}
)


def test_builds_a_request_carrying_the_column_the_reason_and_the_fields():
    client = FakeLLM(response="{}")
    repair_rejected_rows(HEADER, [REJECT], SCHEMA, client=client)
    prompt = client.last_request["prompt"]
    assert "- joined: date" in prompt  # the type the column expects
    assert "not a real date" in prompt  # why rung N0 refused it
    assert "31/02/2024" in prompt  # the fields exactly as they were read
    # Temperature zero, because a repair that changes between two identical
    # calls cannot be reviewed.
    assert client.last_request["temperature"] == 0


def test_decodes_the_answer_and_puts_it_back_through_the_coercion_of_n0():
    client = FakeLLM(response=GOOD_ANSWER)
    result = repair_rejected_rows(HEADER, [REJECT], SCHEMA, client=client)
    assert result["unrepairable"] == []
    assert result["rows"] == [
        {
            "id": 3,
            "name": "Carol",
            "joined": "2024-03-02",
            "amount": 3.5,
            "active": True,
        }
    ]


def test_one_call_per_refused_row_and_none_for_the_rest():
    """
    This is the whole argument for putting a model on this rung at all.

    Six data rows, two of which rung N0 refused. Two calls are made, not six.
    On a file of a hundred thousand rows the ratio is what decides whether
    this rung is affordable or absurd.
    """
    data = (
        "id,name,joined,amount,active\n"
        "1,Alice,2024-01-09,1.0,yes\n"
        "2,Bob,2024-01-10,2.0,no\n"
        "3,Carol,31/02/2024,3.5,yes\n"  # refused
        "4,Dan,2024-01-12,4.0,no\n"
        "5,Eve,2024-01-13,nought,yes\n"  # refused
        "6,Frank,2024-01-14,6.0,no\n"
    ).encode("utf-8")
    cleaned = clean_csv(data, SCHEMA)
    assert len(cleaned["rows"]) == 4 and len(cleaned["rejects"]) == 2

    client = FakeLLM(response=GOOD_ANSWER)
    repair_rejected_rows(cleaned["columns"], cleaned["rejects"], SCHEMA, client=client)
    assert client.call_count == len(cleaned["rejects"])
    assert client.call_count < len(cleaned["rows"])


def test_retries_a_provider_failure():
    client = FakeLLM(response=GOOD_ANSWER, fail_times=2)
    result = repair_rejected_rows(HEADER, [REJECT], SCHEMA, client=client, attempts=3)
    assert client.call_count == 3
    assert len(result["rows"]) == 1


def test_an_unusable_answer_is_recorded_rather_than_swallowed():
    # The model can answer anything, including prose where JSON was asked for.
    client = FakeLLM(response="Of course! Here is the corrected row:")
    result = repair_rejected_rows(HEADER, [REJECT], SCHEMA, client=client)
    assert result["rows"] == []
    refused = result["unrepairable"][0]
    assert refused["line"] == 4 and refused["fields"] == REJECT["fields"]
    assert refused["reason"] == "the model did not return a usable object"
    # One call, not three: at temperature zero, asking again returns the same
    # prose and costs the same money.
    assert client.call_count == 1


def test_a_repair_that_still_does_not_coerce_is_refused_again():
    client = FakeLLM(
        response=json.dumps(
            {
                "id": "3",
                "name": "Carol",
                "joined": "the second of March",
                "amount": "3.5",
                "active": "yes",
            }
        )
    )
    result = repair_rejected_rows(HEADER, [REJECT], SCHEMA, client=client)
    assert result["rows"] == []
    refused = result["unrepairable"][0]
    assert refused["column"] == "joined"
    assert refused["reason"] == "the repair was refused too: not a date"


def test_breaking_point_a_well_formed_invention_passes_without_resistance():
    """
    The dangerous answer is not the malformed one. It is the one that is
    perfectly shaped and wrong.

    The refused row said "in the spring" where a date was expected. The model
    answers with a date in the right format; it coerces; it lands among the
    clean rows with nothing to tell it apart from a value that was actually in
    the file. No check here can catch that, because a date is a date.

    Keep the journal, keep the original fields, and let a human look at what
    was invented. That is all this rung can honestly offer.
    """
    reject = {
        "line": 9,
        "column": "joined",
        "reason": "not a date",
        "fields": ["7", "Zoe", "in the spring", "3.5", "yes"],
    }
    client = FakeLLM(
        response=json.dumps(
            {"id": "7", "name": "Zoe", "joined": "2024-03-01", "amount": "3.5", "active": "yes"}
        )
    )
    result = repair_rejected_rows(HEADER, [reject], SCHEMA, client=client)

    assert result["unrepairable"] == []
    assert result["rows"][0]["joined"] == "2024-03-01"
    # Nothing in the file ever said the first of March.
    assert "2024-03-01" not in reject["fields"]
