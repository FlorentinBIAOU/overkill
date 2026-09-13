from n0 import lemmatise, normalise, stems, tag

# The controlled vocabulary of a small editorial team: four topics, and the
# terms an editor would list for each. It lives here, in the test, because it
# belongs to the newsroom rather than to the code.
VOCABULARY = {
    "cybersécurité": ["cybersécurité", "rançongiciel", "hameçonnage", "mot de passe"],
    "fiscalité": ["fiscalité", "impôt", "TVA", "crédit d'impôt", "déclaration fiscale"],
    "recrutement": ["recrutement", "embauche", "candidat", "entretien d'embauche"],
    "télétravail": ["télétravail", "travail à distance", "distanciel"],
}


def test_tags_an_article_with_the_topic_it_names():
    article = "La campagne d'hameçonnage imitait un message de la banque."
    assert tag(article, VOCABULARY) == ["cybersécurité"]


def test_an_article_carries_several_topics_at_once():
    article = (
        "La loi de finances précise le régime de TVA applicable aux indemnités "
        "de télétravail, et prolonge le crédit d'impôt recherche."
    )
    assert tag(article, VOCABULARY) == ["fiscalité", "télétravail"]


def test_an_article_about_nothing_in_the_vocabulary_carries_no_topic():
    assert tag("Le restaurant du coin a changé de carte.", VOCABULARY) == []
    assert tag("", VOCABULARY) == []


def test_case_accents_and_plurals_cost_nothing():
    # The same sentence four ways: each spelling has to reach the same stem.
    for article in (
        "les impôts et la TVA",
        "LES IMPÔTS ET LA TVA",
        "l'impôt et la tva",
        "les impots et la tva",
    ):
        assert tag(article, VOCABULARY) == ["fiscalité"], article


def test_a_multi_word_term_matches_across_the_plural_of_both_words():
    assert tag("changez vos mots de passe", VOCABULARY) == ["cybersécurité"]
    assert lemmatise("mots") == "mot"
    assert normalise("Hameçonnage") == "hameconnage"


def test_a_stem_never_matches_inside_a_longer_word():
    # "impôt" must not be found inside "impotent". Padding the stems with
    # spaces is what buys that.
    assert tag("un vieillard impotent", VOCABULARY) == []
    assert stems("impôts") == " impot "


def test_min_terms_asks_for_more_than_one_passing_mention():
    article = "Le candidat a signé hier."
    assert tag(article, VOCABULARY) == ["recrutement"]
    assert tag(article, VOCABULARY, min_terms=2) == []


def test_the_best_supported_topic_comes_first():
    article = (
        "Après l'entretien d'embauche, le candidat a demandé si le télétravail "
        "était possible ; le recrutement est signé."
    )
    assert tag(article, VOCABULARY) == ["recrutement", "télétravail"]


def test_breaking_point_a_topic_treated_without_ever_being_named():
    """
    The breaking point claimed on the entry: this article is about remote work
    from its first line to its last, and it never uses a single term of the
    topic's vocabulary.

    A controlled vocabulary sees words, not subjects. The only repair is to
    keep adding terms, one missed article at a time, for ever — which is the
    honest description of what maintaining this rung costs.
    """
    article = (
        "Depuis le printemps, l'équipe ne se retrouve au bureau que le mardi. "
        "Le reste de la semaine, chacun s'organise depuis chez lui, et les "
        "réunions se tiennent en visioconférence."
    )
    assert tag(article, VOCABULARY) == []
