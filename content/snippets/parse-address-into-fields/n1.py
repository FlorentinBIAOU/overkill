"""
Label every token of an address with a logistic regression on context traits.

Rung N1. N0 reads the address it expects; this one reads the address it is
given. Each word is labelled on its own — number, street type, street name,
complement, postcode, town — from what it looks like and from what sits on
either side of it. Fields are then rebuilt from the labels.

That is the whole gain: a complement in the middle of the line no longer
swallows the street, because « Bâtiment » is a word the model has seen in that
position, not an unexpected token in a fixed pattern.

The price is a labelled training set. A few dozen addresses tagged by hand are
enough to start, and every convention absent from that set is a convention the
model does not know.
"""

import re
import unicodedata

from sklearn.feature_extraction import DictVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline

# The labels are the fields, so the mapping back is a grouping and nothing more.
LABELS = ("number", "street_type", "street", "complement", "postcode", "city")

TOKEN = re.compile(r"[^\W_]+")


def tokenise(address: str) -> list[str]:
    """Words and numbers, punctuation dropped."""
    return TOKEN.findall(unicodedata.normalize("NFKC", address))


def fold(word: str) -> str:
    """Lowercase and accent-free, so « Allée » and « allee » share a trait."""
    decomposed = unicodedata.normalize("NFD", word.lower())
    return "".join(c for c in decomposed if not unicodedata.combining(c))


def features(tokens: list[str], i: int) -> dict:
    """
    What the token looks like, and what surrounds it.

    The neighbours carry most of the signal: five digits followed by one
    capitalised word is a postcode and a town, wherever it sits in the line.
    """
    token = tokens[i]
    return {
        f"token={fold(token)}": 1,
        f"previous={fold(tokens[i - 1]) if i else '<start>'}": 1,
        f"next={fold(tokens[i + 1]) if i + 1 < len(tokens) else '<end>'}": 1,
        "digits": float(token.isdigit()),
        "five_digits": float(token.isdigit() and len(token) == 5),
        "short_number": float(token.isdigit() and len(token) <= 3),
        "capitalised": float(token[:1].isupper()),
        "position": i / len(tokens),
        "last": float(i == len(tokens) - 1),
    }


def train(examples):
    """
    `examples` pairs an address with one label per token, in reading order.

    Tagging is the work of this rung, and mistagging it is the usual way the
    rung is made to fail, so a misaligned example is rejected rather than
    quietly learnt.
    """
    rows, targets = [], []
    for address, labels in examples:
        tokens = tokenise(address)
        if len(tokens) != len(labels):
            raise ValueError(f"{len(tokens)} tokens for {len(labels)} labels: {address!r}")
        rows += [features(tokens, i) for i in range(len(tokens))]
        targets += list(labels)
    model = make_pipeline(
        DictVectorizer(),
        LogisticRegression(max_iter=1000, class_weight="balanced"),
    )
    model.fit(rows, targets)
    return model


def parse(model, address: str) -> dict:
    """Group the labelled tokens back into fields, in reading order."""
    fields = dict.fromkeys(LABELS, "")
    tokens = tokenise(address)
    if not tokens:
        return fields
    predicted = model.predict([features(tokens, i) for i in range(len(tokens))])
    for token, label in zip(tokens, predicted):
        fields[label] = f"{fields[label]} {token}".strip()
    # The street type stays available on its own, and also opens the street, so
    # the output can be compared field by field with the rung below.
    fields["street"] = f"{fields['street_type']} {fields['street']}".strip()
    return fields
