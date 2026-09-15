"""
Ces tests injectent un double local au lieu de charger un vrai encodeur.

Ce qu'ils prouvent : le registre est encodé une fois et non à chaque requête,
les vecteurs sont ramenés à la longueur un, le cosinus est calculé et trié comme
l'extrait le dit, les égalités sont stables, top_k plafonne la réponse.

Ce qu'ils ne prouvent pas : que le modèle comprend quoi que ce soit. Le double
est un sac de mots ; sur la paire pour laquelle ce niveau existe, un sigle contre
sa raison sociale, il rend exactement zéro.
"""

import time

import numpy as np
import pytest

from _harness.fake_model import FakeEncoder
from n0 import similarity
from n1 import build_index as build_index_n1, match as match_n1
from n2 import MODEL_NAME, build_index, match

REGISTER = [
    "Boulangerie du Vieux Moulin",
    "Boulangerie du Vieux Port",
    "Le Vieux Moulin",
    "SNCF",
    "Société Nationale des Chemins de fer Français",
]
SNCF_DEVELOPPEE = REGISTER[-1]

# Le vrai encodeur de l'extrait rend 384 nombres par nom ; le double aussi.
DIMENSIONS = 384


def make_index():
    return build_index(REGISTER, encoder=FakeEncoder(DIMENSIONS))


def ranked(query):
    return dict(match(make_index(), query, top_k=len(REGISTER)))


class RealShapedEncoder:
    """Imite `SentenceTransformer.encode` : une liste de textes, un tableau numpy 2D de float32."""

    def __init__(self):
        self.inner = FakeEncoder(DIMENSIONS)

    def encode(self, texts):
        return np.asarray(self.inner.encode(texts), dtype=np.float32)


# ---------------------------------------------------------------------------
# Point de rupture (contre le double)
# ---------------------------------------------------------------------------


def test_point_de_rupture_avec_le_double_des_mots_ordinaires_partages_l_emportent_sur_l_identite():
    """
    « Dans le test, « Boulangerie du Vieux Port », qui est une autre société, passe
    devant « Le Vieux Moulin », qui est la même société sous son nom court, et
    aucun seuil ne démêle les deux. » Démontré pour le double seulement.
    """
    scores = ranked("Boulangerie du Vieux Moulin")
    assert scores["Boulangerie du Vieux Port"] == pytest.approx(0.75, abs=1e-12)
    assert scores["Le Vieux Moulin"] == pytest.approx(1 / 3**0.5, abs=1e-12)
    # Tout seuil qui retient le nom court retient aussi l'autre boulangerie.
    assert scores["Boulangerie du Vieux Port"] > scores["Le Vieux Moulin"]
    # Témoin : le nom lui-même arrive premier, à 1.
    assert match(make_index(), "Boulangerie du Vieux Moulin")[0] == ("Boulangerie du Vieux Moulin", pytest.approx(1.0))


def test_point_de_rupture_le_double_score_a_zero_la_paire_de_sigles():
    """« un double local, qui score à zéro la paire de sigles pour laquelle ce niveau existe »."""
    assert ranked("SNCF")[SNCF_DEVELOPPEE] == 0.0


# ---------------------------------------------------------------------------
# Autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_n0_et_n1_manquent_tous_deux_la_paire_de_sigles():
    """Docstring : « N0 et N1 comparent tous deux des caractères, et tous deux manquent donc la paire »."""
    assert similarity("SNCF", SNCF_DEVELOPPEE) < 0.85
    index = build_index_n1(["Boulangerie Martin SARL", "Menuiserie Dubois SA", "SNCF", SNCF_DEVELOPPEE])
    assert match_n1(index, "SNCF", top_k=4)[-1][0] == SNCF_DEVELOPPEE


