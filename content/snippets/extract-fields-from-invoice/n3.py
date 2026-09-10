"""
Ask a general-purpose multimodal model to read the invoice.

Rung N3. This is the option people reach for first, and on this task it has a
real argument: the model is given a picture of the page, so it sees the column
an amount sits in, which the extracted text has already lost.

Note what the code has to do that N0 did not: cap the size of what it sends,
retry on failure, parse an answer that is only probably JSON, and check the
shape of what came back. That plumbing is the real cost of this rung, and it is
the part your tests have to cover, because the model itself is not testable.
"""

from __future__ import annotations

import base64
import json

PROMPT = (
    "Read the invoice below and return its header fields.\n"
    "Answer with JSON only: an object with the keys `invoice_number`, `date`\n"
    "and `total`. `total` is the amount due, taxes included, as a number.\n"
    "Use null for a field the page does not carry.\n\n"
    "Extracted text:\n{text}"
)

# A model charges by the token, and a scanned page is a lot of them. Refusing
# an oversized image is not an optimisation, it is a cost control.
MAX_IMAGE_BYTES = 4_000_000

FIELDS = ("invoice_number", "date", "total")


class ExtractionUnavailable(Exception):
    """The provider could not be reached, or answered something unusable."""


def extract_fields(text: str, page_image: bytes, client=None, *, attempts: int = 3) -> dict:
    """
    Read the invoice fields from its text and a picture of the page.

    `client` is injected so this function can be tested without a network call.
    In production it defaults to a real provider client.
    """
    if client is None:  # pragma: no cover - needs a key and a network
        from openai import OpenAI

        client = OpenAI()

    if len(page_image) > MAX_IMAGE_BYTES:
        raise ValueError(f"page image larger than {MAX_IMAGE_BYTES} bytes")

    image_url = "data:image/png;base64," + base64.b64encode(page_image).decode()
    return _decode(_ask(client, text, image_url, attempts))


def _ask(client, text: str, image_url: str, attempts: int) -> str:
    last_error: Exception | None = None
    for _ in range(attempts):
        try:
            return client.complete(
                prompt=PROMPT.format(text=text),
                image_url=image_url,
                # Temperature zero, because an amount that changes between two
                # identical calls cannot be reconciled with anything.
                temperature=0,
            )
        except Exception as error:  # noqa: BLE001 - any provider failure is retried
            last_error = error
    raise ExtractionUnavailable(str(last_error))


def _decode(answer: str) -> dict:
    """
    Turn the answer into the three fields, or refuse it.

    Models like to wrap JSON in a code fence. That is noise, not an error, and
    stripping it is cheaper than another call.
    """
    stripped = answer.strip().removeprefix("```json").removeprefix("```").removesuffix("```")
    try:
        parsed = json.loads(stripped)
    except ValueError as error:
        raise ExtractionUnavailable(f"the model did not answer with JSON: {error}")
    if not isinstance(parsed, dict):
        raise ExtractionUnavailable("the model answered something that is not an object")

    fields = {field: parsed.get(field) for field in FIELDS}
    total = fields["total"]
    # A total nobody can compute with is worse than no total at all: it would
    # travel down the pipeline looking like a number.
    if total is not None and (isinstance(total, bool) or not isinstance(total, (int, float))):
        raise ExtractionUnavailable(f"the model answered a total that is not a number: {total!r}")
    return fields
