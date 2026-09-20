"""
Check a French company identification number, offline and exactly.

Rung N0. A SIREN is nine digits, a SIRET fourteen, and the last digit of each
is computed from the ones before it. Checking it is arithmetic: the answer is
exact, it is the same every time, and it costs nothing.

The arithmetic is not what you write. A standard-number library carries it —
`python-stdnum` here, `stdnum-js` in JavaScript — and with it the exception a
hand-written Luhn gets wrong: every establishment of La Poste shares the SIREN
356000000, and their SIRETs do not satisfy Luhn. The rule INSEE gives for them
is that the plain sum of the fourteen digits is a multiple of five.
35600000009075, the Rennes establishment, fails Luhn and is valid.

What the key proves is narrow, and the report says which one was applied so the
caller can tell. A number can be well-formed and belong to nobody: 000000000
passes. Whether the company exists, and is still trading, is a lookup in the
Sirene register, not a harder computation.
"""

from __future__ import annotations

from stdnum.fr import siren, siret

# The separators people paste around these numbers: the ordinary space, the
# non-breaking ones a spreadsheet inserts, the full stop, the hyphens. Anything
# else surviving the clean-up is refused rather than quietly dropped, which is
# what turns a mistyped number into a different valid one.
SEPARATORS = " .  -‐‑–"

# Nine digits, or fourteen. Sixty-four characters leaves room for every
# separator anyone has pasted and refuses a pasted paragraph.
MAX_CHARACTERS = 64

VALIDATORS = {"SIREN": (9, siren.is_valid), "SIRET": (14, siret.is_valid)}
BY_LENGTH = {9: "SIREN", 14: "SIRET"}


def check_company_number(raw, *, expected: str | None = None) -> dict:
    """
    Say whether `raw` carries a well-formed SIREN or SIRET.

    `expected` is the kind the caller is asking for, "SIREN" or "SIRET". Left
    out, the length decides — the only reading there is, since the two lengths
    do not overlap — and `kind` in the report says which one was checked.

    Nothing here raises on bad input: a validator that throws in a request path
    leaves the form with no answer to show. Every refusal comes back as
    `valid: False` with a `reason` in plain words.
    """
    if not isinstance(raw, str):
        return _report(False, None, "", f"a company number is text, not {type(raw).__name__}")
    if len(raw) > MAX_CHARACTERS:
        return _report(False, None, "", f"longer than {MAX_CHARACTERS} characters")

    compact = "".join(character for character in raw if character not in SEPARATORS)
    # `str.isdigit` is true of Arabic-Indic and other decimal digits, which the
    # checksum cannot be computed on; ASCII is what the register uses.
    if not compact or not compact.isascii() or not compact.isdigit():
        return _report(False, None, compact, "not digits and separators only")

    kind = expected or BY_LENGTH.get(len(compact))
    if kind not in VALIDATORS:
        return _report(False, None, compact, f"{len(compact)} digits: expected nine or fourteen")

    length, is_valid = VALIDATORS[kind]
    if len(compact) != length:
        return _report(False, kind, compact, f"{kind} is {length} digits, got {len(compact)}")
    if not is_valid(compact):
        return _report(False, kind, compact, f"the check digit of this {kind} does not match")
    return _report(True, kind, compact, None)


def _report(valid: bool, kind: str | None, compact: str, reason: str | None) -> dict:
    return {"valid": valid, "kind": kind, "compact": compact, "reason": reason}
