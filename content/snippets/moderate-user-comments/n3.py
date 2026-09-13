"""
Score a comment by asking a general-purpose model.

Rung N3. The shortest code on the ladder to write, and the one that hands the
most away: what each category means, the calibration, the right to appeal, and
the text of your users' comments, which leaves your premises on every call.

You name the categories below; the model decides what they mean. Everything
else here — capping the input, retrying, refusing to act on an answer that is
not the shape you asked for — is plumbing you own, and it is where the bugs of
this rung live. It is also all your tests can reach, because the judgement
itself is not testable.
"""

from __future__ import annotations

import json

CATEGORIES = ("harassment", "hate", "violence", "self_harm")

PROMPT = (
    "Rate the comment below on each moderation category. Answer with JSON\n"
    "only: an object mapping each category to a score between 0 and 1.\n"
    f"Categories: {', '.join(CATEGORIES)}\n\nComment:\n{{comment}}"
)

MAX_CHARACTERS = 4000
DEFAULT_THRESHOLDS = {"block": 0.9, "review": 0.6}


class ModerationUnavailable(Exception):
    """The provider could not be reached, or answered something unusable."""


def moderate(comment: str, client=None, *, thresholds=None, attempts: int = 3) -> dict:
    """
    Decide what to do with one comment: block, send to review, or allow.

    `client` is injected so this can be tested without a network call. In
    production it defaults to a real provider client.
    """
    if client is None:  # pragma: no cover - needs a key and a network
        from openai import OpenAI

        client = OpenAI()

    # A model charges by the token, and a comment that long is a bug or an
    # attack. Refusing it is a cost control, not an optimisation.
    if len(comment) > MAX_CHARACTERS:
        raise ValueError(f"comment longer than {MAX_CHARACTERS} characters")

    thresholds = thresholds or DEFAULT_THRESHOLDS
    scores = _ask(client, comment, attempts)
    category, score = max(scores.items(), key=lambda item: item[1])
    if score >= thresholds["block"]:
        action = "block"
    elif score >= thresholds["review"]:
        action = "review"
    else:
        action = "allow"
    return {"action": action, "category": category, "score": score, "scores": scores}


def _ask(client, comment: str, attempts: int) -> dict[str, float]:
    """
    Keep the categories that came back as a number in range, and nothing else.

    A category the model invented is dropped, one it omitted is simply absent.
    An answer with none of them left is unusable, and unusable is raised rather
    than quietly turned into "allow".
    """
    last_error: Exception | None = None
    for _ in range(attempts):
        try:
            answer = client.complete(prompt=PROMPT.format(comment=comment), temperature=0)
            parsed = json.loads(answer)
            scores = {n: float(parsed[n]) for n in CATEGORIES if _is_score(parsed.get(n))}
            if scores:
                return scores
            last_error = ValueError("no category came back as a score in range")
        except Exception as error:  # noqa: BLE001 - any provider failure is retried
            last_error = error
    raise ModerationUnavailable(str(last_error))


def _is_score(value) -> bool:
    """A number the caller can act on, rather than whatever came back."""
    return isinstance(value, (int, float)) and not isinstance(value, bool) and 0.0 <= value <= 1.0
