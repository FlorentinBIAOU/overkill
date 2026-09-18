"""
Validate a form on the server: a declarative schema, one error per field.

Rung N0. Deterministic, standard library only. The rules stay readable, and
every refusal can be explained to the person who typed the form.

Four decisions carry the design.

First, the schema is data, not code. It can be written next to the form, read by
someone who does not write Python, and handed to the JavaScript version that
guards the same form in the browser. A pattern means the same thing on both
sides only with explicit classes: the shorthands for a digit and a word
character reach beyond ASCII in Python and stop at it in JavaScript, so write
[0-9] and [A-Za-z].

Second, the answer is a mapping of field name to message, never a boolean. A
form that answers "no" without saying which field is wrong sends the user
hunting, and sends the developer to the logs.

Third, one message per field: checks stop at the first broken rule. Telling
someone their password is too short *and* badly formed at once is noise; fix
the first thing, resubmit, see the next.

Fourth, leading and trailing whitespace comes off every string before anything
is checked, and a string left empty by that is treated as absent. A browser
sends what the user typed, and a phone's autofill adds a space: without this,
" ada@example.com" is refused by a pattern nobody can see the fault in, and a
required field filled with two spaces passes as filled. The HTML standard
trims the value of an email field for the same reason.

One thing the schema has to carry, and this file cannot: a maximum length on
every string. A field without `max` accepts megabytes, and the pattern is then
applied to megabytes.
"""

import re
import unicodedata

# The types a form field can hold once decoded. `bool` is excluded from
# `integer` on purpose: in Python a boolean *is* an int, and a checkbox is not
# an age. 36.0 is an integer, as it is in JavaScript.
TYPES = {
    "string": lambda v: isinstance(v, str),
    "integer": lambda v: not isinstance(v, bool)
    and (isinstance(v, int) or (isinstance(v, float) and v.is_integer())),
}


def trimmed(value):
    """A string without its edge whitespace; anything else is left alone."""
    return value.strip() if isinstance(value, str) else value


def check(value, rule):
    """Return the first broken rule as a message, or None if the value passes."""
    kind = rule.get("type", "string")
    if not TYPES[kind](value):
        return f"must be of type {kind}"
    # For a string the bounds read as a length; for a number, as a value. The
    # length counts code points once composed (NFC), as the JavaScript version
    # does: "é" counts one however it was typed, and an emoji made of several
    # code points, such as a flag, still counts several.
    text = unicodedata.normalize("NFC", str(value))
    size, unit = (len(text), " characters") if kind == "string" else (value, "")
    if "min" in rule and size < rule["min"]:
        return f"must be at least {rule['min']}{unit}"
    if "max" in rule and size > rule["max"]:
        return f"must be at most {rule['max']}{unit}"
    if "pattern" in rule and not re.fullmatch(rule["pattern"], text):
        return rule.get("message", "is not in the expected format")
    return None


def validate(data, schema):
    """
    Check a submitted form against a schema, and return {field: message}.

    An empty mapping means the form is valid. A missing key, an explicit None,
    an empty string and a string of spaces are the same thing here, because
    that is what a browser posts for a field the user left alone.
    """
    # A field the schema does not declare is refused, not ignored: whoever
    # stores the submission would otherwise store it too.
    errors = {field: "is not a field of this form" for field in data if field not in schema}
    for field, rule in schema.items():
        value = trimmed(data.get(field))
        if value is None or value == "":
            if rule.get("required"):
                errors[field] = "is required"
            continue
        message = check(value, rule)
        if message is not None:
            errors[field] = message
    return errors
