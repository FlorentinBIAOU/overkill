"""
Le fonds vit ici, pas dans l'extrait. Le même fonds et la même table attendue
figurent dans n1.test.js, ce qui tient les deux langages au même classement :
c'est ce que le docstring JavaScript affirme (« this ranks a corpus exactly as
the Python version does »).
"""

import ast
import random
import time
import unicodedata
from pathlib import Path

import pytest
from sklearn.feature_extraction.text import TfidfVectorizer

from n1 import article_text, build_neighbour_table

# Deux paires qui vont ensemble, deux articles qui ne vont avec rien, et une
# annonce. Corps courts : le cas difficile pour TF-IDF.
ARTICLES = [
    {
        "id": "sourdough-starter",
        "title": "Keeping a sourdough starter alive",
        "body": (
            "A sourdough starter is flour, water and time. Feed the starter twice a day "
            "with equal weights of flour and water, discard half, and the dough will rise "
            "on wild yeast alone. A starter that smells of acetone is a starter that "
            "wants more flour."
        ),
    },
    {
        "id": "rye-bread",
        "title": "Baking a dense rye loaf",
        "body": (
            "Rye flour holds little gluten, so a rye loaf never rises like a wheat loaf. "
            "Build the dough on a lively sourdough starter, keep the dough wet, and let "
            "it proof slowly before baking. The crumb stays dense and the loaf keeps for "
            "a week."
        ),
    },
    {
        "id": "kimchi-at-home",
        "title": "Kimchi in a jar at home",
        "body": (
            "Salt the cabbage overnight, rinse it, then pack the cabbage into a jar with "
            "garlic, ginger and chilli. Leave the jar on the counter and let the cabbage "
            "ferment. The kimchi is ready when the brine turns cloudy and tastes sour."
        ),
    },
    {
        "id": "pickled-cucumbers",
        "title": "Pickled cucumbers in brine",
        "body": (
            "Pack small cucumbers into a jar with dill, garlic and a spoon of salt, then "
            "cover them with brine. Leave the jar on the counter for a week and let the "
            "cucumbers ferment. The brine turns cloudy, which is the sign that it worked."
        ),
    },
    {
        "id": "knife-sharpening",
        "title": "Sharpening a kitchen knife",
        "body": (
            "Hold the blade against a wet whetstone at a constant angle and count the "
            "strokes on each side. Finish on a fine stone until the edge catches on a "
            "fingernail. A sharp knife is safer than a blunt knife, because a sharp blade "
            "cuts where you aim it."
        ),
    },
    {
        "id": "cast-iron-care",
        "title": "Caring for a cast iron pan",
        "body": (
            "Wash the pan, dry the pan on the hob, and wipe a thin film of oil across the "
            "iron while the pan is hot. That film, baked on, is the seasoning. Rust means "
            "the pan went into a cupboard wet, and rust comes off with oil and a scourer."
        ),
    },
    {
        "id": "site-news",
        "title": "Site news",
        "body": "The archive is searchable again and the comment form is back.",
    },
]

# La liste de mots vides appartient au fonds, pas à l'extrait.
ENGLISH_FILLER = (
    "an and are as at be but by for from in into is it its of on or so that "
    "the then this to until when while with you"
).split()

EXPECTED = {
    "sourdough-starter": [("rye-bread", 0.131)],
    "rye-bread": [("sourdough-starter", 0.131)],
    "kimchi-at-home": [("pickled-cucumbers", 0.3)],
    "pickled-cucumbers": [("kimchi-at-home", 0.3)],
    "knife-sharpening": [],
    "cast-iron-care": [],
    "site-news": [],
}

# Même sujet, deux langues.
SAME_SUBJECT_TWO_LANGUAGES = [
    {
        "id": "sourdough-starter",
        "title": "Keeping a sourdough starter alive",
        "body": (
            "A sourdough starter is flour, water and time. Feed the starter twice a day "
            "with equal weights of flour and water, discard half, and the dough will rise "
            "on wild yeast alone."
        ),
    },
    {
        "id": "levain-naturel",
        "title": "Entretenir un levain naturel",
        "body": (
            "Un levain, c'est de la farine, de l'eau et du temps. Nourrissez-le deux fois "
            "par jour avec le même poids de farine et d'eau, jetez la moitié, et la pâte "
            "lèvera toute seule."
        ),
    },
    {
        "id": "office-move",
        "title": "The office is moving",
        "body": (
            "The office moves in June. The lift will be out of service for a day and the "
            "archive boxes go into storage until the move is done."
        ),
    },
]


def scores_of(table, article_id):
    return dict(table[article_id])


