import ast
import random
import time
from pathlib import Path

import pytest

from n0 import END, RANKED, build, normalise, suggest

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


def test_un_caractere_nul_dans_un_terme_ne_se_confond_pas_avec_la_marque_de_fin():
    """commentaire de END : « It is not a string, so no character can collide with it. »"""
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


def test_production_un_terme_de_100000_caracteres_dans_le_journal_ne_fait_pas_planter_la_barre_vide():
    """docstring de _collect : « A stack rather than recursion: one term of a hundred
    thousand characters in the search log would otherwise overflow the call stack »."""
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


def test_production_espace_insecable_largeur_nulle_et_bom_dans_la_saisie_retrouvent_le_terme():
    """docstring de normalise : « Invisible characters (zero-width space, byte order mark) are dropped »."""
    tree = make_tree()
    assert suggest(tree, "écharpe\u00a0en") == ["écharpe en laine"]
    assert suggest(tree, "\u200bech") == ["écharpe en laine", "échelle télescopique"]
    assert suggest(tree, "\ufeffech") == ["écharpe en laine", "échelle télescopique"]


def test_production_une_espace_en_tete_de_saisie_retrouve_le_terme():
    """docstring de normalise : « one space with none at either end »."""
    assert suggest(make_tree(), " cha") == [
        "chaussures de running",
        "chaussettes de sport",
    ]


def test_production_a_compte_egal_l_orthographe_normalisee_departage_echarpe_avant_zebre():
    """commentaire de suggest : « Equal counts fall back to the normalised spelling, so "écharpe" comes before "zèbre" »."""
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


# ---------------------------------------------------------------------------
# Contre-épreuve, tour 2 : ce que la correction affirme désormais
# ---------------------------------------------------------------------------


def _feuille(tree, term):
    node = tree
    for char in normalise(term):
        node = node[char]
    return node


def test_le_classement_est_calcule_une_fois_par_noeud_puis_relu():
    """
    docstring : « the ordering is a plain sort on the usage count, done once per
    node and kept there ». Un terme glissé dans l'arbre après le premier appel
    n'est pas vu du nœud déjà classé ; le témoin : un nœud jamais demandé le voit.
    """
    tree = make_tree()
    assert suggest(tree, "ch", limit=1) == ["chaussures de running"]
    _feuille(tree, "chemise en lin")[END].append((10_000, "chemise en lin", "chemise en lin bis"))
    assert suggest(tree, "ch", limit=1) == ["chaussures de running"]
    assert suggest(tree, "che", limit=1) == ["chemise en lin bis"]


def test_le_second_appel_ne_reparcourt_pas_le_sous_arbre(monkeypatch):
    """« done once per node » : _collect n'est appelé qu'au premier appel sur un nœud."""
    import n0

    appels = []
    original = n0._collect
    monkeypatch.setattr(n0, "_collect", lambda node: appels.append(1) or original(node))
    tree = make_tree()
    suggest(tree, "ch")
    suggest(tree, "ch", limit=1)
    suggest(tree, "CH")
    assert len(appels) == 1
    suggest(tree, "cha")
    assert len(appels) == 2


def test_le_classement_garde_reste_juste_pour_des_limites_differentes_et_des_noeuds_emboites():
    """Le nœud classé sert toutes les limites ; un parent classé après son enfant ne compte pas deux fois."""
    tree = make_tree()
    assert suggest(tree, "ch", limit=1) == ["chaussures de running"]
    assert suggest(tree, "ch", limit=3) == [
        "chaussures de running",
        "chaussettes de sport",
        "chemise en lin",
    ]
    suggest(tree, "cha")
    assert suggest(tree, "", limit=10) == [term for term, _ in CATALOGUE]


def test_le_prix_en_memoire_est_au_plus_une_reference_par_terme_pour_chaque_noeud_atteint():
    """docstring : « The price is memory, at most one reference per term for each node a keystroke has reached »."""
    tree = make_tree()
    suggest(tree, "")
    suggest(tree, "ech")
    assert len(tree[RANKED]) == len(CATALOGUE)
    assert len(tree["e"]["c"]["h"][RANKED]) == 2
    assert RANKED not in tree["e"]
    assert RANKED not in tree["c"]


