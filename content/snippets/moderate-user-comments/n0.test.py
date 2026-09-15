import ast
import sys
import time
from pathlib import Path

import pytest

from n0 import normalise, review

# La liste est une politique : elle vit avec le test, pas avec le code. Les
# termes sont inventés, ce qui suffit à exercer un filtre de termes.
TERMS = ["blorptard", "zibbernaut", "flarnwit"]
REPORT = "he called me a blorptard, please remove his comment"
ATTACK = "get off this forum you blorptard"


def without_location(result):
    """Ce qu'un programme lit du résultat : le drapeau et les termes, sans la fenêtre."""
    return {"flagged": result["flagged"], "terms": [m["term"] for m in result["matches"]]}


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_une_graphie_absente_de_la_liste_passe_intacte():
    """« « bl0rptard », « blorp-tard », les lettres espacées une à une » passent."""
    for evasion in ("bl0rptard", "blorp-tard", "b l o r p t a r d", "blorptardd"):
        assert review(f"you are a {evasion}", TERMS) == {"flagged": False, "matches": []}, evasion
    # Témoin : la graphie listée est signalée.
    assert review("you are a blorptard", TERMS)["flagged"]


def test_point_de_rupture_le_signalement_est_signale_exactement_comme_l_insulte():
    """
    « le message « he called me a blorptard, please remove his comment » est signalé
    exactement comme l'insulte qu'il rapporte ».
    """
    report, attack = review(REPORT, TERMS), review(ATTACK, TERMS)
    banter = review("congratulations you absolute blorptard, well played", TERMS)
    assert without_location(report) == without_location(attack) == without_location(banter) == {
        "flagged": True, "terms": ["blorptard"]}
    # Témoin : un commentaire ordinaire n'est pas signalé.
    assert not review("great write-up, the third section helped a lot", TERMS)["flagged"]


@pytest.mark.xfail(
    strict=True,
    reason="INFIRMÉ : la fiche dit que rien dans le résultat ne distingue le signalement de l'insulte ; "
    "la fenêtre de contexte les distingue (« called me a blorptard please remove his » contre « this forum you blorptard »)",
)
def test_rien_dans_le_resultat_ne_distingue_le_signalement_de_l_insulte():
    assert review(REPORT, TERMS)["matches"] == review(ATTACK, TERMS)["matches"]


# ---------------------------------------------------------------------------
# Autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_signale_un_terme_liste_et_montre_son_contexte():
    result = review("honestly this whole update is the work of a blorptard", TERMS)
    assert result == {"flagged": True, "matches": [
        {"term": "blorptard", "position": 9, "context": "work of a blorptard"}]}


def test_chaque_decision_se_ramene_a_un_mot_de_la_liste():
    """« auditable: every decision can be traced back to one word in a list you control »."""
    result = review("ZIBBERNAUT and flarnwît", TERMS)
    assert {m["term"] for m in result["matches"]} <= {normalise(t) for t in TERMS}


def test_la_normalisation_replie_la_casse_et_les_accents():
    assert normalise("BLÔRPTARD") == "blorptard"
    assert review("what a ZIBBERNAUT", TERMS)["flagged"]
    assert review("quel flarnwît celui-là", TERMS)["flagged"]
    assert review("what a blorptard", ["BLÖRPTARD"])["flagged"]  # la liste est normalisée aussi


@pytest.mark.xfail(
    strict=True,
    reason="INFIRMÉ : la docstring dit que rien d'autre que la casse et les accents n'est touché ; NFKD replie "
    "aussi les formes de compatibilité (pleine largeur, ligatures, exposants)",
)
def test_rien_d_autre_que_la_casse_et_les_accents_n_est_touche():
    assert normalise("ｂｌｏｒｐｔａｒｄ") == "ｂｌｏｒｐｔａｒｄ"
    assert normalise("ﬁn²") == "ﬁn²"


def test_les_lettres_et_chiffres_de_toute_ecriture_la_ponctuation_et_le_souligne_separent():
    """Commentaire : « Letters and digits, in any script. Punctuation and underscores separate. »"""
    result = review("блорп_blorptard, 42blorptard", TERMS)
    assert [m["position"] for m in result["matches"]] == [1]
    assert result["matches"][0]["context"] == "блорп blorptard 42blorptard"


def test_la_fenetre_compte_des_mots_de_chaque_cote():
    """« `window` is a number of words on each side. »"""
    text = "one two three four blorptard five six seven eight"
    assert review(text, TERMS)["matches"][0]["context"] == "two three four blorptard five six seven"
    assert review(text, TERMS, window=1)["matches"][0]["context"] == "four blorptard five"
    assert review(text, TERMS, window=0)["matches"][0]["context"] == "blorptard"


def test_rend_chaque_occurrence_pas_seulement_la_premiere():
    result = review("one blorptard, then another blorptard", TERMS)
    assert [m["position"] for m in result["matches"]] == [1, 4]


def test_la_fenetre_est_coupee_aux_bords_du_commentaire():
    assert review("blorptard", TERMS, window=5)["matches"][0]["context"] == "blorptard"


def test_un_terme_de_deux_mots_est_trouve():
    assert review("quel sale type celui-là", ["sale type"])["flagged"]


def test_n0_est_deterministe_et_n_emploie_que_la_bibliotheque_standard():
    assert all(review(REPORT, TERMS) == review(REPORT, TERMS) for _ in range(20))
    source = (Path(__file__).parent / "n0.py").read_text(encoding="utf-8")
    modules = set()
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, ast.Import):
            modules |= {alias.name.split(".")[0] for alias in node.names}
        elif isinstance(node, ast.ImportFrom):
            modules.add(node.module.split(".")[0])
    assert modules and modules <= set(sys.stdlib_module_names)


def test_un_commentaire_se_verifie_en_moins_d_une_milliseconde():
    runs = []
    for _ in range(5):
        start = time.perf_counter()
        for _ in range(100):
            review("honestly this whole update is the work of a blorptard", TERMS)
        runs.append((time.perf_counter() - start) / 100)
    assert min(runs) < 0.001


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_un_commentaire_vide_et_une_liste_vide():
    assert review("", TERMS) == {"flagged": False, "matches": []}
    assert review(ATTACK, []) == {"flagged": False, "matches": []}


def test_production_un_commentaire_de_cent_ko_termine_vite():
    start = time.perf_counter()
    result = review("you blorptard " * 7000, TERMS)
    assert time.perf_counter() - start < 2
    assert len(result["matches"]) == 7000


def test_production_pleine_largeur_marque_d_ordre_et_casefold():
    assert review("ｂｌｏｒｐｔａｒｄ", TERMS)["flagged"]
    assert review("﻿blorptard", TERMS)["flagged"]
    assert review("SCHEISSE", ["scheiße"])["flagged"]  # casefold : ß devient ss


def test_defaut_un_terme_avec_accent_decompose_est_signale():
    assert review("quel flarnwît", TERMS)["flagged"]
