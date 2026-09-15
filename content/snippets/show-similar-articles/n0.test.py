"""
Le fonds vit ici, pas dans l'extrait : l'extrait montre une fonction, pas une
démonstration. Le même fonds et la même table attendue figurent dans
n0.test.js, ce qui tient les deux langages au même classement.
"""

import ast
import inspect
import random
import time
import unicodedata
from pathlib import Path

import pytest

from n0 import build_neighbour_table, similarity, tag_weights
from n1 import build_neighbour_table as build_n1

# Un petit blog. Chaque article porte « blog », comme chaque article d'un vrai
# site porte l'étiquette posée le premier jour et jamais retirée.
ARTICLES = [
    {"id": "kimchi-at-home", "tags": ["blog", "fermentation", "vegetables"]},
    {"id": "cast-iron-care", "tags": ["blog", "tools", "maintenance", "cast-iron"]},
    {"id": "knife-sharpening", "tags": ["blog", "tools", "maintenance"]},
    {"id": "rye-bread", "tags": ["blog", "baking", "sourdough", "rye"]},
    {"id": "site-news", "tags": ["blog"]},
    {"id": "sourdough-starter", "tags": ["blog", "baking", "sourdough", "fermentation"]},
]

EXPECTED = {
    "kimchi-at-home": [("sourdough-starter", 0.302)],
    "cast-iron-care": [("knife-sharpening", 0.655)],
    "knife-sharpening": [("cast-iron-care", 0.655)],
    "rye-bread": [("sourdough-starter", 0.535)],
    "site-news": [],
    "sourdough-starter": [("rye-bread", 0.535), ("kimchi-at-home", 0.302)],
}

TOO_GENERIC = [
    {"id": "first", "tags": ["blog", "article"]},
    {"id": "second", "tags": ["blog", "article"]},
    {"id": "third", "tags": ["blog", "article"]},
]

TOO_SPECIFIC = [
    {"id": "first", "tags": ["2024-retrospective"]},
    {"id": "second", "tags": ["march-release"]},
    {"id": "third", "tags": ["office-move"]},
]


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_un_fonds_mal_etiquete_ne_produit_aucune_similarite():
    """
    breaking_point : « Un fonds mal étiqueté ne produit aucune similarité » ; les
    deux fonds du test sortent entièrement vides.
    """
    assert build_neighbour_table(TOO_GENERIC) == {"first": [], "second": [], "third": []}
    assert build_neighbour_table(TOO_SPECIFIC) == {"first": [], "second": [], "third": []}


def test_point_de_rupture_blog_et_article_pesent_exactement_zero():
    """
    breaking_point : « chaque article porte « blog » et « article », dont le
    poids vaut exactement zéro ». Témoin : trois articles aux étiquettes
    identiques, qu'un simple comptage déclarerait parfaitement semblables.
    """
    assert tag_weights(TOO_GENERIC) == {"blog": 0.0, "article": 0.0}
    ones = {"blog": 1.0, "article": 1.0}
    assert round(similarity(TOO_GENERIC[0]["tags"], TOO_GENERIC[1]["tags"], ones), 6) == 1.0


def test_point_de_rupture_chaque_article_porte_une_etiquette_que_lui_seul_porte():
    """
    breaking_point : « chaque article porte une étiquette que lui seul porte ».
    Témoin : dès que deux articles partagent une étiquette, la paire apparaît.
    """
    assert all(weight > 0 for weight in tag_weights(TOO_SPECIFIC).values())
    assert build_neighbour_table(TOO_SPECIFIC) == {"first": [], "second": [], "third": []}
    shared = [dict(a, tags=a["tags"] + (["release"] if a["id"] != "third" else [])) for a in TOO_SPECIFIC]
    assert build_neighbour_table(shared) == {"first": [("second", 0.12)], "second": [("first", 0.12)], "third": []}


