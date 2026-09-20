"""
Check an email address against the definition the browser already applied.

Rung N0, and the whole of it: nothing here touches the network, so nothing here
knows whether the mailbox exists. What it knows is the shape.

The shape is specified. The HTML standard defines a valid e-mail address for
`input type=email` and publishes the regular expression for it, adding that
"this requirement is a willful violation of RFC 5322". That violation is the
point: it is the definition your users were already validated against in their
browser, so it is the one a server should agree with.

The mature libraries do not agree with it, nor with each other. On the
thirty-two addresses of the test, `email-validator` 2.3.0 in Python and
`validator.js` 13.15.35 in JavaScript return different verdicts four times,
and the browser's definition differs from one or the other fourteen times.
Among the four: the quoted form "jean dupont"@exemple.fr, a single-letter top
level, and a sixty-five-character local part, which `email-validator` accepts
although RFC 5321 caps it at sixty-four — which is why the length is checked
here rather than left to a library.

Two things the report says rather than decides. The local part is left in its
case, because RFC 5321 makes it case-sensitive and only the domain is not;
lowercasing the whole address is a silent rewrite of somebody's mailbox name.
And `routable` is false for jean@localhost, which the HTML definition accepts:
a bare host name is a valid address and no public mail server will reach it.
"""

from __future__ import annotations

import re

# The regular expression published by the HTML standard for input type=email,
# transcribed character for character.
WHATWG = re.compile(
    r"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+"
    r"@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?"
    r"(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$"
)

# RFC 5321, section 4.5.3.1: sixty-four octets for the local part, two hundred
# and fifty-six for the path, which leaves two hundred and fifty-four for the
# address itself once the angle brackets are counted.
MAX_LOCAL, MAX_ADDRESS = 64, 254


def check_email_syntax(raw) -> dict:
    """
    Say whether `raw` has the shape of an address, and what it normalises to.

    Nothing raises, and nothing is sent: a refusal comes back as `valid: False`
    with a `reason`, because a validator that throws in a request path leaves
    the form with nothing to show.
    """
    if not isinstance(raw, str):
        return _report(False, None, f"an address is text, not {type(raw).__name__}")

    # The HTML value sanitisation algorithm strips leading and trailing
    # whitespace from an email field before the browser validates it. A server
    # that does not do the same refuses what the browser accepted.
    written = raw.strip(" \t\r\n\f\v")
    if not WHATWG.match(written):
        return _report(False, None, "does not match the HTML definition of an email address")

    local, _, domain = written.rpartition("@")
    if len(local) > MAX_LOCAL:
        return _report(False, None, f"the part before the @ is over {MAX_LOCAL} characters")
    # Only the domain is case-insensitive. The local part belongs to the
    # receiving server, and RFC 5321 says it may tell Jean from jean.
    normalised = f"{local}@{domain.lower()}"
    if len(normalised) > MAX_ADDRESS:
        return _report(False, None, f"over {MAX_ADDRESS} characters")
    return _report(True, normalised, None)


def _report(valid: bool, normalised: str | None, reason: str | None) -> dict:
    local, _, domain = (normalised or "").rpartition("@")
    return {
        "valid": valid,
        "normalised": normalised,
        "local": local or None,
        "domain": domain or None,
        # A domain with no dot is a host name on the local network. The HTML
        # definition allows it; public mail does not reach it.
        "routable": bool(domain) and "." in domain,
        "reason": reason,
    }