def test_aucune_forme_juridique_n_est_retiree_et_rien_n_est_mis_en_minuscules():
    """« Voyez ce qui n'est pas là […] L'encodeur est censé s'en charger lui-même. » Le code transmet les noms tels quels."""
    encoder = FakeEncoder(DIMENSIONS)
    index = build_index(["Boulangerie Martin SARL", "CAFÉ DE LA GARE"], encoder=encoder)
    match(index, "BOULANGERIE martin sas")
    assert encoder.calls == [["Boulangerie Martin SARL", "CAFÉ DE LA GARE"], ["BOULANGERIE martin sas"]]


def test_la_casse_est_repliee_par_le_double_pas_par_l_extrait():
    """Le double replie la casse ; ce que fera le vrai encodeur n'est pas démontré ici."""
    assert match(make_index(), "BOULANGERIE DU VIEUX MOULIN") == match(make_index(), "Boulangerie du Vieux Moulin")


def test_le_registre_est_encode_une_fois_pas_a_chaque_requete():
    encoder = FakeEncoder(DIMENSIONS)
    index = build_index(REGISTER, encoder=encoder)
    assert encoder.calls == [REGISTER]
    match(index, "Le Vieux Moulin")
    match(index, "SNCF")
    assert encoder.calls[1:] == [["Le Vieux Moulin"], ["SNCF"]]


def test_top_k_plafonne_la_reponse():
    assert len(match(make_index(), "Le Vieux Moulin", top_k=2)) == 2


def test_le_cosinus_est_un_produit_scalaire_de_vecteurs_unitaires():
    """« Cosine similarity is a dot product once both sides have length one. »"""
    index = make_index()
    assert all(sum(v * v for v in vector) == pytest.approx(1.0) for vector in index["vectors"])
    assert ranked("SNCF")["SNCF"] == pytest.approx(1.0, abs=1e-12)


def test_un_nom_qui_ne_partage_rien_marque_zero():
    assert ranked("Boulangerie du Vieux Moulin")["SNCF"] == 0.0


def test_les_egalites_reviennent_dans_l_ordre_du_registre():
    """« A stable sort, so two names with the same score always come back in register order. »"""
    assert [name for name, _ in match(make_index(), "", top_k=len(REGISTER))] == REGISTER
    register = ["Dupont", "Martin", "Dupont", "Garage", "Dupont"]
    index = build_index(register, encoder=FakeEncoder(DIMENSIONS))
    assert [n for n, _ in match(index, "Dupont", top_k=5)] == register[0::2] + ["Martin", "Garage"]


def test_l_encodeur_est_injecte_et_par_defaut_c_est_le_vrai():
    """« `encoder` is injected so this can be tested without loading a model. Left alone, it is the real one above. »"""
    with pytest.raises(ModuleNotFoundError, match="sentence_transformers"):
        build_index(["Boulangerie Martin"])
    assert MODEL_NAME == "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"


def test_un_encodeur_a_la_forme_de_sentence_transformers_est_accepte():
    """`SentenceTransformer.encode` rend un tableau numpy 2D ; l'extrait le lit sans conversion préalable."""
    index = build_index(REGISTER, encoder=RealShapedEncoder())
    name, score = match(index, "Le Vieux Moulin")[0]
    assert name == "Le Vieux Moulin" and isinstance(score, float)
    assert score == pytest.approx(1.0, abs=1e-6)


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_un_registre_vide_et_une_requete_vide():
    assert match(build_index([], encoder=FakeEncoder(DIMENSIONS)), "Martin") == []
    assert all(score == 0.0 for _, score in match(make_index(), "", top_k=5))


def test_production_dix_mille_noms_de_384_dimensions_terminent():
    names = [f"Entreprise {k} numero {k % 97}" for k in range(10_000)]
    index = build_index(names, encoder=FakeEncoder(DIMENSIONS))
    start = time.perf_counter()
    top = match(index, names[4242])
    assert time.perf_counter() - start < 2
    assert top[0][0] == names[4242]


def test_production_accents_nfd_emoji_passent_a_l_encodeur_sans_erreur():
    index = make_index()
    for query in ("Société Nationale", "🍞 Boulangerie", "﻿SNCF", "a" * 100_000):
        assert len(match(index, query)) == 3
