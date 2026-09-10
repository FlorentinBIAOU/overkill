"""
Validate a form on the server: a declarative schema, one error per field.

Rung N0. Deterministic, standard library only. The whole point of this entry is
that a validator worth having fits in forty lines, so the rules stay readable
and every refusal can be explained to the person who typed the form.

Three decisions carry the design.

First, the schema is data, not code. It can be written next to the form, read by
someone who does not write Python, and compared with the JavaScript one that
guards the same form in the browser.

Second, the answer is a mapping of field name to message, never a boolean. A
form that answers "no" without saying which field is wrong sends the user
hunting, and sends the developer to the logs.

Third, one message per field: checks stop at the first broken rule. Telling
someone their password is too short *and* badly formed at once is noise; fix
the first thing, resubmit, see the next.
"""

import re

# The types a form field can hold once decoded. `bool` is excluded from
# `integer` on purpose: in Python a boolean *is* an int, and a checkbox is not
# an age.
TYPES = {
    "string": lambda v: isinstance(v, str),
    "integer": lambda v: isinstance(v, int) and not isinstance(v, bool),
}


def check(value, rule):
    """Return the first broken rule as a message, or None if the value passes."""
    kind = rule.get("type", "string")
    if not TYPES[kind](value):
        return f"must be of type {kind}"
    # For a string the bounds read as a length; for a number, as a value.
    size, unit = (len(value), " characters") if kind == "string" else (value, "")
    if "min" in rule and size < rule["min"]:
        return f"must be at least {rule['min']}{unit}"
    if "max" in rule and size > rule["max"]:
        return f"must be at most {rule['max']}{unit}"
    if "pattern" in rule and not re.fullmatch(rule["pattern"], value):
        return rule.get("message", "is not in the expected format")
    return None


def validate(data, schema):
    """
    Check a submitted form against a schema, and return {field: message}.

    An empty mapping means the form is valid. A missing key, an explicit None
    and an empty string are the same thing here, because that is what a browser
    posts for a field the user left alone.
    """
    errors = {}
    for field, rule in schema.items():
        value = data.get(field)
        if value is None or value == "":
            if rule.get("required"):
                errors[field] = "is required"
            continue
        message = check(value, rule)
        if message is not None:
            errors[field] = message
    return errors
