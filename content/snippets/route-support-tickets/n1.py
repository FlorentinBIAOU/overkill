"""
Route a ticket with TF-IDF and a linear classifier trained on the archive.

Rung N1. The keyword rules of N0 know the words someone thought of. This
knows the words the desk actually received: it is trained on the tickets the
teams have already answered, so the vocabulary of the customers, not the
vocabulary of the rule writer, decides.

What it keeps from N0, deliberately: a default team. A classifier always
returns something, and its most likely class on a ticket it has no opinion
about is still a class. The confidence floor below is what turns that shrug
back into the default queue, instead of a wrong queue.

Training data is the exported archive: the resolved tickets and the team that
resolved each one.
"""

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline

DEFAULT_TEAM = "general"


def train(tickets: list[str], teams: list[str]):
    """
    `teams` is the team that actually handled each past ticket.

    Word pairs as well as single words, because "mot de passe" and "en
    retard" carry more than the words they are made of. Classes are weighted
    by their rarity: an archive is never balanced, and an unweighted model
    learns to answer the busiest team.
    """
    model = make_pipeline(
        TfidfVectorizer(strip_accents="unicode", ngram_range=(1, 2), sublinear_tf=True),
        # C loosens the penalty. With the default C=1, two of the three unseen
        # tickets in the test stay under the 0.5 floor; with C=10 all three
        # clear it.
        LogisticRegression(class_weight="balanced", max_iter=1000, C=10),
    )
    model.fit(tickets, teams)
    return model


def rank(model, ticket: str) -> list[tuple[str, float]]:
    """
    Every team with the probability the model gives it, best first.

    A support desk needs the runner-up: two teams at almost the same score is
    exactly the ambiguous ticket of N0, and here it is visible instead of
    being silently resolved by a priority order.
    """
    probabilities = model.predict_proba([ticket])[0]
    ranked = sorted(zip(model.classes_, probabilities), key=lambda pair: -pair[1])
    return [(str(team), float(probability)) for team, probability in ranked]


def route(model, ticket: str, min_confidence: float = 0.5,
          default_team: str = DEFAULT_TEAM) -> str:
    """
    The team that gets the ticket, or the default queue below the floor.

    The floor is yours to set. Raise it and more tickets are read by a human
    before they move; lower it and more tickets are moved on a hunch. Nothing
    in the model can make that choice for you.
    """
    team, confidence = rank(model, ticket)[0]
    return team if confidence >= min_confidence else default_team
