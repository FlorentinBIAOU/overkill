"""
The labelled columns live here, never in the snippet.

Twenty-one columns, the kind an afternoon of tagging produces. That is the
real size of the training set this rung needs, and showing it is part of the
argument: a classifier is only cheap if its labelling is.
"""

from n0 import clean_csv
from n1 import classify, column_features, infer_schema, train

LABELLED = {
    "integer": [
        ["1", "2", "3", "4", "5", "6"],
        ["1024", "2048", "4096", "8192"],
        ["12", "7", "103", "5", "88", "41"],
        ["-3", "14", "0", "27", "5"],
    ],
    "number": [
        ["1.5", "2.75", "3.0", "4.25"],
        ["12,50", "0,99", "1234,56", "7,10"],
        ["-0.5", "10.25", "3.75", "0.1"],
        ["100.0", "250.5", "99.99", "12.30"],
    ],
    "date": [
        ["2023-04-12", "2023-05-01", "2024-01-09"],
        ["01/05/2023", "12/11/2022", "30/06/2021"],
        ["09.01.2024", "28.02.2023", "15.07.2022"],
        ["2020-12-31", "2021-01-01", "2022-06-15", "2023-03-03"],
    ],
    "boolean": [
        ["yes", "no", "yes", "no", "yes"],
        ["true", "false", "true", "true", "false"],
        ["0", "1", "1", "0", "1", "0"],
        ["oui", "non", "oui", "non"],
    ],
    "text": [
        ["Alice", "Bob", "Carol", "Dan"],
        ["Paris", "Lyon", "Marseille", "Lille"],
        ["a short note", "another note here", "something else entirely"],
        ["AB1", "CD2", "EF3", "GH4"],
        ["thé vert", "café au lait", "jus d'orange"],
    ],
}

COLUMNS = [column for kind in LABELLED for column in LABELLED[kind]]
LABELS = [kind for kind in LABELLED for _ in LABELLED[kind]]

HEADER = ["id", "name", "joined", "amount", "active"]
ROWS = [
    ["1", "Alice", "2023-04-12", "12.50", "yes"],
    ["2", "Bob", "2023-05-01", "3.99", "no"],
    ["3", "Carol", "2023-06-30", "120.00", "yes"],
    ["4", "Dan", "2023-07-14", "7.25", "no"],
    ["5", "Eve", "2023-08-02", "45.10", "yes"],
]


def make_model():
    return train(COLUMNS, LABELS)


def test_features_are_proportions_between_zero_and_one():
    features = column_features(["12", "7", "103"])
    assert all(0.0 <= value <= 1.0 for value in features)
    assert features[0] == 1.0  # all digits
    assert features[3] == 0.0  # none contains a letter
    # Twice as many values of the same shape give the same shape traits: they
    # are proportions, not counts. Only the traits that describe the sample
    # itself, such as how many values are distinct, move.
    deeper = column_features(["12", "7", "103", "44", "9", "271"])
    assert deeper[:5] == features[:5]


def test_infers_the_schema_of_a_file_nobody_documented():
    schema = infer_schema(make_model(), HEADER, ROWS)
    assert schema == {
        "id": "integer",
        "name": "text",
        "joined": "date",
        "amount": "number",
        "active": "boolean",
    }


def test_the_inferred_schema_is_what_rung_n0_takes():
    data = (
        "id,name,joined,amount,active\n"
        "1,Alice,2023-04-12,12.50,yes\n"
        "2,Bob,2023-05-01,3.99,no\n"
        "3,Carol,2023-06-30,120.00,yes\n"
        "4,Dan,2023-07-14,7.25,no\n"
        "5,Eve,2023-08-02,45.10,yes\n"
    ).encode("utf-8")
    result = clean_csv(data, infer_schema(make_model(), HEADER, ROWS))
    assert result["rejects"] == []
    assert result["rows"][0] == {
        "id": 1,
        "name": "Alice",
        "joined": "2023-04-12",
        "amount": 12.50,
        "active": True,
    }


def test_columns_with_little_or_nothing_in_them():
    model = make_model()
    # No evidence at all: text, and the model is not consulted.
    assert classify(model, ["", "  ", ""]) == "text"
    assert classify(model, []) == "text"
    # A column that is mostly empty is still typed on what it does contain.
    assert classify(model, ["2023-04-12", "", "", "2024-01-09", ""]) == "date"
    # A single value is thin evidence, but it is evidence.
    assert classify(model, ["2023-04-12"]) == "date"


def test_the_limit_of_this_rung_an_identifier_that_looks_like_a_number():
    """
    A postcode is not a quantity, and neither is a product reference. Both are
    made of digits, so every trait this rung measures says integer, and the
    classifier says integer. It is not wrong about the shape; it has no way to
    be right about the meaning.

    The cost is silent, which is what makes it worth a test: rung N0 then
    coerces the value and the leading zero is gone for good. Nothing is
    rejected, because nothing failed.
    """
    model = make_model()
    postcodes = ["01000", "06400", "75014", "02100", "13008"]
    assert classify(model, postcodes) == "integer"

    data = b"postcode\n01000\n06400\n75014\n"
    result = clean_csv(data, {"postcode": classify(model, postcodes)})
    assert result["rejects"] == []
    assert [row["postcode"] for row in result["rows"]] == [1000, 6400, 75014]
