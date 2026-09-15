import ast
import random
import time
from pathlib import Path

import pytest

from n0 import build, normalise, suggest

# What a fortnight of search logs looks like once grouped: the term as it is
# spelled in the catalogue, and how often it was searched.
CATALOGUE = [
    ("chaussures de running", 900),
    ("chaussettes de sport", 400),
    ("étagère murale", 300),
    ("chemise en lin", 250),
    ("écharpe en laine", 120),
    ("échelle télescopique", 60),
]


def make_tree():
    return build(CATALOGUE)


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_rcharpe_ne_remonte_rien_quand_echarpe_remonte_echarpe_en_laine():
    """
    breaking_point : « le préfixe « echarpe » remonte « écharpe en laine », le
    préfixe « rcharpe » ne remonte rien, et la bonne orthographe est pourtant
    dans l'index ». Le témoin est la première assertion.
    """
    tree = make_tree()
    assert suggest(tree, "echarpe") == ["écharpe en laine"]
    assert suggest(tree, "rcharpe") == []
    assert "écharpe en laine" in suggest(tree, "", limit=len(CATALOGUE))


def test_point_de_rupture_une_faute_sur_le_premier_caractere_quitte_l_arbre_des_la_premiere_touche():
    """Même mécanique sur un second terme : « chauss » remonte, « vhauss » non."""
    tree = make_tree()
    assert suggest(tree, "chauss") == [
        "chaussures de running",
        "chaussettes de sport",
    ]
    assert suggest(tree, "vhauss") == []


# ---------------------------------------------------------------------------
# Autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_les_termes_les_plus_cherches_sous_un_prefixe_sont_proposes():
    """name : « Arbre de préfixes, trié par fréquence de recherche »."""
    assert suggest(make_tree(), "cha") == [
        "chaussures de running",
        "chaussettes de sport",
    ]


def test_l_ordre_suit_le_compte_d_usage_et_la_limite_est_respectee():
    """docstring : « l'ordre est un tri ordinaire sur le compte d'usage »."""
    assert suggest(make_tree(), "ch", limit=2) == [
        "chaussures de running",
        "chaussettes de sport",
    ]


def test_l_ordre_ne_depend_que_du_compte_pas_de_l_ordre_d_insertion():
    """docstring et essai : le compte décide de l'ordre, et rien d'autre."""
    melange = list(CATALOGUE)
    random.Random(7).shuffle(melange)
    assert suggest(build(melange), "", limit=6) == suggest(make_tree(), "", limit=6)
    assert suggest(build([("b", 1), ("a", 9)]), "") == ["a", "b"]


def test_un_prefixe_vide_propose_les_termes_les_plus_cherches_de_tout_l_index():
    """docstring de suggest : « An empty prefix returns the most searched terms overall »."""
    assert suggest(make_tree(), "", limit=3) == [
        "chaussures de running",
        "chaussettes de sport",
        "étagère murale",
    ]


def test_accents_et_casse_sont_ignores():
    """docstring : « Qui tape « ec » trouve « écharpe », et le lit correctement écrit »."""
    tree = make_tree()
    assert suggest(tree, "ec") == ["écharpe en laine", "échelle télescopique"]
    assert suggest(tree, "ech") == ["écharpe en laine", "échelle télescopique"]
    assert suggest(tree, "ÉCH") == suggest(tree, "ech")


def test_un_prefixe_inconnu_ne_rend_rien():
    """docstring de suggest : « An unknown prefix returns nothing »."""
    assert suggest(make_tree(), "zzz") == []


def test_deux_orthographes_du_meme_terme_survivent_toutes_les_deux():
    """docstring de build : « kept side by side at the same leaf, rather than one silently replacing the other »."""
    tree = build([("Chaussures", 5), ("chaussures", 3)])
    assert suggest(tree, "chau") == ["Chaussures", "chaussures"]


def test_la_normalisation_replie_les_accents_sans_toucher_aux_lettres():
    """commentaire de normalise : « Fold case and strip accents »."""
    assert normalise("Écharpe") == "echarpe"
    assert normalise("Étagère Murale") == "etagere murale"


@pytest.mark.xfail(
    strict=True,
    reason=(
        "INFIRMÉ : le commentaire dit « A character can never collide with it », "
        'or END vaut "\\0", un caractère : un terme qui contient NUL fait lever '
        "build (AttributeError) ou suggest (TypeError)"
    ),
)
def test_infirme_un_caractere_nul_dans_un_terme_ne_se_confond_pas_avec_la_marque_de_fin():
    """commentaire : « Marks the terms that end at a node. A character can never collide with it. »"""
    tree = build([("a\0b", 1)])
    assert suggest(tree, "a") == ["a\0b"]
    tree = build([("a\0b", 1), ("a", 2)])
    assert suggest(tree, "a") == ["a", "a\0b"]


