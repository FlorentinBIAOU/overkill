"""
The same handbook as n0, so the two rungs can be compared on the same corpus.

Every number asserted here is asserted identically in n1.test.js. The two
implementations rank the same documents in the same order with the same scores,
which is the only way to claim, as the entry does, that this is one algorithm
rather than two.
"""

from n1 import build_index, search, tokenise

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

INDEX = build_index(HANDBOOK)


def ids(results):
    return [result["id"] for result in results]


def test_finds_and_scores_the_right_document():
    assert search(INDEX, "congés payés") == [
        {"id": "conges", "score": 3.6746, "terms": {"conges": 1.8373, "payes": 1.8373}}
    ]


def test_one_term_is_enough_where_n0_wanted_them_all():
    # The query that returned nothing at N0, because FTS5 demands every term,
    # returns three documents here, ranked. Same corpus, different rule.
    assert ids(search(INDEX, "congés responsable")) == ["conges", "teletravail", "materiel"]


def test_a_title_match_outranks_two_body_matches():
    assert ids(search(INDEX, "télétravail")) == ["teletravail", "conges"]


def test_the_score_is_the_sum_of_what_each_term_contributed():
    result = search(INDEX, "paie du mois")[0]
    assert result["id"] == "frais"
    assert round(sum(result["terms"].values()), 4) == result["score"]


def test_a_rare_term_weighs_more_than_a_common_one():
    # "congés" is in one document, "le" in three. Both are matches; only one
    # tells you anything.
    terms = search(INDEX, "congés le")[0]["terms"]
    assert terms["conges"] > terms["le"]


def test_length_normalisation_is_a_dial_not_a_law():
    # b = 0 stops correcting for document length. The scores change, and so can
    # the order: on this corpus the long page loses the advantage b gave it.
    assert search(INDEX, "paie du mois", b=0)[1] == {
        "id": "conges", "score": 1.3863, "terms": {"paie": 0.6931, "mois": 0.6931}
    }


def test_a_word_typed_twice_is_not_twice_as_important():
    assert search(INDEX, "congés congés") == search(INDEX, "congés")


def test_accents_and_case_do_not_matter():
    assert search(INDEX, "CONGÉS") == search(INDEX, "conges")
    assert tokenise("Notes de frais !") == ["notes", "de", "frais"]


def test_an_empty_query_returns_nothing():
    for query in ("", "   ", "!?"):
        assert search(INDEX, query) == []


def test_the_limit_is_respected():
    assert len(search(INDEX, "le", limit=2)) == 2


def test_breaking_point_the_tokenizer_is_now_your_problem():
    """
    Writing the index yourself does not close the gap N0 showed; it hands you
    the gap. A reader asking for "vacances" still finds nothing, and now the
    singular of a word the handbook writes in the plural finds nothing either,
    because nothing in these forty lines knows French morphology.

    Stemming, elision, synonyms, stop words: each is a rule you write, test and
    maintain, for the language of every document you hold.
    """
    assert search(INDEX, "vacances") == []
    assert search(INDEX, "congé") == []
    assert ids(search(INDEX, "congés")) == ["conges"]
