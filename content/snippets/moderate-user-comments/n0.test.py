import ast
import sys
import time
from pathlib import Path

import unicodedata

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


def test_point_de_rupture_seule_la_fenetre_de_contexte_distingue_le_signalement_de_l_insulte():
    """« même drapeau, même terme, et seule la fenêtre de contexte, qu'un humain doit lire, les distingue »."""
    # Une insulte dont le terme tombe à la même position que dans le signalement.
    attack = "just get lost you blorptard"
    report, insult = review(REPORT, TERMS), review(attack, TERMS)
    assert report["flagged"] == insult["flagged"] is True
    differ = {key for key in report["matches"][0] if report["matches"][0][key] != insult["matches"][0][key]}
    assert differ == {"context"}
    assert report["matches"][0]["context"] == "called me a blorptard please remove his"
    assert insult["matches"][0]["context"] == "get lost you blorptard"


# ---------------------------------------------------------------------------
# Autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_signale_un_terme_liste_et_montre_son_contexte():
    result = review("honestly this whole update is the work of a blorptard", TERMS)
    assert result == {"flagged": True, "matches": [
        {"term": "blorptard", "position": 9, "context": "work of a blorptard"}]}


def test_chaque_decision_se_ramene_a_une_entree_de_la_liste():
    """« auditable: every decision can be traced back to one entry in a list you control »."""
    terms = TERMS + ["Sale Type"]
    result = review("ZIBBERNAUT and flarnwît, quel sale type", terms)
    assert [m["term"] for m in result["matches"]] == ["zibbernaut", "flarnwit", "sale type"]
    assert {m["term"] for m in result["matches"]} <= {normalise(t) for t in terms}


def test_la_normalisation_replie_la_casse_et_les_accents():
    assert normalise("BLÔRPTARD") == "blorptard"
    assert review("what a ZIBBERNAUT", TERMS)["flagged"]
    assert review("quel flarnwît celui-là", TERMS)["flagged"]
    assert review("what a blorptard", ["BLÖRPTARD"])["flagged"]  # la liste est normalisée aussi


def test_les_formes_de_compatibilite_sont_repliees_pas_les_sosies():
    """
    « Case, accents and compatibility forms (full-width letters, ligatures, superscripts) are
    spellings of the same word […] Look-alikes are not: a 0 stays a 0, which is why bl0rptard walks past. »
    """
    assert normalise("ｂｌｏｒｐｔａｒｄ") == "blorptard"
    assert normalise("ﬁn²") == "fin2"
    assert review("you ᵇˡᵒʳᵖᵗᵃʳᵈ", TERMS)["flagged"]
    assert review("you are a ﬂarnwit", TERMS)["flagged"]
    # Les sosies : un zéro, un « о » cyrillique.
    assert normalise("bl0rptard") == "bl0rptard"
    assert not review("you bl0rptard", TERMS)["flagged"]
    assert not review("you bl\u043erptard", TERMS)["flagged"]


def test_les_formes_de_compatibilite_en_capitales_sont_repliees_comme_les_autres():
    """
    Commentaire de `normalise` : « Decomposed before folding, and again after:
    𝐁𝐋𝐎𝐑𝐏𝐓𝐀𝐑𝐃 has to become BLORPTARD before the case fold can see it. » Replier
    avant de décomposer laissait passer les capitales de compatibilité.
    """
    assert review("you 𝐁𝐋𝐎𝐑𝐏𝐓𝐀𝐑𝐃", TERMS)["flagged"]
    assert review("you ᴮᴸᴼᴿᴾᵀᴬᴿᴰ", TERMS)["flagged"]
    # Et la parité avec JavaScript, qui les signalait déjà.
    assert normalise("𝐁𝐋𝐎𝐑𝐏𝐓𝐀𝐑𝐃") == "blorptard"


def test_le_repli_a_la_main_de_javascript_ne_couvre_que_deux_lettres_sur_deux_cent_cinquante_quatre():
    """
    Commentaire de `normalise` en JavaScript : « the two letters a Latin term
    list meets, ß and the final ς, are done by hand; there are two hundred and
    fifty-two others, in Cherokee, Greek and Cyrillic, that this line does not
    cover ». Compté ici, sur la table Unicode elle-même.
    """
    differ = set()
    for code in range(0x110000):
        char = chr(code)
        if unicodedata.category(char).startswith("L"):
            folded = unicodedata.normalize("NFKD", char)
            if folded.casefold() != folded.lower():
                differ.add(char)
    assert len(differ) == 254
    assert {"ß", "ς"} <= differ
    assert {"\u037a", "\u13a0", "\u1c80"} <= differ  # ypogegrammeni, cherokee, cyrillique


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


def test_un_terme_de_plusieurs_mots_est_trouve_quelle_que_soit_la_ponctuation_qui_les_separe():
    """« A term of several words matches those words in a row, whatever punctuation separates them in the comment. »"""
    result = review("quel sale, type celui-là", ["sale type"], window=1)
    assert result["matches"] == [{"term": "sale type", "position": 1, "context": "quel sale type celui"}]
    assert review("quel SALE — type", ["sale type"])["flagged"]
    # Témoin : les mots doivent se suivre.
    assert not review("quel sale gros type", ["sale type"])["flagged"]
    # Un terme et un terme plus long qui le contient sont rendus tous les deux.
    assert [m["term"] for m in review("sale type", ["sale", "sale type"])["matches"]] == ["sale", "sale type"]


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


def test_production_un_accent_tape_en_nfd_reste_dans_son_mot():
    """« Composed first, so an accent typed as a separate mark stays in its word. »"""
    assert review("quel flarnwi\u0302t", TERMS)["matches"] == [
        {"term": "flarnwit", "position": 1, "context": "quel flarnwît"}]
    assert review("quel flarnwît", ["flarnwi\u0302t"])["flagged"]


def test_production_ss_majuscule_et_sigma_final_sont_replies_comme_en_javascript():
    assert review("STRAẞE", ["strasse"])["flagged"]
    assert review("SCHEISSE", ["scheiße"])["flagged"]
    assert normalise("ΚΑΚΟΣ") == normalise("κακος") == "κακοσ"
    assert review("κακος", ["ΚΑΚΟΣ"])["flagged"]


def test_production_un_terme_vide_ou_de_ponctuation_dans_la_liste_est_sans_effet():
    assert review(ATTACK, ["", "!!!"]) == {"flagged": False, "matches": []}
    assert review(ATTACK, ["", "blorptard"])["matches"] == [
        {"term": "blorptard", "position": 5, "context": "this forum you blorptard"}]


def test_production_un_mot_devanagari_n_est_pas_coupe_a_ses_voyelles():
    """
    docstring de `_words` : « a Devanagari vowel sign would cut a word in two ».
    Découpé aux lettres seules, « मल » se trouvait dans « कोमल ».
    """
    assert not review("यह कोमल है", ["मल"])["flagged"]
    assert review("तुम कमीने हो", ["कमीने"])["matches"][0]["context"] == "तुम कमीने हो"
