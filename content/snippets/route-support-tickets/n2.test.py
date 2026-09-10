"""
These tests inject a local double instead of loading the real encoder.

What they prove: the archive is encoded once and not once per query, the
vectors are brought to length one, the cosine is computed and voted on the way
the snippet claims, the floor sends an unknown ticket to the default queue,
and ties are resolved the way the docstring says.

What they do not prove: that the encoder understands anything. The double is a
bag of words, so the very pair this rung exists for — a ticket and its
paraphrase, sharing no word — scores near nothing. That is asserted below
rather than hidden, and it is why the entry declares this snippet `stubbed`.
"""

from _harness.fake_model import FakeEncoder
from n2 import DEFAULT_TEAM, build_index, neighbours, route

# Resolved tickets, and the team that resolved each one.
ARCHIVE = [
    ("Ma facture de janvier est trop élevée", "billing"),
    ("Le prélèvement est passé deux fois ce mois-ci", "billing"),
    ("Bonjour, merci de me confirmer le remboursement de ma commande", "billing"),
    ("Impossible de me connecter depuis ce matin", "technical"),
    ("L'application plante quand j'ouvre le tableau de bord", "technical"),
    ("J'ai perdu mon mot de passe", "technical"),
    ("Mon colis n'est toujours pas arrivé", "shipping"),
    ("La livraison a été annulée par le transporteur", "shipping"),
    ("Le suivi indique livré mais je n'ai rien reçu", "shipping"),
]

TICKETS = [ticket for ticket, _ in ARCHIVE]
TEAMS = [team for _, team in ARCHIVE]

# The real encoder of this snippet returns 384 numbers per ticket; the double
# is asked for the same width, so the test exercises the real shape.
DIMENSIONS = 384


def make_index(encoder=None):
    return build_index(TICKETS, TEAMS, encoder or FakeEncoder(DIMENSIONS))


def test_routes_a_ticket_to_the_team_of_its_nearest_neighbours():
    assert route(make_index(), "Ma facture de février est trop élevée") == "billing"


def test_the_nearest_neighbour_is_the_reason_shown_to_the_agent():
    closest = neighbours(make_index(), "Ma facture de février est trop élevée", k=1)
    similarity, team = closest[0]
    assert team == "billing"
    # The same number as the JavaScript version of this snippet, because both
    # run the same double. Six of the seven words are shared with the archived
    # ticket, and the cosine says exactly that.
    assert round(similarity, 12) == 0.857142857143


def test_the_archive_is_encoded_once_not_once_per_query():
    # The point of an index: the expensive call happens at build time.
    encoder = FakeEncoder(DIMENSIONS)
    index = make_index(encoder)
    assert encoder.calls == [TICKETS]
    route(index, "Mon colis est en retard chez le transporteur")
    assert encoder.calls[1] == ["Mon colis est en retard chez le transporteur"]


def test_the_vote_counts_the_neighbourhood_not_only_the_best_match():
    # The closest neighbour is a shipping ticket, the second is a billing one
    # that clears the floor as well; two shipping tickets outvote it.
    ticket = "Mon colis est en retard chez le transporteur"
    assert [team for _, team in neighbours(make_index(), ticket)] == [
        "shipping", "billing", "shipping",
    ]
    assert route(make_index(), ticket) == "shipping"


def test_an_empty_ticket_goes_to_the_default_queue():
    assert route(make_index(), "") == DEFAULT_TEAM


def test_a_ticket_the_archive_has_never_seen_goes_to_the_default_queue():
    # Nothing in the archive shares anything with it, so every score is zero
    # and the floor does its job.
    ticket = "Votre entrepôt accepte-t-il les visites scolaires"
    assert [similarity for similarity, _ in neighbours(make_index(), ticket)] == [0.0, 0.0, 0.0]
    assert route(make_index(), ticket) == DEFAULT_TEAM


def test_what_the_double_cannot_prove():
    """
    The reason this rung exists is the paraphrase, and the double cannot show
    it: it is a bag of words, exactly like N1.

    « Je n'arrive plus à entrer dans mon espace client » is the lost password
    of the archive said in other words. The double puts the password ticket
    third, behind two parcel tickets that merely share « mon » and « plus »,
    and the routing falls to the default queue. Only the real encoder closes
    that gap. This test asserts the double's silence instead of implying a win
    nobody measured.
    """
    index = make_index()
    ticket = "Je n'arrive plus à entrer dans mon espace client"
    assert [team for _, team in neighbours(index, ticket)] == ["shipping", "shipping", "technical"]
    assert route(index, ticket) == DEFAULT_TEAM


def test_breaking_point_the_archive_is_the_policy():
    """
    The breaking point of this rung: there is no model of the teams, only an
    archive, and the nearest ticket is not always a relevant one.

    This customer asks whether their file arrived. It is a question for
    nobody in particular, and it is routed to billing with a high score — the
    archive happens to hold one billing ticket written with the same
    politeness formulas, and the vote sees a strong match.

    The double makes the mechanism visible in its crudest form, by counting
    words. A real encoder moves where the accident happens, it does not remove
    it: whatever the archive is made of is the routing policy, including the
    parts nobody chose.
    """
    index = make_index()
    ticket = "Bonjour, merci de me confirmer que vous avez bien reçu mon dossier"
    similarity, team = neighbours(index, ticket, k=1)[0]
    assert team == "billing"
    assert round(similarity, 12) == 0.617213399848
    assert route(index, ticket) == "billing"