def test_production_un_prefixe_inconnu_ne_greffe_rien_dans_l_arbre():
    """docstring de _descend : « empty if none does » ; le nœud vide n'est pas rattaché à l'arbre."""
    tree = make_tree()
    assert suggest(tree, "zzz") == []
    assert "z" not in tree


def test_production_la_barre_vide_d_un_index_de_cent_mille_termes_se_relit_vite_une_fois_classee():
    """
    Borne large, pas un chiffre publié : le premier appel trie l'index entier
    (observé : 0,4 s), mille appels suivants tiennent dans une seconde
    (observé : quelques millisecondes).
    """
    alea = random.Random(2)
    lettres = "abcdefghijklmnopqrstuvwxyz "
    tree = build(
        ("".join(alea.choice(lettres) for _ in range(20)), alea.randint(1, 1000))
        for _ in range(100_000)
    )
    debut = time.perf_counter()
    premier = suggest(tree, "", limit=10)
    assert time.perf_counter() - debut < 20
    debut = time.perf_counter()
    for _ in range(1000):
        assert suggest(tree, "", limit=10) == premier
    assert time.perf_counter() - debut < 1


def test_production_une_espace_en_queue_et_des_espaces_repetees_sont_ignorees():
    """docstring de normalise : « runs of spaces [...] become one space with none at either end »."""
    tree = make_tree()
    assert suggest(tree, "cha ") == ["chaussures de running", "chaussettes de sport"]
    assert suggest(tree, "chemise   en" + chr(0x3000) + "lin") == ["chemise en lin"]
    assert normalise("  cha" + chr(0x2003) + "\t\nssures ") == "cha ssures"


def test_production_la_normalisation_est_la_meme_dans_les_deux_langages():
    """
    commentaires de normalise : « Upper then lower case folds "ß" into "ss", the
    same way in both languages » ; « The final sigma is folded by hand ». Le
    jumeau JavaScript attend les mêmes sorties.
    """
    attendus = {
        "Straße": "strasse",
        "\u039f\u0394\u039f\u03a3": "\u03bf\u03b4\u03bf\u03c3",
        "\u03bf\u03b4\u03bf\u03c2": "\u03bf\u03b4\u03bf\u03c3",
        "\ufb01let": "filet",
        "\u0130stanbul": "istanbul",
        "\u216b": "xii",
        "\u00adcha": "cha",
        "a\u200db": "ab",
        "\ufeff\u00e9charpe\u00a0": "echarpe",
    }
    for texte, attendu in attendus.items():
        assert normalise(texte) == attendu, texte


def test_production_un_sigma_final_frappe_atteint_le_sigma_du_milieu_de_mot():
    """commentaire : « The final sigma is folded by hand » ; « οδος » en cours de frappe atteint « οδοστρωτήρας »."""
    assert suggest(build([("οδοστρωτήρας", 1)]), "οδος") == ["οδοστρωτήρας"]


def test_production_une_ligature_fi_est_retrouvee_par_f_i():
    assert suggest(build([("\ufb01let de bœuf", 1)]), "filet") == ["\ufb01let de bœuf"]


def test_production_a_compte_egal_et_meme_orthographe_normalisee_le_terme_d_origine_departage():
    """clé de tri (−compte, orthographe normalisée, terme) : l'ordre ne dépend pas de l'insertion."""
    attendu = ["echarpe", "ÉCHARPE", "Écharpe"]
    assert suggest(build([("Écharpe", 1), ("echarpe", 1), ("ÉCHARPE", 1)]), "") == attendu
    assert suggest(build([("ÉCHARPE", 1), ("Écharpe", 1), ("echarpe", 1)]), "") == attendu


@pytest.mark.xfail(
    strict=True,
    reason=(
        "INFIRMÉ : la docstring dit « Fold case » (« casse abandonnée »), or majuscule "
        "puis minuscule laisse « ẞ » (U+1E9E) en « ß » quand « ß » devient « ss » : "
        "« strasse » ne trouve pas « STRAẞE », et « STRAẞE » ne trouve pas « Straße »"
    ),
)
def test_infirme_le_eszett_majuscule_se_replie_comme_le_eszett_minuscule():
    """Témoin hors marquage : test_production_strasse_retrouve_strasse_avec_eszett_dans_les_deux_langages."""
    assert normalise("STRA\u1e9eE") == normalise("Straße")
    assert suggest(build([("STRA\u1e9eE", 1)]), "strasse") == ["STRA\u1e9eE"]
