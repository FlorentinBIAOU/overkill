"""
Route comments with a self-hosted toxicity classifier.

Rung N2. An encoder fine-tuned on the labelled comments of a public toxicity
challenge, running on your own machine. It arrives trained, which N1 makes you
gather a corpus for, and it stays inside your infrastructure, which matters
when the text you would send away is the abuse one of your users just
received.

The model and the labels that may decide go together, and the language of your
comments chooses the pair. The English one scores seven separate harms, which
is what you show a moderator; the multilingual one, whose card lists French
among fourteen languages, scores one. Picking the English model for a French
forum returns numbers, not errors, which is the failure this rung is most
likely to hand you.

What you own on this rung is not the model, it is everything around it: the
batching, the thresholds, the labels that may decide, and the answer to "what
does the code do when the model says nothing usable". The model itself is a
black box with a fixed list of labels, and the last function below is where
that becomes your problem.
"""

from __future__ import annotations

import functools

# English only: its corpus is Civil Comments. Seven labels name a harm; the
# model also scores which identities a comment mentions (male, muslim, black…),
# and those say who is mentioned, not what is done to them, so they are left out
# and never decide anything here.
ENGLISH = ("unitary/unbiased-toxic-roberta",
           ("toxicity", "severe_toxicity", "obscene", "identity_attack",
            "insult", "threat", "sexual_explicit"))

# Fourteen languages, French among them, and one label for all of them: its
# card lists the languages and publishes a validation score per language. What
# you lose is the breakdown — "insult" or "threat" is what a moderator reads,
# "toxic 0.87" is what is left. Its licence is not the other one's either: read
# both before you ship.
MULTILINGUAL = ("gravitee-io/distilbert-multilingual-toxicity-classifier", ("toxic",))

# The examples on this page are English, so this file is set to the English
# pair. A French forum swaps the line, and loses the breakdown with it.
MODEL_NAME, HARM_LABELS = ENGLISH

# Two thresholds, not one: between "obviously fine" and "obviously not" there
# is a band that belongs to a human. These two numbers are examples, not
# defaults to leave alone: calibrate them on a sample of your own comments that
# somebody has read by hand.
DEFAULT_THRESHOLDS = {"block": 0.9, "review": 0.6}


class ToxicityModel:
    """The real model. A large download: load it once, with `default_model`."""

    def __init__(self, name: str = MODEL_NAME) -> None:
        from transformers import pipeline

        # Truncated to the length the model reads, as Transformers.js does:
        # whatever sits past it in a very long comment is not scored.
        self._pipe = pipeline("text-classification", model=name, top_k=None, truncation=True)

    def predict(self, comments: list[str]) -> list[dict[str, float]]:
        """One label-to-score mapping per comment, in the order given."""
        return [{r["label"]: r["score"] for r in row} for row in self._pipe(comments)]


@functools.cache
def default_model() -> ToxicityModel:
    """The real model, loaded on first use and kept for the process."""
    return ToxicityModel()


class ModerationUnavailable(Exception):
    """The model answered something no caller can act on."""


def moderate(comments, classifier=None, thresholds=None, labels=HARM_LABELS) -> list[dict]:
    """
    Decide what to do with each comment: block, send to review, or allow.

    `classifier` is injected so this can be tested without downloading the
    weights. In production it defaults to the real model above, and `labels`
    has to be the label set of whichever model that is.

    The whole list goes to the classifier in one call. Whether the model then
    reads the comments together is the library's business: transformers
    batches only when given a `batch_size`, and leaves it off by default.
    """
    comments = list(comments)
    if not comments:
        return []
    classifier = classifier or default_model()
    thresholds = thresholds or DEFAULT_THRESHOLDS
    scored = classifier.predict(comments)
    if len(scored) != len(comments):
        raise ModerationUnavailable("the model returned one row per comment, and did not")
    return [_decide(row, thresholds, labels) for row in scored]


def _decide(scores, thresholds: dict[str, float], labels) -> dict:
    """
    Keep the strongest harm label, and fall back to a human when nothing is usable.

    Falling back to "allow" would be the tempting shortcut, and it would mean
    that a model failure silently publishes everything it was asked about.
    """
    rows = scores.items() if isinstance(scores, dict) else ()
    usable = {label: v for label, v in rows if label in labels and _is_score(v)}
    if not usable:
        return {"action": "review", "label": None, "score": None}
    label, value = max(usable.items(), key=lambda item: item[1])
    if value >= thresholds["block"]:
        action = "block"
    elif value >= thresholds["review"]:
        action = "review"
    else:
        action = "allow"
    return {"action": action, "label": label, "score": value}


def _is_score(value) -> bool:
    """A number the caller can act on, rather than whatever came back."""
    return isinstance(value, (int, float)) and not isinstance(value, bool) and 0.0 <= value <= 1.0
