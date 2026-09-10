"""
These tests inject a local double instead of running a real engine.

What they prove: the engine is called with the page it was given, the reading
is decoded and cleaned, a low confidence sends the page to a human without
losing the text, a failed call is retried, and an answer that is not a reading
never passes for one.

What they do not prove: that the engine reads the pixels correctly. That is
why this snippet is declared `verification: stubbed` on the entry, and why the
page says so next to the code.
"""

import pytest

from _harness.fake_model import FakeOCR
from n2 import OCRUnavailable, clean, read_page

PAGE = "scan-page-1.png"

# What an engine gives back on a clean office scan: the text, with the ragged
# spacing of a page that was photographed rather than typeset.
READING = (
    "NORD FOURNITURES SAS\n"
    "   N° 2024-000431\n"
    "\n"
    "   Émise le 3 avril 2024\n"
    "NET A PAYER    92,40 EUR\n"
)


class FlakyEngine:
    """An engine that drops a call, the way a busy worker process does."""

    def __init__(self, engine, failures: int = 1):
        self.engine = engine
        self.failures = failures

    def read(self, image_path):
        if self.failures > 0:
            self.failures -= 1
            raise RuntimeError("the worker was not ready")
        return self.engine.read(image_path)


def test_reads_the_page():
    result = read_page(PAGE, FakeOCR({PAGE: READING}, confidence=0.94))
    assert result["text"].splitlines() == [
        "NORD FOURNITURES SAS",
        "N° 2024-000431",
        "Émise le 3 avril 2024",
        "NET A PAYER 92,40 EUR",
    ]
    assert result["confidence"] == 0.94
    assert result["review"] is False


def test_hands_the_engine_the_page_it_was_given():
    engine = FakeOCR({PAGE: READING})
    read_page(PAGE, engine)
    assert engine.calls == [PAGE]


def test_rejoins_a_word_the_scan_cut_in_two():
    # A word broken at the end of a line comes back with its hyphen. Left
    # alone, « exemplaire » is two tokens no search will ever match.
    engine = FakeOCR({PAGE: "un second exem-\nplaire de la facture"})
    assert read_page(PAGE, engine)["text"] == "un second exemplaire de la facture"


def test_a_low_confidence_keeps_the_text_and_asks_for_a_human():
    # A faint fax, read badly but not uselessly. The text is still the best
    # thing anyone has; what changes is that nobody files it unread.
    engine = FakeOCR({PAGE: READING}, confidence=0.41)
    result = read_page(PAGE, engine)
    assert "NORD FOURNITURES SAS" in result["text"]
    assert result["confidence"] == 0.41
    assert result["review"] is True


def test_a_blank_page_is_flagged_however_sure_the_engine_is():
    engine = FakeOCR({}, confidence=0.99)
    assert read_page(PAGE, engine) == {"text": "", "confidence": 0.99, "review": True}


def test_a_confidence_that_is_not_a_number_is_not_a_confidence():
    engine = FakeOCR({PAGE: READING}, confidence="high")
    result = read_page(PAGE, engine)
    assert result["confidence"] == 0.0
    assert result["review"] is True


def test_retries_a_failed_call():
    engine = FlakyEngine(FakeOCR({PAGE: READING}))
    assert "NORD FOURNITURES SAS" in read_page(PAGE, engine)["text"]


def test_gives_up_after_the_last_attempt():
    engine = FlakyEngine(FakeOCR({PAGE: READING}), failures=5)
    with pytest.raises(OCRUnavailable):
        read_page(PAGE, engine, attempts=2)


def test_an_answer_that_is_not_a_reading_raises():
    class TalkativeEngine:
        def read(self, image_path):
            return "NORD FOURNITURES SAS"

    with pytest.raises(OCRUnavailable):
        read_page(PAGE, TalkativeEngine())


def test_cleaning_an_empty_reading_stays_empty():
    assert clean("") == ""
    assert clean("   \n\n \t \n") == ""


def test_breaking_point_a_confident_misreading_passes_every_threshold():
    """
    The breaking point of this rung: the confidence catches a page the engine
    struggled with, and the engine did not struggle here.

    This scan is clean, the glyphs are sharp, and the engine is sure. It has
    simply read the letter O where the invoice printed a zero, which is the
    one mistake it makes on every reference number in the file. The reading
    comes back with a high score and no review flag: nothing in this code, and
    nothing in the engine, can tell that the number is wrong.

    Raising the threshold does not help, because the mistake is confident.
    What helps is knowing the shape of your references and checking the
    reading against it — a rule you write yourself, back on rung N0.
    """
    engine = FakeOCR({PAGE: "N° 2O24-OOO431"}, confidence=0.96)
    result = read_page(PAGE, engine)
    assert result["review"] is False
    assert result["text"] == "N° 2O24-OOO431"
    assert "2024-000431" not in result["text"]
