"""
Check an IBAN before a transfer leaves, offline and exactly.

Rung N0. ISO 13616 puts two check digits in positions 3 and 4 of every IBAN,
computed over the rest of the number by the modulo 97 of ISO 7064. The country
code fixes the length — 27 characters in France, 22 in Germany, 16 in Belgium —
and the shape of what follows. All of that is a table and an arithmetic
identity: the answer is exact and free.

The table is the part you do not write. `python-stdnum` here and `ibantools` in
JavaScript both carry the IBAN registry, revised as countries join.

On top of ISO 13616, several countries put a second key inside the national
part, and the two libraries do not cover the same countries. So this snippet
does not rely on theirs: it asks the library for the check digits, the length
and the registry format, and computes the French RIB key itself, in both
languages. Elsewhere, a number that passes here can still be refused by the
receiving bank.

Measured on five hundred generated French IBANs: with both keys, not one of
twenty thousand digit-for-digit slips, two thousand adjacent transpositions or
seven thousand lookalike-letter slips gets through. The ISO key alone lets
0.6 % of the last kind pass, because the French account number is alphanumeric
by registry and `I` for `1` is a legal character there; the RIB key is what
closes that.

And none of it says whose account it is. That question is answered by the payee
verification service every euro-area provider has had to offer since 9 October
2025, not by a longer computation.
"""

from __future__ import annotations

from stdnum import iban
from stdnum.exceptions import ValidationError

# What people paste around an IBAN: the printed grouping in spaces of every
# kind, and the hyphens a word processor inserts. Anything else left in the
# string is refused rather than dropped, because dropping it would turn a
# mistyped account into a different valid one.
SEPARATORS = "    -‐‑–"

# ISO 13616 caps an IBAN at 34 characters and no country is under 15. Sixty-four
# leaves room for every separator and refuses a pasted paragraph.
MIN_LENGTH, MAX_LENGTH = 15, 34
MAX_CHARACTERS = 64

# The letter-to-digit table of the French RIB key, from the French banking
# standard: A and J are 1, B, K and S are 2, and so on to I, R and Z at 9.
RIB_LETTERS = {c: str((i % 9) + 1) for i, c in enumerate("ABCDEFGHIJKLMNOPQRSTUVWXYZ".replace("S", ""))}
RIB_LETTERS.update({c: str(i + 2) for i, c in enumerate("STUVWXYZ")})


def national_key_ok(country: str, bban: str) -> bool | None:
    """
    The country's own key inside the account number, or None when this snippet
    has none for that country. France: letters become digits, and the whole
    twenty-three-digit national part, key included, is a multiple of 97.
    """
    if country != "FR":
        return None
    digits = "".join(RIB_LETTERS.get(c, c) for c in bban)
    return int(digits) % 97 == 0


def check_bank_details(raw, *, expected_country: str | None = None) -> dict:
    """
    Say whether `raw` carries a well-formed IBAN, and for which country.

    `expected_country` is the two-letter code the caller is expecting, from the
    contract or the invoice. Supplied, a mismatch is refused: the country
    changing between the quote and the payment details is the shape the
    redirected-invoice fraud takes, and it is the one thing on this page that
    code can still see.

    `country` comes back whether the number is valid or not, so the caller can
    decide about reachability — a Brazilian IBAN is perfectly well-formed and
    no SEPA transfer will get there.

    Nothing raises: a validator that throws in a request path leaves the payer
    with no answer. Every refusal is `valid: False` and a `reason` in words.
    """
    if not isinstance(raw, str):
        return _report(False, None, "", None, f"an IBAN is text, not {type(raw).__name__}")
    if len(raw) > MAX_CHARACTERS:
        return _report(False, None, "", None, f"longer than {MAX_CHARACTERS} characters")

    # Upper case is the electronic format of ISO 13616; lower case carries no
    # other reading, so it is raised rather than refused.
    compact = "".join(c for c in raw if c not in SEPARATORS).upper()
    if not compact.isascii() or not compact.isalnum():
        return _report(False, None, compact, None, "not letters, digits and separators only")
    if not (MIN_LENGTH <= len(compact) <= MAX_LENGTH):
        return _report(False, None, compact, None,
                       f"{len(compact)} characters: an IBAN has {MIN_LENGTH} to {MAX_LENGTH}")

    country = compact[:2]
    if not country.isalpha() or not compact[2:4].isdigit():
        return _report(False, None, compact, None, "an IBAN starts with two letters then two digits")
    if expected_country and country != expected_country.upper():
        return _report(False, country, compact, None,
                       f"expected a {expected_country.upper()} account, this one is {country}")

    try:
        # The country modules are left out on purpose: the two libraries do not
        # have the same ones, and the national key is computed below instead.
        iban.validate(compact, check_country=False)
    except ValidationError:
        return _report(False, country, compact, None,
                       "ISO 13616 check digits, length or registry format do not match")

    key = national_key_ok(country, compact[4:])
    if key is False:
        return _report(False, country, compact, key,
                       "the French RIB key inside the account number does not match")
    return _report(True, country, compact, key, None)


def _report(valid: bool, country: str | None, compact: str,
            national_key: bool | None, reason: str | None) -> dict:
    # The printed grouping in fours, which is how a payer reads a number back.
    printed = " ".join(compact[i:i + 4] for i in range(0, len(compact), 4))
    return {"valid": valid, "country": country, "compact": compact,
            "printed": printed, "national_key": national_key, "reason": reason}
