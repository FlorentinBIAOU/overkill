"""
These tests inject a local double instead of calling a provider.

What they prove: the interface context and the variables really travel in the
request, the answer is decoded, oversized input is refused before anything is
spent, failures are retried, an unusable answer raises instead of being
mistaken for a translation, and a rewritten variable is reported.

What they do not prove: that the model translates well, or that the context
changes anything to its answer. That is why this snippet is declared
`verification: stubbed` on the entry, and why the page says so.
"""

import pytest

from _harness.fake_llm import FakeLLM
from n3 import MAX_CHARACTERS, TranslationUnavailable, translate


def test_translates_what_the_model_answers():
    client = FakeLLM(response={"translation": "Enregistrer les modifications"})
    result = translate("Save changes", "French", context="button label", client=client)
    assert result["target"] == "Enregistrer les modifications"
    assert result["review"] is False
    assert result["warnings"] == []


def test_the_interface_context_travels_with_the_string():
    """The whole reason for this rung: the model is told where the string sits."""
    client = FakeLLM(response={"translation": "Enregistrer"})
    translate("Save", "French", context="button label, next to Cancel", client=client)
    prompt = client.last_request["prompt"]
    assert "button label, next to Cancel" in prompt
    assert "French" in prompt
    assert prompt.endswith("Save")
    # Temperature zero: the same string must not be translated two ways in the
    # same interface.
    assert client.last_request["temperature"] == 0


def test_the_variables_are_listed_in_the_request():
    client = FakeLLM(response={"translation": "{count} éléments sélectionnés"})
    translate("{count} items selected", "French", client=client)
    assert "exactly as written: {count}" in client.last_request["prompt"]


def test_a_missing_context_is_said_to_be_missing_rather_than_left_blank():
    client = FakeLLM(response={"translation": "Enregistrer"})
    translate("Save", "French", client=client)
    assert "Where it appears in the interface: not given" in client.last_request["prompt"]


def test_a_moved_variable_is_accepted():
    client = FakeLLM(response={"translation": "Éléments sélectionnés : {count}"})
    assert translate("{count} items selected", "French", client=client)["review"] is False


def test_refuses_oversized_input_before_spending_anything():
    client = FakeLLM(response={"translation": "x"})
    with pytest.raises(ValueError):
        translate("x" * (MAX_CHARACTERS + 1), "French", client=client)
    assert client.call_count == 0


def test_retries_a_provider_failure():
    client = FakeLLM(response={"translation": "Enregistrer"}, fail_times=2)
    assert translate("Save", "French", client=client, attempts=3)["target"] == "Enregistrer"
    assert client.call_count == 3


def test_an_answer_without_a_translation_raises():
    client = FakeLLM(response={"note": "I am not sure what you mean"})
    with pytest.raises(TranslationUnavailable):
        translate("Save", "French", client=client)


def test_breaking_point_prose_where_json_was_asked_for():
    """
    A general-purpose model answers whatever it likes, including a polite
    sentence around the translation. Returning that sentence as the label of a
    button is worse than returning nothing, so it raises and the caller
    decides.
    """
    client = FakeLLM(response='Sure! In French, Save is "Enregistrer".')
    with pytest.raises(TranslationUnavailable):
        translate("Save", "French", client=client)


def test_breaking_point_asking_for_the_variables_is_not_keeping_them():
    """
    The request says to keep `{count}` exactly as written. The model translated
    it anyway. Nothing in the prompt can prevent that, which is precisely why
    the answer is checked rather than trusted.
    """
    client = FakeLLM(response={"translation": "{compte} éléments sélectionnés"})
    result = translate("{count} items selected", "French", client=client)
    assert result["review"] is True
    assert result["warnings"] == ["the model did not keep the interpolation variables"]
