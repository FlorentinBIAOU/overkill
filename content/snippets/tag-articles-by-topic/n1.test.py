"""
Tests du niveau N1 : TF-IDF et régression logistique un contre tous.
Chaque test cite l'affirmation de la fiche qu'il démontre.
"""

import ast
import random
import time
import unicodedata
from pathlib import Path

import pytest

from n0 import tag as tag_n0
from n1 import score, tag, train

# Un fonds de la taille d'un après-midi d'étiquetage : vingt-huit articles,
# quatre thèmes, certains articles en portent deux, un n'en porte aucun. Il vit
# dans le test, parce que le fonds appartient à la rédaction et non à l'extrait.
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

ARTICLES = [article for article, _ in CORPUS]
TOPICS = [topics for _, topics in CORPUS]
MODEL = train(ARTICLES, TOPICS)

REMOTE_WORK_ARTICLE = (
    "Depuis le printemps, l'équipe ne se retrouve au bureau que le mardi. "
    "Le reste de la semaine, chacun s'organise depuis chez lui, et les "
    "réunions se tiennent en visioconférence."
)

SUBSIDY_ARTICLE = (
    "La région finance une partie du matériel acheté par les entreprises "
    "industrielles, via un guichet de subvention ouvert jusqu'en juin."
)


def _single_topic_articles(topic):
    return [article for article, topics in CORPUS if topics == [topic]]


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_un_theme_absent_du_fonds_etiquete_ressort_vide():
    """« Un thème que personne n'a étiqueté n'existe pas pour le modèle. L'article sur le guichet de subvention de la région ressort vide »."""
    assert "subventions" not in MODEL["topics"]
    assert tag(MODEL, SUBSIDY_ARTICLE) == []
    # Témoin : un article d'un thème étiqueté, au même seuil, est étiqueté.
    assert tag(MODEL, "Un message frauduleux invitait les salariés à saisir leur mot de passe sur un faux site.") == ["cybersécurité"]


def test_point_de_rupture_baisser_le_seuil_classe_l_article_en_teletravail():
    """« baisser le seuil pour le rattraper ne fait pas apparaître le thème manquant : il classe l'article en télétravail »."""
    scored = score(MODEL, SUBSIDY_ARTICLE)
    # Le premier thème qui entre quand le seuil descend est le télétravail.
    assert max(scored, key=scored.get) == "télétravail"
    assert tag(MODEL, SUBSIDY_ARTICLE, threshold=0.25) == ["télétravail"]
    # Au seuil zéro, tous les thèmes connus, jamais le thème manquant.
    assert set(tag(MODEL, SUBSIDY_ARTICLE, threshold=0.0)) == set(MODEL["topics"])


# ---------------------------------------------------------------------------
# Nom, docstring, commentaires
# ---------------------------------------------------------------------------


def test_n1_est_tfidf_et_un_contre_tous_de_bibliotheque():
    """name « TF-IDF et classification multi-étiquette un contre tous » ; risks `vendor_lock: library`."""
    steps = MODEL["pipeline"].named_steps
    assert type(steps["tfidfvectorizer"]).__name__ == "TfidfVectorizer"
    assert type(steps["onevsrestclassifier"]).__name__ == "OneVsRestClassifier"
    assert len(steps["onevsrestclassifier"].estimators_) == 4
    source = ast.parse(Path(__file__).with_name("n1.py").read_text(encoding="utf-8"))
    modules = {node.module.split(".")[0] for node in ast.walk(source) if isinstance(node, ast.ImportFrom)}
    assert modules == {"sklearn"}


def test_bureau_visioconference_et_domicile_portent_le_theme_du_teletravail():
    """« "bureau", "visioconférence" et "domicile" finissent par porter le thème du télétravail »."""
    vocabulary = MODEL["pipeline"].named_steps["tfidfvectorizer"].vocabulary_
    estimators = dict(zip(MODEL["topics"], MODEL["pipeline"].named_steps["onevsrestclassifier"].estimators_))
    for word in ("bureau", "visioconférence", "domicile"):
        weights = {topic: est.coef_[0][vocabulary[word]] for topic, est in estimators.items()}
        assert weights["télétravail"] > 0, word
        assert all(w < 0 for topic, w in weights.items() if topic != "télétravail"), word


def test_les_themes_ne_se_disputent_pas_un_vainqueur_unique():
    """« One classifier per topic […] the topics do not compete for a single winner » (existant)."""
    article = "Les indemnités de télétravail sont soumises à l'impôt et à la TVA."
    assert sum(score(MODEL, article).values()) > 1.0


