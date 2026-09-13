from n1 import score, tag, train

# A corpus the size of an afternoon of tagging: twenty-eight articles, four
# topics, some articles carrying two, one carrying none. It lives in the test
# because the corpus belongs to the newsroom, not to the snippet.
CORPUS = [
    ("La loi de finances relève le plafond du crédit d'impôt recherche pour les PME.", ["fiscalité"]),
    ("Le taux de TVA applicable aux travaux de rénovation change au premier janvier.", ["fiscalité"]),
    ("La déclaration fiscale des entreprises doit être déposée en ligne avant le 15 mai.", ["fiscalité"]),
    ("L'administration fiscale précise le calcul de l'impôt sur les sociétés.", ["fiscalité"]),
    ("Le barème de l'impôt sur le revenu est revalorisé pour tenir compte de l'inflation.", ["fiscalité"]),
    ("Une facture sans mention de TVA expose l'entreprise à un redressement.", ["fiscalité"]),
    ("Nous ouvrons un poste de développeur : les candidatures sont à envoyer avant la fin du mois.", ["recrutement"]),
    ("L'entretien d'embauche se déroule en deux temps, un échange technique puis une rencontre avec l'équipe.", ["recrutement"]),
    ("Le recrutement d'un profil senior demande plusieurs semaines de recherche.", ["recrutement"]),
    ("Nous cherchons quelqu'un pour rejoindre l'équipe produit et l'accompagner sur la durée.", ["recrutement"]),
    ("Trois cents candidatures sont arrivées pour une seule offre publiée la semaine dernière.", ["recrutement"]),
    ("La période d'essai du nouveau salarié se termine à la fin du mois de mars.", ["recrutement"]),
    ("L'équipe ne se retrouve au bureau que le mardi ; le reste de la semaine, chacun travaille depuis chez lui.", ["télétravail"]),
    ("Les réunions se tiennent en visioconférence, ce qui demande un ordre du jour écrit.", ["télétravail"]),
    ("Le télétravail deux jours par semaine est inscrit dans l'accord d'entreprise.", ["télétravail"]),
    ("Travailler à distance depuis son domicile suppose des horaires clairs et un droit à la déconnexion.", ["télétravail"]),
    ("Les bureaux ont été réduits de moitié depuis que chacun vient trois jours par semaine.", ["télétravail"]),
    ("Un salarié installé loin du siège ne passe au bureau qu'une fois par mois.", ["télétravail"]),
    ("Un rançongiciel a paralysé le système d'information d'une collectivité pendant plusieurs jours.", ["cybersécurité"]),
    ("La campagne d'hameçonnage imitait un message de la banque de l'entreprise.", ["cybersécurité"]),
    ("Changer les mots de passe ne suffit pas : il faut activer la double authentification.", ["cybersécurité"]),
    ("Une fuite de données a exposé les adresses de milliers de clients.", ["cybersécurité"]),
    ("Le correctif publié hier ferme une faille exploitée depuis une semaine.", ["cybersécurité"]),
    ("Un message frauduleux invitait les salariés à saisir leur identifiant sur un faux site.", ["cybersécurité"]),
    ("Le versement des indemnités de télétravail suit un régime de TVA particulier.", ["fiscalité", "télétravail"]),
    ("Le recrutement à distance impose de vérifier l'identité du candidat sans jamais le rencontrer.", ["recrutement", "télétravail"]),
    ("La prime versée aux salariés qui travaillent depuis chez eux entre dans l'assiette de l'impôt.", ["fiscalité", "télétravail"]),
    ("Le compte-rendu du conseil municipal est en ligne.", []),
]

MODEL = train([article for article, _ in CORPUS], [topics for _, topics in CORPUS])


def test_tags_an_article_of_a_topic_it_was_trained_on():
    article = (
        "Un message frauduleux invitait les salariés à saisir leur mot de passe "
        "sur un faux site de la banque."
    )
    assert tag(MODEL, article) == ["cybersécurité"]


def test_an_article_comes_back_with_two_topics():
    article = (
        "Les indemnités de télétravail versées aux salariés qui travaillent "
        "depuis chez eux entrent dans le calcul de l'impôt et de la TVA."
    )
    assert tag(MODEL, article) == ["fiscalité", "télétravail"]


def test_the_topics_do_not_compete_for_a_single_winner():
    """
    One classifier per topic, each answering its own question. The scores are
    therefore not a distribution and do not add up to one — which is exactly
    what allows two topics to be right at the same time.
    """
    article = "Les indemnités de télétravail sont soumises à l'impôt et à la TVA."
    assert sum(score(MODEL, article).values()) > 1.0


def test_an_article_outside_every_topic_comes_back_empty():
    assert tag(MODEL, "Le restaurant du coin a changé de carte.") == []
    assert tag(MODEL, "") == []


def test_the_model_only_knows_the_topics_of_the_corpus():
    assert MODEL["topics"] == ["cybersécurité", "fiscalité", "recrutement", "télétravail"]


def test_the_threshold_is_yours_to_set():
    # A second topic the model saw, but less clearly. Lowering the threshold
    # brings it back; that dial is the whole review policy of the newsroom.
    article = "La prime de télétravail versée aux salariés est-elle soumise à l'impôt sur le revenu ?"
    assert tag(MODEL, article) == ["fiscalité"]
    assert tag(MODEL, article, threshold=0.3) == ["fiscalité", "télétravail"]


def test_it_clears_the_breaking_point_of_n0():
    """
    The article that defeats the controlled vocabulary of N0: remote work from
    the first line to the last, and not one term of the topic's term list.

    N1 reads "bureau", "semaine" and "visioconférence", which came with
    the topic in the corpus, and tags it. This is the whole argument for
    climbing one rung, and it is measured here rather than asserted on the page.
    """
    article = (
        "Depuis le printemps, l'équipe ne se retrouve au bureau que le mardi. "
        "Le reste de la semaine, chacun s'organise depuis chez lui, et les "
        "réunions se tiennent en visioconférence."
    )
    assert tag(MODEL, article) == ["télétravail"]


def test_breaking_point_a_topic_absent_from_the_labelled_corpus():
    """
    The breaking point of this rung: a classifier can only ever answer with a
    topic someone labelled. This article is plainly about public subsidies, a
    subject the corpus never names, so the topic simply does not exist for the
    model.

    Worse than silence: lowering the threshold to catch it does not surface a
    missing topic, it files an article about subsidies under remote work. The
    only repair is another round of hand-labelling, over the whole corpus,
    every time the taxonomy grows.
    """
    article = (
        "La région finance une partie du matériel acheté par les entreprises "
        "industrielles, via un guichet de subvention ouvert jusqu'en juin."
    )
    assert "subventions" not in MODEL["topics"]
    assert tag(MODEL, article) == []
    assert tag(MODEL, article, threshold=0.25) == ["télétravail"]
