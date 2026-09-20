"""
Keep the article and drop everything around it.

Rung N0. Separating the body of a page from its menus, its footer, its cookie
banner and its « you may also like » is a solved problem with a name — boilerplate
removal — and two mature implementations: `trafilatura` here, Mozilla's
`Readability` in JavaScript. Both work on the tag tree, weighing text density
against link density, and both run offline in a few milliseconds.

They are not the same algorithm and they do not return the same characters. The
titles differ, the line breaks differ, and one keeps the heading inside the body
while the other puts it in the title. What they agree on is the part that
matters, and the test of this entry says it that way: the article's sentences
are in, the navigation and the footer are out.

Two things this file adds. The first is the refusal to hand back an empty
string as if it were an answer, and to confuse two situations while doing it.
A page whose body is built by its own JavaScript arrives here as an empty
shell, and that is not the same thing as a press brief of a hundred and
twenty-five characters that came out whole. The two have two reasons: one says
nothing came out, the other says how short what came out is, and says nothing
about why.

The second settles a disagreement between the two libraries. On a category page
— forty links and nothing else — `trafilatura` returns nothing and `Readability`
returns the link text as though it were an article. So the share of the page's
text that sits inside links is measured here, in both languages, and above half
the page is not an article whatever the extractor said.
"""

from __future__ import annotations

import trafilatura

# The length under which the report says so, in characters. It is a line of
# information handed to the caller, not a verdict: a press brief and the
# documentation of one function are both genuinely below it, and both come
# back whole, with their text and their title. Nothing is dropped and nothing
# is diagnosed because of it.
MIN_CHARACTERS = 200

# Above this share of the page's text inside links, the page is a list of
# links — a category, an index, a tag page — and not an article. Measured
# rather than guessed, because the two extractors do not agree on their own.
MAX_LINK_SHARE = 0.5


def read_article(html, *, min_characters: int = MIN_CHARACTERS) -> dict:
    """
    The body of the page, its title, and whether it is worth reading.

    `reason` tells a caller that came back empty-handed which of the two
    happened. Nothing at all came out — the page is a shell, and that calls
    for another tool, not for a better extractor. Or something came out and it
    is short, in which case the reason says how short, and nothing else: a
    short page is a short page, not a broken one.
    """
    if not isinstance(html, str):
        return _report(None, "", f"expected HTML, not {type(html).__name__}")
    try:
        text = trafilatura.extract(html, output_format="txt", include_comments=False,
                                   include_tables=False, favor_precision=True) or ""
        metadata = trafilatura.extract_metadata(html)
        share = _link_share(html)
    except Exception:  # noqa: BLE001 - a page that cannot be parsed is an answer too
        return _report(None, "", "this page could not be parsed")

    title = getattr(metadata, "title", None) if metadata else None
    if share > MAX_LINK_SHARE:
        return _report(title, "", "this page is a list of links, not an article")
    text = text.strip()
    if not text:
        return _report(title, "", "nothing was extracted: this page may be built by its own JavaScript")
    if len(text) < min_characters:
        return _report(title, text, f"this page is short: {len(text)} characters")
    return _report(title, text, None)


def _link_share(html: str) -> float:
    """
    What share of the page's text sits inside a link.

    Both sides are stripped, and the result is capped at one: a link nested
    inside another — which a permissive parser produces on malformed markup —
    is counted twice, and a share above one is not a share.
    """
    from lxml import html as lxml_html

    tree = lxml_html.fromstring(html)
    for element in tree.iter("script", "style"):
        element.text = None
    total = len("".join(tree.itertext()).strip())
    inside = sum(len("".join(link.itertext()).strip()) for link in tree.iter("a"))
    return min(inside / total, 1.0) if total else 0.0


def _report(title, text: str, reason: str | None) -> dict:
    return {"title": title, "text": text, "characters": len(text), "reason": reason}
