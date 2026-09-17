import ast
import time
from datetime import date
from pathlib import Path

import pytest

from n0 import NUMERIC, document_convention, extract_dates


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
    """breaking_point : « « dans 15 jours », qui a des chiffres, ne rend rien non plus »."""
    assert extract_dates("livraison dans 15 jours") == []
    assert extract_dates("delivery in 15 days") == []


def test_point_de_rupture_une_date_abregee_3_4_24_est_ecartee_expres():
    """
    breaking_point : « une date abrégée comme « 3/4/24 » est écartée exprès : une année sur deux chiffres
    n'est lue qu'avec un jour et un mois sur deux chiffres, sans quoi « version 2.1.24 » deviendrait un
    2 janvier ». Témoin : « 03/04/24 » est lu.
    """
    assert extract_dates("rendez-vous le 3/4/24") == []
    assert extract_dates("mise à jour vers la version 2.1.24") == []
    assert extract_dates("rendez-vous le 03/04/24", day_first=True) == [("03/04/24", date(2024, 4, 3))]
    # Limites : un seul des deux champs non complété suffit à écarter ; une année sur quatre chiffres, non.
    assert extract_dates("le 03/4/24") == [] and extract_dates("le 3/04/24") == []
    assert extract_dates("le 3/4/2024", day_first=True) == [("3/4/2024", date(2024, 4, 3))]


# ---------------------------------------------------------------------------
# Autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_lit_les_motifs_enumeres_du_scenario():
    """scenario : « des motifs que l'on peut énumérer (12/03/2024, 2024-03-12, 3 avril 2024) », en : « March 3, 2024 »."""
    text = "Réunion le 12/03/2024, specs 2024-03-12, livraison le 3 avril 2024, invoice March 3, 2024."
    assert extract_dates(text, day_first=True) == [
        ("12/03/2024", date(2024, 3, 12)),
        ("2024-03-12", date(2024, 3, 12)),
        ("3 avril 2024", date(2024, 4, 3)),
        ("March 3, 2024", date(2024, 3, 3)),
    ]


