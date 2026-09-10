"""
Reuse the translations you already paid for: a translation memory.

Rung N0. No model, no service, no key. An interface string rarely changes
deeply: a word is added, a capital is fixed, a variable moves. When that
happens, last year's translation is still nearly right, and the cheapest
translation is the one you do not order twice.

Three answers, and the difference between them matters more than the code.
An exact match ships. An approximate match is a draft: it comes back with its
score and a review flag, never as a finished translation. Anything else is new
text, which this rung has nothing to say about — see the breaking point in the
test. Handing back an approximation as a certainty is the one behaviour that
would make this whole approach dishonest.

Interpolation variables are checked apart from the score. A translation whose
variables do not match the source is a broken interface, however high it
scores, so it is flagged even on an exact hit.
"""

from __future__ import annotations

import re
import unicodedata
from difflib import SequenceMatcher

# The variable forms an interface uses: {count}, {}, %s, %d, %(count)s,
# and the numbered variant of %s that Android and iOS string files carry.
PLACEHOLDER = re.compile(r"\{[A-Za-z0-9_]*\}|%(?:\([A-Za-z0-9_]+\)|\d+\$)?[sd]")


def placeholders(text: str) -> list[str]:
    """The interpolation variables of a string, sorted so order does not count."""
    return sorted(PLACEHOLDER.findall(text))


def normalise(text: str) -> str:
    """Fold case, accents and spacing, which are not what makes a string new."""
    stripped = unicodedata.normalize("NFKD", text)
    without_accents = "".join(c for c in stripped if not unicodedata.combining(c))
    return " ".join(without_accents.lower().split())


def lookup(source: str, memory: dict[str, str], threshold: float = 0.75) -> dict:
    """
    Look a string up in a memory of `source: target` pairs already translated.

    Returns the status (`exact`, `fuzzy` or `none`), the target when there is
    one, the score, and whether a human has to look at it.
    """
    key = normalise(source)
    best_source, best_target, best_score = None, None, 0.0
    for known, target in memory.items():
        candidate = normalise(known)
        if candidate == key:
            # Exact after normalisation: a fixed capital or a stray double
            # space is not a new string to send to a translator.
            return _decide("exact", source, known, target, 1.0)
        # autojunk=False so a long string scores exactly like the JavaScript
        # version of this snippet, which has no such heuristic.
        score = SequenceMatcher(None, key, candidate, autojunk=False).ratio()
        if score > best_score:
            best_source, best_target, best_score = known, target, score
    if best_score >= threshold:
        return _decide("fuzzy", source, best_source, best_target, best_score)
    return {"status": "none", "target": None, "score": best_score,
            "matched": None, "review": False, "warnings": []}


def _decide(status: str, source: str, matched: str, target: str, score: float) -> dict:
    """Assemble the answer, and never let a fuzzy hit pass as a finished one."""
    warnings = []
    if placeholders(target) != placeholders(source):
        warnings.append("interpolation variables differ from the source string")
    return {"status": status, "target": target, "score": score, "matched": matched,
            "review": status == "fuzzy" or bool(warnings), "warnings": warnings}
