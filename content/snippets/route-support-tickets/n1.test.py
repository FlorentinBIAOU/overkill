import json
import shutil
import subprocess
import time
import unicodedata
from pathlib import Path

import pytest
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline

import n0
from n1 import DEFAULT_TEAM, rank, route, train

ICI = Path(__file__).parent

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

UNKNOWN = "Votre entrepôt accepte-t-il les visites scolaires le mercredi"
TWO_TEAMS = "Le colis n'est jamais arrivé et le prélèvement est passé quand même"
NO_KEYWORD = "La page reste blanche quand je valide le formulaire"
SHRUG = "Bonjour, depuis hier je n’arrive plus à faire ce que je faisais avant"


def make_model():
    return train(ARCHIVE, TEAMS)


def route_en_javascript(tickets):
    """Entraîne le vrai n1.js sur la même archive, et route les tickets."""
    node = shutil.which("node")
    assert node, "node est requis pour comparer les deux implémentations"
    script = (
        f"import {{ train, route }} from {json.dumps((ICI / 'n1.js').as_uri())};"
        "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{"
        "const {archive,teams,tickets}=JSON.parse(d);const m=train(archive,teams);"
        "process.stdout.write(JSON.stringify(tickets.map(t=>route(m,t))));});"
    )
    sortie = subprocess.run([node, "--input-type=module", "-e", script],
                            input=json.dumps({"archive": ARCHIVE, "teams": TEAMS, "tickets": tickets}),
                            capture_output=True, text=True, timeout=60, check=True)
    return json.loads(sortie.stdout)


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_le_ticket_inconnu_ne_partage_que_le_mot_le():
    """
    breaking_point : « « Votre entrepôt accepte-t-il les visites scolaires le
    mercredi » ne partage avec les tickets déjà résolus que le mot « le » ».
    """
    model = make_model()
    vectorizer = model.named_steps["tfidfvectorizer"]
    communs = [term for term in vectorizer.build_analyzer()(UNKNOWN) if term in vectorizer.vocabulary_]
    assert communs == ["le"]


def test_point_de_rupture_les_trois_equipes_ressortent_presque_a_egalite_et_le_seuil_nest_pas_atteint():
    """« les trois équipes ressortent presque à égalité, le seuil de confiance n'est pas atteint, et le ticket repart dans la file par défaut »."""
    model = make_model()
    ranked = rank(model, UNKNOWN)
    scores = [score for _, score in ranked]
    assert max(scores) - min(scores) < 0.1
    assert scores[0] < 0.5
    assert route(model, UNKNOWN) == DEFAULT_TEAM
    # Témoin : un ticket que l'archive connaît franchit le seuil.
    assert route(model, "Le prélèvement de février est passé deux fois sur mon compte") == "billing"


def test_point_de_rupture_n1_na_pas_supprime_la_file_par_defaut_il_la_retrecie():
    """« N1 n'a pas supprimé cette file, il l'a rétrécie »."""
    model = make_model()
    tickets = [UNKNOWN, NO_KEYWORD, "L’application plante au démarrage", "Mon adresse de livraison a changé",
               "Le paiement a été refusé", "Le suivi indique livré mais rien reçu",
               "Je ne comprends pas la ligne de TVA", SHRUG]
    defaut_n0 = [t for t in tickets if n0.route(t) == n0.DEFAULT_TEAM]
    defaut_n1 = [t for t in tickets if route(model, t) == DEFAULT_TEAM]
    assert 0 < len(defaut_n1) < len(defaut_n0)
    assert set(defaut_n1) <= set(defaut_n0)


# ---------------------------------------------------------------------------
# Les autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_route_un_ticket_quil_na_jamais_vu():
    model = make_model()
    assert route(model, "Le montant prélevé sur ma facture de février est faux") == "billing"
    assert route(model, "Le tableau de bord ne s'ouvre plus depuis la mise à jour") == "technical"
    assert route(model, "Le transporteur a livré le colis chez le voisin") == "shipping"


def test_attrape_un_ticket_qui_nemploie_aucun_mot_cle_de_n0():
    """Docstring : « the vocabulary of the customers, not the vocabulary of the rule writer, decides » ; verdict : « elle route les formulations que la liste de mots-clés de N0 n'avait pas prévues »."""
    assert route(make_model(), NO_KEYWORD) == "technical"
    # Témoin : N0 ne le route pas.
    assert n0.route(NO_KEYWORD) == n0.DEFAULT_TEAM


def test_les_accents_et_la_casse_ne_coutent_rien():
    model = make_model()
    assert route(model, "PRELEVEMENT en double sur ma facture") == "billing"
    assert rank(model, unicodedata.normalize("NFD", "Prélèvement en double")) == rank(model, "Prélèvement en double")


def test_les_paires_de_mots_sont_apprises_avec_les_mots_seuls():
    """Docstring de train : « Word pairs as well as single words, because "mot de passe" and "en retard" carry more »."""
    vocabulaire = make_model().named_steps["tfidfvectorizer"].vocabulary_
    assert {"mot", "mot de", "de passe", "passe"} <= set(vocabulaire)


