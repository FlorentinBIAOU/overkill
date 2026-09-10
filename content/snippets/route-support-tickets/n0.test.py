from n0 import DEFAULT_TEAM, matches, route

# A handful of tickets as a support desk receives them: French, hurried, and
# rarely limited to one subject.
BILLING = "Ma facture de janvier est trop élevée, pouvez-vous vérifier ?"
TECHNICAL = "Impossible d'ouvrir une connexion depuis ce matin."
SHIPPING = "Mon colis n'est toujours pas arrivé après trois semaines."


def test_routes_each_ticket_to_its_team():
    assert route(BILLING) == "billing"
    assert route(TECHNICAL) == "technical"
    assert route(SHIPPING) == "shipping"


def test_accents_and_case_cost_nothing():
    assert route("PRÉLÈVEMENT en double sur mon compte") == "billing"
    assert route("prelevement en double sur mon compte") == "billing"


def test_plurals_and_derived_forms_still_match():
    # French tickets are written in the plural far more often than a keyword
    # list is, which is why the boundary is on the left of the word only.
    assert route("Mes factures de mars sont fausses") == "billing"
    assert route("Des erreurs apparaissent à chaque export") == "technical"
    assert route("Les livraisons du mois sont toutes en retard") == "shipping"


def test_an_empty_ticket_goes_to_the_default_queue():
    assert route("") == DEFAULT_TEAM


def test_the_default_queue_is_the_callers_to_name():
    assert route("Bonjour, merci de me rappeler.", default_team="triage") == "triage"


def test_matches_shows_what_the_rules_saw():
    # What a reviewer needs when a ticket lands on the wrong desk.
    assert matches(SHIPPING) == {"shipping": ["colis"]}


def test_breaking_point_a_ticket_that_belongs_to_two_teams():
    """
    The breaking point claimed on the entry, first half.

    This customer has two problems, and the rules see both. The routing
    returns one team, the one the priority order puts first, and the parcel
    half of the ticket is dropped without a trace in the queue that receives
    it.

    Priority makes the outcome predictable; it does not make it right. No
    ordering of the rules would be, because the ticket really is both.
    """
    ticket = "Le colis n'est jamais arrivé et le prélèvement est passé quand même."
    assert matches(ticket) == {"billing": ["prélèvement"], "shipping": ["colis"]}
    assert route(ticket) == "billing"


def test_breaking_point_a_ticket_that_belongs_to_no_team():
    """
    The breaking point claimed on the entry, second half.

    A perfectly ordinary ticket, written by someone who describes their
    problem without ever using the vocabulary of the rules. Nothing matches,
    so it goes to the default queue — which is the honest outcome, and also
    the reason this rung stops working once that queue is the busiest one.
    """
    ticket = "Bonjour, depuis hier je n'arrive plus à faire ce que je faisais avant."
    assert matches(ticket) == {}
    assert route(ticket) == DEFAULT_TEAM
