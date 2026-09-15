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


def test_l_essai_sanofi_partage_avec_sncf_trois_lettres_sur_quatre():
    """Essai, cas 4 (why) : « Sanofi, qui partage avec SNCF trois lettres sur quatre »."""
    source = ESSAI.read_text(encoding="utf-8")
    assert "qui partage avec SNCF trois lettres sur quatre" in source
    assert "which shares three of the four letters of SNCF" in source
    partagees = set("sncf") & set(normalise("Sanofi"))
    assert partagees == {"s", "n", "f"} and len(partagees) == 3


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
    """Commentaire : « Legal forms, French and foreign. »"""
    assert {"sarl", "sas", "sasu", "eurl", "sci", "snc"} <= LEGAL_FORMS
    assert {"ltd", "gmbh", "llc", "bv"} <= LEGAL_FORMS


def test_spa_n_est_pas_une_forme_et_nordic_spa_ne_fusionne_pas_avec_nordic_sa():
    """Commentaire : « No "spa": it is also a word of trading names, and dropping it would merge "Nordic Spa" with "Nordic SA". »"""
    assert "spa" not in LEGAL_FORMS
    assert normalise("Nordic Spa") == "nordic spa"
    assert similarity("Nordic Spa", "Nordic SA") == pytest.approx(0.92, abs=1e-9)
    # Témoin : « SA » est bien retiré, « Nordic SA » et « Nordic » sont un seul nom.
    assert similarity("Nordic SA", "Nordic") == 1.0


def test_jaro_winkler_recompense_un_debut_commun():
    """
    « It rewards a shared opening, which suits names that differ at the tail:
    a form, a city, a scrap of punctuation after the same brand. »
    """
    assert jaro_winkler("martin", "martix") > jaro_winkler("nartin", "xartin")
    # Une ville, un reste de ponctuation après la même marque : au-dessus du seuil.
    assert similarity("Boulangerie Martin Lyon", "Boulangerie Martin") == pytest.approx(0.9565, abs=1e-4)
    assert similarity("Boulangerie Martin (ex-Dupuis)", "Boulangerie Martin") == pytest.approx(0.9286, abs=1e-4)
    # Témoin : la même ville en tête coûte bien plus, sous le seuil.
    assert similarity("Lyon Boulangerie Martin", "Boulangerie Martin") == pytest.approx(0.7794, abs=1e-4)


def test_winkler_ne_regarde_que_les_quatre_premiers_caracteres():
    base = _jaro("martinxy", "martinzw")
    # Six caractères communs en tête, mais quatre seulement comptent.
    assert jaro_winkler("martinxy", "martinzw") == pytest.approx(base + 4 * PREFIX_SCALING * (1 - base))


def test_winkler_rend_un_dixieme_du_score_retenu_par_caractere_commun_en_tete():
    """Commentaire : « gives back a tenth of the score Jaro withheld for each of them that both names share »."""
    for commun in range(7):
        a = "abcdefgh"
        b = a[:commun] + "XYZWVUTS"[commun:]
        base = _jaro(a, b)
        rendu = (jaro_winkler(a, b) - base) / (1 - base) if base < 1 else 0.0
        # Un dixième par caractère commun, et quatre au plus.
        assert rendu == pytest.approx(min(commun, 4) / 10, abs=1e-12), commun


def test_la_fenetre_separe_jaro_d_un_simple_compte_de_lettres():
    """« That window is what separates Jaro from a plain count of common letters. »"""
    assert _jaro("abcdefgh", "hgfedcba") == 0.5  # huit lettres communes, quatre trouvées


def test_la_fenetre_vaut_la_moitie_de_la_longueur_moins_un():
    """_jaro : « its twin sits less than half the length of the longer name away: at most that half, minus one »."""
    # « abcdef » : six caractères, moitié 3, fenêtre 2.
    assert _jaro("abcdef", "xxaxxx") == pytest.approx((1 / 6 + 1 / 6 + 1) / 3)  # distance 2 : trouvé
    assert _jaro("abcdef", "xxxaxx") == 0.0  # distance 3, la moitié : pas trouvé


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
    « La même maison sous trois statuts » ; « Accents, esperluette, pluriel : tout
    reste au-dessus du seuil » ; « Deux boulangeries qui n'ont rien à voir, au-dessus du seuil ».
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


