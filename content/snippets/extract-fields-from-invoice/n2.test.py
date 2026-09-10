"""
These tests inject a local double instead of loading the real model.

What they prove: the page is sent in one pass with its lines in order, the
scores are decoded into fields, the threshold sends a doubtful field to a
human, an oversized document is refused before the model runs, a failed pass is
retried, and an unusable answer never passes for a reading.

What they do not prove: that the model tags the right lines. That is why this
snippet is declared `verification: stubbed` on the entry, and why the page says
so next to the code.
"""

import pytest

from _harness.fake_model import FakeClassifier
from n2 import MAX_LINES, ExtractionUnavailable, extract_fields

LINES = [
    "NORD FOURNITURES SAS",
    "                            N° 2024-000431",
    "                            Émise le 3 avril 2024",
    "Cartouche encre noire            2    38,50      77,00",
    "                    Sous-total                     77,00",
    "                    TVA (20 %)                     15,40",
    "                    NET A PAYER                    92,40 EUR",
]
INVOICE = "\n".join(LINES)

# The labels are the ones an invoice model exposes; the scores are ours, so the
# test exercises our thresholds and not the model's opinions.
SCORES = {
    LINES[1]: {"invoice_number": 0.97, "date": 0.11},
    LINES[2]: {"date": 0.95},
    LINES[6]: {"total": 0.93, "invoice_number": 0.02},
}


class FlakyModel:
    """A model that drops a pass, the way a machine under load does."""

    def __init__(self, model, failures: int = 1):
        self.model = model
        self.failures = failures

    def predict(self, lines):
        if self.failures > 0:
            self.failures -= 1
            raise RuntimeError("the model was not ready")
        return self.model.predict(lines)


def test_reads_the_three_fields():
    fields = extract_fields(INVOICE, FakeClassifier(SCORES))
    assert fields["invoice_number"]["value"] == "2024-000431"
    assert fields["date"]["value"] == "3 avril 2024"
    assert fields["total"]["value"] == 92.40
    assert [f["review"] for f in fields.values()] == [False, False, False]


def test_sends_the_whole_page_in_one_pass():
    model = FakeClassifier(SCORES)
    extract_fields(INVOICE, model)
    assert model.calls == [LINES]


def test_a_doubtful_score_goes_to_a_human_with_its_value():
    fields = extract_fields(INVOICE, FakeClassifier(SCORES), threshold=0.99)
    assert fields["total"]["value"] == 92.40
    assert fields["total"]["review"] is True
    assert fields["total"]["score"] == 0.93


def test_a_tagged_line_holding_no_value_is_not_an_answer():
    # The model is sure the company name is the total. It carries no amount,
    # so there is nothing to return and a human is asked.
    model = FakeClassifier({LINES[0]: {"total": 0.99}})
    total = extract_fields(INVOICE, model)["total"]
    assert total["value"] is None
    assert total["review"] is True


def test_a_score_that_is_not_a_number_is_not_a_score():
    model = FakeClassifier({LINES[6]: {"total": "very"}})
    total = extract_fields(INVOICE, model)["total"]
    assert total == {"value": None, "score": 0.0, "review": True}


def test_refuses_an_oversized_document_before_the_model_runs():
    model = FakeClassifier(SCORES)
    with pytest.raises(ValueError):
        extract_fields("ligne\n" * (MAX_LINES + 1), model)
    assert model.calls == []


def test_retries_a_failed_pass():
    model = FlakyModel(FakeClassifier(SCORES))
    assert extract_fields(INVOICE, model)["total"]["value"] == 92.40


def test_gives_up_after_the_last_attempt():
    model = FlakyModel(FakeClassifier(SCORES), failures=5)
    with pytest.raises(ExtractionUnavailable):
        extract_fields(INVOICE, model, attempts=2)


def test_a_short_answer_raises_rather_than_misaligning_the_lines():
    class TruncatingModel:
        def predict(self, lines):
            return [{"total": 0.99}]

    with pytest.raises(ExtractionUnavailable):
        extract_fields(INVOICE, TruncatingModel())


def test_breaking_point_a_confident_mistake_passes_every_threshold():
    """
    The breaking point of this rung: the threshold catches doubt, and the model
    is not in doubt.

    This invoice carries a deposit block, a layout the fine-tuning never saw.
    The model tags the deposit line as the total and scores it high, so the
    field comes back with a number, a good score, and no review flag. Nothing
    in the code is wrong; the reading simply is.

    Raising the threshold does not help, because the mistake scores higher than
    the right answer. What helps is fine-tuning on invoices that carry deposits,
    which means an annotated corpus of your own — the cost this rung is usually
    assumed not to have.
    """
    lines = [
        "VERRERIE DU CENTRE",
        "Facture V-2451 du 12/09/2024",
        "Bocaux 500 ml x 200                          264,00",
        "Total TTC                                    360,00 €",
        "Acompte versé le 02/09                       120,00 €",
        "Solde à régler                               240,00 €",
    ]
    model = FakeClassifier({lines[4]: {"total": 0.96}, lines[3]: {"total": 0.41}})
    total = extract_fields("\n".join(lines), model)["total"]
    assert total["value"] == 120.00
    assert total["review"] is False
    assert total["value"] != 360.00