def test_point_de_rupture_l_echec_est_total_le_bloc_n_apparait_sur_aucune_page():
    """
    breaking_point : « l'échec est total plutôt que dégradé […] le bloc
    n'apparaît sur aucune page ». Témoin : sur le blog bien étiqueté, cinq pages
    sur six ont un bloc.
    """
    for corpus in (TOO_GENERIC, TOO_SPECIFIC):
        assert not any(build_neighbour_table(corpus).values())
    assert sum(1 for row in build_neighbour_table(ARTICLES).values() if row) == 5


# ---------------------------------------------------------------------------
# Autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_la_table_entiere_est_construite_d_un_coup():
    """docstring : « computed once for the whole corpus » ; forme `{id: [(voisin, score)]}`, meilleur en tête."""
    assert build_neighbour_table(ARTICLES) == EXPECTED


def test_une_etiquette_que_tous_portent_ne_pese_rien():
    """docstring de tag_weights : « log(corpus size / tag count) is exactly zero for a tag carried by every article »."""
    weights = tag_weights(ARTICLES)
    assert weights["blog"] == 0.0
    assert weights["rye"] > weights["sourdough"] > 0.0


def test_la_rarete_bat_le_compte_des_etiquettes_partagees():
    """
    docstring : « Counting shared tags is the obvious version, and it is the
    wrong one ». Le test d'origine comparait deux nombres écrits à la main
    ({seo-checklist: 2, sourdough-troubles: 1}, donc 2 > 1), qui ne démontrait
    rien et était faux : les deux articles partagent chacun deux étiquettes, comme
    les deux autres. Un simple compte met les quatre à égalité, l'identifiant
    donne la tête à css-grid ; la rareté met sourdough-troubles en tête.
    """
    corpus = [
        {"id": "sourdough-hydration", "tags": ["news", "guide", "sourdough"]},
        {"id": "seo-checklist", "tags": ["news", "guide", "seo"]},
        {"id": "sourdough-troubles", "tags": ["news", "sourdough"]},
        {"id": "css-grid", "tags": ["news", "guide", "css"]},
        {"id": "hiring-process", "tags": ["news", "guide", "hiring"]},
    ]
    neighbours = build_neighbour_table(corpus)["sourdough-hydration"]
    assert neighbours[0][0] == "sourdough-troubles"
    mine = set(corpus[0]["tags"])
    by_count = sorted(corpus[1:], key=lambda a: (-len(mine & set(a["tags"])), a["id"]))
    assert [len(mine & set(a["tags"])) for a in by_count] == [2, 2, 2, 2]
    assert by_count[0]["id"] == "css-grid"


def test_sans_la_rarete_l_annonce_du_site_se_range_a_cote_de_chaque_article():
    """
    docstring : « Weighting each tag by its rarity is the whole difference
    between a useful block and one that files the site announcement next to
    every article on the site ».
    """
    ones = {tag: 1.0 for article in ARTICLES for tag in article["tags"]}
    news = ARTICLES[4]["tags"]
    assert all(similarity(news, other["tags"], ones) > 0 for other in ARTICLES)
    table = build_neighbour_table(ARTICLES)
    assert table["site-news"] == []
    assert all("site-news" not in dict(row) for row in table.values())


def test_un_article_qui_ne_porte_que_des_etiquettes_universelles_n_a_aucun_voisin():
    """Commentaire : « An article carrying only universal tags has a null vector, and no neighbours »."""
    assert similarity(["blog"], ["blog", "rye"], tag_weights(ARTICLES)) == 0.0
    assert build_neighbour_table(ARTICLES)["site-news"] == []


def test_un_article_sans_etiquette_n_a_aucun_voisin_et_n_est_le_voisin_de_personne():
    corpus = ARTICLES + [{"id": "untagged-draft", "tags": []}]
    table = build_neighbour_table(corpus)
    assert table["untagged-draft"] == []
    assert all("untagged-draft" not in dict(row) for row in table.values())


