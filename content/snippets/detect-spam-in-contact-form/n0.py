"""
Reject spam in a contact form: honeypot, submission delay, link cap, banned phrases.

Rung N0. Four checks, no dependency, no training data, and a rejection that
comes with a reason you can show to whoever asks why a message was lost.

Two of the checks look at the sender rather than the text. A honeypot field,
kept out of sight in the form, and the time spent on the page catch the
scripts that post to the endpoint without rendering it, as long as they fill
in every field or post faster than a person types. Neither needs to read the
message.

The two text checks are the weak half, and the entry says so.
"""

import re
import unicodedata

# The field is present in the form, hidden by the stylesheet, and named after
# something a naive form filler will want to complete.
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


def fold(text: str) -> str:
    """Lowercase and strip accents, so `Rétrolien` and `RETROLIEN` match alike."""
    stripped = unicodedata.normalize("NFKD", text)
    return "".join(c for c in stripped if not unicodedata.combining(c)).casefold()


def reasons(fields: dict, seconds_on_page: float) -> list[str]:
    """
    Every reason to reject this submission. An empty list means: accept it.

    Returning reasons rather than a boolean is what makes the rule reviewable:
    a rejection you cannot explain is a rejection you cannot tune.
    """
    found = []
    if fields.get(HONEYPOT_FIELD, "").strip():
        found.append("honeypot filled")
    # Written as "not at least", so a missing or unreadable delay (NaN) counts
    # as too fast instead of slipping through.
    if not seconds_on_page >= MINIMUM_SECONDS:
        found.append("submitted too fast")

    message = fold(fields.get("message", ""))
    if len(LINK.findall(message)) > MAXIMUM_LINKS:
        found.append("too many links")
    found.extend(f"banned phrase: {phrase}" for phrase in sorted(set(BANNED.findall(message))))
    return found


def is_spam(fields: dict, seconds_on_page: float) -> bool:
    """The same decision, for callers that only want the verdict."""
    return bool(reasons(fields, seconds_on_page))
