import ast
import time
from datetime import date
from pathlib import Path

import pytest

from n0 import NUMERIC, extract_dates


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_jeudi_prochain_dans_quinze_jours_et_a_partir_de_demain_ne_rendent_rien():
    """
    breaking_point : « « jeudi prochain », « dans quinze jours », « à partir de
    demain » : il n'y a pas de chiffres à faire correspondre, donc il ne se
    trouve rien du tout ». Témoin : la même phrase avec une date écrite en
    chiffres est lue.
    """
    for phrase in (
        "on se voit jeudi prochain",
        "livraison dans quinze jours",
        "à partir de demain",
        "let us meet next Thursday",
        "fin du mois",
    ):
        assert extract_dates(phrase) == [], phrase
    assert extract_dates("on se voit jeudi 14/03/2024") == [("14/03/2024", date(2024, 3, 14))]


def test_point_de_rupture_l_echec_est_silencieux_une_liste_vide_et_non_une_erreur():
    """breaking_point : « L'échec est silencieux, une liste vide et non une erreur »."""
    result = extract_dates("Relance à faire jeudi prochain, livraison dans quinze jours.")
    assert result == []
    assert isinstance(result, list)


def test_point_de_rupture_une_date_relative_avec_des_chiffres_ne_rend_rien_non_plus():
    """Au-delà de la fiche : « dans 15 jours » a des chiffres, et rien n'est trouvé pour autant."""
    assert extract_dates("livraison dans 15 jours") == []


# ---------------------------------------------------------------------------
# Autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_lit_les_trois_formats_dans_une_phrase():
    """name : « Une expression régulière par format, puis validation calendaire »."""
    text = "Réunion le 12/03/2024, livraison le 3 avril 2024, gel des specs 2024-03-01."
    assert extract_dates(text) == [
        ("12/03/2024", date(2024, 3, 12)),
        ("3 avril 2024", date(2024, 4, 3)),
        ("2024-03-01", date(2024, 3, 1)),
    ]


def test_lit_les_mois_en_lettres_avec_et_sans_accents_en_francais_et_en_anglais():
    """commentaire : « Month names in French and English » ; _fold : « so that "février" and "fevrier" reach the same entry »."""
    for written in ("1er février 2024", "1er fevrier 2024", "1 February 2024", "1er mars 2024"):
        day = 1
        month = 3 if "mars" in written else 2
        assert extract_dates(f"à compter du {written}") == [(written, date(2024, month, day))], written


def test_les_annees_sur_deux_chiffres_suivent_le_pivot_69_2069_70_1970():
    """commentaire : « Two-digit years on the usual pivot: 69 reads as 2069, 70 as 1970 »."""
    assert extract_dates("facture du 12.03.24") == [("12.03.24", date(2024, 3, 12))]
    assert extract_dates("archive du 12.03.97") == [("12.03.97", date(1997, 3, 12))]
    assert extract_dates("01/01/69") == [("01/01/69", date(2069, 1, 1))]
    assert extract_dates("01/01/70") == [("01/01/70", date(1970, 1, 1))]


def test_l_expression_reguliere_accepte_31_02_2024_et_29_02_2023_le_calendrier_les_refuse():
    """docstring : « 31/02/2024 lui correspond parfaitement, et 29/02/2023 aussi » ; scenario : « 31/02/2024 a toutes les apparences d'une date sans en être une »."""
    assert NUMERIC.fullmatch("31/02/2024")
    assert NUMERIC.fullmatch("29/02/2023")
    assert extract_dates("livraison le 31/02/2024") == []
    assert extract_dates("livraison le 31/04/2024") == []
    assert extract_dates("livraison le 29/02/2023") == []


def test_annees_bissextiles_regle_du_siecle_comprise():
    """docstring : « la règle du siècle qui fait de 1900 une année commune » ; verdict : « 29/02/1900 […] écartés »."""
    assert extract_dates("29/02/2024") == [("29/02/2024", date(2024, 2, 29))]
    assert extract_dates("29/02/2023") == []
    assert extract_dates("29/02/2000") == [("29/02/2000", date(2000, 2, 29))]
    assert extract_dates("29/02/1900") == []


def test_jour_ou_mois_d_abord_c_est_l_appelant_qui_tranche():
    """docstring : « l'appelant le tranche une fois » ; scenario : « 03/04/2024 en désigne deux »."""
    assert extract_dates("03/04/2024") == [("03/04/2024", date(2024, 4, 3))]
    assert extract_dates("03/04/2024", day_first=False) == [("03/04/2024", date(2024, 3, 4))]
    # Read the other way round, 13 is not a month, and the check catches it.
    assert extract_dates("13/04/2024", day_first=False) == []


def test_l_ordre_iso_ne_depend_pas_de_la_convention():
    """commentaire : « ISO order, whatever the local habit is »."""
    for day_first in (True, False):
        assert extract_dates("2024-03-12", day_first=day_first) == [("2024-03-12", date(2024, 3, 12))]


