"""
These tests inject a local double instead of loading a real encoder.

What they prove: the whole corpus and the query go to the model in one batched
call, an encoder that fails or returns the wrong number of vectors raises
instead of quietly losing documents, the two rankings are fused in the declared
order, and the fusion is deterministic down to its tie-breaks.

What they do not prove: that a real encoder puts "vacances" next to "congés
payés". That is the whole promise of this rung, it is the one thing a double
cannot stand in for, and it is why the entry declares this snippet
`verification: stubbed`.
"""

import pytest

from _harness.fake_model import FakeEncoder
from n2 import EncodingFailed, hybrid_search, vector_ranking

HANDBOOK = [
    {
        "id": "conges",
        "title": "Congés payés",
        "body": "Le salarié acquiert deux jours et demi de congés payés par mois "
                "travaillé. Le solde figure sur le bulletin de paie. Le télétravail "
                "ne change rien à ce calcul, et une journée de télétravail reste "
                "une journée travaillée.",
    },
    {
        "id": "teletravail",
        "title": "Télétravail",
        "body": "Deux jours par semaine sont ouverts, après accord écrit du "
                "responsable.",
    },
    {
        "id": "frais",
        "title": "Notes de frais",
        "body": "Les notes de frais se déposent avant le cinq du mois. Le "
                "remboursement suit la paie du mois suivant.",
    },
    {
        "id": "materiel",
        "title": "Matériel informatique",
        "body": "Le poste de travail est renouvelé tous les quatre ans. La demande "
                "passe par le responsable.",
    },
]


def encoder():
    # Wide enough that two words of this corpus almost never share a dimension.
    return FakeEncoder(dimensions=1024)


class SynonymEncoder(FakeEncoder):
    """
    Stands in for the one thing a real encoder brings: knowing that two words
    are used in the same places.

    The double is a bag of words, so the synonym is spelled out here rather
    than learnt from a corpus. Injecting it exercises the fusion; it says
    nothing about whether a real model would make the same connection.
    """

    SYNONYMS = {"maison": "télétravail"}

    def encode(self, texts):
        expanded = [
            " ".join(self.SYNONYMS.get(word.lower(), word) for word in text.split())
            for text in texts
        ]
        return super().encode(expanded)


class TruncatedEncoder(FakeEncoder):
    """A model that silently drops the last item of a batch."""

    def encode(self, texts):
        return super().encode(texts)[:-1]


class BrokenEncoder:
    """A model that cannot be run at all."""

    def encode(self, texts):
        raise RuntimeError("out of memory while loading the model")


def ids(results):
    return [result["id"] for result in results]


def test_a_document_both_legs_rank_first_wins():
    # The full-text search returned ["frais"]; the vector leg agrees.
    assert hybrid_search("notes de frais", HANDBOOK, ["frais"], encoder=encoder()) == [
        {"id": "frais", "score": 0.032787},
        {"id": "conges", "score": 0.016129},
        {"id": "materiel", "score": 0.015873},
        {"id": "teletravail", "score": 0.015625},
    ]


def test_the_corpus_and_the_query_go_out_in_one_call():
    fake = encoder()
    hybrid_search("notes de frais", HANDBOOK, [], encoder=fake)
    texts = [f"{d['title']} {d['body']}" for d in HANDBOOK]
    assert fake.calls == [texts + ["notes de frais"]]


def test_an_empty_corpus_never_reaches_the_model():
    fake = encoder()
    assert hybrid_search("notes de frais", [], [], encoder=fake) == []
    assert fake.calls == []


def test_k_says_how_much_being_first_is_worth():
    # k is the flatness of the vote. At k = 0 the first place of a list is
    # worth a whole point and the second half a point.
    top = hybrid_search("notes de frais", HANDBOOK, ["frais"], encoder=encoder(), k=0)[0]
    assert top == {"id": "frais", "score": 2.0}


def test_the_limit_is_respected():
    assert len(hybrid_search("frais", HANDBOOK, ["frais"], encoder=encoder(), limit=2)) == 2


def test_a_truncated_batch_raises_rather_than_losing_a_document():
    with pytest.raises(EncodingFailed):
        hybrid_search("frais", HANDBOOK, [], encoder=TruncatedEncoder(dimensions=1024))


def test_a_model_that_cannot_run_raises():
    with pytest.raises(EncodingFailed):
        hybrid_search("frais", HANDBOOK, [], encoder=BrokenEncoder())


def test_the_vector_leg_finds_what_the_words_could_not():
    """The gap N0 could not close, closed by the second leg.

    "maison" appears in no document, so the full-text search returns nothing at
    all. With an encoder that connects it to "télétravail", the two pages that
    speak of working from home come out on top, where they were last.
    """
    question = "puis-je rester à la maison"
    assert vector_ranking(question, HANDBOOK, encoder())[-1] == "teletravail"
    found = hybrid_search(question, HANDBOOK, [], encoder=SynonymEncoder(dimensions=1024))
    assert ids(found)[:2] == ["conges", "teletravail"]


def test_breaking_point_the_vector_leg_always_has_an_answer():
    """
    The breaking point of this rung: cosine similarity is defined for every
    pair of texts, so a vector search always returns a full ranking. There is
    no such thing as "no match".

    Below, the handbook says nothing about the colour of the walls. The
    full-text leg answers honestly, with nothing. The vector leg ranks all four
    pages anyway, and the fusion presents an unrelated one first. Anything
    downstream — a rung N3 answer, a "did you mean" — will treat it as the best
    document there is, unless you set a floor and enforce it.
    """
    keyword_ids = []  # what N0 returns for this question
    found = hybrid_search("quelle est la couleur des murs du bureau", HANDBOOK,
                          keyword_ids, encoder=encoder())
    assert len(found) == 4
    assert found[0]["id"] == "frais"
