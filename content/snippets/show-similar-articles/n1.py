"""
Related articles from the text itself: TF-IDF, then cosine similarity.

Rung N1. N0 only sees what someone remembered to tag. This reads the article,
and lets the corpus decide which words matter: the rarer a word across the
corpus, the more it weighs. Unlike a tag on every article at N0, a word in every
article still weighs something, which is why the stop list below is part of
the job, one per language.

Still computed offline, once per corpus change, and it returns a neighbour
table of the same shape as N0. The page-rendering code does not change when
you move from one rung to the next, which is what makes the move cheap.
"""

import unicodedata

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import linear_kernel


def article_text(article: dict) -> str:
    """
    The title counts twice.

    A word in a title is a stronger claim about the subject than the same word
    buried in the fourth paragraph, and repeating the title is the cheapest
    way to say so to a bag-of-words model.
    """
    title, body = article["title"] or "", article["body"] or ""  # a NULL column is empty
    # NFC: the same accented word typed on two systems is one token, not two halves.
    return unicodedata.normalize("NFC", f"{title} {title} {body}")


def build_neighbour_table(
    articles: list[dict],
    k: int = 5,
    minimum: float = 0.05,
    stop_words: list[str] | None = None,
) -> dict:
    """
    Return `{article id: [(neighbour id, score), ...]}`, best neighbour first.

    `stop_words` is a per-language list, so it belongs to the caller and not
    to this function. Without one, the words every article shares still count:
    on the test corpus, the knife-sharpening article gets the site announcement
    as a neighbour.

    `minimum` is that floor, not a knob to be tweaked until the block looks
    full: below it, two articles share ordinary words and nothing else, and
    showing no block beats showing a wrong one.
    """
    if len(articles) < 2:
        return {article["id"]: [] for article in articles}

    # Rows come out l2-normalised, so their dot product is already a cosine.
    vectoriser = TfidfVectorizer(stop_words=stop_words)
    try:
        matrix = vectoriser.fit_transform(article_text(a) for a in articles)
    except ValueError:  # no word left at all: nothing to compare, no neighbours
        return {article["id"]: [] for article in articles}
    scores = linear_kernel(matrix)

    table = {}
    for index, article in enumerate(articles):
        neighbours = [
            (other["id"], round(float(scores[index][position]), 3))
            for position, other in enumerate(articles)
            if position != index
        ]
        # Ties broken by identifier, so that two builds give the same page.
        neighbours = sorted(
            (n for n in neighbours if n[1] > minimum),
            key=lambda neighbour: (-neighbour[1], neighbour[0]),
        )
        table[article["id"]] = neighbours[:k]
    return table
