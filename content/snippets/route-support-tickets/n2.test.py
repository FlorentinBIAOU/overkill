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

import sys
import time
import types

import pytest

import n2
from _harness.fake_model import FakeEncoder
from n2 import DEFAULT_TEAM, MODEL_NAME, build_index, neighbours, route

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

POLITENESS = "Bonjour, merci de me confirmer que vous avez bien reçu mon dossier"


def make_index(encoder=None, tickets=TICKETS, teams=TEAMS):
    return build_index(tickets, teams, encoder or FakeEncoder(DIMENSIONS))


class VecteursDonnes:
    """Un encodeur dont chaque vecteur est écrit dans le test."""

    def __init__(self, vecteurs):
        self.vecteurs = vecteurs

    def encode(self, texts):
        return [self.vecteurs[t] for t in texts]


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_un_ticket_qui_ne_sadresse_a_personne_part_chez_facturation():
    """
    « "Bonjour, merci de me confirmer que vous avez bien reçu mon dossier" ne
    s'adresse à personne en particulier, et part chez facturation avec un score
    élevé : l'archive contient un ticket de facturation écrit avec les mêmes
    formules de politesse ».
    """
    index = make_index()
    similarity, team = neighbours(index, POLITENESS, k=1)[0]
    assert team == "billing"
    assert round(similarity, 12) == 0.617213399848
    assert route(index, POLITENESS) == "billing"
    # Le voisin est bien le ticket de facturation poli.
    vecteur = n2._unit(index["encoder"].encode([POLITENESS])[0])
    scores = [n2._dot(v, vecteur) for v in index["vectors"]]
    assert TICKETS[scores.index(max(scores))].startswith("Bonjour, merci de me confirmer")


def test_point_de_rupture_temoin_sans_ce_ticket_dans_larchive_laccident_se_deplace():
    """
    « ce dont l'archive est faite est la politique de routage » : retiré de
    l'archive, le ticket poli ne décide plus, et le même message part chez
    technique, sur deux tickets qui partagent « de me ».
    """
    gardes = [(t, e) for t, e in ARCHIVE if not t.startswith("Bonjour")]
    index = make_index(tickets=[t for t, _ in gardes], teams=[e for _, e in gardes])
    assert route(index, POLITENESS) == "technical"


def test_point_de_rupture_le_vote_tranche_de_justesse():
    """Précision du score : 0,617 pour facturation contre 0,303 + 0,303 = 0,606 pour technique."""
    found = neighbours(make_index(), POLITENESS)
    assert [team for _, team in found] == ["billing", "technical", "technical"]
    assert round(found[0][0] - (found[1][0] + found[2][0]), 3) == 0.011


# ---------------------------------------------------------------------------
# Les autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_route_un_ticket_vers_lequipe_de_ses_voisins_les_plus_proches():
    assert route(make_index(), "Ma facture de février est trop élevée") == "billing"


def test_le_voisin_le_plus_proche_et_son_score():
    closest = neighbours(make_index(), "Ma facture de février est trop élevée", k=1)
    similarity, team = closest[0]
    assert team == "billing"
    assert round(similarity, 12) == 0.857142857143


@pytest.mark.xfail(strict=True, reason=(
    "INFIRMÉ : la docstring dit que « the neighbours are shown to the agent as the "
    "reason for the routing — which is more than N1's weights ever explain » ; "
    "`neighbours` rend des couples (score, équipe) sans le ticket archivé ni son "
    "rang dans l'archive : l'agent voit « billing, 0,62 », pas le ticket qui a décidé"
))
def test_infirme_les_voisins_montres_a_lagent_disent_quel_ticket_a_decide():
    found = neighbours(make_index(), POLITENESS, k=1)
    assert any(isinstance(part, str) and part in TICKETS for part in found[0])


