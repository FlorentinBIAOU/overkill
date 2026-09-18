"""
Ces tests injectent un double local au lieu de charger un vrai encodeur.

Ce qu'ils prouvent : une chaîne par article, un seul appel pour tout le fonds,
une table correctement ordonnée, un fonds trop petit pour une paire n'atteint
jamais le modèle, et un encodeur qui tombe ou rend le mauvais nombre de vecteurs
lève.

Ce qu'ils ne prouvent pas : qu'un vrai encodeur rapproche les bons articles, et
en particulier qu'il comble le trou de N1 : le double apparie des mots, comme
N1. C'est pourquoi la fiche déclare `verification: stubbed`.
"""

import sys
import time
import types

import numpy as np
import pytest

from _harness.fake_model import FakeEncoder
from n1 import build_neighbour_table as build_n1
from n2 import MODEL_NAME, EncodingFailed, article_text, build_neighbour_table, unit

# Corps courts, la longueur d'un chapeau. Le même fonds figure dans n2.test.js.
ARTICLES = [
    {
        "id": "sourdough-starter",
        "title": "Keeping a sourdough starter alive",
        "body": "Feeding flour and water to a sourdough starter, and reading its smell.",
    },
    {
        "id": "rye-bread",
        "title": "Baking a dense rye loaf",
        "body": "Rye flour, a sourdough starter, a long proof, a dense rye loaf.",
    },
    {
        "id": "kimchi-at-home",
        "title": "Kimchi in a jar at home",
        "body": "Salting cabbage, packing a jar, waiting for the ferment to turn sour.",
    },
    {
        "id": "pickled-cucumbers",
        "title": "Pickled cucumbers in brine",
        "body": "Cucumbers, dill and brine in a jar, left to ferment on the counter.",
    },
    {
        "id": "knife-sharpening",
        "title": "Sharpening a kitchen knife",
        "body": "Angle, whetstone and strokes: putting an edge back on a kitchen knife.",
    },
    {
        "id": "cast-iron-care",
        "title": "Caring for a cast iron pan",
        "body": "Oil, heat and seasoning: keeping rust off a cast iron pan.",
    },
]

# Les deux voisins de chaque article, meilleur en tête ; égalités départagées
# par l'identifiant, d'où kimchi avant rye pour knife-sharpening.
EXPECTED = {
    "sourdough-starter": [("rye-bread", 0.416), ("cast-iron-care", 0.28)],
    "rye-bread": [("sourdough-starter", 0.416), ("kimchi-at-home", 0.273)],
    "kimchi-at-home": [("pickled-cucumbers", 0.421), ("rye-bread", 0.273)],
    "pickled-cucumbers": [("kimchi-at-home", 0.421), ("sourdough-starter", 0.18)],
    "knife-sharpening": [("kimchi-at-home", 0.261), ("rye-bread", 0.261)],
    "cast-iron-care": [("sourdough-starter", 0.28), ("rye-bread", 0.256)],
}

# Le four, la plaque, la grille, le couteau, la planche, le pot de confiture, la poêle.
RAMBLING = (
    " The oven, the tin, the cooling rack, the knife, the board and the jar of jam all "
    "come into it, and so does the counter, the kitchen, the oil, the pan and the iron "
    "shelf above the hob."
)


def encoder():
    return FakeEncoder(dimensions=256)


class TruncatedEncoder(FakeEncoder):
    """Un modèle qui perd en silence le dernier élément d'un lot."""

    def encode(self, texts):
        return super().encode(texts)[:-1]


class BrokenEncoder:
    """Un modèle qui ne peut pas tourner du tout."""

    def encode(self, texts):
        raise RuntimeError("out of memory while loading the model")


class TableEncoder:
    """Un encodeur dont les vecteurs sont fabriqués par une fonction du lot."""

    def __init__(self, make):
        self.make = make

    def encode(self, texts):
        return self.make(texts)


@pytest.fixture
def sentence_transformers(monkeypatch):
    """Un module à la surface de sentence-transformers publié ; il compte les chargements."""
    module = types.ModuleType("sentence_transformers")
    module.loads = []

    class SentenceTransformer:
        def __init__(self, name):
            module.loads.append(name)
            self._fake = FakeEncoder(dimensions=256)

        def encode(self, sentences):
            return np.array(self._fake.encode(list(sentences)), dtype=np.float64)

    module.SentenceTransformer = SentenceTransformer
    monkeypatch.setitem(sys.modules, "sentence_transformers", module)
    return module


