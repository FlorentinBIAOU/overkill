"""
These tests inject a local double instead of calling a provider.

What they prove: the image is recognised and encoded, an unsupported or
oversized image is refused before anything is spent, the answer is decoded,
failures are retried, and an unusable answer never passes for a transcription.

What they do not prove: that the transcription is what the page says. The last
test in this file is about exactly that, and it is the reason this snippet is
declared `verification: stubbed` on the entry.
"""

import base64
import json

import pytest

from _harness.fake_llm import FakeLLM
from n3 import MAX_IMAGE_BYTES, ReadingUnavailable, read_page

# Enough of a PNG to be recognised as one. Nothing here decodes the pixels —
# neither this test, nor the snippet, nor anything else on this rung.
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64

TRANSCRIPTION = {
    "text": "NORD FOURNITURES SAS\nN° 2024-000431\nNET A PAYER 92,40 EUR",
    "unreadable": [],
}


def test_returns_the_transcription():
    client = FakeLLM(response=json.dumps(TRANSCRIPTION))
    result = read_page(PNG, client=client)
    assert result["text"].startswith("NORD FOURNITURES SAS")
    assert result["review"] is False


def test_sends_the_image_encoded_with_its_media_type():
    client = FakeLLM(response=json.dumps(TRANSCRIPTION))
    read_page(PNG, client=client)
    request = client.last_request
    assert request["image"]["media_type"] == "image/png"
    assert base64.b64decode(request["image"]["data"]) == PNG
    assert "Transcribe" in request["prompt"]
    assert request["temperature"] == 0


def test_reads_the_format_from_the_bytes_not_from_a_name():
    client = FakeLLM(response=json.dumps(TRANSCRIPTION))
    read_page(JPEG, client=client)
    assert client.last_request["image"]["media_type"] == "image/jpeg"


def test_refuses_a_format_no_provider_takes_before_spending_anything():
    client = FakeLLM(response=json.dumps(TRANSCRIPTION))
    with pytest.raises(ValueError):
        read_page(b"GIF89a" + b"\x00" * 64, client=client)
    assert client.call_count == 0


def test_refuses_an_oversized_image_before_spending_anything():
    client = FakeLLM(response=json.dumps(TRANSCRIPTION))
    with pytest.raises(ValueError):
        read_page(PNG + b"\x00" * MAX_IMAGE_BYTES, client=client)
    assert client.call_count == 0


def test_a_fragment_the_model_could_not_read_asks_for_a_human():
    # The one honest signal this rung gives: the model saying it does not know.
    client = FakeLLM(
        response=json.dumps({"text": "NET A PAYER ... EUR", "unreadable": ["the total"]})
    )
    result = read_page(PNG, client=client)
    assert result["unreadable"] == ["the total"]
    assert result["review"] is True


def test_a_missing_unreadable_key_is_not_an_error():
    client = FakeLLM(response=json.dumps({"text": "une page lisible"}))
    assert read_page(PNG, client=client) == {"text": "une page lisible", "unreadable": [], "review": False}


def test_retries_a_provider_failure():
    client = FakeLLM(response=json.dumps(TRANSCRIPTION), fail_times=2)
    read_page(PNG, client=client, attempts=3)
    assert client.call_count == 3


def test_an_unusable_answer_raises_rather_than_returning_a_blank_page():
    # Prose where JSON was asked for. Returning an empty transcription would
    # file the page as read and empty, which is worse than failing.
    client = FakeLLM(response="Of course! Here is the text of your invoice:")
    with pytest.raises(ReadingUnavailable):
        read_page(PNG, client=client)


def test_an_answer_shaped_wrong_raises_too():
    client = FakeLLM(response=json.dumps({"text": ["line one", "line two"]}))
    with pytest.raises(ReadingUnavailable):
        read_page(PNG, client=client)


def test_breaking_point_the_model_can_write_a_page_it_never_read():
    """
    The breaking point of this rung: a model that reads is a model that writes.

    The image handed over here carries a PNG header and nothing to read. The
    model answers with a complete, well-formatted, entirely plausible invoice:
    a supplier, a reference in the right shape, a total with two decimals, and
    an empty `unreadable` list — it is not in doubt, because it is not reading.

    Every assertion below passes, and that is the point. The transcription is
    well-formed JSON, the plumbing is correct, the review flag is false, and
    the caller receives a total that was never printed on any page. Nothing
    upstream of the model saw the pixels, and nothing downstream can check
    them: the only defence left is a rule about what the document must
    contain, which is rung N0 again, or a human.
    """
    invented = {
        "text": "PAPETERIE DU NORD\nFacture 2024-000998\nNET A PAYER 1 240,00 EUR",
        "unreadable": [],
    }
    client = FakeLLM(response=json.dumps(invented))
    result = read_page(PNG, client=client)

    assert result["review"] is False
    assert result["unreadable"] == []
    assert "NET A PAYER 1 240,00 EUR" in result["text"]
    # The whole of what the code did with the pixels: forward them.
    assert base64.b64decode(client.last_request["image"]["data"]) == PNG
