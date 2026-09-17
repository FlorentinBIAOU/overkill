"""
Tests du niveau N0 : mémoire de traduction, correspondance exacte puis approchée.

La mémoire ci-dessous est ce qu'un projet possède après une première vague de
traduction. Elle vit ici et non dans l'extrait : l'extrait est une fonction.
"""

import ast
import time
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path

import pytest

from n0 import lookup, normalise, placeholders

MEMORY = {
    "Save": "Enregistrer",
    "Save changes": "Enregistrer les modifications",
    "Delete this item?": "Supprimer cet élément ?",
    "{count} items selected": "{count} éléments sélectionnés",
    "Your session has expired": "Votre session a expiré",
}

WARNING = "interpolation variables differ from the source string"


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_une_chaine_nouvelle_n_a_aucune_correspondance():
    """
    « Le test lui soumet « Two-factor authentication is required for
    administrators » : rien dans la mémoire ne s'en approche, et la fonction
    renvoie une absence de correspondance au lieu de la phrase française
    qu'elle a sous la main » (existant, complété).
    """
    result = lookup("Two-factor authentication is required for administrators", MEMORY)
    assert result == {"status": "none", "target": None, "score": 0.375, "matched": None, "review": False, "warnings": []}
    # Témoin : une chaîne proche de la mémoire, elle, remonte sa traduction.
    assert lookup("Your session has expired.", MEMORY)["target"] == "Votre session a expiré"


# ---------------------------------------------------------------------------
# Nom et docstring
# ---------------------------------------------------------------------------


def test_une_correspondance_exacte_part_telle_quelle():
    """« An exact match ships » (existant)."""
    result = lookup("Save changes", MEMORY)
    assert result == {
        "status": "exact", "target": "Enregistrer les modifications", "score": 1.0,
        "matched": "Save changes", "review": False, "warnings": [],
    }


def test_une_majuscule_corrigee_ou_une_double_espace_donnent_une_approchee_a_relire():
    """docstring : « an approximate match — a word added, a capital or an accent changed — […] because "Polish" and "polish" are not the same word »."""
    # Le repli du rapprochement ignore casse, accents et espaces multiples : la
    # chaîne est retrouvée, à 1,0. Mais elle n'est pas la même que celle du
    # souvenir, donc c'est une approchée, renvoyée en relecture, pas une exacte.
    for source in ("save   changes", "SAVE CHANGES"):
        result = lookup(source, MEMORY)
        assert result["status"] == "fuzzy", source
        assert result["score"] == 1.0 and result["review"] is True
        assert result["matched"] == "Save changes"
    assert normalise("Élément  SUPPRIMÉ") == "element supprime"


def test_un_mot_ajoute_donne_une_correspondance_approchee_a_relire():
    """« a word is added » ; « An approximate match is a draft: it comes back with its score and a review flag » (existant)."""
    result = lookup("Save all changes", MEMORY)
    assert result["status"] == "fuzzy"
    assert result["matched"] == "Save changes"
    assert result["target"] == "Enregistrer les modifications"
    assert round(result["score"], 3) == 0.857
    assert result["review"] is True


@pytest.mark.xfail(
    strict=True,
    reason="INFIRMÉ : « a variable moves. When that happens, last year's translation is still nearly right » ; au "
    "seuil par défaut, « {count} selected items » (0,727) et « Selected: {count} items » (0,6) ne remontent rien",
)
def test_une_variable_deplacee_remonte_la_traduction_de_l_an_dernier():
    for moved in ("{count} selected items", "Selected: {count} items"):
        assert lookup(moved, MEMORY)["target"] == "{count} éléments sélectionnés", moved


def test_le_seuil_decide_de_ce_qui_merite_d_etre_montre():
    """`threshold` (existant, complété) : inclusif."""
    assert lookup("Save all changes", MEMORY, threshold=0.9)["status"] == "none"
    exactly = lookup("abce", {"abcd": "x"})
    assert exactly["score"] == 0.75 and exactly["status"] == "fuzzy"
    assert lookup("abce", {"abcd": "x"}, threshold=0.7500001)["status"] == "none"