def diluted():
    articles = [dict(article) for article in ARTICLES]
    articles[1]["body"] += RAMBLING
    return articles


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_le_paragraphe_digressif_coute_au_seigle_sa_place_de_premier_voisin():
    """
    breaking_point : « Le test ajoute un paragraphe digressif à l'article sur le
    pain de seigle […] et cela suffit à lui coûter sa place de premier voisin :
    l'article sur le levain se retrouve apparié à celui sur la poêle en fonte ».
    Témoin : avant l'ajout, le seigle est premier voisin du levain.
    """
    before = build_neighbour_table(ARTICLES, encoder=encoder(), k=2)
    after = build_neighbour_table(diluted(), encoder=encoder(), k=2)
    assert before["sourdough-starter"][0][0] == "rye-bread"
    assert after["sourdough-starter"][0][0] == "cast-iron-care"


def test_point_de_rupture_l_article_rallonge_perd_son_propre_meilleur_voisin():
    """breaking_point : « et l'article rallongé perd au passage son propre meilleur voisin »."""
    assert build_neighbour_table(ARTICLES, encoder=encoder(), k=2)["rye-bread"][0][0] == "sourdough-starter"
    assert build_neighbour_table(diluted(), encoder=encoder(), k=2)["rye-bread"][0][0] == "kimchi-at-home"


def test_point_de_rupture_c_est_le_hors_sujet_qui_dilue_pas_la_longueur_seule():
    """
    Témoin de « un texte qui aborde huit sujets » : rallonger l'article de seigle
    avec son propre sujet (le corps répété huit fois) ne lui coûte pas sa place.
    """
    longer = [dict(article) for article in ARTICLES]
    longer[1]["body"] = " ".join([longer[1]["body"]] * 8)
    table = build_neighbour_table(longer, encoder=encoder(), k=2)
    assert table["sourdough-starter"][0] == ("rye-bread", 0.482)
    assert table["rye-bread"][0] == ("sourdough-starter", 0.482)


def test_constat_avec_le_double_huit_sujets_ne_pesent_pas_chacun_un_huitieme():
    """
    breaking_point : « un texte qui aborde huit sujets les porte chacun au
    huitième ». Non testable pour un vrai encodeur ; avec le double, le cosinus
    entre un article de huit mots et l'un de ces mots vaut 0,289, pas 0,125 :
    une norme L2 répartit en racine, pas en fraction.
    """
    eight = [
        {"id": "all", "title": "oven", "body": "board jam pan rye kimchi knife iron"},
        {"id": "one", "title": "rye", "body": ""},
        {"id": "z", "title": "zzz", "body": ""},
    ]
    assert build_neighbour_table(eight, encoder=encoder(), minimum=-1.0)["one"][0] == ("all", 0.289)


# ---------------------------------------------------------------------------
# Autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_la_table_entiere_est_construite_d_un_coup():
    assert build_neighbour_table(ARTICLES, encoder=encoder(), k=2) == EXPECTED


def test_le_fonds_est_encode_en_un_seul_appel_et_en_entier():
    """Commentaire : « One batched call […] this runs over the whole corpus every time »."""
    fake = encoder()
    build_neighbour_table(ARTICLES, encoder=fake)
    assert fake.calls == [[article_text(article) for article in ARTICLES]]


def test_une_chaine_par_article_titre_puis_corps():
    """docstring d'article_text : « One string per article »."""
    assert article_text(ARTICLES[0]) == "Keeping a sourdough starter alive. Feeding flour and water to a sourdough starter, and reading its smell."


def test_unit_normalise_et_laisse_le_vecteur_nul_intact():
    assert unit([3, 4]) == [0.6, 0.8]
    assert unit([0, 0]) == [0.0, 0.0]


def test_les_egalites_sont_departagees_par_l_identifiant():
    tie = [{"id": i, "title": "a", "body": "b"} for i in ("z", "b", "m")]
    assert build_neighbour_table(tie, encoder=encoder())["z"] == [("b", 1.0), ("m", 1.0)]


def test_un_fonds_trop_petit_pour_une_paire_n_atteint_jamais_le_modele():
    fake = encoder()
    assert build_neighbour_table([ARTICLES[0]], encoder=fake) == {"sourdough-starter": []}
    assert build_neighbour_table([], encoder=fake) == {}
    assert fake.calls == []


def test_k_borne_la_longueur_de_chaque_ligne():
    assert build_neighbour_table(ARTICLES, encoder=encoder(), k=1)["sourdough-starter"] == [("rye-bread", 0.416)]