def test_chaque_probabilite_est_independante_des_autres_themes():
    """`score` : « One probability per topic, each independent of the others »."""
    article = "Les indemnités de télétravail sont soumises à l'impôt et à la TVA."
    two_topics = train(ARTICLES, [[t for t in topics if t in ("fiscalité", "télétravail")] for topics in TOPICS])
    assert score(two_topics, article)["fiscalité"] == pytest.approx(score(MODEL, article)["fiscalité"], abs=1e-9)


def test_un_article_ressort_avec_deux_themes():
    """« an article can come back with […] tags » (existant)."""
    article = (
        "Les indemnités de télétravail versées aux salariés qui travaillent "
        "depuis chez eux entrent dans le calcul de l'impôt et de la TVA."
    )
    assert tag(MODEL, article) == ["fiscalité", "télétravail"]


@pytest.mark.xfail(
    strict=True,
    reason="INFIRMÉ : « an article can come back with three tags » ; un article fait des articles d'entraînement de "
    "trois thèmes, recopiés mot pour mot, ressort sans aucune étiquette au seuil par défaut (scores 0,32 à 0,39) : "
    "la normalisation L2 dilue chaque thème",
)
def test_un_article_qui_traite_trois_themes_ressort_avec_trois_etiquettes():
    article = " ".join(
        " ".join(_single_topic_articles(t)) for t in ("cybersécurité", "fiscalité", "recrutement")
    )
    assert tag(MODEL, article) == ["cybersécurité", "fiscalité", "recrutement"]


def test_un_article_hors_de_tout_theme_ressort_vide():
    """« or with none » (existant)."""
    assert tag(MODEL, "Le restaurant du coin a changé de carte.") == []
    assert tag(MODEL, "") == []


def test_le_modele_ne_connait_que_les_themes_du_fonds():
    """Existant."""
    assert MODEL["topics"] == ["cybersécurité", "fiscalité", "recrutement", "télétravail"]


def test_etiquette_un_article_d_un_theme_appris():
    """Cas nominal (existant)."""
    article = (
        "Un message frauduleux invitait les salariés à saisir leur mot de passe "
        "sur un faux site de la banque."
    )
    assert tag(MODEL, article) == ["cybersécurité"]


def test_un_article_sans_etiquette_est_un_exemple_negatif_utile():
    """`train` : « An untagged article is a useful negative example, not a gap »."""
    without_negative = train(ARTICLES[:-1], TOPICS[:-1])
    article = "Le conseil municipal a voté le budget."
    assert max(score(MODEL, article).values()) < max(score(without_negative, article).values()) - 0.1


@pytest.mark.xfail(
    strict=True,
    reason="INFIRMÉ : commentaire « Word unigrams and bigrams: "
    "\"à distance\" says something that \"distance\" alone does not » ; le motif de jetons par défaut ne garde que les "
    "mots de deux caractères au moins, « à » est jeté et le bigramme « à distance » n'existe pas",
)
def test_le_bigramme_a_distance_est_un_trait():
    assert "à distance" in MODEL["pipeline"].named_steps["tfidfvectorizer"].vocabulary_


def test_les_bigrammes_sont_des_traits():
    """Témoin du précédent : les bigrammes existent, ceux qui ne contiennent pas « à »."""
    vocabulary = MODEL["pipeline"].named_steps["tfidfvectorizer"].vocabulary_
    assert "travailler distance" in vocabulary
    assert "crédit impôt" in vocabulary


def test_le_seuil_est_a_vous():
    """« The threshold is yours to set » (existant)."""
    article = "La prime de télétravail versée aux salariés est-elle soumise à l'impôt sur le revenu ?"
    assert tag(MODEL, article) == ["fiscalité"]
    assert tag(MODEL, article, threshold=0.3) == ["fiscalité", "télétravail"]


def test_monter_le_seuil_retire_des_etiquettes_le_baisser_en_ajoute():
    """« Move it towards 1 when a wrong tag is worse than a missing one, towards 0 when […] one topic too many »."""
    article = "La prime de télétravail versée aux salariés est-elle soumise à l'impôt sur le revenu ?"
    previous = None
    for step in range(0, 11):
        kept = set(tag(MODEL, article, threshold=step / 10))
        if previous is not None:
            assert kept <= previous
        previous = kept
    assert tag(MODEL, article, threshold=0.0) and tag(MODEL, article, threshold=1.0) == []


