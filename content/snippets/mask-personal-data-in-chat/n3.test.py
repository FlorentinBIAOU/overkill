"""
These tests inject a local double instead of calling a provider.

What they prove: the request is built correctly, the answer is decoded
correctly, oversized input is refused, failures are retried, and an unusable
answer does not silently return the message unmasked.

What they do not prove: that the model finds the right things. That is why this
snippet is declared `verification: stubbed` on the entry, and why the page says
so next to the code.
"""

import json

import pytest

from _harness.fake_llm import FakeLLM
from n3 import MAX_CHARACTERS, MaskingUnavailable, mask


def test_masks_what_the_model_reports():
    client = FakeLLM(response='[{"text": "jean@example.com", "kind": "email"}]')
    assert mask("write to jean@example.com", client=client) == "write to [email]"


def test_sends_the_message_inside_the_prompt():
    client = FakeLLM(response="[]")
    mask("hello there", client=client)
    assert "hello there" in client.last_request["prompt"]
    # Temperature zero, because a masking decision that changes between two
    # identical calls cannot be reviewed.
    assert client.last_request["temperature"] == 0


def test_empty_result_leaves_the_message_untouched():
    client = FakeLLM(response="[]")
    assert mask("nothing to see here", client=client) == "nothing to see here"


def test_longest_match_is_replaced_first():
    client = FakeLLM(
        response=json.dumps(
            [
                {"text": "06", "kind": "phone"},
                {"text": "06 12 34 56 78", "kind": "phone"},
            ]
        )
    )
    assert mask("call 06 12 34 56 78", client=client) == "call [phone]"


def test_refuses_oversized_input_before_spending_anything():
    client = FakeLLM(response="[]")
    with pytest.raises(ValueError):
        mask("x" * (MAX_CHARACTERS + 1), client=client)
    assert client.call_count == 0


def test_retries_a_provider_failure():
    client = FakeLLM(response="[]", fail_times=2)
    mask("hello", client=client, attempts=3)
    assert client.call_count == 3


def test_breaking_point_an_unusable_answer_raises_rather_than_passing_through():
    """
    The breaking point claimed on the entry: the model can answer anything,
    including prose where JSON was asked for.

    The dangerous behaviour would be to shrug and return the message unmasked,
    which would leak the very data this function exists to remove. It raises
    instead, and the caller decides.
    """
    client = FakeLLM(response="Sure! Here are the details I found:")
    with pytest.raises(MaskingUnavailable):
        mask("call 06 12 34 56 78", client=client)
