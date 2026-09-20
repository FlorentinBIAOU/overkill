"""
Check a request body against the OpenAPI document that describes the endpoint.

Rung N0. An OpenAPI document is the contract, and inside it every request body
is a JSON Schema. So validating a payload is two lookups and one validation:
find the operation the request is aimed at, take the schema it declares, apply
it. All three are exact, and the same document validates the same way on the
client side and on the server side.

The operation is found the way the standard says: an exact path wins over a
templated one, so `/factures/resume` is the summary endpoint and not an invoice
whose identifier happens to be « resume ». Getting that precedence wrong
validates a request against the wrong schema and says yes.

References are left to the validator. Putting the whole document at the root of
the schema and pointing at the operation with a JSON Pointer means every
`$ref: '#/components/schemas/…'` inside it resolves on its own, however deep
and however recursive.

One count is normalised. The two libraries do not report an unexpected
property the same way — `ajv` gives one failure per property, `jsonschema` a
single one for all of them — so `additionalProperties` failures at the same
place are collapsed into one. Every other rule is left as it comes.

One conversion is done by hand, because the two libraries disagree about it.
OpenAPI 3.0 writes an optional null as `nullable: true`, which is not JSON
Schema: `ajv` honours it, `jsonschema` ignores it and refuses a null the
contract allows. It is rewritten here into the `type` the standard uses, so
both languages answer the same thing.
"""

from __future__ import annotations

import json

from jsonschema import Draft202012Validator, FormatChecker

# The methods an operation can be written under, as OpenAPI spells them.
METHODS = ("get", "put", "post", "delete", "options", "head", "patch", "trace")

MAX_ERRORS = 200

# This runs on a request path, and compiling a document costs more than
# checking one body against it — far more in JavaScript, where `ajv` generates
# code, than in Python, where `jsonschema` interprets. The compiled validators
# are kept here, keyed by the document and the operation; the cap is what stops
# a caller that builds a new document per request from filling memory.
_COMPILED: dict = {}
MAX_COMPILED = 64


def validate_request(document, method: str, path: str, body) -> dict:
    """
    Say whether `body` matches what the document declares for this endpoint.

    `operation` in the report is the operation that was matched, so a caller
    can see which schema the answer came from: a request validated against the
    wrong path is a yes that means nothing.
    """
    if not isinstance(document, dict) or not isinstance(path, str):
        return _report(False, None, [], 0, "this document is not usable")

    template = _match_path(document.get("paths") or {}, path)
    if template is None:
        return _report(False, None, [], 0, f"no path in the document matches {path}")
    operation = (document["paths"][template] or {}).get(str(method).lower())
    if not isinstance(operation, dict):
        return _report(False, None, [], 0, f"{method} is not declared on {template}")

    name = f"{str(method).lower()} {template}"
    content = ((operation.get("requestBody") or {}).get("content") or {})
    schema = (content.get("application/json") or {}).get("schema")
    if schema is None:
        # No body declared: anything sent is outside the contract, and the
        # contract is what this function answers about.
        return _report(body is None, name, [], 0, None if body is None else "no body is declared")

    pointer = (f"#/paths/{_escape(template)}/{str(method).lower()}"
               f"/requestBody/content/{_escape('application/json')}/schema")
    validator = _compiled(document, pointer)
    if validator is None:
        return _report(False, name, [], 0, "this document is not usable")
    try:
        failures = sorted(validator.iter_errors(body),
                          key=lambda e: (_pointer_of(e.absolute_path), str(e.validator)))
    except Exception:  # noqa: BLE001 - a broken contract is an answer too
        return _report(False, name, [], 0, "this document is not usable")

    kept = []
    for error in failures:
        entry = {"path": _pointer_of(error.absolute_path), "rule": str(error.validator)}
        if entry["rule"] == "additionalProperties" and entry in kept:
            continue
        kept.append(entry)
    return _report(not kept, name, kept[:MAX_ERRORS], len(kept), None)


def _compiled(document, pointer: str):
    """The compiled validator for this operation, or None when it is not usable."""
    try:
        key = (json.dumps(document, sort_keys=True), pointer)
    except TypeError:
        return None
    if key not in _COMPILED:
        try:
            root = {**_without_nullable(document), "$ref": pointer}
            _COMPILED[key] = Draft202012Validator(root, format_checker=FormatChecker())
        except Exception:  # noqa: BLE001 - a broken contract is an answer too
            _COMPILED[key] = None
        if len(_COMPILED) > MAX_COMPILED:
            del _COMPILED[next(iter(_COMPILED))]
    return _COMPILED[key]


def _match_path(paths, path: str) -> str | None:
    """The path template this request belongs to, exact match winning."""
    if path in paths:
        return path
    wanted = path.strip("/").split("/")
    for template in sorted(paths):
        steps = template.strip("/").split("/")
        if len(steps) != len(wanted):
            continue
        if all(s.startswith("{") and s.endswith("}") or s == w for s, w in zip(steps, wanted)):
            return template
    return None


def _without_nullable(value):
    """OpenAPI 3.0's `nullable: true`, rewritten into the type JSON Schema uses."""
    if isinstance(value, list):
        return [_without_nullable(item) for item in value]
    if not isinstance(value, dict):
        return value
    out = {key: _without_nullable(item) for key, item in value.items() if key != "nullable"}
    if value.get("nullable") is True and isinstance(out.get("type"), str):
        out["type"] = [out["type"], "null"]
    return out


def _escape(step: str) -> str:
    return step.replace("~", "~0").replace("/", "~1")


def _pointer_of(path) -> str:
    return "".join(f"/{_escape(str(step))}" for step in path)


def _report(valid, operation, errors, total, reason) -> dict:
    return {"valid": valid, "operation": operation, "errors": errors,
            "error_count": total, "truncated": total > len(errors), "reason": reason}