def test_n1_rattrape_le_point_de_rupture_de_n0():
    """verdict_rationale : « l'article de télétravail qui n'emploie aucun terme de la liste, et que le vocabulaire contrôlé laisse filer, il l'étiquette, et le test le mesure » (existant)."""
    vocabulary = {
        "cybersécurité": ["cybersécurité", "rançongiciel", "hameçonnage", "mot de passe"],
        "fiscalité": ["fiscalité", "impôt", "TVA", "crédit d'impôt", "déclaration fiscale"],
        "recrutement": ["recrutement", "embauche", "candidat", "entretien d'embauche"],
        "télétravail": ["télétravail", "travail à distance", "distanciel"],
    }
    assert tag_n0(REMOTE_WORK_ARTICLE, vocabulary) == []
    assert tag(MODEL, REMOTE_WORK_ARTICLE) == ["télétravail"]


def test_n1_est_deterministe():
    """risks `deterministic: true`."""
    again = train(ARTICLES, TOPICS)
    assert score(again, REMOTE_WORK_ARTICLE) == score(MODEL, REMOTE_WORK_ARTICLE)


def test_une_decision_prend_moins_d_une_milliseconde():
    """latency `<1 ms` (mesuré 0,5 ms)."""
    tag(MODEL, REMOTE_WORK_ARTICLE)
    best = float("inf")
    for _ in range(30):
        start = time.perf_counter()
        tag(MODEL, REMOTE_WORK_ARTICLE)
        best = min(best, time.perf_counter() - start)
    assert best < 0.001


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_un_fonds_vide_ou_sans_theme_est_refuse():
    with pytest.raises(ValueError):
        train([], [])
    with pytest.raises(ValueError):
        train(ARTICLES, TOPICS[:-2])


@pytest.mark.xfail(
    strict=True,
    reason="DÉFAUT (Python) : avec un seul thème dans le fonds, scikit-learn traite le problème en binaire et "
    "`predict_proba` rend deux colonnes ; `score` lit la première, la probabilité de l'absence du thème",
)
def test_defaut_un_fonds_a_un_seul_theme_donne_la_probabilite_du_theme():
    article = "Les indemnités de télétravail sont soumises à l'impôt et à la TVA."
    one_topic = train(ARTICLES, [[t for t in topics if t == "fiscalité"] for topics in TOPICS])
    assert score(one_topic, article)["fiscalité"] == pytest.approx(score(MODEL, article)["fiscalité"], abs=0.05)


def test_production_valeurs_aux_limites_du_seuil():
    scored = score(MODEL, REMOTE_WORK_ARTICLE)
    exact = scored["télétravail"]
    assert "télétravail" in tag(MODEL, REMOTE_WORK_ARTICLE, threshold=exact)
    assert "télétravail" not in tag(MODEL, REMOTE_WORK_ARTICLE, threshold=exact + 1e-9)
    assert tag(MODEL, "", threshold=0.0) == sorted(MODEL["topics"], key=lambda t: (-score(MODEL, "")[t], t))


def test_production_un_article_de_700_ko_termine_vite():
    article = " ".join(ARTICLES) * 300
    start = time.perf_counter()
    tag(MODEL, article)
    assert time.perf_counter() - start < 2


def test_production_un_fonds_de_trois_cents_articles_s_entraine():
    """« quelques centaines d'articles » : 300 articles de 500 mots, 146 000 traits (mesuré 3,4 s)."""
    rng = random.Random(7)
    lexicon = [f"mot{i}" for i in range(3000)]
    articles = [" ".join(lexicon[int(3000 * rng.random() ** 2)] for _ in range(500)) for _ in range(300)]
    topics = [[("a", "b", "c", "d")[i % 4]] for i in range(300)]
    start = time.perf_counter()
    model = train(articles, topics)
    assert time.perf_counter() - start < 30
    assert model["topics"] == ["a", "b", "c", "d"]


def test_production_encodage_nfd_insecables_emoji_bom():
    nfd = unicodedata.normalize("NFD", REMOTE_WORK_ARTICLE)
    assert tag(MODEL, nfd) == ["télétravail"]
    assert tag(MODEL, "﻿" + REMOTE_WORK_ARTICLE.replace(" ", " ") + " 🙂") == ["télétravail"]
    assert tag(MODEL, REMOTE_WORK_ARTICLE.upper()) == ["télétravail"]