def tokens(article):
    return set(TfidfVectorizer().build_analyzer()(article_text(article)))


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_le_meme_sujet_en_deux_langues_vaut_exactement_zero():
    """
    breaking_point : « l'article anglais sur le levain et son jumeau français :
    leur cosinus vaut exactement zéro, pas une valeur basse ».
    """
    table = build_neighbour_table(SAME_SUBJECT_TWO_LANGUAGES, minimum=-1.0)
    assert scores_of(table, "sourdough-starter")["levain-naturel"] == 0.0
    assert tokens(SAME_SUBJECT_TWO_LANGUAGES[0]) & tokens(SAME_SUBJECT_TWO_LANGUAGES[1]) == set()


def test_point_de_rupture_l_annonce_de_demenagement_obtient_un_score_strictement_superieur():
    """
    breaking_point : « une annonce de déménagement de bureau […] obtient un score
    strictement supérieur ». Elle entre même dans le bloc au plancher par défaut.
    """
    scores = scores_of(build_neighbour_table(SAME_SUBJECT_TWO_LANGUAGES, minimum=-1.0), "sourdough-starter")
    assert scores == {"office-move": 0.199, "levain-naturel": 0.0}
    assert build_neighbour_table(SAME_SUBJECT_TWO_LANGUAGES)["sourdough-starter"] == [("office-move", 0.199)]


def test_ce_que_l_annonce_partage_avec_l_article_anglais():
    """
    Ce que les deux textes ont en commun, mot pour mot : de la grammaire, et
    « day » — « for a day » d'un côté, « twice a day » de l'autre. Le témoin
    ci-dessous montre que même sans ce mot, l'annonce reste devant le jumeau.
    """
    shared = tokens(SAME_SUBJECT_TWO_LANGUAGES[0]) & tokens(SAME_SUBJECT_TWO_LANGUAGES[2])
    assert shared == {"and", "day", "is", "of", "the", "will"}


def test_point_de_rupture_la_grammaire_seule_suffit_a_passer_devant_le_jumeau():
    """Témoin du précédent : sans « for a day », l'annonce reste devant le jumeau."""
    no_day = [dict(a) for a in SAME_SUBJECT_TWO_LANGUAGES]
    no_day[2]["body"] = no_day[2]["body"].replace(" for a day", "")
    assert tokens(no_day[0]) & tokens(no_day[2]) == {"and", "is", "of", "the", "will"}
    assert scores_of(build_neighbour_table(no_day, minimum=-1.0), "sourdough-starter") == {
        "office-move": 0.192, "levain-naturel": 0.0
    }


def test_point_de_rupture_aucun_seuil_ne_rattrape_cela():
    """breaking_point : « Aucun seuil ne rattrape cela ». Tout plancher qui garde le jumeau garde l'annonce."""
    for floor in (-1.0, -0.001, 0.0, 0.01, 0.05, 0.1, 0.19, 0.2, 0.5):
        row = scores_of(build_neighbour_table(SAME_SUBJECT_TWO_LANGUAGES, minimum=floor), "sourdough-starter")
        if "levain-naturel" in row:
            assert "office-move" in row
        assert not ("levain-naturel" in row and floor >= 0)


# ---------------------------------------------------------------------------
# Autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_la_table_entiere_est_construite_d_un_coup():
    assert build_neighbour_table(ARTICLES, stop_words=ENGLISH_FILLER) == EXPECTED


def test_le_titre_compte_deux_fois():
    """docstring d'article_text : « The title counts twice »."""
    assert article_text(ARTICLES[6]) == "Site news Site news " + ARTICLES[6]["body"]
    # « rye » au titre de l'un, « bread » au titre de l'autre : sans le doublement,
    # ce serait le même sac de mots et un cosinus de 1.
    pair = [
        {"id": "t", "title": "rye", "body": "bread"},
        {"id": "u", "title": "bread", "body": "rye"},
        {"id": "v", "title": "oven", "body": "hot"},
    ]
    assert build_neighbour_table(pair)["t"] == [("u", 0.8)]


def test_un_mot_present_partout_pese_le_moins_mais_pas_rien():
    """
    Commentaire : « A term present everywhere weighs 1, the least possible ».
    Le moins possible n'est pas zéro : trois articles qui ne partagent que
    « the » sont voisins à 0,583, bien au-dessus du plancher. C'est pour cela
    que la liste de mots vides est le prix de ce niveau.
    """
    three = [
        {"id": "a", "title": "the", "body": "sourdough"},
        {"id": "b", "title": "the", "body": "rye"},
        {"id": "c", "title": "the", "body": "kimchi"},
    ]
    assert dict(build_neighbour_table(three)["a"])["b"] == 0.583
    # Et avec le mot dans la liste, les trois lignes sont vides.
    assert build_neighbour_table(three, stop_words=("the",)) == {"a": [], "b": [], "c": []}


