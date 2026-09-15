import builtins
import json
import os
import re
import shutil
import subprocess
import time
import unicodedata
from pathlib import Path

import pytest

import n0
from n0 import DEFAULT_TEAM, RULES, matches, route

ICI = Path(__file__).parent

# A handful of tickets as a support desk receives them: French, hurried, and
# rarely limited to one subject.
BILLING = "Ma facture de janvier est trop élevée, pouvez-vous vérifier ?"
TECHNICAL = "Impossible d'ouvrir une connexion depuis ce matin."
SHIPPING = "Mon colis n'est toujours pas arrivé après trois semaines."

TWO_TEAMS = "Le colis n'est jamais arrivé et le prélèvement est passé quand même."
NO_TEAM = "Bonjour, depuis hier je n'arrive plus à faire ce que je faisais avant."


def en_javascript(tickets):
    node = shutil.which("node")
    assert node, "node est requis pour comparer les deux implémentations"
    script = (
        f"import {{ route, matches }} from {json.dumps((ICI / 'n0.js').as_uri())};"
        "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{"
        "process.stdout.write(JSON.stringify(JSON.parse(d).map(t=>[route(t),matches(t)])));});"
    )
    sortie = subprocess.run([node, "--input-type=module", "-e", script], input=json.dumps(tickets),
                            capture_output=True, text=True, timeout=60, check=True)
    return [tuple(x) for x in json.loads(sortie.stdout)]


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_un_ticket_qui_appartient_a_deux_equipes_perd_sa_moitie_colis():
    """
    « "Le colis n'est jamais arrivé et le prélèvement est passé quand même"
    déclenche facturation et livraison ; la priorité tranche pour facturation, et
    la moitié colis disparaît sans trace dans la file qui reçoit le ticket ».
    """
    assert matches(TWO_TEAMS) == {"billing": ["prélèvement"], "shipping": ["colis"]}
    decision = route(TWO_TEAMS)
    assert decision == "billing"
    # Ce que la file reçoit est un nom d'équipe, et rien d'autre : pas de trace de « shipping ».
    assert isinstance(decision, str) and "shipping" not in decision
    # Témoin : un ticket de colis seul part bien chez livraison.
    assert route(SHIPPING) == "shipping"


def test_point_de_rupture_un_ticket_qui_ne_declenche_aucune_equipe_part_dans_la_file_par_defaut():
    """« "je n'arrive plus à faire ce que je faisais avant" ne déclenche rien et part dans la file par défaut »."""
    assert matches(NO_TEAM) == {}
    assert route(NO_TEAM) == DEFAULT_TEAM
    # Témoin : le même client qui emploie le mot « connexion » est routé.
    assert route("Bonjour, depuis hier la connexion ne marche plus.") == "technical"


# ---------------------------------------------------------------------------
# Les autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_route_chaque_ticket_vers_son_equipe():
    assert route(BILLING) == "billing"
    assert route(TECHNICAL) == "technical"
    assert route(SHIPPING) == "shipping"


def test_python_et_javascript_routent_de_meme():
    tickets = [BILLING, TECHNICAL, SHIPPING, TWO_TEAMS, NO_TEAM, "", "PRÉLÈVEMENT en double",
               unicodedata.normalize("NFD", "Prélèvement refusé"), "Mes factures de mars", "le panneau solaire",
               "mot de passe perdu", "l'expédition 📦 est en retard"]
    assert en_javascript(tickets) == [(route(t), matches(t)) for t in tickets]


def test_les_accents_et_la_casse_ne_coutent_rien():
    """Docstring de _fold : « so "Prélèvement" matches "prelevement" »."""
    assert route("PRÉLÈVEMENT en double sur mon compte") == "billing"
    assert route("prelevement en double sur mon compte") == "billing"
    assert route(unicodedata.normalize("NFD", "Prélèvement en double")) == "billing"


def test_pluriels_et_formes_derivees_se_declenchent_encore():
    """Commentaire : « "facture" then also matches "factures" »."""
    assert route("Mes factures de mars sont fausses") == "billing"
    assert route("Des erreurs apparaissent à chaque export") == "technical"
    assert route("Les livraisons du mois sont toutes en retard") == "shipping"