def test_larchive_est_encodee_une_fois_et_non_a_chaque_question():
    encoder = FakeEncoder(DIMENSIONS)
    index = make_index(encoder)
    assert encoder.calls == [TICKETS]
    route(index, "Mon colis est en retard chez le transporteur")
    route(index, "Ma facture est fausse")
    assert encoder.calls[1:] == [["Mon colis est en retard chez le transporteur"], ["Ma facture est fausse"]]


def test_lindex_est_une_copie_de_larchive():
    """Docstring : « the index is the archive itself » ; regulatory : « l'index, qui en est une copie »."""
    tickets = list(TICKETS)
    index = make_index(tickets=tickets)
    tickets.pop(0)
    assert index["tickets"] == TICKETS
    assert len(index["vectors"]) == len(TICKETS)


def test_le_vote_compte_le_voisinage_et_pas_seulement_le_meilleur():
    """Docstring de route : « one archived ticket that happens to be phrased like this one is an accident, three of them are a pattern »."""
    ticket = "Mon colis est en retard chez le transporteur"
    assert [team for _, team in neighbours(make_index(), ticket)] == ["shipping", "billing", "shipping"]
    assert route(make_index(), ticket) == "shipping"
    # Témoin : réduit au meilleur voisin (k=1), le vote est le même ici ; il diffère quand le meilleur est isolé.
    vecteurs = {"q": [1.0, 0.0], "a": [0.9, 0.1], "b": [0.8, 0.2], "c": [0.8, 0.2]}
    index = build_index(["a", "b", "c"], ["x", "y", "y"], VecteursDonnes(vecteurs))
    assert route(index, "q", k=1) == "x"
    assert route(index, "q", k=3) == "y"


def test_a_egalite_de_score_le_tri_garde_lordre_de_larchive():
    """Commentaire : « A stable sort, so two equally close tickets always come back in archive order »."""
    vecteurs = {"q": [1.0, 0.0], "a": [0.6, 0.8], "b": [0.6, 0.8], "c": [0.6, 0.8]}
    index = build_index(["a", "b", "c"], ["x", "y", "z"], VecteursDonnes(vecteurs))
    assert [team for _, team in neighbours(index, "q")] == ["x", "y", "z"]


def test_a_egalite_de_vote_lequipe_du_plus_proche_lemporte():
    """Commentaire : « Ties go to the team of the closest neighbour, which is the first key inserted above »."""
    # Composantes dyadiques, normes exactement 1 : votes x = 0,5 ; y = 0,25 + 0,25 = 0,5, égalité exacte.
    vecteurs = {"q": [1.0, 0, 0, 0, 0], "a": [0.5, 0.5, 0.5, 0.5, 0],
                "b": [0.25, 0.75, 0.5, 0.25, 0.25], "c": [0.25, 0.25, 0.25, 0.5, 0.75]}
    index = build_index(["a", "b", "c"], ["x", "y", "y"], VecteursDonnes(vecteurs))
    assert route(index, "q") == "x"
    assert [round(sc, 12) for sc, _ in neighbours(index, "q")] == [0.5, 0.25, 0.25]
    # Témoin : si le plus proche est de l'équipe y, c'est y qui l'emporte à égalité.
    index = build_index(["a", "b", "c"], ["y", "x", "x"], VecteursDonnes(vecteurs))
    assert route(index, "q") == "y"


def test_le_plancher_juste_au_dessus_et_juste_en_dessous():
    """Docstring de route : « The floor is what keeps the default queue of N0 alive »."""
    vecteurs = {"q": [1.0, 0.0], "a": [0.25, 0.9682458365518543]}
    index = build_index(["a"], ["x"], VecteursDonnes(vecteurs))
    assert route(index, "q", k=1) == "x"
    assert route(index, "q", k=1, min_similarity=0.2500001) == DEFAULT_TEAM


