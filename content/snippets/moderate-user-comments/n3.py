"""
Score a comment by asking a general-purpose model.

Rung N3. The rung that hands the most away: what each category means, the
calibration, the right to appeal, and the text of your users' comments, which
leaves your premises on every call.

Before writing this, look at whether your provider publishes a moderation
endpoint. The one taken as an example here does, it is not metered, and it
scores thirteen fixed categories. If the harms you care about are on that
list, this file is the expensive way to get them. What it buys, and the only
thing it buys, is a category that is yours: the last one below names giving
out where somebody lives, which no fixed taxonomy on this page carries — not
the provider's thirteen, and not the labels of the model at N2.

You name the categories; the model decides what they mean. Everything else
here — capping the input, retrying, refusing to act on an answer that is not
the shape you asked for — is plumbing you own, and it is where the bugs of
this rung live. It is also all your tests can reach, because the judgement
itself is not testable.
"""

from __future__ import annotations

import json

# The provider named here is an example, not a recommendation: the reasoning
# holds for any general-purpose model API, and the client is swappable. Pass
# any object with a `complete(prompt=..., temperature=...)` method.
MODEL = "gpt-4.1-mini"  # an example id: check the parameters your model accepts

# The first four are on the provider's own moderation endpoint too. The last
# one is not, and it is the reason this file exists.
CATEGORIES = ("harassment", "hate", "violence", "self_harm", "personal_information")

PROMPT = (
    "Rate the comment below on each moderation category. Answer with JSON\n"
    "only: an object mapping each category to a score between 0 and 1.\n"
    f"Categories: {', '.join(CATEGORIES)}\n"
    "personal_information means giving out where somebody lives, works, or how\n"
    "to reach them, without their consent.\n\nComment:\n{comment}"
)

MAX_CHARACTERS = 4000
DEFAULT_THRESHOLDS = {"block": 0.9, "review": 0.6}


class ProviderClient:
    """The one call this snippet makes, on top of the provider's SDK."""

    def __init__(self, sdk=None, model: str = MODEL):
        if sdk is None:  # pragma: no cover - needs a key and a network
            from openai import OpenAI

            sdk = OpenAI()
        self.sdk, self.model = sdk, model

    def complete(self, *, prompt: str, temperature: float) -> str:
        response = self.sdk.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=temperature,
        )
        return response.choices[0].message.content


class ModerationUnavailable(Exception):
    """The provider could not be reached, or answered something unusable."""


def moderate(comment: str, client=None, *, thresholds=None, attempts: int = 3) -> dict:
    """
    Decide what to do with one comment: block, send to review, or allow.

    `client` is injected so this can be tested without a network call. In
    production it defaults to a real provider client.
    """
    # The provider bills every token of the prompt. The cap counts characters,
    # not tokens, and is checked before any call: the caller decides where a
    # longer comment goes instead. On a forum that is the review queue, not the
    # bin — a comment of four thousand and one characters is not an anomaly.
    if len(comment) > MAX_CHARACTERS:
        raise ValueError(f"comment longer than {MAX_CHARACTERS} characters")

    client = client or ProviderClient()
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
            # Temperature zero, because a moderation decision that changes between
            # two identical calls cannot be explained to the person it hit.
            answer = client.complete(prompt=PROMPT.format(comment=comment), temperature=0)
            # No content (a refusal) and anything but a JSON object are unusable.
            parsed = json.loads(_unfenced(answer)) if isinstance(answer, str) else None
            if not isinstance(parsed, dict):
                last_error = ValueError("the answer is not a JSON object")
                continue
            scores = {n: float(parsed[n]) for n in CATEGORIES if _is_score(parsed.get(n))}
            if scores:
                return scores
            last_error = ValueError("no category came back as a score in range")
        except Exception as error:  # noqa: BLE001 - any provider failure is retried
            last_error = error
    raise ModerationUnavailable(str(last_error))


def _unfenced(answer: str) -> str:
    """
    A JSON answer wrapped whole in one code fence is read; nothing else is.

    Prose around it, a second block, or a fence never closed is a failed
    answer, and it is asked for again rather than salvaged.
    """
    text = answer.strip()
    if text.startswith("```") and text.endswith("```") and text.count("```") == 2:
        return text[3:-3].removeprefix("json")
    return text


def _is_score(value) -> bool:
    """A number the caller can act on, rather than whatever came back."""
    return isinstance(value, (int, float)) and not isinstance(value, bool) and 0.0 <= value <= 1.0
