"""
Type the names with a small pre-trained recogniser, on your own machine.

Rung N2. This is the level that answers the half rung N0 cannot: what a name
*is*, when the sentence does not say. The model is a few tens of megabytes, it
runs on a processor in milliseconds, and nothing leaves the machine — which
matters more here than elsewhere, because what is being extracted is a list of
people.

What you own on this rung is not the model. It is the cap, the batch, the map
from its label set to yours, and the answer to « what does the code do with a
label we do not map ». The French pipeline of spaCy has four labels — person,
organisation, place, and a fourth that means « something else » — where this
entry has three meanings. `MISC` is therefore dropped rather than guessed, and
counted so that the caller sees how much was dropped.

The limit to keep in mind is the shape of the answer, not its quality: the
pipeline returns a label for every name it finds, and no score alongside it.
There is no threshold to raise and no « unknown » to fall back on. Rung N0
answers `unknown` when the sentence proves nothing; here, something is always
claimed.
"""

from __future__ import annotations

# The pipeline name is an example: pick the one trained for your language, and
# read its licence — the French pipelines of spaCy are published under
# LGPL-LR, which is not the licence of spaCy itself.
MODEL = "fr_core_news_sm"

# A document longer than this is cut, not refused: a recogniser that raises on
# a long article returns nothing at all.
MAX_CHARACTERS = 20000

# Their label set is theirs, and wider than ours. What is not mapped is
# dropped on purpose: an unmapped label that silently became a type would be a
# surprise in a list of people.
LABELS = {"PER": "person", "PERSON": "person", "ORG": "company", "LOC": "place",
          "GPE": "place"}


class SpacyRecogniser:
    """The real recogniser: a pipeline loaded once, then fed in batches."""

    def __init__(self, model: str = MODEL):
        import spacy  # a large local install, and a model to download

        self._nlp = spacy.load(model, disable=["lemmatizer", "textcat"])

    def predict(self, texts: list[str]) -> list[dict]:
        return [{"entities": [{"text": entity.text, "label": entity.label_,
                               "start": entity.start_char, "end": entity.end_char}
                              for entity in document.ents]}
                for document in self._nlp.pipe(texts)]


class RecognitionUnavailable(Exception):
    """The recogniser could not be loaded, or answered something unusable."""


def extract_names(texts, recogniser=None) -> list[dict]:
    """
    For each text, the names the model found, with its labels mapped to ours.

    `recogniser` is injected so this function can be tested without the model.
    In production it defaults to the real pipeline.
    """
    recogniser = recogniser or SpacyRecogniser()
    cut = [text[:MAX_CHARACTERS] if isinstance(text, str) else "" for text in texts]
    try:
        answers = recogniser.predict(cut)
    except Exception as error:  # noqa: BLE001 - a local model failing is still a failure
        raise RecognitionUnavailable(str(error)) from error
    if not isinstance(answers, list) or len(answers) != len(cut):
        raise RecognitionUnavailable("the recogniser did not answer once per text")

    reports = []
    for text, answer in zip(cut, answers):
        names, unmapped = [], []
        for entity in (answer or {}).get("entities", []):
            label = str(entity.get("label", ""))
            found = str(entity.get("text", ""))
            if label not in LABELS:
                unmapped.append(label)
            elif found and found in text:
                names.append({"text": found, "type": LABELS[label], "evidence": label,
                              "start": int(entity.get("start", text.index(found))),
                              "end": int(entity.get("end", text.index(found) + len(found)))})
        reports.append({"names": names, "unmapped": unmapped,
                        "characters_read": len(text)})
    return reports