def test_un_modele_qui_ne_peut_pas_tourner_leve():
    with pytest.raises(EncodingFailed):
        build_neighbour_table(ARTICLES, encoder=BrokenEncoder())


def test_un_lot_tronque_leve_plutot_que_de_decaler_chaque_voisin():
    with pytest.raises(EncodingFailed):
        build_neighbour_table(ARTICLES, encoder=TruncatedEncoder(dimensions=256))


def test_infirme_des_vecteurs_inutilisables_levent():
    nan = TableEncoder(lambda texts: [[float("nan")] * 3 for _ in texts])
    ragged = TableEncoder(lambda texts: [[1.0, 0.0]] * (len(texts) - 1) + [[1.0, 0.0, 5.0]])
    for bad in (nan, ragged):
        with pytest.raises(EncodingFailed):
            build_neighbour_table(ARTICLES, encoder=bad)


def test_constat_le_double_ne_comble_pas_le_trou_des_deux_langues():
    """
    docstring : « the French and the English piece on sourdough can land
    together ». Non testable ici : le double apparie des mots, et rend zéro comme N1.
    """
    two = [
        {"id": "en", "title": "Keeping a sourdough starter alive", "body": "Feed the starter twice a day."},
        {"id": "fr", "title": "Entretenir un levain naturel", "body": "Nourrissez-le deux fois par jour."},
        {"id": "x", "title": "Other", "body": "thing"},
    ]
    assert dict(build_neighbour_table(two, encoder=encoder(), minimum=-1.0)["en"])["fr"] == 0.0


def test_scenario_la_table_a_la_meme_forme_qu_en_n0_et_n1():
    """docstring : « it has the same shape as the one N0 and N1 return »."""
    for table in (build_neighbour_table(ARTICLES, encoder=encoder()), build_n1(ARTICLES)):
        assert set(table) == {a["id"] for a in ARTICLES}
        for row in table.values():
            assert all(isinstance(n, tuple) and isinstance(n[0], str) and isinstance(n[1], float) for n in row)


def test_le_modele_nomme_est_multilingue():
    assert MODEL_NAME == "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"


def test_le_modele_par_defaut_a_la_surface_de_sentence_transformers(sentence_transformers):
    """Contre un module à la surface publiée, le chargement par défaut fonctionne."""
    assert build_neighbour_table(ARTICLES, k=2) == EXPECTED
    assert sentence_transformers.loads == [MODEL_NAME]


def test_le_modele_est_charge_par_construction_et_lache_ensuite(sentence_transformers):
    """
    Le modèle sert à construire la table, hors ligne, et rien ne le garde entre
    deux constructions : ce niveau ne demande pas un service à tenir chaud, il
    demande une machine le temps d'une construction. C'est ce qui le sépare
    d'un modèle interrogé à l'affichage.
    """
    build_neighbour_table(ARTICLES)
    build_neighbour_table(ARTICLES)
    assert len(sentence_transformers.loads) == 2


def test_deux_constructions_rendent_la_meme_table():
    """risks.deterministic : true (avec le double)."""
    assert build_neighbour_table(ARTICLES, encoder=encoder()) == build_neighbour_table(ARTICLES, encoder=encoder())


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_trois_cents_articles():
    corpus = [{"id": f"a{i:04}", "title": f"title {i}", "body": "word " * 20 + f"w{i % 37}"} for i in range(300)]
    started = time.monotonic()
    assert len(build_neighbour_table(corpus, encoder=encoder())) == 300
    assert time.monotonic() - started < 60


def test_production_le_texte_part_tel_quel_nfd_insecable_emoji():
    fake = encoder()
    odd = [dict(ARTICLES[0], title="Pâte à crêpes 🥞﻿"), ARTICLES[1]]
    build_neighbour_table(odd, encoder=fake)
    assert fake.calls[0][0].startswith("Pâte à crêpes 🥞﻿. ")


def test_production_limites_k_nul_et_score_egal_au_minimum():
    assert build_neighbour_table(ARTICLES, encoder=encoder(), k=0) == {a["id"]: [] for a in ARTICLES}
    assert build_neighbour_table(ARTICLES, encoder=encoder(), minimum=0.416)["rye-bread"] == []
    assert build_neighbour_table(ARTICLES, encoder=encoder(), minimum=0.415)["rye-bread"] == [("sourdough-starter", 0.416)]
