"""
Validate a phone number against the numbering plan of its country.

Rung N0. Every country publishes which prefixes exist, how long a number is
behind each of them, and what kind of line it reaches. Google collects those
plans in libphonenumber and republishes them as they change — `phonenumbers`
here, `libphonenumber-js` in JavaScript. Both are a table lookup: no network,
no key, and the same answer twice.

The one thing this code refuses to do is guess. A number written 06 12 34 56 78
is French only if somebody says so; the same digits are a valid mobile number
in several other countries. So the region is either written in the number, as
the leading +, or declared by the caller, or the number is refused — never
assumed from where the server happens to run.

What comes back is the number in E.164, the region it belongs to, and the kind
of line. The kind is what tells a form that an SMS will never arrive: in France
a number starting 01 is a fixed line, and it is valid.
"""

from __future__ import annotations

import unicodedata

import phonenumbers
from phonenumbers import PhoneNumberFormat, PhoneNumberType

# The enumeration of libphonenumber, by name, so that both languages of this
# page return the same word for the same line.
TYPE_NAMES = {
    value: name
    for name, value in vars(PhoneNumberType).items()
    if isinstance(value, int) and not name.startswith("_")
}

# E.164 caps a number at fifteen digits. Forty characters leaves room for the
# spaces, dots and brackets people type, and refuses a pasted paragraph.
MAX_CHARACTERS = 40

# Everything a phone number may carry besides digits. Digits are any Unicode
# decimal digit, category Nd, which is what the JavaScript side matches too:
# a number typed in Arabic-Indic digits is a number.
PUNCTUATION = "+ .-()/"

# The space characters a word processor and a French keyboard put inside a
# number. libphonenumber has its own list of punctuation it steps over, and the
# narrow no-break space is not in it: a number grouped with those stops being
# read at the first one. They are levelled to an ordinary space, and nothing
# else is touched.
SPACES = "\t\n\r\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000"


def validate_phone_number(raw, *, default_region: str | None = None) -> dict:
    """
    Say whether `raw` is a number that exists in a numbering plan.

    `default_region` is the two-letter country the caller is expecting, and it
    is required unless the number starts with +. There is no fallback: a
    silently assumed region turns a Belgian mobile into a French one, and the
    caller would never see it happen.

    Nothing raises. A number that cannot be read comes back as `valid: False`
    with a `reason`, because a validator that throws in a request path leaves
    the form with nothing to show.
    """
    if not isinstance(raw, str):
        return _report(False, None, None, None, f"a phone number is text, not {type(raw).__name__}")
    if len(raw) > MAX_CHARACTERS:
        return _report(False, None, None, None, f"longer than {MAX_CHARACTERS} characters")

    written = "".join(" " if c in SPACES else c for c in raw).strip(" ")
    # Letters are refused rather than passed on. libphonenumber reads them as
    # the keys of a telephone keypad, so « 06 12 34 56 78 poste 42 » becomes a
    # longer number that is not the one anybody typed.
    if any(c not in PUNCTUATION and unicodedata.category(c) != "Nd" for c in written):
        return _report(False, None, None, None, "contains something that is not a number")
    if not written.startswith("+") and not default_region:
        return _report(False, None, None, None,
                       "no country code in the number and no region declared by the caller")

    try:
        parsed = phonenumbers.parse(written, default_region)
    except phonenumbers.NumberParseException:
        # The two libraries do not word their parse errors the same way, and
        # the caller acts on the refusal, not on its wording.
        return _report(False, None, None, None, "cannot be read as a phone number")

    region = phonenumbers.region_code_for_number(parsed)
    kind = TYPE_NAMES.get(phonenumbers.number_type(parsed))
    kind = None if kind == "UNKNOWN" else kind
    e164 = phonenumbers.format_number(parsed, PhoneNumberFormat.E164)

    if not phonenumbers.is_valid_number(parsed):
        # `is_possible_number` only checks the length, so it separates a number
        # that is too short from one whose prefix is not allocated.
        detail = ("no prefix of that country's plan matches"
                  if phonenumbers.is_possible_number(parsed) else "the wrong length for its country")
        return _report(False, region, kind, e164, f"not in a numbering plan: {detail}")
    return _report(True, region, kind, e164, None)


def _report(valid: bool, region: str | None, kind: str | None,
            e164: str | None, reason: str | None) -> dict:
    return {"valid": valid, "region": region, "type": kind, "e164": e164, "reason": reason}