def test_constat_l_idf_d_un_mot_present_partout_vaut_un():
    """Mesure de l'infirmation précédente, avec le vectoriseur de l'extrait."""
    vectoriser = TfidfVectorizer().fit([article_text(a) for a in ARTICLES])
    idf = dict(zip(vectoriser.get_feature_names_out(), vectoriser.idf_))
    assert idf["the"] == 1.0
    assert round(max(idf.values()), 3) == 2.386


def test_sans_liste_de_mots_vides_l_affutage_est_apparie_a_l_annonce_du_site():
    """verdict_rationale : « sans laquelle le test apparie l'article sur l'affûtage avec l'annonce du site »."""
    assert dict(build_neighbour_table(ARTICLES)["knife-sharpening"])["site-news"] == 0.054
    assert "site-news" not in dict(build_neighbour_table(ARTICLES, stop_words=ENGLISH_FILLER)["knife-sharpening"])


def test_les_lignes_normalisees_donnent_un_cosinus_un_article_et_sa_copie_valent_un():
    """Commentaire : « Rows come out l2-normalised, so their dot product is already a cosine »."""
    corpus = [ARTICLES[0], dict(ARTICLES[0], id="copy"), ARTICLES[2]]
    assert build_neighbour_table(corpus, stop_words=ENGLISH_FILLER)["copy"] == [("sourdough-starter", 1.0)]


def test_les_egalites_sont_departagees_par_l_identifiant():
    """Commentaire : « Ties broken by identifier »."""
    corpus = [dict(ARTICLES[0], id="z-copy"), dict(ARTICLES[0], id="a-copy"), ARTICLES[0], ARTICLES[2]]
    assert build_neighbour_table(corpus)["sourdough-starter"][:2] == [("a-copy", 1.0), ("z-copy", 1.0)]


def test_la_ponderation_est_recalculee_sur_le_seul_fonds_a_chaque_construction():
    """regulatory : « la pondération est recalculée sur votre seul corpus à chaque construction de la table »."""
    before = build_neighbour_table(ARTICLES, stop_words=ENGLISH_FILLER)["kimchi-at-home"]
    extra = {"id": "z", "title": "Brine and jar", "body": "brine jar brine"}
    after = build_neighbour_table(ARTICLES + [extra], stop_words=ENGLISH_FILLER)["kimchi-at-home"]
    assert before == [("pickled-cucumbers", 0.3)]
    assert after == [("z", 0.349), ("pickled-cucumbers", 0.278)]


def test_reecrire_un_article_change_la_table_puisque_ce_niveau_lit_le_texte():
    """
    scenario : la table « ne change que lorsque le fonds change : un article
    publié, réécrit, ou dont les étiquettes changent ». Le mot « réécrit » est
    là pour ce niveau : N0 ne lisait que les étiquettes, N1 lit le texte.
    """
    edited = [dict(a) for a in ARTICLES]
    edited[6]["body"] = "Sharpen your knife on a whetstone before the comment form comes back."
    table = build_neighbour_table(edited, stop_words=ENGLISH_FILLER)
    assert table != EXPECTED
    assert table["site-news"] == [("knife-sharpening", 0.124)]
    assert EXPECTED["site-news"] == []


def test_un_mot_d_une_lettre_est_ecarte_et_cela_coute_le_sujet_de_l_article():
    """
    Commentaire : « A one-letter word, such as the C of "Programming in C", is
    dropped with the rest ». C'est le motif de jeton par défaut de
    scikit-learn, et son prix se voit : deux articles dont C est le sujet ont
    un cosinus nul.
    """
    corpus = [
        {"id": "a", "title": "Programming in C", "body": ""},
        {"id": "b", "title": "Pointers in C", "body": ""},
        {"id": "c", "title": "Rust traits", "body": ""},
    ]
    assert scores_of(build_neighbour_table(corpus, stop_words=ENGLISH_FILLER, minimum=-1.0), "a")["b"] == 0.0
    # Témoin : nommé en entier, le même sujet rapproche les deux articles.
    nommé = [dict(a, title=a["title"].replace(" C", " Ada")) for a in corpus]
    assert scores_of(build_neighbour_table(nommé, stop_words=ENGLISH_FILLER, minimum=-1.0), "a")["b"] > 0


