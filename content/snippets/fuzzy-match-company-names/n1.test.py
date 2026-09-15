import ast
import time
from pathlib import Path

import numpy as np
import pytest

from n0 import similarity
from n1 import build_index, match

# Un registre de la taille d'un petit annuaire professionnel.
REGISTER = [
    "Boulangerie Martin SARL",
    "Boulangerie Dupont",
    "Menuiserie Dubois SA",
    "Dubois Menuiserie",
    "Café de la Gare",
    "SNCF",
    "Société Nationale des Chemins de fer Français",
]
SNCF_DEVELOPPEE = REGISTER[-1]

INDEX = build_index(REGISTER)


def ranked(query):
    return dict(match(INDEX, query, top_k=len(REGISTER)))


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_le_sigle_n_atteint_pas_les_trois_premiers_double_par_deux_societes_sans_rapport():
    """
    « la raison sociale développée de la SNCF n'atteint même pas les trois
    premiers résultats de sa propre abréviation, doublée par deux entreprises sans rapport ».
    """
    top = match(INDEX, "SNCF", top_k=4)
    assert [name for name, _ in top] == ["SNCF", "Menuiserie Dubois SA", "Boulangerie Martin SARL", SNCF_DEVELOPPEE]
    # Doublée par un score, pas par l'ordre du registre : les deux scores sont strictement plus hauts.
    assert top[1][1] > top[3][1] and top[2][1] > top[3][1] > 0.0
    assert round(top[3][1], 12) == 0.010394932704


def test_point_de_rupture_ponderer_repare_l_ordre_des_mots_et_classe_la_bonne_boulangerie():
    """Témoin du point de rupture : « Pondérer les fragments rares répare l'ordre des mots et classe la bonne boulangerie devant l'autre »."""
    assert match(INDEX, "MARTIN BOULANGERIE") == match(INDEX, "Boulangerie Martin")
    scores = ranked("Boulangerie Martin")
    assert scores["Boulangerie Martin SARL"] > scores["Boulangerie Dupont"]


# ---------------------------------------------------------------------------
# Autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_trouve_la_bonne_societe_en_premier():
    name, score = match(INDEX, "Boulangerie Martin")[0]
    assert name == "Boulangerie Martin SARL"
    assert round(score, 12) == 0.883177974427  # le même nombre en JavaScript


def test_un_fragment_rare_pese_plus_qu_un_fragment_courant():
    """
    « « boulangerie » figure dans la moitié du registre et n'apprend presque rien ;
    « quiquengrogne » y figure une fois et tranche la question. »
    """
    register = ["Boulangerie Martin", "Boulangerie Dupont", "Boulangerie de la Quiquengrogne",
                "Boulangerie Petit", "Garage Lemoine", "Fleurs Roux"]
    index = build_index(register)
    vocabulary, idf = index["vectoriser"].vocabulary_, index["vectoriser"].idf_
    assert idf[vocabulary["quiq"]] > idf[vocabulary["boul"]]
    assert match(index, "Quiquengrogne", top_k=1)[0] == pytest.approx(("Boulangerie de la Quiquengrogne", 0.8013573), abs=1e-6)
    # « boulangerie » seul ne tranche rien : quatre boulangeries entre 0,47 et 0,67.
    assert [n for n, _ in match(index, "Boulangerie", top_k=4)] == [
        "Boulangerie Petit", "Boulangerie Martin", "Boulangerie Dupont", "Boulangerie de la Quiquengrogne"]


def test_jaro_winkler_traite_tous_les_caracteres_de_la_meme_facon():
    """« N0 n'en a pas d'équivalent » : pour N0, la boulangerie voisine passe au-dessus du seuil de 0,85."""
    assert similarity("Boulangerie Martin", "Boulangerie Dupont") > 0.85
    assert ranked("Boulangerie Martin")["Boulangerie Dupont"] < 0.6


def test_les_fragments_ne_chevauchent_jamais_deux_mots():
    """« `char_wb` keeps n-grams inside word boundaries, so a fragment never straddles two words. »"""
    assert not [g for g in INDEX["vectoriser"].vocabulary_ if " " in g.strip()]


def test_l_ordre_des_mots_ne_coute_rien_ici_au_contraire_de_n0():
    """« « Martin Dubois » et « Dubois Martin » se rencontrent donc […] au contraire de N0, où il coûte presque tout. »"""
    assert match(INDEX, "Martin Dubois", top_k=len(REGISTER)) == match(INDEX, "Dubois Martin", top_k=len(REGISTER))
    assert similarity("Martin Dubois", "Dubois Martin") < 0.5


def test_un_pluriel_et_une_inversion_a_la_fois():
    assert match(INDEX, "Menuiseries Dubois")[0][0] == "Dubois Menuiserie"


