"""
Ask a general-purpose multimodal model to read the invoice.

Rung N3. The model is sent a picture of the page along with its text, and the
picture still holds what the extracted text has lost: the column an amount
sits in.

Note what the code has to do that N0 did not: cap the size of what it sends,
retry on failure, parse an answer that is only probably JSON, and check the
shape of what came back. That plumbing is the real cost of this rung, and it is
the part your tests have to cover, because the model itself is not testable.
"""

from __future__ import annotations

import base64
import json
import math

PROMPT = (
    "Read the invoice below and return its header fields.\n"
    "Answer with JSON only: an object with the keys `invoice_number`, `date`\n"
    "and `total`. `total` is the amount due, taxes included, as a number.\n"
    "Use null for a field the page does not carry.\n\n"
    "Extracted text:\n{text}"
)

# The provider bills every token of the prompt: the text is capped before the
# call, in characters, not tokens. An image is billed by its dimensions, not its
# bytes, so its cap only bounds what is encoded and uploaded.
MAX_CHARACTERS = 8000
MAX_IMAGE_BYTES = 4_000_000

FIELDS = ("invoice_number", "date", "total")

# The provider named here is an example, not a recommendation: the reasoning
# holds for any general-purpose model API, and the client is swappable. Pass
# any object with a `complete(prompt=..., image_url=..., temperature=...)` method.
MODEL = "gpt-4.1-mini"  # an example id: check the parameters your model accepts


class ExtractionUnavailable(Exception):
    """The provider could not be reached, or answered something unusable."""


class ProviderClient:
    """The one call this snippet makes, on top of the provider's SDK."""

    def __init__(self, sdk=None, model: str = MODEL):
        if sdk is None:  # pragma: no cover - needs a key and a network
            from openai import OpenAI

            sdk = OpenAI()
        self.sdk, self.model = sdk, model

    def complete(self, *, prompt: str, image_url: str, temperature: float) -> str:
        response = self.sdk.chat.completions.create(
            model=self.model,
            # The page travels inside the message, as a data URL.
            messages=[{"role": "user", "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": image_url}},
            ]}],
            temperature=temperature,
        )
        return response.choices[0].message.content


def extract_fields(text: str, page_image: bytes, client=None, *, attempts: int = 3) -> dict:
    """
    Read the invoice fields from its text and a picture of the page.

    `client` is injected so this function can be tested without a network call.
    In production it defaults to a real provider client.
    """
    if len(text) > MAX_CHARACTERS:
        raise ValueError(f"text longer than {MAX_CHARACTERS} characters")
    if not page_image or len(page_image) > MAX_IMAGE_BYTES:
        raise ValueError(f"page image empty or larger than {MAX_IMAGE_BYTES} bytes")
    client = client or ProviderClient()

    image_url = "data:image/png;base64," + base64.b64encode(page_image).decode()
    return _decode(_ask(client, text, image_url, attempts))


def _ask(client, text: str, image_url: str, attempts: int) -> str:
    last_error: Exception | None = None
    for _ in range(attempts):
        try:
            answer = client.complete(
                prompt=PROMPT.format(text=text),
                image_url=image_url,
                # Temperature zero, because an amount that changes between two
                # identical calls cannot be reconciled with anything.
                temperature=0,
            )
            if isinstance(answer, str):
                return answer
            last_error = ValueError("the model returned no content")  # a refusal: unusable, not empty
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
    for field in ("invoice_number", "date"):
        if fields[field] is not None and not isinstance(fields[field], str):
            raise ExtractionUnavailable(f"the model answered a {field} that is not text: {fields[field]!r}")
    total = fields["total"]
    # A total nobody can compute with is worse than no total at all: it would
    # travel down the pipeline looking like a number.
    if total is not None and (isinstance(total, bool) or not isinstance(total, (int, float)) or not math.isfinite(total)):
        raise ExtractionUnavailable(f"the model answered a total that is not a number: {total!r}")
    return fields
