"""
Read a scanned page by handing the image to a general-purpose multimodal model.

Rung N3. This is the option people reach for first, and on this entry it does
buy something real: a model that sees the page reads a handwritten annotation
in the margin, a stamp across a table, a column layout an OCR engine flattens.

Note what the code has to do that N0 did not: recognise the image format, cap
what it sends, encode the bytes, retry on failure, parse an answer that is only
probably valid JSON, and refuse an answer it cannot use. That plumbing is the
real cost of this rung, and it is the part the tests have to cover, because the
model itself is not testable.

And note what none of that plumbing can do: tell whether the transcription is
what the page says. A model that reads is also a model that writes.
"""

from __future__ import annotations

import base64
import json

PROMPT = (
    "Transcribe the page in the image, exactly as it is printed, keeping the\n"
    "line breaks. Answer with JSON only: an object with keys `text` and\n"
    "`unreadable`, where `text` is the transcription and `unreadable` is the\n"
    "list of fragments you could not read. Never guess at a fragment you\n"
    "cannot read: leave « ... » in the text and name it in `unreadable`."
)

# The signatures a scanner produces. Anything else is refused rather than sent
# and charged for, because a provider will reject it too.
SIGNATURES = ((b"\x89PNG\r\n\x1a\n", "image/png"), (b"\xff\xd8\xff", "image/jpeg"),
              (b"II*\x00", "image/tiff"), (b"MM\x00*", "image/tiff"))

# A page scan larger than this is a photograph of a desk, not a page. A model
# charges by what it is given, so refusing it is a cost control, not an
# optimisation.
MAX_IMAGE_BYTES = 8 * 1024 * 1024


class ReadingUnavailable(Exception):
    """The provider could not be reached, or answered something unusable."""


def read_page(image_bytes: bytes, client=None, *, attempts: int = 3, max_bytes: int = MAX_IMAGE_BYTES) -> dict:
    """
    Transcribe one page image, and say what the model admits it could not read.

    `client` is injected so this function can be tested without a network call.
    In production it defaults to a real provider client.
    """
    if client is None:  # pragma: no cover - needs a key and a network
        from openai import OpenAI

        client = OpenAI()

    media_type = _media_type(image_bytes)
    if len(image_bytes) > max_bytes:
        raise ValueError(f"image larger than {max_bytes} bytes")

    answer = _ask(client, image_bytes, media_type, attempts)
    text, unreadable = answer.get("text"), answer.get("unreadable", [])
    if not isinstance(text, str) or not isinstance(unreadable, list):
        raise ReadingUnavailable("the model answered JSON that is not a transcription")

    # What the model admits it could not read is the only doubt it reports.
    # It is worth having, and it is not a confidence: see the test file.
    return {"text": text, "unreadable": [str(u) for u in unreadable], "review": bool(unreadable)}


def _media_type(image_bytes: bytes) -> str:
    """Read the format from the bytes, rather than trusting a file extension."""
    for signature, media_type in SIGNATURES:
        if image_bytes.startswith(signature):
            return media_type
    raise ValueError("unrecognised image format")


def _ask(client, image_bytes: bytes, media_type: str, attempts: int) -> dict:
    last_error: Exception | None = None
    for _ in range(attempts):
        try:
            answer = client.complete(
                prompt=PROMPT,
                # Base64 is how an image travels in a JSON request body.
                image={"media_type": media_type, "data": base64.b64encode(image_bytes).decode("ascii")},
                # Temperature zero: a transcription that changes between two
                # identical calls cannot be checked by anyone.
                temperature=0,
            )
            parsed = json.loads(answer)
            if isinstance(parsed, dict):
                return parsed
            last_error = ValueError("the model answered something that is not an object")
        except Exception as error:  # noqa: BLE001 - any provider failure is retried
            last_error = error
    raise ReadingUnavailable(str(last_error))
