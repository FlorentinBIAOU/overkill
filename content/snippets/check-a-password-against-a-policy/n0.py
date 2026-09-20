"""
Check a password against the policy the standard actually asks for.

Rung N0. NIST SP 800-63B-4 is short and its requirements are rules, not
judgements: fifteen characters for a password used on its own, at least
sixty-four permitted, no composition rules, no periodic change, and a
comparison against a blocklist of passwords already known to be compromised.
Four of those five are arithmetic on a string.

The fifth is the only one that leaves the machine, and it leaves almost
nothing. The Have I Been Pwned range service takes the first five characters of
the SHA-1 of the password and returns every suffix that begins with them — some
eight hundred of them — so the password is never sent, the service cannot tell
which of the eight hundred was asked about, and the answer is a count. That is
what `pwned_count` below does, and it is worth reading: the whole privacy
argument is in two lines.

What this file deliberately does not do is count capitals, digits and symbols.
The standard forbids it — « Verifiers and CSPs SHALL NOT impose other
composition rules » — because those rules push people towards « Motdepasse1! »,
which the blocklist catches and no composition rule does.
"""

from __future__ import annotations

import hashlib
import unicodedata

# SP 800-63B-4, section 3.1.1.2: fifteen characters for a password used as a
# single factor, eight when it is only one factor among several.
MINIMUM = 15
MINIMUM_WITH_SECOND_FACTOR = 8

# The standard says « SHOULD permit a maximum password length of at least 64
# characters »: sixty-four is a floor on the ceiling, not the ceiling. Taking
# it as one turns down a seventy-character passphrase — six words out of a
# password manager — which is a good password refused by a rule of shape, in
# an entry whose whole thesis is that rules of shape push people towards bad
# ones. Two hundred and fifty-six is the usual ceiling; it exists to bound the
# hashing, not to judge anything.
MAXIMUM = 256

RANGE_URL = "https://api.pwnedpasswords.com/range/"

# Reasons that block. A blocklist that did not answer is reported and never
# decided: refusing every sign-up because a third party is down is an outage
# you did not choose, and accepting in silence is the check the standard puts
# in a SHALL, skipped without a word. The caller decides; `reasons` is what it
# decides on.
BLOCKING = ("not-text", "too-short", "too-long", "context-word", "breached")


def pwned_count(password: str, fetch=None) -> int:
    """
    How many breaches this password appears in, without sending the password.

    Only the first five characters of its SHA-1 leave: the service answers with
    every suffix sharing that prefix, and the comparison happens here. The
    `Add-Padding` header makes every answer the same size, so the length of the
    response says nothing either.
    """
    if fetch is None:  # pragma: no cover - needs a network
        def fetch(url: str) -> str:
            import urllib.request

            request = urllib.request.Request(url, headers={"Add-Padding": "true"})
            with urllib.request.urlopen(request, timeout=5) as response:
                return response.read().decode("utf-8")

    digest = hashlib.sha1(password.encode("utf-8")).hexdigest().upper()
    for line in fetch(RANGE_URL + digest[:5]).splitlines():
        suffix, _, count = line.strip().partition(":")
        if suffix == digest[5:]:
            return int(count)
    return 0


def check_password(password, *, second_factor: bool = False, context=(), fetch=None) -> dict:
    """
    Say whether this password may be accepted, and why not when it may not.

    `context` is the short list of words a password must not be — the site's
    name, the account's local part — which the standard allows a blocklist to
    carry. It is compared after normalisation and without case, and nothing
    else about the password's shape is judged.

    `fetch` is injected by the tests; in production it is an HTTPS request.
    It runs on a sign-up path, so a service that does not answer must not raise
    here: the failure comes back as `blocklist-unavailable` in `reasons`, with
    `breaches` at None, and `acceptable` says what the rest of the check says.
    Only `BLOCKING` reasons make a password unacceptable.
    """
    if not isinstance(password, str):
        return _report(False, ["not-text"], None, 0)

    # The standard asks for NFC, so that a password typed with a composed « é »
    # and one typed with « e » plus an accent are the same password.
    normalised = unicodedata.normalize("NFC", password)
    length = len(normalised)
    reasons = []
    floor = MINIMUM_WITH_SECOND_FACTOR if second_factor else MINIMUM
    if length < floor:
        reasons.append("too-short")
    if length > MAXIMUM:
        reasons.append("too-long")
    # Lower case rather than case folding, so that the two languages of this
    # page compare the same way: folding turns « ß » into « ss », lowering
    # leaves it alone, and JavaScript has no folding.
    folded = normalised.lower()
    if any(folded == unicodedata.normalize("NFC", word).lower() for word in context):
        reasons.append("context-word")

    # The blocklist is asked last, and only for a password that could still be
    # accepted: a request that will change nothing is a request not to make.
    breaches = None
    if not reasons:
        try:
            breaches = pwned_count(normalised, fetch)
        except Exception:  # noqa: BLE001 - see BLOCKING: an outage is not a verdict
            reasons.append("blocklist-unavailable")
        else:
            if breaches:
                reasons.append("breached")
    blocking = [reason for reason in reasons if reason in BLOCKING]
    return _report(not blocking, reasons, breaches, length)


def _report(acceptable: bool, reasons: list, breaches: int | None, length: int) -> dict:
    return {"acceptable": acceptable, "reasons": reasons, "breaches": breaches, "length": length}
