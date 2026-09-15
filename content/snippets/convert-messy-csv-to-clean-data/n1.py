"""
Guess what each column holds, instead of writing the schema by hand.

Rung N1. Rung N0 needs a schema: somebody has to declare that `joined` holds
dates and `amount` holds numbers. On a file with three columns that takes a
minute. On the two hundred columns of an export nobody documented, it does not
happen, and the file gets loaded as text.

The classifier never looks at a value on its own. It looks at eight traits of
a column taken as a whole — how often a value is all digits, how often it
carries a decimal mark, how many distinct values there are — and learns which
combination goes with which type, from columns labelled by hand.

The output is exactly the schema `clean_csv` of rung N0 takes as its second
argument. This rung replaces the typing, not the cleaning.
"""

import re

import numpy as np
from sklearn.linear_model import LogisticRegression

_SPACES = re.compile(r"[\s\u00a0\u202f]")
_ALL_DIGITS = re.compile(r"[+-]?[0-9]+")
_DECIMAL = re.compile(r"[+-]?[0-9]*[.,][0-9]+")
_DATE_SHAPE = re.compile(r"[0-9]{2,4}[-/.][0-9]{1,2}[-/.][0-9]{2,4}")
_LETTER = re.compile(r"[^\W\d_]")

BOOLEAN_WORDS = frozenset(
    {"true", "false", "yes", "no", "y", "n", "0", "1", "vrai", "faux", "oui", "non"}
)
LONG_VALUE = 20  # a length past which a column reads as free text

FEATURE_NAMES = (
    "all digits",
    "decimal mark",
    "date shape",
    "contains a letter",
    "boolean word",
    "distinct ratio",
    "mean length",
    "empty ratio",
)


def column_features(values: list[str]) -> list[float]:
    """
    Describe one column with eight numbers, all between zero and one.

    Blank values are set aside before the proportions are taken, and counted
    separately: a column that is mostly empty is a fact about the file, not
    about the type.

    The distinct ratio depends on the size of the sample: it falls as the
    sample grows. Small integers repeated, 0 to 3, read as integer on eight
    rows and as boolean on two hundred, and rung N0 then refuses every 2 and
    every 3, in its journal.
    """
    filled = [value.strip() for value in values if value.strip()]
    if not filled:
        return [0.0] * len(FEATURE_NAMES)
    bare = [_SPACES.sub("", value) for value in filled]
    count = len(filled)
    return [
        sum(1 for v in bare if _ALL_DIGITS.fullmatch(v)) / count,
        sum(1 for v in bare if _DECIMAL.fullmatch(v)) / count,
        sum(1 for v in bare if _DATE_SHAPE.fullmatch(v)) / count,
        sum(1 for v in filled if _LETTER.search(v)) / count,
        sum(1 for v in filled if v.lower() in BOOLEAN_WORDS) / count,
        len(set(filled)) / count,
        min(sum(len(v) for v in filled) / count, LONG_VALUE) / LONG_VALUE,
        (len(values) - count) / len(values),
    ]


def train(columns: list[list[str]], labels: list[str]):
    """
    `columns` is a list of column samples, `labels` the type name of each.

    The type names are the ones rung N0 coerces to: text, integer, number,
    date, boolean.
    """
    model = LogisticRegression(max_iter=1000, C=10.0)
    model.fit(np.array([column_features(column) for column in columns]), labels)
    return model


def classify(model, values: list[str]) -> str:
    """
    The type of one column.

    A column with nothing in it is text, and the model is not consulted:
    there is no evidence to weigh, and text is the type that loses nothing.
    """
    if not any(value.strip() for value in values):
        return "text"
    return str(model.predict(np.array([column_features(values)]))[0])


def infer_schema(model, header: list[str], rows: list[list[str]], sample: int = 200) -> dict:
    """
    Build the schema that `clean_csv` of rung N0 asks for.

    Only the first `sample` rows are read. On a file sorted, or one that
    changes as it goes, they are not the whole column: whole amounts on the
    first two hundred rows and decimals after give integer, and rung N0 then
    refuses every decimal, in its journal.
    """
    columns = [[row[i] if i < len(row) else "" for row in rows[:sample]] for i in range(len(header))]
    schema = dict.fromkeys(header, "text")  # a column with nothing in it stays text
    filled = [i for i, values in enumerate(columns) if any(value.strip() for value in values)]
    if filled:
        # One call to the model for the whole file, not one per column.
        kinds = model.predict(np.array([column_features(columns[i]) for i in filled]))
        for i, kind in zip(filled, kinds):
            schema[header[i]] = str(kind)
    return schema
