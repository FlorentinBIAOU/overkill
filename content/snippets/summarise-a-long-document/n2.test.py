"""
These tests inject a local double instead of loading a model.

What they prove: the document is cut into pieces the model can read, at
sentence boundaries, with nothing lost between them; the two passes are wired
together correctly; oversized input is refused before any work is done; a
failed call is retried; and an empty answer raises rather than leaving a silent
hole in the middle of the summary.

What they do not prove: that the model writes a good summary, or a true one.
The last test below shows exactly how far that goes. This snippet is declared
`verification: stubbed` on the entry, and the page says so next to the code.
"""

import pytest

from _harness.fake_model import FakeSeq2Seq
from n2 import MAX_CHARACTERS, SummaryUnavailable, chunk, summarise

REPORT = (
    "The support team migrated the ticketing system to a new platform in March. "
    "Every agent was trained during the two weeks before the switch. "
    "The old platform stayed available in read-only mode for a month afterwards."
)

# Long enough to need several passes of the model.
LONG = " ".join(f"Paragraph {i} describes another part of the warehouse." for i in range(120))


class FlakySeq2Seq(FakeSeq2Seq):
    """The harness double, with its first calls failing, as a real one does."""

    def __init__(self, outputs, fail_times, default=""):
        super().__init__(outputs, default)
        self._fail_times = fail_times

    def generate(self, text, **kwargs):
        if self._fail_times > 0:
            self._fail_times -= 1
            self.calls.append(text)
            raise RuntimeError("simulated model failure")
        return super().generate(text, **kwargs)


def test_returns_what_the_model_wrote():
    model = FakeSeq2Seq({REPORT: "The ticketing system was migrated in March."})
    assert summarise(REPORT, model=model) == "The ticketing system was migrated in March."


def test_a_short_document_is_sent_in_one_piece():
    model = FakeSeq2Seq({}, default="a summary")
    summarise(REPORT, model=model)
    assert model.calls == [REPORT]


def test_chunks_are_cut_at_sentence_boundaries_and_lose_nothing():
    pieces = chunk(LONG, size=400)
    assert len(pieces) > 1
    for piece in pieces:
        assert len(piece) <= 400
        assert piece.endswith(".")
    assert " ".join(pieces) == LONG


def test_a_sentence_longer_than_the_window_is_passed_whole():
    """Documented behaviour: cutting mid-clause would be worse."""
    one_long_sentence = " ".join(["word"] * 200) + "."
    assert chunk(one_long_sentence, size=100) == [one_long_sentence]


def test_a_long_document_is_summarised_in_two_passes():
    pieces = chunk(LONG)
    notes = {piece: f"note about part {i}" for i, piece in enumerate(pieces)}
    second_pass = " ".join(notes[piece] for piece in pieces)
    model = FakeSeq2Seq({**notes, second_pass: "the whole warehouse, in one line"})

    assert summarise(LONG, model=model) == "the whole warehouse, in one line"
    # One call per piece, then one on the notes the model itself wrote.
    assert model.calls == [*pieces, second_pass]


def test_an_empty_document_costs_nothing():
    model = FakeSeq2Seq({}, default="a summary")
    assert summarise("", model=model) == ""
    assert summarise("   \n  ", model=model) == ""
    assert model.calls == []


def test_a_single_sentence_document_still_goes_through_the_model():
    model = FakeSeq2Seq({}, default="rewritten")
    assert summarise("The plant will close.", model=model) == "rewritten"


def test_refuses_an_oversized_document_before_doing_any_work():
    model = FakeSeq2Seq({}, default="a summary")
    with pytest.raises(ValueError):
        summarise("x" * (MAX_CHARACTERS + 1), model=model)
    assert model.calls == []


def test_retries_a_failed_call():
    model = FlakySeq2Seq({REPORT: "a summary"}, fail_times=1)
    assert summarise(REPORT, model=model, attempts=2) == "a summary"
    assert len(model.calls) == 2


def test_gives_up_when_every_attempt_fails():
    model = FlakySeq2Seq({REPORT: "a summary"}, fail_times=5)
    with pytest.raises(SummaryUnavailable):
        summarise(REPORT, model=model, attempts=3)
    assert len(model.calls) == 3


def test_an_empty_answer_raises_rather_than_leaving_a_hole():
    """
    Returning the empty string would put a gap in the middle of a multi-pass
    summary that nobody would ever notice.
    """
    model = FakeSeq2Seq({}, default="   ")
    with pytest.raises(SummaryUnavailable):
        summarise(REPORT, model=model)


def test_breaking_point_the_model_writes_what_the_document_does_not_say():
    """
    The risk this rung buys, and the one nothing in n2.py catches.

    An abstractive model writes new sentences. That is exactly why it can state
    a conclusion drawn from two passages ten pages apart, which N0 and N1
    cannot. It is also why it can state one the document does not support.

    Below, the double is told to answer each of two summaries of the same
    document. One follows from it, the other is invented: neither April nor a
    move to Rouen appears anywhere in the source. The function returns both,
    identically, without a warning, because the only thing it can check about
    an answer is that it is not empty. Checking that a summary is entailed by
    its source is a different problem, and no amount of plumbing here solves
    it. What this test shows is what the plumbing lets through, not what a real
    model writes.
    """
    document = (
        "The Rouen plant supplies every battery cell used on the Lyon assembly line. "
        "The Rouen plant will close at the end of March."
    )
    supported = "The Lyon assembly line will stop when Rouen closes at the end of March."
    invented = "The Lyon assembly line will move to Rouen in April."

    assert summarise(document, model=FakeSeq2Seq({}, default=supported)) == supported
    assert summarise(document, model=FakeSeq2Seq({}, default=invented)) == invented

    assert "April" not in document
    assert invented not in document
