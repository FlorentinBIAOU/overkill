from n0 import validate

# The schema lives in the test, not in the snippet: it is example data, and the
# JavaScript test declares exactly the same one, field for field.
SCHEMA = {
    "email": {
        "required": True,
        "pattern": r"[^@\s]+@[^@\s]+\.[a-z]{2,}",
        "message": "is not a valid email address",
    },
    "display_name": {"required": True, "min": 2, "max": 30},
    "age": {"required": True, "type": "integer", "min": 18, "max": 130},
    "website": {"pattern": r"https?://\S+"},
}

VALID = {
    "email": "ada@example.com",
    "display_name": "Ada",
    "age": 36,
    "website": "https://example.com",
}


def test_a_valid_submission_passes():
    assert validate(VALID, SCHEMA) == {}


def test_an_optional_field_may_be_absent():
    assert validate({k: v for k, v in VALID.items() if k != "website"}, SCHEMA) == {}


def test_one_error_per_faulty_field_naming_the_field():
    errors = validate(
        {"email": "ada.example.com", "display_name": "A", "age": 12, "website": "nope"},
        SCHEMA,
    )
    assert errors == {
        "email": "is not a valid email address",
        "display_name": "must be at least 2 characters",
        "age": "must be at least 18",
        "website": "is not in the expected format",
    }


def test_a_missing_required_field_is_reported_by_name():
    assert validate({}, SCHEMA) == {
        "email": "is required",
        "display_name": "is required",
        "age": "is required",
    }


def test_an_empty_string_counts_as_missing():
    # This is what a browser posts for a field the user left alone.
    assert validate({**VALID, "email": ""}, SCHEMA)["email"] == "is required"


def test_a_wrong_type_is_reported_before_the_bounds():
    # "12" breaks two rules at once; only the first one is reported, so the
    # user fixes one thing at a time.
    assert validate({**VALID, "age": "12"}, SCHEMA) == {"age": "must be of type integer"}


def test_a_value_out_of_bounds():
    assert validate({**VALID, "age": 150}, SCHEMA) == {"age": "must be at most 130"}
    assert validate({**VALID, "display_name": "A" * 31}, SCHEMA) == {
        "display_name": "must be at most 30 characters"
    }


def test_a_boolean_is_not_an_integer():
    # In Python True is an int; a checkbox is still not an age.
    assert validate({**VALID, "age": True}, SCHEMA) == {"age": "must be of type integer"}


def test_breaking_point_a_well_formed_address_that_does_not_exist():
    """
    The breaking point claimed on the entry: no rule can say whether an address
    exists. This one is well formed, nobody reads mail there, and the validator
    accepts it — deciding otherwise takes an external check, which is a
    different need.
    """
    unreachable = {**VALID, "email": "ada@no-such-mailbox.example"}
    assert validate(unreachable, SCHEMA) == {}
