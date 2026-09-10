"""
Match company names by meaning, with a self-hosted encoder.

Rung N2. N0 and N1 both compare characters, so both miss the pair this entry
keeps coming back to: an acronym and the name it stands for share almost no
letters. An encoder maps each name to a vector by meaning rather than by
spelling, which is the only way that pair can ever meet.

What it costs: a model file to ship and keep in sync, a warm process to hold
it, and a score you cannot explain to the colleague who asks why two names
were merged. The register also has to be re-encoded whenever the model is
upgraded, and the scores of the old version are not comparable to the new.

Note what is not here: no legal form is stripped and nothing is lowercased.
The encoder is supposed to handle that itself. Whether it does is exactly the
part a local double cannot prove — see the test.
"""

from __future__ import annotations

MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"


def load_encoder(name: str = MODEL_NAME):
    """The real encoder: fetched once, then held in memory and run locally."""
    from sentence_transformers import SentenceTransformer  # pragma: no cover

    return SentenceTransformer(name)


def build_index(names: list[str], encoder=None) -> dict:
    """
    Encode the whole register once, and keep the encoder for the queries.

    `encoder` is injected so this can be tested without loading a model. Left
    alone, it is the real one above.
    """
    encoder = load_encoder() if encoder is None else encoder
    names = list(names)
    return {"names": names, "encoder": encoder,
            "vectors": [_unit(v) for v in encoder.encode(names)]}


def match(index: dict, query: str, top_k: int = 3) -> list[tuple[str, float]]:
    """The nearest names by meaning, best first, with their cosine score."""
    vector = _unit(index["encoder"].encode([query])[0])
    scored = [(name, _dot(known, vector))
              for name, known in zip(index["names"], index["vectors"])]
    # A stable sort, so two names with the same score always come back in
    # register order. A matching run has to be replayable.
    scored.sort(key=lambda pair: -pair[1])
    return scored[:top_k]


def _unit(vector) -> list[float]:
    """Cosine similarity is a dot product once both sides have length one."""
    values = [float(v) for v in vector]
    norm = sum(v * v for v in values) ** 0.5
    return [v / norm for v in values] if norm else values


def _dot(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))