def test_les_nombres_ordinaires_restent_intacts():
    """commentaire : « Years are two or four digits, never three: that is what keeps "1.2.3" out »."""
    assert extract_dates("version 1.2.3, ticket 4512, salle 4, 192.168.1.1") == []
    assert extract_dates("version 1.2.345") == []


def test_defaut_un_numero_de_version_a_deux_chiffres_de_fin_est_lu_comme_une_date():
    assert extract_dates("mise à jour vers la version 2.1.24") == []
    assert extract_dates("serveur 10.1.1.24") == []


def test_un_passage_qui_chevauche_une_date_retenue_n_est_pas_une_seconde_date():
    """commentaire : « A match that overlaps an accepted one is a second reading of the same characters, not a second date »."""
    assert extract_dates("3 avril 2024-05-06") == [("3 avril 2024", date(2024, 4, 3))]


def test_escalate_when_une_convention_unique_rend_des_dates_plausibles_mais_fausses_sur_un_corpus_mixte():
    """escalate_when : « La convention unique […] est alors fausse pour une partie du fichier, et elle rend des dates plausibles »."""
    corpus = "Facture émise le 03/04/2024. Invoice issued 04/05/2024."
    assert extract_dates(corpus, day_first=True) == [
        ("03/04/2024", date(2024, 4, 3)),
        ("04/05/2024", date(2024, 5, 4)),  # the American invoice meant 5 April
    ]


@pytest.mark.xfail(
    strict=True,
    reason=(
        "INFIRMÉ : verdict_rationale dit « Ce que ce niveau ne sait pas faire, il ne le "
        "fait pas à moitié, il rend une liste vide » ; sur une date mois-jour lue en "
        "jour-mois, il rend une date plausible et fausse, comme le dit escalate_when"
    ),
)
def test_infirme_ce_que_n0_ne_sait_pas_faire_il_rend_une_liste_vide():
    assert extract_dates("Invoice issued 04/05/2024, net thirty days.", day_first=True) == []


def test_l_extrait_est_deterministe_et_n_importe_que_la_bibliotheque_standard():
    """docstring : « Deterministic, standard library only » ; risks.data_egress: none."""
    source = ast.parse(Path(__file__).with_name("n0.py").read_text(encoding="utf-8"))
    imported = {a.name.split(".")[0] for n in ast.walk(source) if isinstance(n, ast.Import) for a in n.names}
    imported |= {n.module.split(".")[0] for n in ast.walk(source) if isinstance(n, ast.ImportFrom)}
    assert imported <= {"re", "unicodedata", "datetime"}
    text = "Réunion le 12/03/2024, livraison le 3 avril 2024."
    assert extract_dates(text) == extract_dates(text)


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_chaine_vide_et_texte_sans_chiffre():
    assert extract_dates("") == []
    assert extract_dates("   \n\t") == []


def test_defaut_quinze_mille_dates_depassent_une_borne_large():
    text = "le 12/03/2024, " * 15_000
    debut = time.perf_counter()
    assert len(extract_dates(text)) == 15_000
    assert time.perf_counter() - debut < 3


def test_production_un_motif_pathologique_termine_dans_une_borne_large():
    debut = time.perf_counter()
    assert extract_dates(("1 " + "a" * 1000 + " ") * 1000) == []
    assert extract_dates("1" + " " * 200_000 + "avril") == []
    assert time.perf_counter() - debut < 5


def test_production_espaces_insecables_bom_et_largeur_nulle_autour_de_la_date():
    assert extract_dates("3\u00a0avril\u00a02024") == [("3\u00a0avril\u00a02024", date(2024, 4, 3))]
    assert extract_dates("3\u202favril 2024") == [("3\u202favril 2024", date(2024, 4, 3))]
    assert extract_dates("\ufeff12/03/2024\u200b") == [("12/03/2024", date(2024, 3, 12))]


def test_production_casse_mixte_dans_le_nom_du_mois():
    assert extract_dates("LE 3 AVRIL 2024") == [("3 AVRIL 2024", date(2024, 4, 3))]


def test_defaut_1er_en_capitales_n_est_pas_lu():
    assert extract_dates("LE 1ER MARS 2024") == [("1ER MARS 2024", date(2024, 3, 1))]


def test_defaut_un_mois_en_accents_decomposes_n_est_pas_lu():
    assert extract_dates("1er fe\u0301vrier 2024") == [("1er fe\u0301vrier 2024", date(2024, 2, 1))]


def test_defaut_la_forme_anglaise_mois_jour_annee_n_est_pas_lue():
    assert extract_dates("Payment due March 3, 2024.") == [("March 3, 2024", date(2024, 3, 3))]


def test_production_des_chiffres_pleine_chasse_sont_lus_dans_les_deux_langages():
    assert extract_dates("１２/０３/２０２４") == [("１２/０３/２０２４", date(2024, 3, 12))]


def test_production_valeurs_aux_limites_du_calendrier():
    assert extract_dates("31/12/9999") == [("31/12/9999", date(9999, 12, 31))]
    assert extract_dates("00/01/2024") == []
    assert extract_dates("01/13/2024") == []
    assert extract_dates("31/01/2024") == [("31/01/2024", date(2024, 1, 31))]
    assert extract_dates("32/01/2024") == []