def test_un_ticket_que_larchive_na_jamais_vu_part_dans_la_file_par_defaut():
    ticket = "Votre entrepôt accepte-t-il les visites scolaires"
    assert [similarity for similarity, _ in neighbours(make_index(), ticket)] == [0.0, 0.0, 0.0]
    assert route(make_index(), ticket) == DEFAULT_TEAM


def test_ce_que_le_double_ne_peut_pas_prouver():
    """
    Docstring : « "je n'arrive plus à entrer dans mon espace" lands next to the
    archived tickets about a lost password » — non démontrable avec le double,
    qui est un sac de mots : il met le ticket du mot de passe troisième.
    """
    index = make_index()
    ticket = "Je n'arrive plus à entrer dans mon espace client"
    assert [team for _, team in neighbours(index, ticket)] == ["shipping", "shipping", "technical"]
    assert route(index, ticket) == DEFAULT_TEAM


def test_lencodeur_par_defaut_a_la_forme_de_sentence_transformers(monkeypatch):
    """
    Docstring de load_encoder : « fetched once, then held in memory and run
    locally ». Double à la forme publiée : `SentenceTransformer(name)` puis
    `.encode(list_of_str)` qui rend un tableau (liste de vecteurs).
    """
    charges = []

    class SentenceTransformer:
        def __init__(self, name):
            charges.append(name)
            self.inner = FakeEncoder(DIMENSIONS)

        def encode(self, sentences):
            return [list(v) for v in self.inner.encode(sentences)]

    module = types.ModuleType("sentence_transformers")
    module.SentenceTransformer = SentenceTransformer
    monkeypatch.setitem(sys.modules, "sentence_transformers", module)
    index = build_index(TICKETS, TEAMS)
    assert route(index, "Ma facture de février est trop élevée") == "billing"
    route(index, "Mon colis est perdu")
    assert charges == [MODEL_NAME]


def test_deterministe():
    assert neighbours(make_index(), POLITENESS) == neighbours(make_index(), POLITENESS)


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_ticket_vide_archive_vide_et_k_nul():
    assert route(make_index(), "") == DEFAULT_TEAM
    assert route(make_index(tickets=[], teams=[]), "Ma facture") == DEFAULT_TEAM
    assert route(make_index(), "Ma facture de janvier est trop élevée", k=0) == DEFAULT_TEAM
    assert len(neighbours(make_index(), "Ma facture", k=50)) == len(TICKETS)


def test_production_nfd_emoji_bom_et_casse_arrivent_a_lencodeur_tels_quels():
    encoder = FakeEncoder(DIMENSIONS)
    index = make_index(encoder)
    ticket = "\ufeff📦 COLIS perdu, cafe\u0301\u00a0!"
    route(index, ticket)
    assert encoder.calls[-1] == [ticket]


def test_production_une_archive_de_900_tickets_repond_vite():
    tickets = [f"{t} numero {i}" for i in range(100) for t, _ in ARCHIVE]
    teams = [e for _ in range(100) for _, e in ARCHIVE]
    index = make_index(tickets=tickets, teams=teams)
    debut = time.perf_counter()
    assert route(index, "Ma facture de février est trop élevée") == "billing"
    assert time.perf_counter() - debut < 5.0


@pytest.mark.xfail(strict=True, reason=(
    "DÉFAUT : la docstring prévient que l'archive doit être ré-encodée quand le "
    "modèle change, mais rien ne le vérifie. Un index de vecteurs de 384 nombres "
    "interrogé par un encodeur de 768 n'est pas refusé : Python tronque le produit "
    "scalaire (`zip`) et route sur un score faux mais plausible (facturation, "
    "0,38) ; JavaScript tronque de même, et calcule NaN quand l'encodeur est plus "
    "étroit que l'index, ce qui envoie tout en file par défaut"
))
def test_defaut_un_index_encode_par_un_autre_modele_est_refuse():
    index = make_index()
    index["encoder"] = FakeEncoder(768)
    with pytest.raises(ValueError):
        route(index, "Ma facture de janvier")
