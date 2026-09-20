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

Two things this file adds. The first is the refusal to hand back an empty string
as if it were an answer: a page whose body is built by its own JavaScript
arrives here as an empty shell, and « nothing extracted » is a different thing
from « this article is short ».

The second settles a disagreement between the two libraries. On a category page
— forty links and nothing else — `trafilatura` returns nothing and `Readability`
returns the link text as though it were an article. So the share of the page's
text that sits inside links is measured here, in both languages, and above half
the page is not an article whatever the extractor said.
"""

from __future__ import annotations

import trafilatura

# Under this many characters, what came out is a caption, a teaser or the
# leftovers of a page that had no body to begin with. An article in the press,
# a documentation page or a blog post is an order of magnitude above.
MIN_CHARACTERS = 200

# Above this share of the page's text inside links, the page is a list of
# links — a category, an index, a tag page — and not an article. Measured
# rather than guessed, because the two extractors do not agree on their own.
MAX_LINK_SHARE = 0.5


def read_article(html, *, min_characters: int = MIN_CHARACTERS) -> dict:
    """
    The body of the page, its title, and whether it is worth reading.

    `reason` is what tells a caller that came back empty-handed whether the
    page was short or whether there was nothing to take — the second is what
    happens on a page rendered in the browser, and it calls for another tool,
    not for a better extractor.
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
    if len(text.strip()) < min_characters:
        return _report(title, text.strip(),
                       "almost nothing was extracted: this page may be built by its own JavaScript")
    return _report(title, text.strip(), None)


def _link_share(html: str) -> float:
    """What share of the page's text sits inside a link."""
    from lxml import html as lxml_html

    tree = lxml_html.fromstring(html)
    for element in tree.iter("script", "style"):
        element.text = None
    total = len("".join(tree.itertext()).strip())
    inside = sum(len("".join(link.itertext())) for link in tree.iter("a"))
    return inside / total if total else 0.0


def _report(title, text: str, reason: str | None) -> dict:
    return {"title": title, "text": text, "characters": len(text), "reason": reason}
