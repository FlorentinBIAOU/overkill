"""
Tag articles with a one-versus-rest classifier over TF-IDF features.

Rung N1. The controlled vocabulary of N0 sees the words an editor listed. This
sees the words that go with a topic in the articles you have already tagged —
"bureau", "visioconférence" and "domicile" end up carrying the remote
work topic, although no editor would ever have written them in a term list.

One classifier per topic, each answering its own yes-or-no question. That is
what one-versus-rest means, and it is what keeps the tagging multi-label: the
topics do not compete for a single winner, so an article can come back with
three tags, or with none.

The cost of this rung is not the code, which is below. It is the labelled
corpus: a few hundred articles someone has to tag by hand, and tag again every
time the taxonomy moves.
"""

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.multiclass import OneVsRestClassifier
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import MultiLabelBinarizer


def train(articles: list[str], topics_per_article: list[list[str]]) -> dict:
    """
    `topics_per_article[i]` is the list of topics of `articles[i]`, possibly
    empty. An untagged article is a useful negative example, not a gap.
    """
    binariser = MultiLabelBinarizer()
    matrix = binariser.fit_transform(topics_per_article)
    pipeline = make_pipeline(
        # Word unigrams and bigrams: "à distance" says something that
        # "distance" alone does not.
        TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True),
        OneVsRestClassifier(LogisticRegression(C=4.0, max_iter=1000)),
    )
    pipeline.fit(articles, matrix)
    return {"pipeline": pipeline, "topics": list(binariser.classes_)}


def score(model: dict, article: str) -> dict[str, float]:
    """One probability per topic, each independent of the others."""
    probabilities = model["pipeline"].predict_proba([article])[0]
    return {topic: float(p) for topic, p in zip(model["topics"], probabilities)}


def tag(model: dict, article: str, threshold: float = 0.5) -> list[str]:
    """
    The topics above the threshold, best first.

    The threshold is yours to set, and it is the only dial here. Move it
    towards 1 when a wrong tag is worse than a missing one, towards 0 when an
    editor reviews the list anyway and would rather see one topic too many.
    """
    scored = score(model, article)
    kept = [topic for topic, value in scored.items() if value >= threshold]
    return sorted(kept, key=lambda topic: (-scored[topic], topic))
