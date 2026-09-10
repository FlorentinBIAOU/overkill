from n1 import DEFAULT_TEAM, rank, route, train

# An archive as an export gives it: the ticket, and the team that resolved it.
BILLING = [
    "Ma facture de janvier est trop élevée, pouvez-vous vérifier le montant",
    "Je demande le remboursement de la commande que j'ai annulée hier",
    "Le prélèvement automatique est passé deux fois ce mois-ci",
    "Pouvez-vous m'envoyer un devis pour dix licences supplémentaires",
    "Mon IBAN a changé, comment mettre à jour le moyen de paiement",
    "Je ne comprends pas la ligne de TVA sur la facture de 2024",
    "Le paiement par carte a été refusé trois fois de suite",
]

TECHNICAL = [
    "Impossible de me connecter depuis ce matin, la page reste blanche",
    "L'application plante dès que j'ouvre le tableau de bord",
    "J'ai perdu mon mot de passe et le lien de réinitialisation ne marche pas",
    "Une erreur 500 s'affiche quand j'enregistre une fiche",
    "La synchronisation est en panne depuis la mise à jour de mardi",
    "Mon identifiant ne fonctionne plus après le changement de poste",
    "Le bouton d'export ne répond plus dans le navigateur",
]

SHIPPING = [
    "Mon colis n'est toujours pas arrivé après trois semaines",
    "La livraison a été annulée par le transporteur sans explication",
    "Le suivi indique livré mais je n'ai rien reçu",
    "Je souhaite changer l'adresse de livraison de ma commande",
    "L'expédition est bloquée au dépôt depuis lundi",
    "Le colis est arrivé ouvert et un article manque",
    "Le retard de livraison dépasse la date annoncée",
]

ARCHIVE = BILLING + TECHNICAL + SHIPPING
TEAMS = ["billing"] * len(BILLING) + ["technical"] * len(TECHNICAL) + ["shipping"] * len(SHIPPING)


def make_model():
    return train(ARCHIVE, TEAMS)


def test_routes_a_ticket_it_has_never_seen():
    model = make_model()
    assert route(model, "Le montant prélevé sur ma facture de février est faux") == "billing"
    assert route(model, "Le tableau de bord ne s'ouvre plus depuis la mise à jour") == "technical"
    assert route(model, "Le transporteur a livré le colis chez le voisin") == "shipping"


def test_catches_a_ticket_that_uses_none_of_the_keywords_of_n0():
    # The gain of this rung over the rules: the customer describes the symptom
    # in their own words, and the archive has already seen those words.
    model = make_model()
    assert route(model, "La page reste blanche quand je valide le formulaire") == "technical"


def test_accents_and_case_cost_nothing():
    model = make_model()
    assert route(model, "PRELEVEMENT en double sur ma facture") == "billing"


def test_rank_shows_the_runner_up():
    model = make_model()
    ranked = rank(model, "Le colis n'est jamais arrivé et le prélèvement est passé quand même")
    assert len(ranked) == 3
    # The ambiguous ticket of N0, the one the rules resolved by priority and
    # said nothing about. Here both of its halves are in the answer: the team
    # it goes to, and the team it also belongs to, in second place.
    assert [team for team, _ in ranked[:2]] == ["shipping", "billing"]
    assert ranked[1][1] > ranked[2][1]


def test_the_floor_is_yours_to_set():
    model = make_model()
    ticket = "Le montant prélevé sur ma facture de février est faux"
    assert route(model, ticket, min_confidence=0.0) == "billing"
    # A floor of one sends everything to a human, which is the point of
    # exposing it.
    assert route(model, ticket, min_confidence=1.0) == DEFAULT_TEAM


def test_breaking_point_a_ticket_written_in_words_the_archive_never_saw():
    """
    The breaking point of this rung: the model knows the archive, and only
    the archive.

    Here is a real support ticket about a subject no team has ever handled.
    Nothing in it overlaps the vocabulary the model was trained on, so the
    three teams come out nearly tied — and the confidence floor sends it to
    the default queue rather than to the least implausible team.

    That is the right behaviour, and it is also the honest limit: N1 did not
    remove the default queue of N0, it made it smaller. Every new kind of
    ticket has to be answered by a human, labelled, and added to the archive
    before the model can route it.
    """
    model = make_model()
    ticket = "Votre entrepôt accepte-t-il les visites scolaires le mercredi"
    ranked = rank(model, ticket)
    assert ranked[0][1] < 0.5
    assert route(model, ticket) == DEFAULT_TEAM
