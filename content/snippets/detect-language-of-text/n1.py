"""
Detect the language of a text with a naive Bayes classifier on character
n-grams.

Rung N1. Features close to those of N0, n-grams of one to three characters
cut at word boundaries, but weighed instead of ranked. Each n-gram of the text votes for every language, in proportion to
how often that language uses it, and the votes are multiplied together.

What this buys over the rank distance of N0 is a number the caller can act
on. N0 answers "French"; this answers "French, and here is how far ahead
of Spanish it is". A detector that can abstain is worth more than one that
is right slightly more often.

Training takes a paragraph per language. The model is a table of counts.
"""

from sklearn.feature_extraction.text import CountVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import make_pipeline


def train(samples: dict[str, str]):
    """
    Fit on one sample of text per language.

    `char_wb` cuts n-grams inside word boundaries, so an n-gram carries the
    information that it opens or closes a word, exactly as the padding of N0
    did. Smoothing is light: an n-gram this language never used should count
    against it, without ruling it out on a single character.
    """
    model = make_pipeline(
        CountVectorizer(analyzer="char_wb", ngram_range=(1, 3), lowercase=True),
        MultinomialNB(alpha=0.1),
    )
    model.fit(list(samples.values()), list(samples.keys()))
    return model


def probabilities(model, text: str) -> dict[str, float]:
    """
    How the text splits between the known languages.

    Read these as an ordering, not as a measure of truth: they always sum to
    one, over the languages the model was trained on and no others.
    """
    scores = model.predict_proba([text])[0]
    return {str(name): float(score) for name, score in zip(model.classes_, scores)}


def detect(model, text: str, minimum: float = 0.0) -> str | None:
    """
    The most likely language, or None when the model is not sure enough.

    `minimum` is yours to set. Raise it when a wrong language costs more than
    no answer, for instance when the answer picks the queue a message is
    routed to. Leave it at zero to always get a name, as N0 does.
    """
    best, score = max(probabilities(model, text).items(), key=lambda item: item[1])
    return best if score >= minimum else None