def test_l_extrait_n_importe_que_la_bibliotheque_standard():
    """docstring : « Standard library only » ; risks.data_egress: none, rien ne sort du processus."""
    source = ast.parse(Path(__file__).with_name("n0.py").read_text(encoding="utf-8"))
    modules = {
        alias.name.split(".")[0]
        for node in ast.walk(source)
        if isinstance(node, ast.Import)
        for alias in node.names
    } | {
        node.module.split(".")[0]
        for node in ast.walk(source)
        if isinstance(node, ast.ImportFrom)
    }
    assert modules == {"unicodedata"}


def test_deux_executions_sur_la_meme_entree_rendent_la_meme_liste():
    """risks.deterministic: true."""
    assert suggest(make_tree(), "ch") == suggest(make_tree(), "ch")


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_un_index_vide_ne_propose_rien():
    tree = build([])
    assert suggest(tree, "") == []
    assert suggest(tree, "cha") == []


def test_production_cent_mille_termes_se_construisent_et_se_parcourent_dans_une_borne_large():
    """Borne volontairement large : elle attrape un effondrement, elle ne mesure rien."""
    alea = random.Random(1)
    lettres = "abcdefghijklmnopqrstuvwxyz "
    termes = [
        ("".join(alea.choice(lettres) for _ in range(20)), alea.randint(1, 1000))
        for _ in range(100_000)
    ]
    debut = time.perf_counter()
    tree = build(termes)
    assert len(suggest(tree, "", limit=10)) == 10
    assert len(suggest(tree, "a", limit=10)) == 10
    assert time.perf_counter() - debut < 20


@pytest.mark.xfail(
    strict=True,
    reason=(
        "DÉFAUT : _collect est récursif, un terme de 100 000 caractères dans le "
        "journal fait lever RecursionError sur le préfixe vide, pour tout le monde (en Python dès 1 000 caractères)"
    ),
)
def test_defaut_un_terme_de_100000_caracteres_dans_le_journal_fait_planter_la_barre_vide():
    tree = build([("x" * 100_000, 1), ("chemise en lin", 2)])
    assert suggest(tree, "") == ["chemise en lin", "x" * 100_000]


def test_production_une_saisie_en_accents_decomposes_retrouve_le_terme_compose():
    """NFD dans la saisie, NFC dans l'index, et l'inverse."""
    tree = make_tree()
    assert suggest(tree, "e\u0301charpe") == ["écharpe en laine"]
    assert suggest(build([("e\u0301charpe", 1)]), "écha") == ["e\u0301charpe"]


def test_production_casse_mixte_et_emoji_sont_retrouves():
    assert suggest(make_tree(), "cHeMiSe") == ["chemise en lin"]
    assert suggest(build([("🎁 coffret cadeau", 3)]), "🎁") == ["🎁 coffret cadeau"]


def test_production_strasse_retrouve_strasse_avec_eszett_dans_les_deux_langages():
    """Le repli de casse est le même dans les deux extraits : « strasse » atteint « Straße »."""
    assert suggest(build([("Straße", 1)]), "strasse") == ["Straße"]


@pytest.mark.xfail(
    strict=True,
    reason=(
        "DÉFAUT : un caractère invisible collé dans la saisie (espace insécable, "
        "espace de largeur nulle, marque d'ordre des octets) rend la bonne "
        "orthographe inatteignable, une rupture que la fiche n'annonce pas"
    ),
)
def test_defaut_un_caractere_invisible_dans_la_saisie_vide_la_liste():
    tree = make_tree()
    assert suggest(tree, "écharpe\u00a0en") == ["écharpe en laine"]
    assert suggest(tree, "\u200bech") == ["écharpe en laine", "échelle télescopique"]
    assert suggest(tree, "\ufeffech") == ["écharpe en laine", "échelle télescopique"]


@pytest.mark.xfail(
    strict=True,
    reason="DÉFAUT : une espace en tête de saisie, fréquente après un collage, vide la liste",
)
def test_defaut_une_espace_en_tete_de_saisie_vide_la_liste():
    assert suggest(make_tree(), " cha") == [
        "chaussures de running",
        "chaussettes de sport",
    ]


@pytest.mark.xfail(
    strict=True,
    reason=(
        "DÉFAUT : à compte égal, Python départage par point de code, donc « zèbre » "
        "passe avant « écharpe » ; l'extrait JavaScript, lui, rend l'ordre alphabétique"
    ),
)
def test_defaut_a_compte_egal_l_ordre_est_alphabetique():
    assert suggest(build([("zèbre", 1), ("écharpe", 1)]), "") == ["écharpe", "zèbre"]


def test_production_limite_a_zero_a_un_et_au_nombre_exact_de_candidats():
    tree = make_tree()
    assert suggest(tree, "ch", limit=0) == []
    assert suggest(tree, "ch", limit=1) == ["chaussures de running"]
    assert len(suggest(tree, "ch", limit=3)) == 3
    assert len(suggest(tree, "ch", limit=4)) == 3


def test_production_un_prefixe_plus_long_que_tout_terme_ne_rend_rien():
    assert suggest(make_tree(), "chemise en lin bleue") == []
    assert suggest(make_tree(), "chemise en lin") == ["chemise en lin"]
