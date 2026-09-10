"""The corpus is a small internal handbook, the kind every company has."""

from n0 import build_index, search, tokenise

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


def index():
    return build_index(HANDBOOK)


def ids(results):
    return [result["id"] for result in results]


def test_finds_the_document_that_carries_the_words():
    assert ids(search(index(), "notes de frais")) == ["frais"]


def test_a_title_match_outranks_two_body_matches():
    # The handbook says "télétravail" twice in the body of the leave page, and
    # never in the body of the page whose title it is. The column weights are
    # what puts the right document first.
    assert ids(search(index(), "télétravail")) == ["teletravail", "conges"]


def test_all_the_query_terms_must_appear():
    # FTS5 puts an implicit AND between terms. That is the behaviour you get by
    # default, and the reason a long question often returns nothing at all.
    assert ids(search(index(), "accord responsable")) == ["teletravail"]
    assert search(index(), "congés responsable") == []


def test_accents_and_case_do_not_matter():
    assert ids(search(index(), "CONGÉS")) == ids(search(index(), "conges")) == ["conges"]


def test_a_word_present_in_most_documents_adds_nothing_to_the_score():
    # BM25 weighs a term by how rare it is. "le" is everywhere, so it separates
    # nothing, and every document comes back with the same score.
    scores = {result["score"] for result in search(index(), "le")}
    assert scores == {0.0}


def test_an_empty_query_returns_nothing_instead_of_raising():
    for query in ("", "   ", "!?", "«»"):
        assert search(index(), query) == []


def test_a_query_full_of_match_syntax_is_searched_not_executed():
    # Unquoted, this comes out of the search box as a syntax error inside FTS5.
    # Quoting each token turns it back into a search for those words.
    assert tokenise('congés" paie') == ["conges", "paie"]
    assert ids(search(index(), 'congés" paie')) == ["conges"]


def test_the_limit_is_respected():
    assert len(search(index(), "le", limit=2)) == 2


def test_breaking_point_a_search_by_meaning():
    """
    The breaking point claimed on the entry: the reader asks for the thing, the
    document names it otherwise, and the index has nothing to match.

    The handbook answers both questions below. It says "congés payés" where the
    reader says "vacances", and "télétravail" where the reader says "depuis chez
    moi". No amount of ranking helps: the words are not in the inverted index,
    so the documents are not even candidates.
    """
    assert search(index(), "combien de vacances puis-je poser") == []
    assert search(index(), "puis-je travailler depuis chez moi") == []
    # The same two questions, asked in the words of the document, work.
    assert ids(search(index(), "congés")) == ["conges"]
    assert ids(search(index(), "télétravail"))[0] == "teletravail"
