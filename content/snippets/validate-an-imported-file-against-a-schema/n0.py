"""
Validate an imported document against the schema it is supposed to follow.

Rung N0. JSON Schema is a published standard, and a validator is a program that
applies it: every failure comes back with the place it happened and the rule it
broke. There is nothing to guess, and nothing to learn — a schema is the
contract, written once, and the same document validates the same way for ever.

`jsonschema` applies it here, `ajv` in JavaScript. Two things they both do that
catch people out, and that this file settles rather than inherits.

`format` is an annotation, not an assertion. The two libraries react to that
differently, and both reactions surprise somebody: `jsonschema` accepts
« 12/01/2026 » and « 2026-02-30 » against `"format": "date"` without a word,
while `ajv` refuses to compile the schema at all until the formats are
registered. Switching the format checker on, below, is what makes the two
agree — and makes both refuse those two dates.

And a validator stops at the first failure unless it is told not to. An import
is checked once and corrected once, so every error is collected, capped, and
the report says how many were left out rather than pretending there were none.

What comes back is a path and a rule name for each failure. The wording of the
message belongs to the library and differs between the two; the path and the
rule are what your code should branch on.
"""

from __future__ import annotations

import json

from jsonschema import Draft202012Validator, FormatChecker

# A file with one systematic mistake produces one error per record. Two hundred
# is enough to see the pattern; the count says how many more there were.
MAX_ERRORS = 200

# Compiling a schema costs far more than checking one document against it, and
# an import checks thousands against the same schema. The compiled form is kept
# here, keyed by the schema itself; the cap is what stops a caller that builds
# a new schema per record from filling memory.
_COMPILED: dict[str, object] = {}
MAX_COMPILED = 32


def validate_import(document, schema) -> dict:
    """
    Check `document` against `schema`, and return every failure.

    `errors` carries, for each one, the JSON Pointer of the value and the name
    of the rule it broke — the two things a caller can act on — plus the
    library's own message, which is for a human to read and not for code to
    match on.

    A schema that is itself invalid is reported as such rather than raised:
    on an import path, a broken contract is an incident to log, not a crash.
    """
    validator = _compiled(schema)
    if validator is None:
        return _report(False, [], 0, "this schema is not usable")
    try:
        failures = sorted(validator.iter_errors(document), key=_order)
    except Exception:  # noqa: BLE001 - a broken contract is an answer too
        return _report(False, [], 0, "this schema is not usable")
    kept = [{"path": _pointer(error.absolute_path),
             "rule": str(error.validator),
             "message": error.message}
            for error in failures[:MAX_ERRORS]]
    return _report(not failures, kept, len(failures), None)


def _compiled(schema):
    """The compiled validator for this schema, or None when it is not usable."""
    try:
        key = json.dumps(schema, sort_keys=True)
    except TypeError:
        return None
    if key not in _COMPILED:
        try:
            # The schema itself is checked first: a rule the standard does not
            # define — « objet » for « object » — would otherwise only surface
            # as an exception in the middle of a file, on the first value that
            # uses it.
            Draft202012Validator.check_schema(schema)
            _COMPILED[key] = Draft202012Validator(schema, format_checker=FormatChecker())
        except Exception:  # noqa: BLE001 - a broken contract is an answer too
            _COMPILED[key] = None
        if len(_COMPILED) > MAX_COMPILED:
            del _COMPILED[next(iter(_COMPILED))]
    return _COMPILED[key]


def _order(error):
    """
    A single order, in both languages: by place in the document, then by rule.
    An index sorts as a number, so record 10 comes after record 2 and not
    after record 1 as a string comparison would have it.
    """
    steps = [(0, step, "") if isinstance(step, int) else (1, 0, str(step))
             for step in error.absolute_path]
    return (steps, str(error.validator))


def _pointer(path) -> str:
    """The JSON Pointer of a value, which is what both libraries can produce."""
    return "".join(f"/{str(step).replace('~', '~0').replace('/', '~1')}" for step in path)


def _report(valid: bool, errors: list, total: int, reason: str | None) -> dict:
    return {"valid": valid, "errors": errors, "error_count": total,
            "truncated": total > len(errors), "reason": reason}