def test_lit_les_trois_formats_dans_une_phrase():
    """name : « Une expression régulière par format, puis validation calendaire »."""
    text = "Réunion le 12/03/2024, livraison le 3 avril 2024, gel des specs 2024-03-01."
    assert extract_dates(text, day_first=True) == [
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


def test_les_mois_abreges_d_une_facture_sont_lus():
    """
    Commentaire de MONTHS : « with the abbreviations an invoice, a delivery
    note or an email actually use » ; commentaire de TEXTUAL : « The full stop
    of an abbreviation and the comma that often follows the month are both
    optional ».
    """
    assert extract_dates("Échéance le 3 janv. 2024") == [("3 janv. 2024", date(2024, 1, 3))]
    assert extract_dates("le 03 sept. 2024") == [("03 sept. 2024", date(2024, 9, 3))]
    assert extract_dates("Due Mar 3, 2024") == [("Mar 3, 2024", date(2024, 3, 3))]
    assert extract_dates("3 April, 2024") == [("3 April, 2024", date(2024, 4, 3))]
    assert extract_dates("le 3 déc 2024") == [("3 déc 2024", date(2024, 12, 3))]
    assert extract_dates("due 3 Feb. 2024") == [("3 Feb. 2024", date(2024, 2, 3))]
    # Témoin : un mot qui n'est pas un mois reste un mot.
    assert extract_dates("le 3 truc 2024") == []


def test_une_date_sans_annee_n_est_pas_lue():
    """breaking_point : « « le 5 mars », sans année, nomme un jour et pas une date »."""
    assert extract_dates("rendez-vous le 5 mars") == []
    assert extract_dates("due March 5") == []
    # Témoin : la même date avec son année est lue.
    assert extract_dates("rendez-vous le 5 mars 2024") == [("5 mars 2024", date(2024, 3, 5))]


def test_les_annees_sur_deux_chiffres_se_lisent_comme_mysql_00_69_en_2000_70_99_en_1900():
    """_full_year : « Two-digit years as MySQL reads them: 00-69 are 2000-2069, 70-99 are 1970-1999 »."""
    assert extract_dates("01/01/00", day_first=True) == [("01/01/00", date(2000, 1, 1))]
    assert extract_dates("31/12/99") == [("31/12/99", date(1999, 12, 31))]
    assert extract_dates("facture du 12.03.24", day_first=True) == [("12.03.24", date(2024, 3, 12))]
    assert extract_dates("archive du 12.03.97", day_first=True) == [("12.03.97", date(1997, 3, 12))]
    assert extract_dates("01/01/69", day_first=True) == [("01/01/69", date(2069, 1, 1))]
    assert extract_dates("01/01/70", day_first=True) == [("01/01/70", date(1970, 1, 1))]


def test_le_pivot_des_annees_courtes_est_juste_pour_une_echeance_faux_pour_une_naissance():
    """_full_year : « The pivot is right for deadlines and wrong for birth dates: "12/03/65" comes out 2065 »."""
    assert extract_dates("né le 12/03/65", day_first=True) == [("12/03/65", date(2065, 3, 12))]


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


def test_le_document_tranche_d_abord_puis_l_appelant_puis_l_abstention():
    """
    docstring : « one date in it whose first field is above twelve can only be
    day-first, and that settles every other date of the same document. Failing
    that, the caller may know the locale of the sender. Failing that too, the
    snippet abstains ».
    """
    # 1. La preuve interne du document : 25 ne peut être qu'un jour.
    lu = extract_dates("Commande 25/03/2024, livraison 03/04/2024")
    assert lu == [("25/03/2024", date(2024, 3, 25)), ("03/04/2024", date(2024, 4, 3))]
    assert document_convention("Commande 25/03/2024, livraison 03/04/2024") is True
    assert document_convention("Order 03/25/2024, delivery 03/04/2024") is False
    # 2. À défaut, ce que l'appelant sait.
    assert extract_dates("03/04/2024", day_first=True) == [("03/04/2024", date(2024, 4, 3))]
    assert extract_dates("03/04/2024", day_first=False) == [("03/04/2024", date(2024, 3, 4))]
    # 3. À défaut, l'abstention : la date est rendue sans son jour.
    assert extract_dates("03/04/2024") == [("03/04/2024", None)]
    assert document_convention("03/04/2024") is None
    # Un document qui se contredit ne tranche rien non plus.
    assert document_convention("25/03/2024 puis 03/25/2024") is None
    # La preuve interne passe avant l'appelant, date par date : 13 n'est pas un mois.
    assert extract_dates("13/04/2024", day_first=False) == [("13/04/2024", date(2024, 4, 13))]


def test_l_ordre_iso_ne_depend_pas_de_la_convention():
    """commentaire : « ISO order, whatever the local habit is »."""
    for day_first in (True, False):
        assert extract_dates("2024-03-12", day_first=day_first) == [("2024-03-12", date(2024, 3, 12))]


def test_les_nombres_ordinaires_restent_intacts():
    assert extract_dates("version 1.2.3, ticket 4512, salle 4, 192.168.1.1") == []
    assert extract_dates("version 1.2.345") == []


def test_jamais_un_morceau_d_un_nombre_pointe_plus_long():
    """
    Commentaire de NUMERIC : « Never a piece of a longer dotted number: in "10.1.1.24", "1.1.24" is not
    a date » ; commentaire : « a short year only with a padded day and month: "version 2.1.24" is no date ».
    """
    for text in ("serveur 10.1.1.24", "serveur 10.01.01.24", "réf. 12/03/2024/5", "réf. 1.12.03.2024", "v2.1.24"):
        assert extract_dates(text) == [], text
    # Témoin : la même date seule, et en fin de phrase suivie d'un point, est lue.
    assert extract_dates("le 01.01.24", day_first=True) == [("01.01.24", date(2024, 1, 1))]
    assert extract_dates("facture du 12.03.24.", day_first=True) == [("12.03.24", date(2024, 3, 12))]
    assert extract_dates("facture du 12/03/2024.", day_first=True) == [("12/03/2024", date(2024, 3, 12))]


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


def test_verdict_ce_qu_il_ne_voit_pas_est_une_liste_vide_ce_qu_il_lit_a_l_envers_une_date_plausible():
    """
    verdict_rationale : « Ce que ce niveau ne voit pas, il le rend en liste vide ; ce qu'il lit selon la
    mauvaise convention, il le rend comme une date plausible ».
    """
    assert extract_dates("Relance jeudi prochain.") == []
    assert extract_dates("Invoice issued 04/05/2024, net thirty days.", day_first=True) == [
        ("04/05/2024", date(2024, 5, 4))
    ]
    # Témoin : lue selon sa convention, la facture américaine donne le 5 avril.
    assert extract_dates("Invoice issued 04/05/2024, net thirty days.", day_first=False) == [
        ("04/05/2024", date(2024, 4, 5))
    ]


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


def test_production_quinze_mille_dates_tiennent_dans_une_borne_large():
    text = "le 12/03/2024, " * 15_000
    debut = time.perf_counter()
    assert len(extract_dates(text)) == 15_000
    assert time.perf_counter() - debut < 3


def test_production_un_motif_pathologique_termine_dans_une_borne_large():
    debut = time.perf_counter()
    assert extract_dates(("1 " + "a" * 1000 + " ") * 1000) == []
    assert extract_dates("1" + " " * 200_000 + "avril") == []
    assert extract_dates("March" + " " * 200_000 + "3") == []
    assert extract_dates("1." * 100_000) == [] and extract_dates("12/" * 60_000) == []
    assert time.perf_counter() - debut < 5


def test_une_longue_suite_de_lettres_est_lue_une_fois_pas_une_fois_par_lettre():
    """
    Commentaire de MONTH_FIRST : « It only starts at the start of a word, so a long run of letters is
    read once, not once per letter. » 100 000 lettres, puis 1 000 mots de 100 lettres, dans une borne large.
    """
    debut = time.perf_counter()
    assert extract_dates("March" + "a" * 100_000 + " 3, 2024") == []
    assert extract_dates(("a" * 100 + " ") * 1000 + "March 3, 2024") == [("March 3, 2024", date(2024, 3, 3))]
    assert time.perf_counter() - debut < 1


def test_une_longue_suite_de_marques_combinantes_est_lue_une_fois_elle_aussi():
    """
    Commentaire de MONTH_FIRST : « a combining mark is not the start of a word
    — so a long run of letters or of marks is read once, not once per
    character ». Sans le regard arrière sur les marques, vingt mille marques
    prenaient neuf secondes.
    """
    debut = time.perf_counter()
    assert extract_dates("a" + "\u0301" * 20_000) == []
    assert time.perf_counter() - debut < 1
    # Témoin : une date derrière la même suite est toujours lue.
    assert extract_dates("a" + "\u0301" * 20_000 + " March 3, 2024") == [("March 3, 2024", date(2024, 3, 3))]


def test_production_espaces_insecables_bom_et_largeur_nulle_autour_de_la_date():
    assert extract_dates("3\u00a0avril\u00a02024") == [("3\u00a0avril\u00a02024", date(2024, 4, 3))]
    assert extract_dates("3\u202favril 2024") == [("3\u202favril 2024", date(2024, 4, 3))]
    assert extract_dates("\ufeff12/03/2024\u200b", day_first=True) == [("12/03/2024", date(2024, 3, 12))]


def test_production_casse_mixte_dans_le_nom_du_mois():
    assert extract_dates("LE 3 AVRIL 2024") == [("3 AVRIL 2024", date(2024, 4, 3))]


def test_production_1er_en_capitales_et_ordinaux_anglais_sont_lus():
    """Commentaire de TEXTUAL : « "3 avril 2024", "1er mars 2024", "3rd April 2024", in any case »."""
    assert extract_dates("LE 1ER MARS 2024") == [("1ER MARS 2024", date(2024, 3, 1))]
    assert extract_dates("due 3rd April 2024") == [("3rd April 2024", date(2024, 4, 3))]
    assert extract_dates("DUE 3RD APRIL 2024") == [("3RD APRIL 2024", date(2024, 4, 3))]
    assert extract_dates("the 22nd May 2024 and 1st June 2024") == [
        ("22nd May 2024", date(2024, 5, 22)), ("1st June 2024", date(2024, 6, 1))]


def test_production_un_mois_en_accents_decomposes_est_lu():
    """Commentaire de WORD : « its accents typed as one character or as a letter plus a mark »."""
    assert extract_dates("1er fe\u0301vrier 2024") == [("1er fe\u0301vrier 2024", date(2024, 2, 1))]


def test_production_la_forme_anglaise_mois_jour_annee_est_lue():
    """Commentaire de MONTH_FIRST : « "March 3, 2024" » ; avec ordinal et sans virgule."""
    assert extract_dates("Payment due March 3, 2024.") == [("March 3, 2024", date(2024, 3, 3))]
    assert extract_dates("Payment due March 3rd, 2024.") == [("March 3rd, 2024", date(2024, 3, 3))]
    assert extract_dates("Payment due march 3 2024.") == [("march 3 2024", date(2024, 3, 3))]
    assert extract_dates("Payment due March 32, 2024.") == []


def test_production_des_chiffres_pleine_chasse_sont_lus_dans_les_deux_langages():
    """Commentaire de D : « ASCII digits and full-width digits, read the same way in Python and JavaScript »."""
    assert extract_dates("１２/０３/２０２４", day_first=True) == [("１２/０３/２０２４", date(2024, 3, 12))]
    assert extract_dates("３ avril ２０２４") == [("３ avril ２０２４", date(2024, 4, 3))]
    # Les chiffres arabes-indiens ne sont lus ni en Python ni en JavaScript.
    assert extract_dates("٠٣/٠٤/٢٠٢٤") == []


def test_production_l_an_24_ecrit_sur_quatre_chiffres_reste_l_an_24():
    """Le pivot ne s'applique qu'à une année écrite sur deux chiffres ; l'an 0 n'existe pas (même sortie en JavaScript)."""
    assert extract_dates("01/01/0024", day_first=True) == [("01/01/0024", date(24, 1, 1))]
    assert extract_dates("0024-01-01") == [("0024-01-01", date(24, 1, 1))]
    assert extract_dates("01/01/0001", day_first=True) == [("01/01/0001", date(1, 1, 1))]
    assert extract_dates("01/01/0000", day_first=True) == []


def test_production_valeurs_aux_limites_du_calendrier():
    assert extract_dates("31/12/9999") == [("31/12/9999", date(9999, 12, 31))]
    assert extract_dates("00/01/2024", day_first=True) == []
    assert extract_dates("01/13/2024", day_first=True) == [("01/13/2024", date(2024, 1, 13))]
    assert extract_dates("31/01/2024") == [("31/01/2024", date(2024, 1, 31))]
    assert extract_dates("32/01/2024") == []
