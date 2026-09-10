"""
These tests inject a local double instead of calling a provider.

What they prove: the request is built correctly, only an excerpt is sent, the
answer is decoded and normalised correctly, oversized input is refused,
failures are retried, and an unusable answer does not become a language code.

What they do not prove: that the model names the right language. That is why
this snippet is declared `verification: stubbed` on the entry, and why the
page says so next to the code.
"""

import json

import pytest

from _harness.fake_llm import FakeLLM
from n3 import EXCERPT_CHARACTERS, MAX_CHARACTERS, PROMPT, DetectionUnavailable, detect

LANGUAGES = ("fr", "en", "es")


def test_returns_the_code_the_model_reports():
    client = FakeLLM(response='{"language": "fr", "confidence": 0.98}')
    assert detect("La réunion de lundi est reportée.", LANGUAGES, client=client) == "fr"


def test_sends_the_text_and_the_allowed_list_at_temperature_zero():
    client = FakeLLM(response='{"language": "es"}')
    detect("La reunión del lunes.", LANGUAGES, client=client)
    prompt = client.last_request["prompt"]
    assert "La reunión del lunes." in prompt
    assert "en, es, fr" in prompt
    assert client.last_request["temperature"] == 0


def test_sends_only_an_excerpt_of_a_long_document():
    # A language is decided in the first few sentences. The rest is paid for
    # and thrown away.
    client = FakeLLM(response='{"language": "en"}')
    document = "The meeting is on Monday. " * 200 + "and the last line is never read"
    detect(document, LANGUAGES, client=client)
    prompt = client.last_request["prompt"]
    assert "The meeting is on Monday." in prompt
    assert "and the last line is never read" not in prompt
    assert len(prompt) < len(PROMPT) + EXCERPT_CHARACTERS + 40


def test_normalises_the_shapes_a_model_writes_a_code_in():
    for written in ("fr", "FR", " fr ", "fr-CA"):
        client = FakeLLM(response=json.dumps({"language": written}))
        assert detect("Bonjour à tous.", LANGUAGES, client=client) == "fr", written


def test_none_when_the_model_says_it_is_none_of_them():
    client = FakeLLM(response='{"language": "und", "confidence": 0.4}')
    assert detect("Der Zug kam zu spät an.", LANGUAGES, client=client) is None


def test_refuses_oversized_input_before_spending_anything():
    client = FakeLLM(response='{"language": "en"}')
    with pytest.raises(ValueError):
        detect("x" * (MAX_CHARACTERS + 1), LANGUAGES, client=client)
    assert client.call_count == 0


def test_retries_a_provider_failure():
    client = FakeLLM(response='{"language": "en"}', fail_times=2)
    detect("The meeting is on Monday.", LANGUAGES, client=client, attempts=3)
    assert client.call_count == 3


def test_breaking_point_an_unusable_answer_never_becomes_a_language_code():
    """
    The breaking point claimed on the entry: the model can answer anything,
    including prose where JSON was asked for, and a language that was not on
    the list it was given.

    The dangerous behaviour would be to shrug and return a plausible-looking
    code, which downstream would route a message to the wrong team without a
    trace. It raises instead, and the caller decides.
    """
    prose = FakeLLM(response="The text appears to be written in French.")
    with pytest.raises(DetectionUnavailable):
        detect("Bonjour à tous.", LANGUAGES, client=prose)

    off_list = FakeLLM(response='{"language": "it", "confidence": 0.99}')
    with pytest.raises(DetectionUnavailable):
        detect("Bonjour à tous.", LANGUAGES, client=off_list)


def test_breaking_point_the_confidence_is_written_by_the_model_not_measured():
    """
    The second half of the same breaking point, and the more expensive one:
    nothing in this code can tell a right answer from a wrong one.

    Here the model answers Spanish, with a self-reported confidence of
    ninety-nine per cent, on a sentence that is plainly French. The snippet
    validates the shape, finds it perfect, and hands the wrong code back.

    N0 and N1 can be measured against a labelled set on your own machine.
    This cannot be, which is what `verification: stubbed` means on the entry.
    """
    client = FakeLLM(response='{"language": "es", "confidence": 0.99}')
    assert detect("Bonjour à tous, la réunion de lundi est reportée.", LANGUAGES, client=client) == "es"