def test_n0_n_emploie_aucun_modele_ni_service():
    """« No model, no service, no key » ; risks `vendor_lock: none`, `data_egress: none`."""
    source = ast.parse(Path(__file__).with_name("n0.py").read_text(encoding="utf-8"))
    modules = {a.name for n in ast.walk(source) if isinstance(n, ast.Import) for a in n.names}
    modules |= {n.module for n in ast.walk(source) if isinstance(n, ast.ImportFrom)}
    assert modules == {"__future__", "re", "unicodedata", "difflib"}


def test_n0_est_deterministe():
    """risks `deterministic: true`."""
    first = lookup("Save all changes", MEMORY)
    assert all(lookup("Save all changes", MEMORY) == first for _ in range(10))


def test_la_casse_et_les_accents_ne_font_pas_une_chaine_nouvelle():
    assert lookup("polish", {"Polish": "Polonais"})["review"] is True
    assert lookup("Resume", {"Résumé": "CV"})["review"] is True


def test_une_correspondance_approchee_n_est_jamais_rendue_comme_finie():
    """« Handing back an approximation as a certainty is the one behaviour that would make this whole approach dishonest »."""
    for source in ("Save all changes", "Delete this items?", "Your session expired"):
        result = lookup(source, MEMORY)
        assert result["status"] == "fuzzy", source
        assert result["review"] is True
        assert result["score"] < 1.0


def test_une_variable_deplacee_n_est_pas_un_probleme_une_variable_perdue_si():
    """« Interpolation variables are checked apart from the score […] flagged even on an exact hit » (existant)."""
    assert placeholders("Delete {count} of {total}") == placeholders("{total}: {count}")
    result = lookup("{count} items selected", {"{count} items selected": "Éléments sélectionnés"})
    assert result["status"] == "exact"
    assert result["review"] is True
    assert result["warnings"] == [WARNING]


def test_une_variable_ajoutee_depuis_l_an_dernier_est_signalee_sur_l_approchee():
    """Existant."""
    result = lookup("{count} items selected", {"Items selected": "Éléments sélectionnés"})
    assert result["status"] == "fuzzy"
    assert round(result["score"], 3) == 0.778
    assert result["warnings"] == [WARNING]


def test_les_formes_de_variables_annoncees_sont_reconnues():
    """Commentaire : « {count}, {}, %s, %d, %(count)s, and the numbered variant of %s that Android […] carry »."""
    assert placeholders("{count} {} %s %d %(count)s %1$s %2$d") == sorted(
        ["{count}", "{}", "%s", "%d", "%(count)s", "%1$s", "%2$d"]
    )


def test_les_variables_des_fichiers_ios_sont_reconnues():
    assert placeholders("%@ items, %1$@ of %2$@, %ld left") == sorted(["%@", "%1$@", "%2$@", "%ld"])


def test_le_score_est_celui_de_difflib_sans_heuristique_de_rebut():
    """
    Commentaire : « autojunk=False so a long string scores exactly like the
    JavaScript version » : sur 282 et 238 caractères, l'heuristique change le
    score ; le même couple vaut 0,49615384615384617 dans n0.test.js.
    """
    a = "x" * 150 + "The quick brown fox jumps over the lazy dog " * 3
    b = "y" * 100 + "The quick brown fox jumped over the lazy dogs " * 3
    result = lookup(a, {b: "cible"}, threshold=0.0)
    assert result["score"] == SequenceMatcher(None, normalise(a), normalise(b), autojunk=False).ratio()
    assert SequenceMatcher(None, a, b, autojunk=False).ratio() == 0.49615384615384617
    assert SequenceMatcher(None, a, b).ratio() != 0.49615384615384617