def test_des_fragments_de_deux_a_quatre_caracteres_survivent_a_une_faute_de_frappe():
    """Commentaire : « short enough to survive a typo somewhere else in the word »."""
    name, score = match(INDEX, "Boulangrie Martin")[0]
    assert name == "Boulangerie Martin SARL" and round(score, 12) == 0.818982690918


def test_les_lignes_sont_de_longueur_un_donc_le_cosinus_est_un_produit_scalaire():
    """« TfidfVectorizer returns rows of length one, so the cosine similarity is just the dot product. »"""
    norms = np.sqrt(np.asarray(INDEX["matrix"].multiply(INDEX["matrix"]).sum(axis=1)).ravel())
    assert norms == pytest.approx(np.ones(len(REGISTER)), abs=1e-12)
    assert all(ranked(name)[name] == pytest.approx(1.0, abs=1e-12) for name in REGISTER)


def test_une_recherche_dans_dix_mille_noms_est_un_produit_de_matrices():
    """« la recherche est un produit de matrices plutôt qu'une boucle sur toutes les paires : c'est ce qui rend un registre entier consultable »."""
    names = [f"Entreprise {i} {chr(97 + i % 26)}{chr(97 + (i // 26) % 26)}" for i in range(10_000)]
    index = build_index(names)
    start = time.perf_counter()
    top = match(index, names[4242])
    assert time.perf_counter() - start < 0.5
    assert top[0][0] == names[4242]


def test_les_egalites_reviennent_dans_l_ordre_du_registre():
    """« A stable sort, so two names with the same score always come back in register order. »"""
    register = ["Dupont SA", "Martin", "Dupont SA", "Garage", "Dupont SA"]
    index = build_index(register)
    assert [n for n, _ in match(index, "", top_k=5)] == register
    duplicates = match(index, "Dupont", top_k=3)
    assert [n for n, _ in duplicates] == ["Dupont SA"] * 3
    assert len({s for _, s in duplicates}) == 1


def test_un_nom_que_personne_n_a_ecrit_obtient_quand_meme_un_classement():
    name, score = match(INDEX, "Kwyjibo")[0]
    assert name in REGISTER and score > 0.0


def test_n1_est_deterministe():
    first = match(build_index(REGISTER), "Boulangerie Martin", top_k=7)
    assert all(match(build_index(REGISTER), "Boulangerie Martin", top_k=7) == first for _ in range(10))


def test_n1_s_appuie_sur_scikit_learn_et_numpy():
    """risks : vendor_lock library."""
    source = (Path(__file__).parent / "n1.py").read_text(encoding="utf-8")
    modules = set()
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, ast.Import):
            modules |= {alias.name.split(".")[0] for alias in node.names}
        elif isinstance(node, ast.ImportFrom):
            modules.add(node.module.split(".")[0])
    assert modules == {"numpy", "sklearn"}


def test_valeurs_epinglees_pour_le_jumeau_javascript():
    """Le JavaScript dit faire « la même arithmétique que scikit-learn » : ces nombres sont affirmés des deux côtés."""
    assert round(ranked("Société Générale")[SNCF_DEVELOPPEE], 12) == 0.469061234241
    assert round(ranked("A B")["Café de la Gare"], 12) == 0.105066545124
    assert round(ranked("İstanbul Ltd")["Boulangerie Martin SARL"], 12) == 0.178184011082
    emoji = build_index(["🍞🥐 Boulangerie Martin", "Boulangerie Dupont", "𝔄𝔅 Conseil"])
    assert round(match(emoji, "𝔄𝔅", top_k=1)[0][1], 12) == 0.475128643566


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_une_requete_vide_ne_marque_rien():
    assert all(score == 0.0 for _, score in match(INDEX, "", top_k=len(REGISTER)))


def test_production_un_registre_vide_est_refuse_par_une_erreur():
    with pytest.raises(ValueError):
        build_index([])


def test_production_top_k_nul_ou_plus_grand_que_le_registre():
    assert match(INDEX, "Martin", top_k=0) == []
    assert len(match(INDEX, "Martin", top_k=100)) == len(REGISTER)


def test_production_accent_decompose_ou_absent_garde_la_bonne_reponse_en_tete():
    """N1 ne normalise pas les accents : le score baisse, le classement tient."""
    for query, expected in (("Café de la Gare", 0.887063254874), ("CAFE DE LA GARE", 0.884139130742)):
        name, score = match(INDEX, query)[0]
        assert name == "Café de la Gare" and round(score, 12) == expected


def test_production_une_requete_de_cent_ko_termine():
    start = time.perf_counter()
    match(INDEX, "boulangerie martin " * 5000)
    assert time.perf_counter() - start < 2
