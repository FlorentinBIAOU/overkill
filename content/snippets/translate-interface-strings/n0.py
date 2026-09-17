"""
Reuse the translations you already paid for: a translation memory.

Rung N0. No model, no service, no key. A string already in the memory gets its
translation back, and the cheapest translation is the one you do not order
twice.

Three answers, and the difference between them matters more than the code.
An exact match ships: the same string, give or take its spacing, invisible
format characters and Unicode composition. A close enough string is an
approximate match — a word added, a capital or an accent changed — and it is
a draft: it comes back with its score and a review flag, never as a finished
translation, because "Polish" and "polish" are not the same word. Anything
else is new text, which this rung has nothing to say about — see the breaking
point in the test.

Interpolation variables are checked apart from the score. A translation whose
variables do not match the source is a broken interface, however high it
scores, so it is flagged even on an exact hit. An ICU plural or select message
is checked on its argument name and type, not on the branches inside it.

A string longer than MAX_FUZZY_CHARACTERS gets exact matches only: scoring two
long texts costs of the order of the product of their lengths, for every entry
of the memory.
"""

from __future__ import annotations

import re
import unicodedata
from difflib import SequenceMatcher

# The variable forms an interface uses: {{count}} (i18next), {count}, {}, the
# head of an ICU argument such as {count, plural, ...}, %s, %d, %(count)s, the
# numbered %1$s of Android, and the %@, %1$@ and %ld of iOS.
PLACEHOLDER = re.compile(
    r"\{\{\s*[A-Za-z0-9_.]+\s*\}\}|\{[A-Za-z0-9_]*\}|\{\s*[A-Za-z0-9_]+\s*,\s*[A-Za-z]+"
    r"|%(?:\([A-Za-z0-9_]+\)|\d+\$)?l{0,2}[sd@]"
)

MAX_FUZZY_CHARACTERS = 500


def placeholders(text: str) -> list[str]:
    """The interpolation variables of a string, sorted so order does not count."""
    return sorted(PLACEHOLDER.findall(text))


def exact_key(text: str) -> str:
    """Fold only what cannot change the words: composition, format characters, spacing."""
    composed = unicodedata.normalize("NFC", text)
    visible = "".join(c for c in composed if unicodedata.category(c) != "Cf")
    return " ".join(visible.split())


def normalise(text: str) -> str:
    """Fold case, accents and spacing for the score. A match on this alone is reviewed."""
    stripped = unicodedata.normalize("NFKD", exact_key(text))
    without_accents = "".join(c for c in stripped if not unicodedata.category(c).startswith("M"))
    return " ".join(without_accents.lower().split())


def index(memory: dict[str, str]) -> dict[str, tuple[str, str]]:
    """
    The memory keyed by what an exact match compares.

    Build it once for a whole file and pass it to every `lookup`: most of an
    interface does not change from one version to the next, so most strings
    are found here, and scoring is what costs.
    """
    return {exact_key(known): (known, target) for known, target in memory.items()}


def lookup(source: str, memory: dict[str, str], threshold: float = 0.75, exact=None) -> dict:
    """
    Look a string up in a memory of `source: target` pairs already translated.

    Returns the status (`exact`, `fuzzy` or `none`), the target when there is
    one, the score, and whether a human has to look at it.

    The exact match is settled first, by lookup in a dictionary, and only a
    string that is not in the memory is scored against every entry of it.
    Scoring a string that was already there is the expensive way to learn
    nothing: `exact` is that dictionary, built here when the caller does not
    hand one in.
    """
    key, folded = exact_key(source), normalise(source)
    found = (index(memory) if exact is None else exact).get(key)
    if found is not None:
        return _decide("exact", source, found[0], found[1], 1.0)

    best_source, best_target, best_score = None, None, 0.0
    for known, target in memory.items():
        candidate = normalise(known)
        if max(len(folded), len(candidate)) > MAX_FUZZY_CHARACTERS:
            continue
        # autojunk=False so a long string scores exactly like the JavaScript
        # version of this snippet, which has no such heuristic.
        score = SequenceMatcher(None, folded, candidate, autojunk=False).ratio()
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
