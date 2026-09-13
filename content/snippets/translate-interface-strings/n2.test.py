"""
These tests inject a local double instead of loading a translation model.

What they prove: the variables are hidden before the model sees the string,
the markers are put back afterwards, a moved variable is accepted, a lost or
rewritten one is reported rather than shipped, a failed call is retried, and
an empty answer raises instead of returning a blank interface string.

What they do not prove: that the model translates well. That is why this
snippet is declared `verification: stubbed` on the entry, and why the page
says so next to the code.
"""

import pytest

from _harness.fake_model import FakeSeq2Seq
from n2 import TranslationUnavailable, translate


class FlakySeq2Seq(FakeSeq2Seq):
    """A model that dies on its first calls, the way a real worker does."""

    def __init__(self, outputs, fail_times=1):
        super().__init__(outputs)
        self.fail_times = fail_times

    def generate(self, text, **kwargs):
        if self.fail_times > 0:
            self.fail_times -= 1
            self.calls.append(text)
            raise RuntimeError("the model worker died")
        return super().generate(text, **kwargs)


def test_translates_a_plain_string():
    model = FakeSeq2Seq({"Save changes": "Enregistrer les modifications"})
    result = translate("Save changes", model=model)
    assert result["target"] == "Enregistrer les modifications"
    assert result["review"] is False
    assert result["warnings"] == []


def test_the_model_never_sees_the_variable():
    """Request building: a variable is hidden behind a marker, then restored."""
    model = FakeSeq2Seq({"⟦0⟧ items selected": "⟦0⟧ éléments sélectionnés"})
    result = translate("{count} items selected", model=model)
    assert model.calls == ["⟦0⟧ items selected"]
    assert "{count}" not in model.calls[0]
    assert result["target"] == "{count} éléments sélectionnés"
    assert result["review"] is False


def test_a_moved_variable_is_the_models_job_not_a_fault():
    model = FakeSeq2Seq({"Delete ⟦0⟧ of ⟦1⟧": "Sur ⟦1⟧, supprimer ⟦0⟧"})
    result = translate("Delete {count} of {total}", model=model)
    assert result["target"] == "Sur {total}, supprimer {count}"
    assert result["review"] is False


def test_retries_a_model_that_failed():
    model = FlakySeq2Seq({"Save": "Enregistrer"}, fail_times=1)
    assert translate("Save", model=model, attempts=2)["target"] == "Enregistrer"
    assert len(model.calls) == 2


def test_an_empty_answer_raises_rather_than_blanking_the_interface():
    model = FakeSeq2Seq({}, default="   ")
    with pytest.raises(TranslationUnavailable):
        translate("Save", model=model, attempts=2)
    assert len(model.calls) == 2


def test_an_empty_source_is_not_worth_a_call():
    model = FakeSeq2Seq({})
    assert translate("", model=model)["target"] == ""
    assert model.calls == []


def test_breaking_point_a_lost_variable_is_caught_not_shipped():
    """
    The breaking point of a model that reads a variable as text: it can drop
    the marker entirely. The result would be a French sentence with no number
    in it, and nobody reading English would ever notice.

    The snippet cannot stop the model from doing it. It can refuse to call the
    result finished, which is what is asserted here.
    """
    model = FakeSeq2Seq({"⟦0⟧ items selected": "Des éléments sélectionnés"})
    result = translate("{count} items selected", model=model)
    assert result["review"] is True
    assert result["warnings"] == [
        "variables differ from the source: expected {count}, got none"
    ]


def test_breaking_point_an_invented_variable_is_caught_too():
    """
    The other way it breaks: the answer carries a brace the source never had.

    The model is shown ⟦0⟧, never `{count}`, so it cannot translate the
    variable name. It can still produce something brace-shaped, and the
    interface would then print that brace. The same check catches it.
    """
    model = FakeSeq2Seq({"⟦0⟧ items selected": "{compte} éléments sélectionnés"})
    result = translate("{count} items selected", model=model)
    assert result["review"] is True
    assert "expected {count}, got {compte}" in result["warnings"][0]
