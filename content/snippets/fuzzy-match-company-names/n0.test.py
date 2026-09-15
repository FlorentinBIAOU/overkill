import ast
import re
import sys
import time
from pathlib import Path

import pytest

from n0 import LEGAL_FORMS, PREFIX_SCALING, _jaro, jaro_winkler, normalise, similarity

THRESHOLD = 0.85  # le seuil qu'une vraie campagne de déduplication emploierait
ESSAI = Path(__file__).parents[2] / "tryouts" / "live" / "fuzzy-match-company-names.js"
SNCF_DEVELOPPEE = "Société Nationale des Chemins de fer Français"


def essai_inputs() -> list[list[str]]:
    """Les saisies des cas de l'essai, lues dans le fichier de l'essai lui-même."""
    source = ESSAI.read_text(encoding="utf-8")
    return [text.split("\\n") for text in re.findall(r"input: '([^']*)'", source)]


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_un_sigle_passe_sous_le_seuil_et_sous_une_societe_sans_rapport():
    """
    « Le test compare « SNCF » à « Société Nationale des Chemins de fer Français » :
    la vraie paire passe sous le seuil, et — plus embarrassant — sous le score de
    « SNCF » contre « Sanofi ». Aucun seuil ne retient la première en écartant la seconde. »
    """
    vraie = similarity("SNCF", SNCF_DEVELOPPEE)
    sans_rapport = similarity("SNCF", "Sanofi")
    assert vraie == pytest.approx(0.545, abs=1e-9)
    assert sans_rapport == pytest.approx(0.775, abs=1e-9)
    assert vraie < THRESHOLD
    # Aucun seuil : tout seuil qui retient la vraie paire retient aussi Sanofi.
    assert sans_rapport > vraie

    # Témoin : deux graphies d'un même nom passent le seuil.
    assert similarity("Boulangerie Martin SARL", "BOULANGERIE MARTIN") >= THRESHOLD


def test_point_de_rupture_sanofi_partage_trois_lettres_sur_quatre_avec_le_sigle():
    """« société sans rapport dont la graphie ne partage avec le sigle que trois lettres sur quatre »."""
    assert set("sncf") & set(normalise("Sanofi")) == {"s", "n", "f"}
    # Et Jaro les trouve toutes les trois dans sa fenêtre : m = 3.
    m = 3
    assert _jaro("sncf", "sanofi") == pytest.approx((m / 4 + m / 6 + (m - 0) / m) / 3)


@pytest.mark.xfail(
    strict=True,
    reason="INFIRMÉ : l'essai dit que Sanofi « ne partage avec SNCF qu'une première lettre » ; "
    "il en partage trois (s, n, f), et Jaro les compte toutes",
)
def test_l_essai_sanofi_ne_partage_avec_sncf_qu_une_premiere_lettre():
    assert set("sncf") & set(normalise("Sanofi")) == {"s"}


# ---------------------------------------------------------------------------
# Autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_la_meme_societe_sous_deux_graphies():
    assert similarity("Boulangerie Martin SARL", "BOULANGERIE MARTIN") == 1.0


def test_la_forme_juridique_est_retiree_plutot_que_comparee():
    """
    « « Boulangerie Martin SARL » et « Boulangerie Martin SAS » sont un seul nom
    commercial sous deux statuts ; laisser SARL et SAS les éloignerait. »
    """
    assert similarity("Boulangerie Martin SARL", "Boulangerie Martin SAS") == 1.0
    assert jaro_winkler("boulangerie martin sarl", "boulangerie martin sas") < 1.0


def test_accents_casse_et_ponctuation_sont_ignores():
    """normalise : « Lowercase, strip accents and punctuation, drop the legal form ». scenario : « un accent »."""
    assert similarity("Café de la Gare SAS", "CAFE DE LA GARE") == 1.0
    assert normalise("Café-de-la-Gare, S.A.S") == "cafe de la gare s a s"
    assert normalise("Boulangerie Martin SARL") == "boulangerie martin"


