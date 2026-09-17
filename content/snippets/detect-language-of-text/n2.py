"""
Detect the language with a dedicated identifier, self-hosted.

Rung N2. N0 and N1 only know the languages you handed them a sample of. CLD3,
Google's Compact Language Detector, is a small neural network covering a
hundred-odd languages, shipped with its model inside the package: nothing to
sample, nothing to train, no key, no download, and no text leaving your
machine. `gcld3` in Python, `cld3-asm` in JavaScript, the same model
underneath.

What you own on this rung is not the model. It is three things.

The mapping from its codes to yours: CLD3 answers in BCP-47 style, and tells
Latin-script Hindi from Devanagari Hindi with "hi-Latn". A caller expecting
"hi" gets a code it has never seen.

The refusal, and the byte floor it rests on. Below `min_bytes` the library
answers "und" instead of guessing, and that floor — 140 bytes by default — is
the thing N0 and N1 do not have: it is the two-word message, the subject line,
the search box, refused by the library itself. Above the floor, `is_reliable`
and `probability` are two more handles, and this snippet turns all three into
None.

And the loading. The model is read when the identifier is built, and the
identifier holds memory the garbage collector does not manage: build one, keep
it, do not build one per message.
"""

from __future__ import annotations

# The library's own defaults, read from its header: below 140 bytes it returns
# "und", and it predicts on the first 700 bytes of what it is given. Lower the
# floor and you get an answer on a two-word message; you also get the guess
# this whole entry is about.
MIN_BYTES, MAX_BYTES = 140, 700

# Below this probability the answer is not used. CLD3 also carries its own
# `is_reliable`, computed from the text it saw; both have to agree.
THRESHOLD = 0.7


class IdentificationUnavailable(Exception):
    """The identifier could not be loaded, or answered something unusable."""


class Cld3Identifier:
    """The real identifier, and the whole surface of the library this needs."""

    def __init__(self, min_bytes: int = MIN_BYTES, max_bytes: int = MAX_BYTES, module=None) -> None:
        if module is None:
            import gcld3  # a local install, model included, no network and no key

            module = gcld3
        self._identifier = module.NNetLanguageIdentifier(
            min_num_bytes=min_bytes, max_num_bytes=max_bytes
        )

    def find(self, text: str) -> dict:
        """One answer: the code, how sure the model is, and its own verdict on that."""
        found = self._identifier.FindLanguage(text=text)
        return {
            "language": found.language,
            "probability": float(found.probability),
            "is_reliable": bool(found.is_reliable),
        }


_LOADED: Cld3Identifier | None = None


def loaded_identifier() -> Cld3Identifier:
    """The default identifier, built on first use and kept."""
    global _LOADED
    if _LOADED is None:
        _LOADED = Cld3Identifier()
    return _LOADED


def detect(text: str, identifier=None, threshold: float = THRESHOLD) -> str | None:
    """
    Return the language code, or None when nothing can be said.

    None on four counts, and they are not the same thing said four times: an
    empty text, the code CLD3 uses for "undetermined" — which is also what it
    answers on a text below the byte floor —, its own `is_reliable` set to
    false, and a probability below the threshold. Returning a language in any
    of those cases would hand the caller a guess wearing the clothes of a
    fact, which is the failure this whole entry is about.

    `identifier` is injected so this can be tested without installing the
    library. In production it defaults to the real one above.
    """
    if not text.strip():
        return None
    identifier = identifier or loaded_identifier()
    try:
        found = identifier.find(text)
    except Exception as error:  # noqa: BLE001 - a library failure is not the caller's fault
        raise IdentificationUnavailable(str(error)) from error
    if not isinstance(found, dict) or not isinstance(found.get("language"), str):
        raise IdentificationUnavailable("the identifier returned no language")
    if found["language"] == "und" or not found.get("is_reliable"):
        return None
    return found["language"] if float(found.get("probability", 0.0)) >= threshold else None
