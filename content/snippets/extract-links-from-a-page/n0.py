"""
The links of a page, resolved to absolute addresses the way a browser does it.

Rung N0. An href is an attribute: reading it is parsing, not inference. The
work is elsewhere, and it is in two places.

The first is the base. A relative href means nothing on its own, and what it
is relative to is not in the page: it is the address the page was served from,
which only the caller knows. It is therefore required, not guessed — and the
`<base href>` element, when the page carries one, replaces it, which is the
first thing to check when every link comes out wrong.

The second is that the two languages do not resolve alike, and this entry
measures seven places where they part. `urllib.parse.urljoin` follows RFC 3986;
`new URL` follows the WHATWG standard, which is what browsers actually do, and
the difference is not cosmetic: on `href="\\chemin"`, RFC 3986 gives a path of
your own site and the WHATWG standard gives the host `chemin`. Since the
question being asked is « where will the reader land », this file follows the
browser: the cleaning and the normalisation below close the seven gaps. They
are not a complete WHATWG implementation — `urlstd` is, on PyPI, and it was
last published in 2023.
"""

from __future__ import annotations

import re
from html.parser import HTMLParser
from urllib.parse import quote, urljoin, urlsplit, urlunsplit

# The schemes a browser treats as « special », and the port it leaves out.
SPECIAL = {"http": 80, "https": 443, "ws": 80, "wss": 443, "ftp": 21}

# What is stripped from an href before anything else, as the URL standard
# says: control characters and spaces at the edges, tabs and newlines anywhere.
C0_EDGES = re.compile(r"\A[\x00-\x20]+|[\x00-\x20]+\Z")
TABS = re.compile(r"[\t\n\r]")

# Characters left as they are when a component is percent-encoded. « % » is in
# the list so that an already-encoded address is not encoded twice.
SAFE = "/:@!$&'()*+,;=-._~%?\\"

SPACES = re.compile(r"\s+")


class _Links(HTMLParser):
    """Anchors and their text, plus the first <base href> of the document."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.anchors, self.base, self._open = [], None, None

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == "base" and self.base is None and values.get("href"):
            self.base = values["href"]
        if tag == "a":
            self._open = {"href": values.get("href"), "rel": values.get("rel"), "text": []}
            self.anchors.append(self._open)

    def handle_endtag(self, tag):
        if tag == "a":
            self._open = None

    def handle_data(self, data):
        if self._open is not None:
            self._open["text"].append(data)


def extract_links(html, base) -> dict:
    """
    Every anchor of `html`, with its address resolved against `base`.

    `base` is the address the page was served from. It is required: a relative
    href resolved against a guess is a valid address pointing somewhere else.
    """
    if not isinstance(html, str) or not isinstance(base, str) or not base.strip():
        return {"links": [], "skipped": [], "base": None,
                "reason": "the address the page was served from is required"}

    parser = _Links()
    parser.feed(html)
    used = urljoin(_clean(base), _clean(parser.base)) if parser.base else _clean(base)

    links, skipped = [], []
    for anchor in parser.anchors:
        href = anchor["href"]
        if href is None or not _clean(href):
            skipped.append({"href": href, "why": "no address"})
            continue
        scheme = urlsplit(_clean(href)).scheme.lower()
        if scheme in {"javascript", "data", "blob", "about"}:
            skipped.append({"href": href, "why": f"{scheme} is not an address"})
            continue
        url = _normalise(urljoin(used, _clean(href)), _clean(href))
        links.append({"href": href, "url": url, "text": SPACES.sub(" ", "".join(anchor["text"])).strip(),
                      "rel": anchor["rel"], "kind": _kind(url, used)})
    return {"links": links, "skipped": skipped, "base": used, "reason": None}


def _clean(href: str) -> str:
    """The edges and the backslashes, as the URL standard treats them."""
    href = TABS.sub("", C0_EDGES.sub("", href))
    cut = min([i for i in (href.find("?"), href.find("#")) if i >= 0] or [len(href)])
    return href[:cut].replace("\\", "/") + href[cut:]


def _normalise(url: str, href: str) -> str:
    """The seven differences this entry measures, closed on the Python side."""
    parts = urlsplit(url)
    scheme = parts.scheme.lower()
    if scheme not in SPECIAL:
        return url
    host = (parts.hostname or "").lower()
    if not host.isascii():
        try:
            host = host.encode("idna").decode("ascii")
        except UnicodeError:
            pass  # a label a browser would refuse; it is left as written
    netloc = host if parts.port in (None, SPECIAL[scheme]) else f"{host}:{parts.port}"
    if parts.username:
        secret = f":{parts.password}" if parts.password else ""
        netloc = f"{parts.username}{secret}@{netloc}"
    out = urlunsplit((scheme, netloc, quote(parts.path, safe=SAFE) or "/",
                      quote(parts.query, safe=SAFE), quote(parts.fragment, safe=SAFE)))
    # urlunsplit drops an empty query or fragment; a browser keeps the
    # delimiter the author wrote.
    if "?" in href.split("#")[0] and not parts.query:
        out = out.split("#")[0] + "?" + (f"#{parts.fragment}" if parts.fragment else "")
    if "#" in href and not parts.fragment:
        out += "#"
    return out


def _kind(url: str, base: str) -> str:
    scheme = urlsplit(url).scheme.lower()
    if scheme not in SPECIAL:
        return {"mailto": "mail", "tel": "phone"}.get(scheme, "other")
    return "anchor" if url.split("#")[0] == base.split("#")[0] else "page"