@pytest.mark.xfail(strict=True, reason=(
    "INFIRMÉ : le commentaire dit que « facture » déclenche aussi « facturation » ; "
    "« facturation » s'écrit f-a-c-t-u-r-a, le préfixe « facture » n'y est pas, et "
    "« Question sur la facturation » part dans la file par défaut"
))
def test_infirme_facture_declenche_aussi_facturation():
    assert matches("Question sur la facturation") == {"billing": ["facture"]}


def test_le_prix_de_la_frontiere_a_gauche_un_mot_plus_long_qui_commence_pareil():
    """Commentaire : « the price is that it would match a longer word starting the same way »."""
    assert matches("Le panneau solaire est tombé") == {"technical": ["panne"]}
    assert matches("Votre devise préférée ?") == {"billing": ["devis"]}
    # Témoin : un mot qui contient le mot-clé ailleurs qu'au début ne déclenche rien.
    assert matches("un antibug") == {}


def test_la_priorite_est_lordre_de_rules_et_rien_dautre(monkeypatch):
    """Commentaire : « Whoever disagrees can reorder this tuple and nothing else »."""
    assert [team for team, _ in RULES] == ["billing", "technical", "shipping"]
    monkeypatch.setattr(n0, "RULES", tuple(reversed(RULES)))
    assert route(TWO_TEAMS) == "shipping"


def test_un_ticket_vide_part_dans_la_file_par_defaut():
    assert route("") == DEFAULT_TEAM


def test_la_file_par_defaut_est_nommee_par_lappelant():
    assert route("Bonjour, merci de me rappeler.", default_team="triage") == "triage"


def test_matches_montre_ce_que_les_regles_ont_vu():
    """Docstring de matches : « it shows what the rules saw, and what they had to drop »."""
    assert matches(SHIPPING) == {"shipping": ["colis"]}
    assert matches("facture, devis et paiement") == {"billing": ["facture", "devis", "paiement"]}


def test_deterministe_et_bibliotheque_standard_seule(monkeypatch):
    """Docstring : « Deterministic, standard library only » ; regulatory : traité là où il est stocké."""
    def refuser(*args, **kwargs):
        raise AssertionError("un fichier a été ouvert")

    monkeypatch.setattr(builtins, "open", refuser)
    monkeypatch.setattr(os, "open", refuser)
    resultats = [route(TWO_TEAMS) for _ in range(10)]
    monkeypatch.undo()
    assert set(resultats) == {"billing"}
    source = (ICI / "n0.py").read_text(encoding="utf-8")
    assert set(re.findall(r"^import (\w+)", source, re.M)) == {"re", "unicodedata"}


def test_router_un_ticket_prend_moins_dune_milliseconde():
    """latency « <1 ms » : mille tickets en moins d'une seconde."""
    debut = time.perf_counter()
    for _ in range(1000):
        route(TWO_TEAMS)
    assert time.perf_counter() - debut < 1.0


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_un_ticket_dun_megaoctet_avec_fil_transfere_termine_vite():
    ticket = ("> Le transfert précédent, sans mot-clé, ligne après ligne.\n" * 18_000) + "Ma facture est fausse"
    debut = time.perf_counter()
    assert route(ticket) == "billing"
    assert time.perf_counter() - debut < 5.0


def test_production_emoji_bom_et_casse_mixte():
    assert route("\ufeff📦 CoLiS perdu !!") == "shipping"


def test_production_un_mot_cle_de_plusieurs_mots_avec_une_espace_insecable_ne_se_declenche_pas():
    """« mot de passe » n'est reconnu qu'avec des espaces ordinaires ; une insécable ou deux espaces le cachent."""
    assert route("mot de passe oublié") == "technical"
    assert route("mot\u00a0de\u00a0passe oublié") == DEFAULT_TEAM
    assert route("mot  de passe oublié") == DEFAULT_TEAM


def test_production_un_caractere_de_largeur_nulle_dans_un_mot_cle_le_cache():
    assert route("fac\u200bture impayée") == DEFAULT_TEAM


def test_defaut_un_ticket_a_ecritures_melangees_est_route_de_meme_dans_les_deux_langages():
    tickets = ["我的colis est perdu", "Привет,colis"]
    assert en_javascript(tickets) == [(route(t), matches(t)) for t in tickets]


def test_production_un_ticket_absent_leve():
    with pytest.raises(AttributeError):
        route(None)