def test_une_esperluette_et_un_pluriel_restent_au_dessus_du_seuil():
    """scenario : « un pluriel, une esperluette écrite en toutes lettres »."""
    assert similarity("Établissements Léon & Fils SA", "ETABLISSEMENTS LEON ET FILS") > THRESHOLD
    assert similarity("Menuiserie Dubois", "Menuiseries Dubois SA") > THRESHOLD


def test_deux_societes_differentes_d_un_meme_metier_passent_au_dessus_du_seuil():
    """Un score au-dessus du seuil est un candidat à revoir, jamais une décision."""
    assert similarity("Boulangerie Martin SARL", "Boulangerie Dupont SARL") > THRESHOLD


def test_un_nom_fait_seulement_d_une_forme_juridique_la_garde():
    """« Emptying it would make it match every other emptied name perfectly. »"""
    assert normalise("SARL") == "sarl"
    assert similarity("SARL", "SAS") < 1.0


def test_la_liste_des_formes_juridiques_est_francaise_et_etrangere():
    assert {"sarl", "sas", "sasu", "eurl", "sci", "snc"} <= LEGAL_FORMS
    assert {"ltd", "gmbh", "llc", "bv", "spa"} <= LEGAL_FORMS


def test_jaro_winkler_recompense_un_debut_commun():
    """« Il récompense un début commun […] la tête est la marque, la queue est une forme, une ville. »"""
    assert jaro_winkler("martin", "martix") > jaro_winkler("nartin", "xartin")
    assert similarity("Boulangerie Martin Lyon", "Boulangerie Martin") > THRESHOLD


def test_winkler_ne_regarde_que_les_quatre_premiers_caracteres():
    base = _jaro("martinxy", "martinzw")
    # Six caractères communs en tête, mais quatre seulement comptent.
    assert jaro_winkler("martinxy", "martinzw") == pytest.approx(base + 4 * PREFIX_SCALING * (1 - base))


@pytest.mark.xfail(
    strict=True,
    reason="INFIRMÉ : le commentaire dit que Winkler ne rend jamais plus d'un dixième du score retenu par Jaro ; "
    "avec quatre caractères communs il en rend quatre dixièmes",
)
def test_winkler_ne_rend_jamais_plus_d_un_dixieme_du_score_retenu():
    base = _jaro("martinxy", "martinzw")
    assert jaro_winkler("martinxy", "martinzw") - base <= 0.1 * (1 - base) + 1e-12


def test_la_fenetre_separe_jaro_d_un_simple_compte_de_lettres():
    """« That window is what separates Jaro from a plain count of common letters. »"""
    assert _jaro("abcdefgh", "hgfedcba") == 0.5  # huit lettres communes, quatre trouvées


@pytest.mark.xfail(
    strict=True,
    reason="INFIRMÉ : la docstring dit « within half the length of the longer name » ; la fenêtre vaut la moitié "
    "moins un (définition standard), un jumeau à exactement la moitié n'est pas trouvé",
)
def test_un_jumeau_a_la_moitie_de_la_longueur_est_trouve():
    # « abcdef » : six caractères, moitié 3. Le « a » est à distance 3.
    assert _jaro("abcdef", "xxxaxx") > 0.0


def test_un_nom_vide_ne_rapproche_rien():
    assert similarity("", "Martin SARL") == 0.0
    # Deux noms vides sont identiques par définition : l'appelant les filtre.
    assert similarity("", "") == 1.0


def test_n0_n_emploie_que_la_bibliotheque_standard():
    source = (Path(__file__).parent / "n0.py").read_text(encoding="utf-8")
    modules = set()
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, ast.Import):
            modules |= {alias.name.split(".")[0] for alias in node.names}
        elif isinstance(node, ast.ImportFrom):
            modules.add(node.module.split(".")[0])
    assert modules and modules <= set(sys.stdlib_module_names)


