"""
Route comments with a self-hosted toxicity classifier.

Rung N2. A distilled encoder fine-tuned on a moderation corpus, running on
your own machine. It reads context the n-grams of N1 cannot, and it stays
inside your infrastructure, which matters when the text you are sending away
is the abuse one of your users just received.

What you own on this rung is not the model, it is everything around it: the
batching, the thresholds, and the answer to "what does the code do when the
model says nothing usable". The model itself is a black box with a fixed list
of labels, and the last function below is where that becomes your problem.
"""

from __future__ import annotations

MODEL_NAME = "unitary/unbiased-toxic-roberta"

# Two thresholds, not one: between "obviously fine" and "obviously not" there
# is a band that belongs to a human, and pretending otherwise is how automated
# moderation earns its reputation.
DEFAULT_THRESHOLDS = {"block": 0.9, "review": 0.6}


class ToxicityModel:
    """The real model, loaded once and kept in memory for the process."""

    def __init__(self, name: str = MODEL_NAME) -> None:
        from transformers import pipeline  # a large download, done once

        self._pipe = pipeline("text-classification", model=name, top_k=None)

    def predict(self, comments: list[str]) -> list[dict[str, float]]:
        """One label-to-score mapping per comment, in the order given."""
        return [{r["label"]: r["score"] for r in row} for row in self._pipe(comments)]


class ModerationUnavailable(Exception):
    """The model answered something no caller can act on."""


def moderate(comments, classifier=None, thresholds=None) -> list[dict]:
    """
    Decide what to do with each comment: block, send to review, or allow.

    `classifier` is injected so this can be tested without downloading the
    weights. In production it defaults to the real model above.

    The whole batch goes in one call. Feeding comments one by one is the usual
    way this rung is made slow, because a batch of a hundred is one pass
    through the model and a hundred calls are a hundred passes.
    """
    classifier = classifier or ToxicityModel()
    thresholds = thresholds or DEFAULT_THRESHOLDS
    comments = list(comments)
    scored = classifier.predict(comments)
    if len(scored) != len(comments):
        raise ModerationUnavailable("the model returned one row per comment, and did not")
    return [_decide(row, thresholds) for row in scored]


def _decide(scores, thresholds: dict[str, float]) -> dict:
    """
    Keep the strongest label, and fall back to a human when nothing is usable.

    Falling back to "allow" would be the tempting shortcut, and it would mean
    that a model failure silently publishes everything it was asked about.
    """
    usable = {label: v for label, v in (scores or {}).items() if _is_score(v)}
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
