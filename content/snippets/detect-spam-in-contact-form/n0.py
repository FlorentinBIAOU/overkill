"""
Reject spam in a contact form: honeypot, submission delay, link cap, banned phrases.

Rung N0. Four checks, no dependency, no training data, and a rejection that
comes with a reason you can show to whoever asks why a message was lost.

Two of the checks look at the sender rather than the text. A honeypot field,
kept out of sight in the form, and the time spent on the page catch the
scripts that post to the endpoint without rendering it, as long as they fill
in every field or post faster than a person types. Neither needs to read the
message.

The delay is the one that has to be built right, and it is where this kind of
check is usually got wrong. A hidden field holding the time the page was
rendered is a number the sender writes, and a script writes whatever it likes
in it. So the server issues that timestamp itself, signed with a secret only it
holds, and recomputes the signature on submission: a timestamp that was edited,
or that nobody signed, is not a delay at all, and counts as too fast. Thirty
lines below, and no dependency. Ned Batchelder's spinner, which this follows,
signs the visitor's address and the page identifier along with the time, so
that a token issued for one form cannot be replayed on another.

The two text checks are the weak half, and the entry says so.
"""

import hmac
import re
import time
import unicodedata
from hashlib import sha256

# The field is present in the form and hidden by the stylesheet — not with
# `type="hidden"`, which a script knows to skip — and named after something a
# naive form filler will want to complete.
HONEYPOT_FIELD = "website"

MINIMUM_SECONDS = 3.0
MAXIMUM_LINKS = 2

# One match per link, not one per part: a bare `https?://` alternative would
# count `http://example.com` twice and reject the customer who sends two.
# A bare domain must start a word that follows neither `@` nor a dot, so the
# domain of an email address is not a link, and a run like `a-a-a-...` gives
# the pattern one place to start instead of one per letter.
LINK = re.compile(
    r"(?:https?://|www\.)\S+"
    r"|(?<![\w@.-])[\w-]+(?:\.[\w-]+)*\.(?:com|net|org|ru|xyz|top)\b"
)

# Whole words only, so `cryptographie` or a shop called `Casino` is not
# rejected. Every word on such a list is one a customer may write some day.
BANNED = re.compile(r"\b(backlink|guest post|seo (?:services|ranking)|online casino|viagra)s?\b")


def issue_token(secret: bytes, issued_at: float | None = None) -> str:
    """
    The timestamp to put in the form, signed: `<seconds>.<signature>`.

    `secret` never leaves the server. Anything else the form carries about
    time is the sender's word.
    """
    issued = int(time.time() if issued_at is None else issued_at)
    return f"{issued}.{_signature(secret, issued)}"


def seconds_on_page(token: str, secret: bytes, now: float | None = None) -> float:
    """
    How long the form was really on the page, or zero when the token is not ours.

    Zero is the safe answer: `reasons` reads it as too fast. A token that was
    edited, replayed with a different time, or made up, lands here.
    """
    issued_text, _, signature = str(token).partition(".")
    if not issued_text.isdigit():
        return 0.0
    issued = int(issued_text)
    if not hmac.compare_digest(signature, _signature(secret, issued)):
        return 0.0
    return max(0.0, (time.time() if now is None else now) - issued)


def _signature(secret: bytes, issued: int) -> str:
    return hmac.new(secret, str(issued).encode(), sha256).hexdigest()


def fold(text: str) -> str:
    """Lowercase and strip accents, so `Rétrolien` and `RETROLIEN` match alike."""
    stripped = unicodedata.normalize("NFKD", text)
    return "".join(c for c in stripped if not unicodedata.combining(c)).casefold()


def reasons(fields: dict, seconds: float) -> list[str]:
    """
    Every reason to reject this submission. An empty list means: accept it.

    `seconds` is what `seconds_on_page` returned, not a number the form
    carried: this function trusts its caller, and the caller must not trust
    the sender.

    Returning reasons rather than a boolean is what makes the rule reviewable:
    a rejection you cannot explain is a rejection you cannot tune.
    """
    found = []
    if fields.get(HONEYPOT_FIELD, "").strip():
        found.append("honeypot filled")
    # Written as "not at least", so a missing or unreadable delay (NaN) counts
    # as too fast instead of slipping through.
    if not seconds >= MINIMUM_SECONDS:
        found.append("submitted too fast")

    message = fold(fields.get("message", ""))
    if len(LINK.findall(message)) > MAXIMUM_LINKS:
        found.append("too many links")
    found.extend(f"banned phrase: {phrase}" for phrase in sorted(set(BANNED.findall(message))))
    return found


def is_spam(fields: dict, seconds: float) -> bool:
    """The same decision, for callers that only want the verdict."""
    return bool(reasons(fields, seconds))