def test_n0_est_deterministe_et_rejouable():
    """risks : deterministic ; scenario : « les mêmes fichiers rapprochés le mois prochain devant produire les mêmes paires »."""
    pairs = [("Boulangerie Martin SARL", "Boulangerie Dupont"), ("SNCF", "Sanofi")]
    first = [similarity(a, b) for a, b in pairs]
    assert all([similarity(a, b) for a, b in pairs] == first for _ in range(20))


def test_une_comparaison_prend_moins_d_une_milliseconde():
    runs = []
    for _ in range(5):
        start = time.perf_counter()
        for _ in range(100):
            similarity("Boulangerie Martin SARL", "Boulangerie Dupont SARL")
        runs.append((time.perf_counter() - start) / 100)
    assert min(runs) < 0.001


def test_l_ordre_des_mots_coute_presque_tout_a_n0():
    """escalate_when : « « Menuiserie Dubois » ici, « Dubois Menuiserie » là » ; docstring N1 : « au contraire de N0, où il coûte presque tout »."""
    assert similarity("Menuiserie Dubois", "Dubois Menuiserie") < THRESHOLD
    assert similarity("Martin Dubois", "Dubois Martin") < 0.5


def test_l_essai_trois_premiers_cas():
    """
    « La même maison sous trois statuts » ; « Accents, esperluette, pluriel : rien
    de tout cela ne compte » ; « Deux boulangeries qui n'ont rien à voir, au-dessus du seuil ».
    """
    statuts, accents, boulangeries, sigle = essai_inputs()
    reference, *candidats = statuts
    assert [similarity(reference, c) for c in candidats] == [1.0, 1.0]
    reference, *candidats = accents
    assert all(similarity(reference, c) >= THRESHOLD for c in candidats)
    reference, *candidats = boulangeries
    assert all(similarity(reference, c) >= THRESHOLD for c in candidats)
    reference, vraie, sanofi = sigle
    assert similarity(reference, vraie) < THRESHOLD and similarity(reference, sanofi) > similarity(reference, vraie)


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_des_noms_de_deux_mille_cinq_cents_caracteres_terminent():
    a = "boulangerie martin " * 130
    b = "boulangerie dupont " * 130
    start = time.perf_counter()
    similarity(a, b)
    assert time.perf_counter() - start < 2


def test_production_marque_d_ordre_espace_insecable_nfd_emoji():
    assert similarity("﻿Boulangerie Martin", "Boulangerie Martin") == 1.0
    assert similarity("Boulangérie Martin", "Boulangérie Martin") == 1.0
    assert similarity("🍞 Boulangerie Martin", "BOULANGERIE MARTIN") == 1.0


@pytest.mark.xfail(
    strict=True,
    reason="DÉFAUT : un nom sans lettre latine est vidé par [a-z0-9] ; « Газпром » et « Лукойл », "
    "« 東京電力 » et « 日立製作所 » obtiennent 1,0",
)
def test_defaut_deux_noms_non_latins_differents_ne_sont_pas_identiques():
    assert similarity("Газпром", "Лукойл") < THRESHOLD
    assert similarity("東京電力", "日立製作所") < THRESHOLD


@pytest.mark.xfail(
    strict=True,
    reason="DÉFAUT : « spa », « sa », « ag » sont aussi des mots ordinaires ; « Nordic Spa » et « Nordic SA » obtiennent 1,0",
)
def test_defaut_une_forme_juridique_homographe_d_un_mot_ordinaire_ne_fusionne_pas():
    assert similarity("Nordic Spa", "Nordic SA") < 1.0


def test_production_une_lettre_sans_decomposition_est_perdue():
    """« Ø » et « ß » ne se décomposent pas : ils sont retirés, pas repliés. Le score reste au-dessus du seuil."""
    assert normalise("Ørsted") == "rsted"
    assert normalise("Großmann") == "gro mann"
    assert similarity("Ørsted", "Orsted") > THRESHOLD
