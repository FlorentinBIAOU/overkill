"""
These tests inject a local double instead of calling a provider.

What they prove: the request carries the text and the page as a data URL, the
answer is decoded, an oversized image is refused before anything is spent,
failures are retried, and an unusable answer never passes for a reading.

What they do not prove: that the model reads the invoice correctly. That is why
this snippet is declared `verification: stubbed` on the entry, and why the page
says so next to the code, and it is what the last test below is about.
"""

import base64
import json

import pytest

from _harness.fake_llm import FakeLLM
from n3 import MAX_IMAGE_BYTES, ExtractionUnavailable, extract_fields

TEXT = """
NORD FOURNITURES SAS
                                          N° 2024-000431
                                          Émise le 3 avril 2024

Cartouche encre noire                2    38,50      77,00
                          NET A PAYER                92,40 EUR
"""

# The first bytes of a PNG. The caller renders the page; this snippet never
# opens a file.
PAGE = b"\x89PNG\r\n\x1a\n" + b"invoice page"

ANSWER = {"invoice_number": "2024-000431", "date": "2024-04-03", "total": 92.40}


def test_reads_what_the_model_answers():
    client = FakeLLM(response=json.dumps(ANSWER))
    assert extract_fields(TEXT, PAGE, client=client) == ANSWER


def test_sends_the_text_and_the_page_at_temperature_zero():
    client = FakeLLM(response=json.dumps(ANSWER))
    extract_fields(TEXT, PAGE, client=client)
    request = client.last_request
    assert "NET A PAYER" in request["prompt"]
    assert request["image_url"].startswith("data:image/png;base64,")
    assert base64.b64decode(request["image_url"].split(",", 1)[1]) == PAGE
    assert request["temperature"] == 0


def test_accepts_the_code_fence_models_like_to_add():
    client = FakeLLM(response=f"```json\n{json.dumps(ANSWER)}\n```")
    assert extract_fields(TEXT, PAGE, client=client)["total"] == 92.40


def test_a_field_the_page_does_not_carry_comes_back_empty():
    client = FakeLLM(response='{"invoice_number": "2024-000431", "date": null}')
    fields = extract_fields(TEXT, PAGE, client=client)
    assert fields == {"invoice_number": "2024-000431", "date": None, "total": None}


def test_refuses_an_oversized_page_before_spending_anything():
    client = FakeLLM(response=json.dumps(ANSWER))
    with pytest.raises(ValueError):
        extract_fields(TEXT, b"x" * (MAX_IMAGE_BYTES + 1), client=client)
    assert client.call_count == 0


def test_retries_a_provider_failure():
    client = FakeLLM(response=json.dumps(ANSWER), fail_times=2)
    extract_fields(TEXT, PAGE, client=client, attempts=3)
    assert client.call_count == 3


def test_prose_where_json_was_asked_for_raises():
    client = FakeLLM(response="Bien sûr ! Voici les champs de cette facture :")
    with pytest.raises(ExtractionUnavailable):
        extract_fields(TEXT, PAGE, client=client)


def test_a_total_that_is_not_a_number_raises():
    # "92,40 EUR" is what the page says, and it is not a number. Letting it
    # through would put a string where the rest of the pipeline expects a total.
    client = FakeLLM(response='{"invoice_number": "x", "date": null, "total": "92,40 EUR"}')
    with pytest.raises(ExtractionUnavailable):
        extract_fields(TEXT, PAGE, client=client)


def test_breaking_point_a_well_formed_answer_can_still_be_invented():
    """
    The breaking point of this rung: every check here is a check on the shape
    of the answer, and none of them is a check on its truth.

    The model returns a perfectly valid object whose total appears nowhere on
    the invoice. The code cannot tell, because telling would mean finding the
    total in the page itself — which is the work this rung was chosen to avoid.

    The only real defence is to check the answer against the document, and that
    is N0 wearing a different hat.
    """
    invented = {"invoice_number": "2024-000431", "date": "2024-04-03", "total": 942.00}
    client = FakeLLM(response=json.dumps(invented))
    fields = extract_fields(TEXT, PAGE, client=client)
    assert fields["total"] == 942.00
    assert "942,00" not in TEXT