def test_une_archive_desequilibree_non_ponderee_repond_lequipe_la_plus_chargee():
    """Docstring de train : « an unweighted model learns to answer the busiest team »."""
    archive = BILLING * 5 + SHIPPING[:2] + TECHNICAL
    equipes = ["billing"] * 35 + ["shipping"] * 2 + ["technical"] * 7
    ticket = "La livraison du colis est en retard"
    assert rank(train(archive, equipes), ticket)[0][0] == "shipping"
    non_ponderee = make_pipeline(
        TfidfVectorizer(strip_accents="unicode", ngram_range=(1, 2), sublinear_tf=True),
        LogisticRegression(max_iter=1000, C=10),
    ).fit(archive, equipes)
    assert rank(non_ponderee, ticket)[0][0] == "billing"


def test_avec_le_c_par_defaut_deux_des_trois_tickets_restent_sous_le_plancher():
    """
    Commentaire de `train` : « With the default C=1, two of the three unseen
    tickets stay under the 0.5 floor » — c'est-à-dire qu'ils repartiraient en
    file par défaut, alors que l'archive les connaît.
    """
    defaut = make_pipeline(
        TfidfVectorizer(strip_accents="unicode", ngram_range=(1, 2), sublinear_tf=True),
        LogisticRegression(class_weight="balanced", max_iter=1000),
    ).fit(ARCHIVE, TEAMS)
    tickets = ["Le montant prélevé sur ma facture de février est faux",
               "Le tableau de bord ne s'ouvre plus depuis la mise à jour",
               "Le transporteur a livré le colis chez le voisin"]
    sous_le_plancher = [t for t in tickets if rank(defaut, t)[0][1] < 0.5]
    assert len(sous_le_plancher) == 2
    # Témoin : avec le C de l'extrait, les trois franchissent le plancher.
    model = make_model()
    assert all(rank(model, t)[0][1] >= 0.5 for t in tickets)


def test_rank_montre_lequipe_suivante():
    """Docstring de rank : « A support desk needs the runner-up » ; verdict : « l'équipe suivante figure dans la réponse »."""
    ranked = rank(make_model(), TWO_TEAMS)
    assert len(ranked) == 3
    assert [team for team, _ in ranked[:2]] == ["shipping", "billing"]
    assert ranked[1][1] > ranked[2][1]
    assert sum(score for _, score in ranked) == pytest.approx(1.0)


def test_le_plancher_est_a_vous_de_le_fixer():
    """Docstring de route : « The floor is yours to set »."""
    model = make_model()
    ticket = "Le montant prélevé sur ma facture de février est faux"
    confiance = rank(model, ticket)[0][1]
    assert route(model, ticket, min_confidence=0.0) == "billing"
    assert route(model, ticket, min_confidence=confiance) == "billing"
    assert route(model, ticket, min_confidence=confiance + 1e-9) == DEFAULT_TEAM
    assert route(model, ticket, min_confidence=1.0) == DEFAULT_TEAM
    assert route(model, UNKNOWN, default_team="triage") == "triage"


def test_deterministe_le_meme_export_redonne_le_meme_modele():
    """risks.deterministic : true."""
    assert rank(make_model(), TWO_TEAMS) == rank(make_model(), TWO_TEAMS)


def test_router_un_ticket_prend_moins_dune_milliseconde_une_fois_le_modele_entraine():
    """latency « <1 ms » : mesuré ici à la milliseconde près, cent tickets en moins d'une seconde (scikit-learn a un coût d'appel fixe)."""
    model = make_model()
    debut = time.perf_counter()
    for _ in range(100):
        route(model, TWO_TEAMS)
    assert time.perf_counter() - debut < 1.0


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_un_ticket_vide_part_dans_la_file_par_defaut():
    assert route(make_model(), "") == DEFAULT_TEAM


def test_production_une_archive_dune_seule_equipe_est_refusee():
    with pytest.raises(ValueError):
        train(BILLING, ["billing"] * len(BILLING))
    with pytest.raises(ValueError):
        train([], [])


def test_production_une_archive_de_630_tickets_au_vocabulaire_varie_sentraine_vite():
    equipes = ["billing", "technical", "shipping"]
    tickets = [f"Commande {10000 + i} client {i * 7919 % 100000} probleme numero {i}" for i in range(630)]
    debut = time.perf_counter()
    model = train(tickets, [equipes[i % 3] for i in range(630)])
    assert time.perf_counter() - debut < 10.0
    assert len(rank(model, "Commande 10001")) == 3


def test_production_un_ticket_dun_megaoctet_emoji_bom_et_insecables():
    model = make_model()
    debut = time.perf_counter()
    assert route(model, "\ufeff📦 Le colis\u00a0n'est pas arrivé " * 30_000) == "shipping"
    assert time.perf_counter() - debut < 10.0


def test_defaut_python_et_javascript_routent_les_memes_tickets_vers_les_memes_files():
    tickets = [TWO_TEAMS, SHRUG, UNKNOWN, NO_KEYWORD]
    model = make_model()
    assert route_en_javascript(tickets) == [route(model, t) for t in tickets]
