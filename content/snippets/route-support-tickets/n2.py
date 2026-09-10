"""
Route a ticket by its nearest resolved tickets, with a self-hosted encoder.

Rung N2. N1 learns the words of the archive; an encoder maps a ticket to a
vector by meaning, so a customer who says « je n'arrive plus à entrer dans mon
espace » lands next to the archived tickets about a lost password even though
they share no word with them.

There is no training step here, and that is the point of the rung: the index
is the archive itself. A team that changes scope is a re-encoding, not a
retraining, and the neighbours are shown to the agent as the reason for the
routing — which is more than N1's weights ever explain.

What it costs: a model file to ship and keep in sync, a warm process to hold
it, and a routing whose answers change the day you upgrade the model. The
archive also has to be re-encoded then, and the old scores are not comparable
to the new.
"""

from __future__ import annotations

MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

DEFAULT_TEAM = "general"


def load_encoder(name: str = MODEL_NAME):
    """The real encoder: fetched once, then held in memory and run locally."""
    from sentence_transformers import SentenceTransformer  # pragma: no cover

    return SentenceTransformer(name)


def build_index(tickets: list[str], teams: list[str], encoder=None) -> dict:
    """
    Encode the resolved archive once, and keep the encoder for the queries.

    `encoder` is injected so this can be tested without loading a model. Left
    alone, it is the real one above.
    """
    encoder = load_encoder() if encoder is None else encoder
    tickets = list(tickets)
    return {"tickets": tickets, "teams": list(teams), "encoder": encoder,
            "vectors": [_unit(v) for v in encoder.encode(tickets)]}


def neighbours(index: dict, ticket: str, k: int = 3) -> list[tuple[float, str]]:
    """The k nearest resolved tickets, best first, with their cosine score."""
    vector = _unit(index["encoder"].encode([ticket])[0])
    scored = [(_dot(known, vector), team)
              for known, team in zip(index["vectors"], index["teams"])]
    # A stable sort, so two equally close tickets always come back in archive
    # order. A routing run has to be replayable.
    scored.sort(key=lambda pair: -pair[0])
    return scored[:k]


def route(index: dict, ticket: str, k: int = 3, min_similarity: float = 0.25,
          default_team: str = DEFAULT_TEAM) -> str:
    """
    The team of the nearest resolved tickets, each voting with its similarity.

    A vote rather than the single best neighbour: one archived ticket that
    happens to be phrased like this one is an accident, three of them are a
    pattern.

    The floor is what keeps the default queue of N0 alive. Below it, nothing
    in the archive resembles this ticket, and the honest answer is that this
    rung has never seen the problem.
    """
    votes: dict[str, float] = {}
    for similarity, team in neighbours(index, ticket, k):
        if similarity >= min_similarity:
            votes[team] = votes.get(team, 0.0) + similarity
    if not votes:
        return default_team
    # Ties go to the team of the closest neighbour, which is the first key
    # inserted above.
    return max(votes, key=lambda team: votes[team])


def _unit(vector) -> list[float]:
    """Cosine similarity is a dot product once both sides have length one."""
    values = [float(v) for v in vector]
    norm = sum(v * v for v in values) ** 0.5
    return [v / norm for v in values] if norm else values


def _dot(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))