def test_la_similarite_d_un_article_avec_lui_meme_vaut_un():
    """docstring de similarity : « Cosine between two tag sets »."""
    weights = tag_weights(ARTICLES)
    assert round(similarity(ARTICLES[0]["tags"], ARTICLES[0]["tags"], weights), 6) == 1.0


def test_les_egalites_sont_departagees_par_l_identifiant_quel_que_soit_l_ordre():
    """Commentaire : « Ties broken by identifier, so that two builds give the same page »."""
    tie = [
        {"id": "z", "tags": ["x", "q"]},
        {"id": "b", "tags": ["x", "r"]},
        {"id": "a", "tags": ["x", "s"]},
        {"id": "c", "tags": ["w"]},
    ]
    table = build_neighbour_table(tie)
    assert table["z"] == [("a", 0.041), ("b", 0.041)]
    assert build_neighbour_table(list(reversed(tie))) == table


def test_k_borne_la_longueur_de_chaque_ligne():
    assert build_neighbour_table(ARTICLES, k=1)["sourdough-starter"] == [("rye-bread", 0.535)]


def test_la_table_ne_depend_d_aucun_lecteur():
    """regulatory : « Aucun profilage du lecteur : la table de voisins est la même pour tout le monde »."""
    assert list(inspect.signature(build_neighbour_table).parameters) == ["articles", "k", "minimum"]


def test_l_extrait_n_importe_que_la_bibliotheque_standard():
    """docstring : « Standard library » ; risks.data_egress : none."""
    source = ast.parse(Path(__file__).with_name("n0.py").read_text(encoding="utf-8"))
    imported = {a.name for n in ast.walk(source) if isinstance(n, ast.Import) for a in n.names}
    imported |= {n.module for n in ast.walk(source) if isinstance(n, ast.ImportFrom)}
    assert imported == {"math", "collections"}


def test_deux_constructions_rendent_la_meme_table():
    """docstring : « deterministic »."""
    assert build_neighbour_table(ARTICLES) == build_neighbour_table(list(reversed(ARTICLES)))


def test_point_de_rupture_un_seul_article_de_plus_et_l_etiquette_generique_redevient_un_signal():
    """
    Précision sur « l'échec est total plutôt que dégradé » : il faut que
    l'étiquette soit sur tous les articles, exactement. Qu'un seul article ne
    porte pas « article », et les trois articles génériques deviennent voisins
    parfaits (1,0) les uns des autres : la table n'est plus vide, elle est pleine
    de fausses correspondances.
    """
    mixed = TOO_GENERIC + [{"id": "fourth", "tags": ["blog", "unique"]}]
    assert build_neighbour_table(TOO_GENERIC) == {"first": [], "second": [], "third": []}
    assert build_neighbour_table(mixed) == {
        "first": [("second", 1.0), ("third", 1.0)],
        "second": [("first", 1.0), ("third", 1.0)],
        "third": [("first", 1.0), ("second", 1.0)],
        "fourth": [],
    }


@pytest.mark.xfail(
    strict=True,
    reason=(
        "INFIRMÉ : escalate_when dit que la table « contient des lignes vides, parce "
        "que vos étiquettes sont soit sur tous les articles, soit sur un seul ». Une "
        "étiquette sur tous les articles sauf un ne vide aucune ligne : elle remplit "
        "celles des articles génériques de voisins à 1,0. Le signal ne se déclenche pas"
    ),
)
def test_infirme_une_etiquette_presque_universelle_laisse_des_lignes_vides():
    mixed = TOO_GENERIC + [{"id": "fourth", "tags": ["blog", "unique"]}]
    table = build_neighbour_table(mixed)
    assert table["first"] == [] and table["second"] == [] and table["third"] == []


