"""
Read a product from a page that publishes nothing structured, by asking a model.

Rung N3. This is the level for the shop that emits no JSON-LD and whose
rendering changes every quarter, where writing selectors means rewriting them.
It earns its place there, and nowhere above it: on a page that already carries
its JSON-LD, rung N0 reads the same values for nothing.

Three things this code does that the model does not, and that are the real work
of this rung.

It cuts. A shop page is hundreds of kilobytes of markup, almost all of it menus,
tracking and styles; the tags come off and what is left is capped. The provider
bills what is sent, so the cap is a budget, and the entry on estimating a
call's cost is where that budget is computed.

It refuses an invented value. Every string the model returns is looked for in
the text that was sent: a name, a reference or a price that appears nowhere in
the page is dropped, and `invented` says which. This is the one guard that
separates a reading from a plausible answer, and it is worth more than the
prompt.

And it treats a refusal as a refusal. A provider that cannot answer raises;
`content` of None is not a value, and it is not handed to the JSON decoder in
the hope that the exception will do.
"""

from __future__ import annotations

import json
import re

# What the model is asked for, named as schema.org names it so that a caller
# can put an N0 answer and an N3 answer in the same table.
FIELDS = ("name", "sku", "brand", "price", "currency", "availability")

# A shop page is markup; this is what is left once the tags are gone. The
# pattern carries no nested quantifier on purpose: the one that reads
# « <(script|style)...>.*?</\1> » in a single line is the collapse the N0
# snippet of this entry was written to avoid, and it cost tens of seconds of
# CPU here, before the model was even called. The blocks are scanned instead,
# in `_without_scripts`.
TAGS = re.compile(r"<[^>]+>")
SPACES = re.compile(r"[ \t\r\f\v]*\n\s*|[ \t]{2,}")

# The budget in characters of markup, applied before anything reads the page.
# The charte asks that an input too large be refused before the call; a cap
# applied after the cleaning protects nothing, since the cleaning is the part
# that costs.
MAX_HTML = 400_000

# The budget, in characters of text. A page that does not fit is cut, not
# refused: a scraper that raises on a long page returns nothing at all.
MAX_CHARACTERS = 6000

# A single code fence around the whole answer is a common shape, and refusing
# it would buy another call for nothing.
FENCE = re.compile(r"\A\s*```(?:json)?\s*(.*?)\s*```\s*\Z", re.DOTALL)

MODEL = "gpt-4.1-mini"  # an example id: check the parameters your model accepts

PROMPT = (
    "Read this shop page and return the product it is about.\n"
    "Answer with JSON only, with these keys: {fields}.\n"
    "Copy each value from the page. Use null for anything the page does not say.\n\n"
    "Page:\n{page}"
)


class ProviderClient:
    """The one call this snippet makes, on top of the provider's SDK."""

    def __init__(self, sdk=None, model: str = MODEL):
        if sdk is None:  # pragma: no cover - needs a key and a network
            from openai import OpenAI

            sdk = OpenAI()
        self.sdk, self.model = sdk, model

    def complete(self, *, prompt: str, temperature: float) -> str:
        response = self.sdk.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=temperature,
        )
        return response.choices[0].message.content


class ReadingUnavailable(Exception):
    """The provider could not be reached, or answered something unusable."""


def _without_scripts(html: str) -> str:
    """
    The markup with every script and style block removed, scanned rather than
    matched — the same walk as `_blocks` in the N0 snippet, and for the same
    reason. An unclosed block swallows the rest of the page, which is what a
    browser does too.
    """
    kept, cursor, lower = [], 0, html.lower()
    while cursor < len(html):
        starts = [i for i in (lower.find("<script", cursor), lower.find("<style", cursor)) if i >= 0]
        if not starts:
            kept.append(html[cursor:])
            break
        start = min(starts)
        kept.append(html[cursor:start])
        tag = "script" if lower.startswith("<script", start) else "style"
        closing = lower.find(f"</{tag}", start)
        if closing < 0:
            break
        cursor = closing
    return "".join(kept)


def to_text(html: str) -> str:
    """The page without its markup, collapsed, and cut to the budget."""
    return SPACES.sub("\n", TAGS.sub(" ", _without_scripts(html[:MAX_HTML]))).strip()[:MAX_CHARACTERS]


def read_product(html: str, client=None, *, attempts: int = 3) -> dict:
    """
    The product a model reads on this page, with what it made up removed.

    `client` is injected so this function can be tested without a network call.
    In production it defaults to a real provider client.
    """
    client = client or ProviderClient()
    page = to_text(html)
    answer = _ask(client, page, attempts)

    product, invented = {}, []
    haystack = page.casefold()
    for field in FIELDS:
        value = answer.get(field) if isinstance(answer, dict) else None
        if value is None:
            product[field] = None
        elif str(value).strip().casefold() in haystack:
            product[field] = str(value).strip()
        else:
            # The model wrote something the page does not contain. It is not a
            # reading, so it is not kept — and the caller is told.
            product[field] = None
            invented.append(field)
    return {"source": "model", "product": product, "invented": invented,
            "characters_sent": len(page)}


def _ask(client, page: str, attempts: int) -> dict:
    prompt = PROMPT.format(fields=", ".join(FIELDS), page=page)
    last_error: Exception | None = None
    for _ in range(attempts):
        try:
            answer = client.complete(prompt=prompt, temperature=0)
            if not isinstance(answer, str):  # a refusal comes back as no content
                last_error = ValueError("the model answered no text")
                continue
            fenced = FENCE.match(answer)
            return json.loads(fenced.group(1) if fenced else answer)
        except Exception as error:  # noqa: BLE001 - any provider failure is retried
            last_error = error
    raise ReadingUnavailable(str(last_error))