def test_une_chaine_vide_et_une_memoire_vide_ne_rendent_rien():
    """Existant."""
    assert lookup("", MEMORY)["status"] == "none"
    assert lookup("Save", {})["status"] == "none"
    assert lookup("Save", {})["target"] is None


@pytest.mark.xfail(
    strict=True,
    reason="INFIRMÉ : latency « ~10 ms » ; le temps croît avec la mémoire : 11 ms pour 100 chaînes, 77 ms pour "
    "1 000 (66 ms mesurés en Python), plus près de « ~100 ms » ; JavaScript reste à ~21 ms",
)
def test_une_recherche_prend_de_l_ordre_de_dix_millisecondes_dans_une_memoire_reelle():
    words = (
        "the a your to of settings account save delete item items selected changes password email is has been "
        "was not could be error try again later update profile notification"
    ).split()
    memory = {_label(words, i): "fr" for i in range(1000)}
    assert len(memory) == 1000
    lookup("warm up", memory)
    best = float("inf")
    for _ in range(3):
        start = time.perf_counter()
        lookup("Your password could not be updated, try again later", memory)
        best = min(best, time.perf_counter() - start)
    # 32 ms : le milieu, sur une échelle logarithmique, entre « ~10 ms » et « ~100 ms ».
    assert best < 0.032


def _label(words, i):
    """Un libellé d'interface de trois à dix mots, distinct pour chaque i (même construction en JavaScript)."""
    n = len(words)
    head = [words[i % n], words[(i // n) % n], words[(i // (n * n)) % n]]
    return " ".join(head + [words[(i * 7 + j) % n] for j in range(i % 8)])


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_encodage_nfd_insecable_emoji_casse():
    # `exact_key` compose la chaîne et retire les caractères de format : une
    # chaîne en NFD est la même chaîne. La casse, elle, en fait une autre.
    nfd = unicodedata.normalize("NFD", "Delete this item?")
    assert lookup(nfd, MEMORY)["status"] == "exact"
    assert lookup("Save changes", MEMORY)["status"] == "exact"
    assert lookup("SAVE CHANGES", MEMORY)["status"] == "fuzzy"
    assert round(lookup("Save 🙂 changes", {"Save changes 🙂": "x"})["score"], 3) == 0.857


def test_production_une_marque_d_ordre_des_octets_ne_fait_pas_une_autre_chaine():
    """`exact_key` : « Fold only what cannot change the words: composition, format characters, spacing »."""
    # U+FEFF est un caractère de format : il est retiré avant la comparaison,
    # ici comme en JavaScript.
    result = lookup("﻿Save changes", MEMORY)
    assert result["status"] == "exact" and result["review"] is False


def test_production_un_caractere_de_largeur_nulle_envoie_en_relecture():
    assert lookup("Save​changes", MEMORY)["review"] is True


def test_production_une_memoire_de_mille_chaines_termine():
    memory = {f"Label number {i} for the settings page": f"Libellé {i}" for i in range(1000)}
    start = time.perf_counter()
    assert lookup("Label number 517 for the settings page", memory)["target"] == "Libellé 517"
    assert time.perf_counter() - start < 5


def test_defaut_une_memoire_de_textes_longs_reste_rapide():
    words = (
        "the a your to of settings account save delete item items selected changes password email is has been "
        "was not could be error try again later update profile notification"
    ).split()
    paragraph = lambda k: " ".join(words[(i * k + 3) % len(words)] for i in range(250))
    memory = {paragraph(k + 1): "aide" for k in range(20)}
    start = time.perf_counter()
    lookup(paragraph(7) + " now", memory)
    assert time.perf_counter() - start < 0.5


def test_defaut_les_variables_icu_et_i18next_sont_verifiees():
    icu = "{count, plural, one {# item} other {# items}}"
    assert lookup(icu, {icu: "éléments"})["review"] is True
    assert lookup("{{count}} items", {"{{count}} items": "{count} éléments"})["review"] is True