def test_scenario_les_niveaux_rendent_la_meme_forme_de_table():
    """
    scenario : « Les trois niveaux de cette fiche rendent la même table, un
    article vers ses voisins et leurs scores ». Même forme ici pour N0 et N1 ;
    N2 est vérifié dans n2.test.py.
    """
    texts = [dict(a, title=" ".join(a["tags"]), body="") for a in ARTICLES]
    for table in (build_neighbour_table(ARTICLES), build_n1(texts)):
        assert set(table) == {a["id"] for a in ARTICLES}
        for row in table.values():
            assert all(isinstance(n, tuple) and isinstance(n[0], str) and isinstance(n[1], float) for n in row)


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_fonds_vide_et_fonds_d_un_article():
    assert build_neighbour_table([]) == {}
    assert tag_weights([]) == {}
    assert build_neighbour_table([ARTICLES[0]]) == {"kimchi-at-home": []}


def test_production_mille_articles():
    rng = random.Random(1)
    tags = [f"t{j}" for j in range(200)]
    corpus = [{"id": f"a{i:04}", "tags": rng.sample(tags, 5)} for i in range(1000)]
    started = time.monotonic()
    table = build_neighbour_table(corpus)
    assert len(table) == 1000
    assert time.monotonic() - started < 60


def test_production_etiquette_repetee_et_casse_differente():
    """Constat : une étiquette répétée compte une fois ; « Sourdough » et « sourdough » sont deux étiquettes."""
    weights = tag_weights(ARTICLES)
    assert similarity(["rye", "rye", "baking"], ["rye", "baking"], weights) == pytest.approx(1.0)
    cased = [{"id": "a", "tags": ["Sourdough", "x"]}, {"id": "b", "tags": ["sourdough", "y"]}, {"id": "c", "tags": ["z"]}]
    assert build_neighbour_table(cased) == {"a": [], "b": [], "c": []}


@pytest.mark.xfail(
    strict=True,
    reason=(
        "DÉFAUT : deux étiquettes identiques à l'œil, l'une en NFC et l'autre en NFD "
        "(« fermentação » saisi sur deux systèmes), ne se rencontrent pas"
    ),
)
def test_defaut_une_etiquette_nfd_ne_rencontre_pas_la_meme_en_nfc():
    corpus = [
        {"id": "a", "tags": ["fermentação", "x"]},
        {"id": "b", "tags": [unicodedata.normalize("NFD", "fermentação"), "y"]},
        {"id": "c", "tags": ["z"]},
    ]
    assert build_neighbour_table(corpus)["a"] != []


@pytest.mark.xfail(
    strict=True,
    reason=(
        "DÉFAUT : des étiquettes passées en chaîne au lieu d'une liste (« blog » lu "
        "d'une colonne CSV) sont découpées lettre à lettre : « blog » et « gloss » "
        "deviennent voisins à 0,29 par leurs lettres communes"
    ),
)
def test_defaut_des_etiquettes_en_chaine_sont_lues_lettre_a_lettre():
    corpus = [{"id": "a", "tags": "blog"}, {"id": "b", "tags": "gloss"}, {"id": "c", "tags": "x"}]
    try:
        assert build_neighbour_table(corpus)["a"] == []
    except (TypeError, ValueError):
        pass


def test_production_limites_k_nul_et_score_egal_au_minimum():
    assert build_neighbour_table(ARTICLES, k=0) == {a["id"]: [] for a in ARTICLES}
    # Strictement au-dessus du minimum : un score égal est écarté.
    assert build_neighbour_table(ARTICLES, minimum=0.535)["rye-bread"] == []
    assert build_neighbour_table(ARTICLES, minimum=0.534)["rye-bread"] == [("sourdough-starter", 0.535)]


def test_production_etiquettes_emoji_espace_insecable_et_bom():
    corpus = [
        {"id": "a", "tags": ["🍞", "pain levain", "﻿x"]},
        {"id": "b", "tags": ["🍞", "pain levain"]},
        {"id": "c", "tags": ["autre"]},
    ]
    assert build_neighbour_table(corpus)["a"] == [("b", 0.463)]
