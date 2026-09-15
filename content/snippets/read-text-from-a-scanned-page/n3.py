"""
Read a scanned page by handing the image to a general-purpose multimodal model.

Rung N3. The page goes out whole, to a model that returns a transcription.

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
import re

PROMPT = (
    "Transcribe the page in the image, exactly as it is printed, keeping the\n"
    "line breaks. Answer with JSON only: an object with keys `text` and\n"
    "`unreadable`, where `text` is the transcription and `unreadable` is the\n"
    "list of fragments you could not read. Never guess at a fragment you\n"
    "cannot read: leave « ... » in the text and name it in `unreadable`."
)

# The formats the provider's vision input lists: PNG, JPEG, WEBP and GIF (not
# animated, which this check does not see). Anything else, a TIFF included, is
# refused before it is sent: convert it first.
SIGNATURES = ((rb"\x89PNG\r\n\x1a\n", "image/png"), (rb"\xff\xd8\xff", "image/jpeg"),
              (rb"RIFF.{4}WEBP", "image/webp"), (rb"GIF8[79]a", "image/gif"))

# A cap on what is encoded and uploaded; base64 makes the request a third larger
# than the file. It is not a cost control: the provider bills an image by its
# dimensions, not by its bytes.
MAX_IMAGE_BYTES = 8 * 1024 * 1024

# The provider named here is an example, not a recommendation: the reasoning
# holds for any general-purpose model API, and the client is swappable. Pass
# any object with a `complete(prompt=..., image=..., temperature=...)` method.
MODEL = "gpt-4.1-mini"  # an example id: check the parameters your model accepts


class ProviderClient:
    """The one call this snippet makes, on top of the provider's SDK."""

    def __init__(self, sdk=None, model: str = MODEL):
        if sdk is None:  # pragma: no cover - needs a key and a network
            from openai import OpenAI

            sdk = OpenAI()
        self.sdk, self.model = sdk, model

    def complete(self, *, prompt: str, image: dict, temperature: float) -> str:
        # The image travels inside the message, as a data URL.
        url = f"data:{image['media_type']};base64,{image['data']}"
        response = self.sdk.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": url}},
            ]}],
            temperature=temperature,
        )
        return response.choices[0].message.content


class ReadingUnavailable(Exception):
    """The provider could not be reached, or answered something unusable."""


def read_page(image_bytes: bytes, client=None, *, attempts: int = 3, max_bytes: int = MAX_IMAGE_BYTES) -> dict:
    """
    Transcribe one page image, and say what the model admits it could not read.

    `client` is injected so this function can be tested without a network call.
    In production it defaults to a real provider client.
    """
    client = client or ProviderClient()
    media_type = _media_type(image_bytes)
    if len(image_bytes) > max_bytes:
        raise ValueError(f"image larger than {max_bytes} bytes")

    answer = _ask(client, image_bytes, media_type, attempts)
    text, unreadable = answer.get("text"), answer.get("unreadable", [])
    if not isinstance(text, str) or not isinstance(unreadable, list):
        raise ReadingUnavailable("the model answered JSON that is not a transcription")

    # Two doubts, and neither is a confidence: what the model admits it could
    # not read, and a page that came back empty. See the test file.
    review = bool(unreadable) or not text.strip()
    return {"text": text, "unreadable": [str(u) for u in unreadable], "review": review}


def _media_type(image_bytes: bytes) -> str:
    """Read the format from the bytes, rather than trusting a file extension."""
    for signature, media_type in SIGNATURES:
        if re.match(signature, image_bytes, re.S):
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
                # The lowest temperature: the SDK documents lower values as more
                # focused and deterministic.
                temperature=0,
            )
            if not isinstance(answer, str):  # a refusal comes back as no content
                last_error = ValueError("the model answered no text")
                continue
            parsed = json.loads(answer)
            if isinstance(parsed, dict):
                return parsed
            last_error = ValueError("the model answered something that is not an object")
        except Exception as error:  # noqa: BLE001 - any provider failure is retried
            last_error = error
    raise ReadingUnavailable(str(last_error))