def test_le_lissage_ne_protege_d_aucune_division_par_zero_ici():
    """
    Commentaire : « Smoothed, as scikit-learn does by default: as if one extra
    document held every term once. » Ce lissage change les poids, il n'évite
    aucune division par zéro : le vocabulaire vient du fonds, donc tout terme
    vu figure dans au moins un document.
    """
    lisse = TfidfVectorizer().fit([article_text(a) for a in ARTICLES])
    brut = TfidfVectorizer(smooth_idf=False).fit([article_text(a) for a in ARTICLES])
    assert all(value == value and value != float("inf") for value in brut.idf_)
    # Ce qu'il change : le poids d'un terme présent partout, 1 dans les deux cas,
    # et celui du terme le plus rare, plus élevé sans lissage.
    assert round(min(lisse.idf_), 3) == round(min(brut.idf_), 3) == 1.0
    assert max(brut.idf_) > max(lisse.idf_)


def test_l_extrait_n_importe_que_scikit_learn():
    """risks.data_egress : none ; vendor_lock : library."""
    source = ast.parse(Path(__file__).with_name("n1.py").read_text(encoding="utf-8"))
    modules = {n.module for n in ast.walk(source) if isinstance(n, ast.ImportFrom)}
    assert modules == {"sklearn.feature_extraction.text", "sklearn.metrics.pairwise"}


def test_deux_constructions_rendent_la_meme_table():
    """risks.deterministic : true."""
    assert build_neighbour_table(ARTICLES, stop_words=ENGLISH_FILLER) == build_neighbour_table(ARTICLES, stop_words=ENGLISH_FILLER)


def test_k_borne_la_longueur_de_chaque_ligne():
    table = build_neighbour_table(ARTICLES, k=2)
    assert all(len(row) <= 2 for row in table.values())
    assert table["sourdough-starter"][0][0] == "rye-bread"


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_fonds_vide_et_fonds_d_un_article():
    assert build_neighbour_table([]) == {}
    assert build_neighbour_table([ARTICLES[0]]) == {"sourdough-starter": []}


def test_production_un_article_au_corps_vide_est_classe_sur_son_titre():
    articles = [dict(article) for article in ARTICLES]
    articles[0]["body"] = ""
    assert build_neighbour_table(articles, stop_words=ENGLISH_FILLER)["sourdough-starter"] == [("rye-bread", 0.082)]


def test_defaut_un_fonds_sans_aucun_mot_retenu_leve():
    assert build_neighbour_table([{"id": "a", "title": "A", "body": ""}, {"id": "b", "title": "B", "body": ""}]) == {
        "a": [], "b": []
    }


def test_defaut_un_corps_absent_devient_le_mot_none():
    corpus = [
        {"id": "a", "title": "Kimchi", "body": None},
        {"id": "b", "title": "Knives", "body": None},
        {"id": "c", "title": "Rye", "body": "rye bread"},
    ]
    assert build_neighbour_table(corpus)["a"] == []


def test_defaut_le_meme_article_en_nfd_ne_se_reconnait_pas():
    nfc = {"id": "nfc", "title": "Pâte à crêpes", "body": "La pâte à crêpes repose une heure."}
    nfd = {"id": "nfd", "title": unicodedata.normalize("NFD", nfc["title"]), "body": unicodedata.normalize("NFD", nfc["body"])}
    other = {"id": "x", "title": "Other", "body": "thing"}
    assert scores_of(build_neighbour_table([nfc, nfd, other], minimum=-1.0), "nfc")["nfd"] > 0.9


def test_production_espace_insecable_emoji_bom_et_casse():
    corpus = [
        {"id": "a", "title": "﻿KIMCHI jar 🥬", "body": "cabbage"},
        {"id": "b", "title": "kimchi jar", "body": "Cabbage"},
        {"id": "c", "title": "oven", "body": "hot"},
    ]
    assert build_neighbour_table(corpus)["a"] == [("b", 1.0)]


def test_production_limites_k_nul_et_score_egal_au_minimum():
    assert build_neighbour_table(ARTICLES, k=0, stop_words=ENGLISH_FILLER) == {a["id"]: [] for a in ARTICLES}
    assert build_neighbour_table(ARTICLES, minimum=0.3, stop_words=ENGLISH_FILLER)["kimchi-at-home"] == []
    assert build_neighbour_table(ARTICLES, minimum=0.299, stop_words=ENGLISH_FILLER)["kimchi-at-home"] == [("pickled-cucumbers", 0.3)]


def test_production_mille_articles_de_deux_cents_mots():
    rng = random.Random(1)
    words = [f"w{i}" for i in range(3000)]
    corpus = [
        {"id": f"a{i:04}", "title": " ".join(rng.sample(words, 5)), "body": " ".join(rng.choice(words) for _ in range(200))}
        for i in range(1000)
    ]
    started = time.monotonic()
    assert len(build_neighbour_table(corpus)) == 1000
    assert time.monotonic() - started < 60
