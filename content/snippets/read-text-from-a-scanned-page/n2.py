"""
Read a scanned page with a self-hosted optical recognition engine.

Rung N2. When N0 answered « no text layer », something has to look at the
pixels. An engine like Tesseract does exactly that, on your machine: the page
never leaves it, and there is no key and no quota.

What you own on this rung is not the engine, it is everything around it: the
language you tell it to expect, the confidence under which a page goes to a
human, the cleaning of a text that comes back broken across lines, and the
answer to « what does the code do when the engine says nothing usable ».
"""

from __future__ import annotations

import re

# The language data the engine loads, named by its Tesseract code: `fra` for
# French documents.
LANGUAGE = "fra"

# The engine reports how sure it is of each word. Below this, the page is
# still returned, but flagged: the text is a draft, not a reading.
DEFAULT_MIN_CONFIDENCE = 0.70


class OCRUnavailable(Exception):
    """The engine failed, or answered something no caller can act on."""


class TesseractOCR:
    """The real engine. pytesseract starts the tesseract binary for every call."""

    def __init__(self, language: str = LANGUAGE) -> None:
        import pytesseract  # wraps the tesseract binary installed on the host

        self._pytesseract = pytesseract
        self.language = language

    def read(self, image_path: str) -> dict:
        """The text of one image, line by line, and how sure the engine is of it."""
        from PIL import Image

        data = self._pytesseract.image_to_data(
            Image.open(image_path),
            lang=self.language,
            output_type=self._pytesseract.Output.DICT,
        )
        # One row per layout box: a row of level 4 opens a line, the rows of
        # level 5 that follow are its words, each scored out of a hundred.
        lines, scores = [], []
        for level, word, score in zip(data["level"], data["text"], data["conf"]):
            if level == 4:
                lines.append([])
            elif level == 5 and lines and word.strip() and float(score) >= 0:
                lines[-1].append(word)
                scores.append(float(score))
        return {
            "text": "\n".join(" ".join(words) for words in lines),
            "confidence": sum(scores) / (100 * len(scores)) if scores else 0.0,
        }


def read_page(image_path, engine=None, *, min_confidence: float = DEFAULT_MIN_CONFIDENCE, attempts: int = 2) -> dict:
    """
    Read one page image, and say whether a human should check the result.

    `engine` is injected so this can be tested without installing the binary
    or the language data. In production it defaults to the real engine above.
    """
    engine = engine or TesseractOCR()
    reading = _read(engine, image_path, attempts)
    if not isinstance(reading, dict) or not isinstance(reading.get("text"), str):
        raise OCRUnavailable("the engine owed a reading, and did not give one")

    text = clean(reading["text"])
    confidence = _confidence(reading.get("confidence"))
    # A doubtful page is not thrown away: it goes to a human with the text and
    # the score that earned the doubt. Throwing it away would cost the reading
    # that was, most of the time, almost right.
    return {"text": text, "confidence": confidence, "review": not text or confidence < min_confidence}


def _read(engine, image_path, attempts: int) -> object:
    """One page per call, and a failed call is retried, not swallowed."""
    last_error: Exception | None = None
    for _ in range(attempts):
        try:
            return engine.read(image_path)
        except Exception as error:  # noqa: BLE001 - any engine failure is retried
            last_error = error
    raise OCRUnavailable(str(last_error))


def clean(text: str) -> str:
    """Whitespace, and the hyphen a line break leaves inside a word."""
    lines = [re.sub(r"[ \t\xa0]+", " ", line).strip() for line in text.splitlines()]
    joined = "\n".join(line for line in lines if line)
    # « exemp-\nlaire » is one word the scanner cut in two, not two words. Letters
    # only: « 2024-\n000431 » is a reference, and keeps its hyphen.
    return re.sub(r"([^\W\d_])-\n([^\W\d_])", r"\1\2", joined)


def _confidence(value) -> float:
    """A number the caller can act on, rather than whatever came back."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return 0.0
    return float(value) if 0.0 <= value <= 1.0 else 0.0
