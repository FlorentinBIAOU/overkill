"""
Match company names on character n-grams weighted by TF-IDF.

Rung N1. N0 compares two strings. This compares one name against a whole
register, and it does so by looking at the fragments a name is made of.

Two changes matter.

A rare fragment now weighs more than a common one. « boulangerie » appears in
half the register and tells you almost nothing; « quiquengrogne » appears once
and settles the question. TF-IDF is exactly that arithmetic, and N0 has no
equivalent: Jaro-Winkler treats every character alike.

And because a name becomes a vector, the search is a matrix product rather
than a loop over every possible pair, which is what makes a whole register
searchable at all.

`char_wb` keeps n-grams inside word boundaries, so a fragment never straddles
two words. « Martin Dubois » and « Dubois Martin » still meet, because word
order costs nothing here — unlike N0, where it costs almost everything.
"""

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer

# Two to four characters: long enough to be a syllable, short enough to
# survive a typo somewhere else in the word.
NGRAM_RANGE = (2, 4)


def build_index(names: list[str]) -> dict:
    """Fit the vocabulary on the register, once, and vectorise it."""
    vectoriser = TfidfVectorizer(analyzer="char_wb", ngram_range=NGRAM_RANGE)
    return {"names": list(names), "vectoriser": vectoriser,
            "matrix": vectoriser.fit_transform(names)}


def match(index: dict, query: str, top_k: int = 3) -> list[tuple[str, float]]:
    """
    The nearest names in the register, best first, with their cosine score.

    TfidfVectorizer returns rows of length one, so the cosine similarity is
    just the dot product. No normalisation to write, and none to get wrong.
    """
    vector = index["vectoriser"].transform([query])
    scores = (index["matrix"] @ vector.T).toarray().ravel()
    # A stable sort, so two names with the same score always come back in
    # register order. A matching run has to be replayable.
    order = np.argsort(-scores, kind="stable")[:top_k]
    return [(index["names"][i], float(scores[i])) for i in order]
