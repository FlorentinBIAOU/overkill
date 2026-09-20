"""
Keep the last reply of an email thread, and drop the thread under it.

Rung N0. An email client does not send the reply alone: it sends the reply,
then the whole conversation under it, marked by something the client wrote
itself — a « > » in front of each line, a line of underscores, a header block,
or the sentence « Le 10 octobre 2026 à 13:55, Marie Martin a écrit : ». Those
markers are what this rung looks for, and the reply is what sits above the
first of them.

The libraries that do this are `email-reply-parser` in JavaScript and
`email_reply_parser` in Python. They were written for English threads, and it
shows: on the French thread of this entry's test, the Python one leaves
« Le 10 octobre 2026 à 13:55, Marie Martin <marie@exemple.fr> a écrit : » in
the reply, and the JavaScript one removes the signature it keeps on the English
thread. Two extracts that answer differently on the same message are of no use
to a page that shows both, so the markers are written here, French ones
included.

One thing is deliberately not done: removing the signature. « Bien à vous, Jean
Dupont » is part of what Jean wrote, and a line holding nothing but a name is
sometimes the whole message. The cut happens at the quote, and stops there.
"""

from __future__ import annotations

import re

# What a mail client writes when it quotes, and what is under each marker.
# « quoted » means the old message is prefixed line by line, so what is not
# prefixed under it was written by the sender; « block » means it is copied
# as is, and nothing tells it apart from a reply.
MARKERS = [
    # A quoted line, the oldest convention of all.
    ("quoted", re.compile(r"^\s*>")),
    # Outlook's separator, and the header block that follows it.
    ("block", re.compile(r"^\s*_{5,}\s*$")),
    ("block", re.compile(r"^\s*(De|From|Expéditeur)\s*:\s+\S")),
    # « -----Message d'origine----- » and its translations.
    ("block", re.compile(r"^\s*-{2,}\s*(Message d'origine|Message transféré"
                         r"|Original Message|Forwarded message)\s*-{2,}\s*$",
                         re.IGNORECASE)),
]

# « Le 10 octobre 2026 à 13:55, Marie Martin a écrit : », which Gmail wraps
# over two lines. Opening and closing are therefore looked for separately,
# and the closing is tried on one line, then two, then three.
ATTRIBUTION_OPENS = re.compile(r"^\s*(Le|On)\s+\S")
ATTRIBUTION_CLOSES = re.compile(r"(a écrit|wrote)\s*:\s*$")
ATTRIBUTION_LINES = 3

LINE_END = re.compile(r"\r\n|\r|\n")

# Characters the two languages do not class alike: a byte-order mark is a space
# for JavaScript and not for Python, and the C1 separators are the reverse.
# None of them belongs in a reply, and leaving them in would make the two
# extracts of this entry cut at different places.
ODD_SPACES = re.compile(r"[\ufeff\x1c-\x1f\x85]")


def extract_reply(message) -> dict:
    """
    The text above the first quote marker, and what was found under it.

    `reason` is set when the reply looks like it was written under the quote or
    inside it: the cut then returns almost nothing, and « almost nothing » must
    not be handed back as « the reply was empty ».
    """
    if not isinstance(message, str):
        return _report("", None, f"expected text, not {type(message).__name__}")

    # Split on the three line endings a mail carries, and on those only:
    # str.splitlines() also cuts on a form feed and on U+2028, which the
    # JavaScript side does not, and the two would stop answering alike.
    lines = LINE_END.split(ODD_SPACES.sub("", message))
    cut, kind = _first_marker(lines)
    if cut is None:
        return _report(message.strip(), None, None)

    reply = "\n".join(lines[:cut]).strip()
    if kind == "quoted" and _unquoted_under(lines[cut:]) > len(reply):
        return _report(reply, cut, "more text was written under the quote than above it")
    return _report(reply, cut, None)


def _first_marker(lines):
    """Where the quoted thread begins, and how the old message is marked."""
    for index, line in enumerate(lines):
        for kind, marker in MARKERS:
            if marker.search(line):
                return index, kind
        if ATTRIBUTION_OPENS.match(line):
            for length in range(1, ATTRIBUTION_LINES + 1):
                window = " ".join(lines[index:index + length]).rstrip()
                if ATTRIBUTION_CLOSES.search(window):
                    return index, "quoted"
    return None, None


def _unquoted_under(lines) -> int:
    """How much text under the cut carries no quote prefix."""
    loose = [line for line in lines if line.strip() and not line.lstrip().startswith(">")]
    return len("\n".join(loose).strip())


def _report(reply: str, cut, reason: str | None) -> dict:
    return {"reply": reply, "quoted_from_line": cut, "reason": reason}
