"""
Catch obfuscated contact details with a light classifier.

Rung N1. The regular expressions of N0 see one spelling of a phone number.
This sees the shape of one: a run of tokens that is mostly digits, mostly
short, and sitting next to words like "call" or "reach".

Training data is a few hundred labelled messages, not a few million. The
weights are small enough to keep in the repository next to this file, and
there is no service to run: the model loads with the process.
"""

import re

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline

# Digits written as words, and the characters used to stand in for digits.
DIGIT_WORDS = ("zero|one|two|three|four|five|six|seven|eight|nine|ten|"
               "zéro|un|deux|trois|quatre|cinq|six|sept|huit|neuf|dix")
LOOKALIKES = str.maketrans({"O": "0", "o": "0", "I": "1", "i": "1", "l": "1", "S": "5", "s": "5"})


def _is_digits_in_disguise(token: str) -> bool:
    """
    True when folding lookalike characters turns the whole token into digits.

    The token must already contain one real digit. Folding unconditionally
    would be a mistake: « loll » would fold to 1011 and read as a fragment of
    a phone number.
    """
    if not any(c.isdigit() for c in token):
        return False
    return token.translate(LOOKALIKES).isdigit()


def shape(text: str) -> str:
    """
    Turn a message into the features that matter, and drop the rest.

    A classifier trained on raw text memorises the training phone numbers.
    Trained on shapes, it learns what a hidden number looks like.
    """
    out = []
    for token in re.findall(r"[^\W_]+", text):
        lowered = token.lower()
        # Case matters for lookalikes, so fold before lowering.
        if re.fullmatch(DIGIT_WORDS, lowered):
            out.append("D")
        elif _is_digits_in_disguise(token):
            out.append("D" * len(token))
        elif len(lowered) >= 2:
            out.append(lowered)
    return " ".join(out)


def train(messages: list[str], labels: list[int]):
    """`labels` is 1 when the message hides contact details, 0 when it does not."""
    model = make_pipeline(
        TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 4), min_df=1),
        LogisticRegression(class_weight="balanced", max_iter=1000),
    )
    model.fit([shape(m) for m in messages], labels)
    return model


def is_hiding_contact_details(model, message: str, threshold: float = 0.5) -> bool:
    """
    Returns a decision, and the threshold is yours to set.

    Move it towards 1 if a false positive means blocking a legitimate message.
    Move it towards 0 if letting one through is the worse outcome.
    """
    score = model.predict_proba([shape(message)])[0][1]
    return bool(score >= threshold)