def test_production_deux_noms_non_latins_differents_restent_sous_le_seuil():
    """Commentaire : « Letters and digits of every script: a Cyrillic or Japanese name is kept, not emptied ». Valeurs identiques en JavaScript."""
    assert normalise("Газпром") == "газпром"
    assert similarity("Газпром", "Лукойл") == pytest.approx(0.4365, abs=1e-4)
    assert similarity("東京電力", "日立製作所") == 0.0


def test_production_grec_arabe_chinois_identiques_a_un_et_differents_sous_le_seuil():
    """Les mêmes nombres en JavaScript."""
    assert similarity("Αθηναϊκή Ζυθοποιία", "ΑΘΗΝΑΪΚΗ ΖΥΘΟΠΟΙΙΑ") == 1.0
    assert similarity("Αθηναϊκή Ζυθοποιία", "Ελληνικά Πετρέλαια") == pytest.approx(0.5556, abs=1e-4)
    assert similarity("شركة أرامكو", "شركة أرامكو") == 1.0
    assert similarity("أرامكو السعودية", "مصرف الراجحي") == pytest.approx(0.5881, abs=1e-4)
    assert similarity("東京電力", "東京電力") == 1.0
    assert similarity("中国石油", "中国银行") == pytest.approx(0.7333, abs=1e-4)


@pytest.mark.xfail(
    strict=True,
    reason="DÉFAUT : toutes les marques de catégorie M sont retirées, y compris les voyelles du devanagari et du thaï, "
    "qui ne sont pas des accents ; « कमल उद्योग » et « कोमल उद्योग », « กินดี » et « กันดี » obtiennent 1,0",
)
def test_defaut_deux_noms_qui_ne_different_que_par_une_voyelle_devanagari_ou_thai_ne_sont_pas_identiques():
    assert similarity("कमल उद्योग", "कोमल उद्योग") < 1.0
    assert similarity("กินดี", "กันดี") < 1.0


@pytest.mark.xfail(
    strict=True,
    reason="DÉFAUT (#28, non traité hors « spa ») : une forme est retirée où qu'elle soit dans le nom ; "
    "« Sa Nostra » et « Nostra », « NV Energy » et « Energy Ltd » obtiennent 1,0",
)
def test_defaut_une_forme_juridique_en_tete_de_nom_ne_fusionne_pas():
    assert similarity("Sa Nostra", "Nostra") < 1.0
    assert similarity("NV Energy", "Energy Ltd") < 1.0


def test_production_un_nom_fait_seulement_d_emoji_ou_de_ponctuation_est_vide():
    """Non réparé, décision du rédacteur : deux tels noms valent 1,0, comme deux noms vides."""
    assert normalise("🍞") == "" and normalise("!!!") == ""
    assert similarity("🍞", "🚗") == 1.0


def test_production_une_lettre_sans_decomposition_est_gardee_pas_repliee():
    """« Ø » et « ß » ne se décomposent pas : ils sont désormais gardés tels quels. Le score reste au-dessus du seuil."""
    assert normalise("Ørsted") == "ørsted"
    assert normalise("Großmann") == "großmann"
    assert similarity("Ørsted", "Orsted") == pytest.approx(0.8889, abs=1e-4)
    assert similarity("Ørsted", "Orsted") > THRESHOLD


def test_production_des_caracteres_hors_du_plan_de_base_comptent_pour_un():
    """Jumeau de la réparation JavaScript : « Code points, as Python counts them ». Même valeur en JavaScript."""
    assert jaro_winkler("𠀀𠀁x", "𠀀𠀁y") == pytest.approx(0.8222, abs=1e-4)


def test_production_formes_pointees_et_largeur_nulle_restent_au_dessus_du_seuil():
    """Non réparé, décision du rédacteur : « S.A.R.L. » n'est pas retiré, un caractère de largeur nulle coupe le mot."""
    assert similarity("Boulangerie Martin S.A.R.L.", "Boulangerie Martin") == pytest.approx(0.9385, abs=1e-4)
    assert similarity("Boulan\u200bgerie Martin", "Boulangerie Martin") == pytest.approx(0.9561, abs=1e-4)
