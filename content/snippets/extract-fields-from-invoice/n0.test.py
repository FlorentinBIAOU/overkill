import ast
import re
import time
from pathlib import Path

import pytest

from n0 import AMOUNT, extract_fields, find_after_label, parse_amount

# Two invoices, two suppliers, both already turned into text. Nothing here is
# unusual: this is what a French invoice looks like once the PDF has given up
# its characters.

LAMBERT = """
PAPETERIE LAMBERT
12 rue des Acacias — 69003 Lyon

Facture n° FA-2024-0187
Date : 14/03/2024
Client : Studio Vermeil

Réf     Désignation                Qté   PU HT    Montant HT
A-11    Ramette A4 80 g             10    4,90       49,00
B-02    Stylo bille noir            25    0,80       20,00

                          Total HT      69,00 €
                          TVA 20 %      13,80 €
                          Total TTC     82,80 €
"""

NORD = """
NORD FOURNITURES SAS
Facture

                                          N° 2024-000431
                                          Émise le 3 avril 2024

Désignation                        Qté     Prix      Total
Cartouche encre noire                2    38,50      77,00

                          Sous-total                 77,00
                          TVA (20 %)                 15,40
                          NET A PAYER                92,40 EUR
"""


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_le_fournisseur_suivant_fait_tomber_les_trois_champs():
    """
    breaking_point : « Il écrit « N° » là où le premier écrivait « Facture n° »,
    date en toutes lettres, et appelle le montant dû « NET A PAYER » : les trois
    champs tombent ». Témoin : la facture Lambert est lue entièrement.
    """
    fields = extract_fields(NORD)
    assert fields["invoice_number"] is None
    assert fields["date"] is None
    assert fields["total"] != 92.40
    assert extract_fields(LAMBERT) == {"invoice_number": "FA-2024-0187", "date": "14/03/2024", "total": 82.80}


def test_point_de_rupture_deux_champs_tombent_a_vide_et_cela_se_voit():
    """breaking_point : « Deux tombent à vide, et cela se voit »."""
    fields = extract_fields(NORD)
    assert [name for name, value in fields.items() if value is None] == ["invoice_number", "date"]


def test_point_de_rupture_le_total_revient_bien_forme_et_faux_parce_que_sous_total_contient_total():
    """
    breaking_point : « le total revient bien formé et faux, parce que « Sous-total »
    contient « total » ». Témoin : sans le mot « Sous-total », la même ligne ne
    donne plus rien.
    """
    assert extract_fields(NORD)["total"] == 77.00
    assert find_after_label(NORD, ("total",), AMOUNT) == "77,00"
    assert extract_fields(NORD.replace("Sous-total", "Montant HT"))["total"] is None


# ---------------------------------------------------------------------------
# Autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_lit_la_facture_pour_laquelle_il_a_ete_ecrit():
    """name : « Ancrage sur les libellés, puis expressions régulières »."""
    assert extract_fields(LAMBERT) == {
        "invoice_number": "FA-2024-0187",
        "date": "14/03/2024",
        "total": 82.80,
    }


def test_lit_des_libelles_en_capitales_et_un_montant_groupe():
    invoice = "FACTURE N° FA-2024-0201\nDATE : 02/12/2024\nTOTAL TTC : 1 234,56 €"
    assert extract_fields(invoice) == {
        "invoice_number": "FA-2024-0201",
        "date": "02/12/2024",
        "total": 1234.56,
    }


def test_un_libelle_sans_valeur_sur_sa_ligne_est_ignore():
    """docstring : « A label that appears on a line holding no value is skipped rather than accepted, because a column heading is a label too »."""
    invoice = "Qté   Prix   Total\n\nTotal TTC   45,00 €"
    assert extract_fields(invoice)["total"] == 45.00


def test_les_libelles_sont_ranges_du_plus_precis_au_moins_precis_total_ttc_avant_total_ht():
    """docstring : « « Total TTC » et « Total HT » ne diffèrent que d'un mot et le mauvais donne un nombre plausible »."""
    assert extract_fields(LAMBERT)["total"] == 82.80
    # Witness: with the least specific label alone, the plausible wrong number comes back.
    assert find_after_label(LAMBERT, ("total",), AMOUNT) == "69,00"


def test_parse_amount_lit_les_deux_graphies():
    """docstring de parse_amount : « A comma means French spelling: the dots left are thousands separators »."""
    assert parse_amount("1.234,56 €") == 1234.56
    assert parse_amount("82,80") == 82.80
    assert parse_amount("92.40") == 92.40


@pytest.mark.xfail(
    strict=True,
    reason=(
        "INFIRMÉ : le commentaire dit que trois chiffres exacts par groupe empêchent "
        "d'avaler « une quantité et un prix unitaire comme un seul nombre » ; "
        "« 2 380,50 » (quantité 2, prix 380,50) est lu comme un seul montant"
    ),
)
def test_infirme_une_quantite_et_un_prix_unitaire_ne_sont_jamais_lus_comme_un_seul_nombre():
    assert re.search(AMOUNT, "Cartouche encre noire 2 380,50").group(0) == "380,50"


def test_l_extrait_n_importe_que_re():
    """docstring : « No model, no training set, no service » ; risks.data_egress: none."""
    source = ast.parse(Path(__file__).with_name("n0.py").read_text(encoding="utf-8"))
    imported = {a.name.split(".")[0] for n in ast.walk(source) if isinstance(n, ast.Import) for a in n.names}
    imported |= {n.module.split(".")[0] for n in ast.walk(source) if isinstance(n, ast.ImportFrom)}
    assert imported == {"re"}
    assert extract_fields(LAMBERT) == extract_fields(LAMBERT)


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_document_vide_ou_blanc():
    assert extract_fields("") == {"invoice_number": None, "date": None, "total": None}
    assert extract_fields("\n   \n\t") == {"invoice_number": None, "date": None, "total": None}


def test_production_un_document_de_neuf_megaoctets_dans_une_borne_large():
    big = LAMBERT * 20_000
    debut = time.perf_counter()
    assert extract_fields(big)["total"] == 82.80
    assert time.perf_counter() - debut < 10


def test_production_espace_insecable_et_espace_fine_dans_le_montant():
    assert extract_fields("Total TTC 1\u00a0234,56 €")["total"] == 1234.56
    assert extract_fields("Total TTC 1\u202f234,56 €")["total"] == 1234.56


def test_defaut_une_espace_insecable_dans_total_ttc_rend_le_total_ht():
    assert extract_fields(LAMBERT.replace("Total TTC", "Total\u00a0TTC"))["total"] == 82.80


def test_defaut_un_montant_a_l_anglaise_est_lu_sans_erreur_et_faux():
    assert extract_fields("TOTAL TTC : 1,234.56 USD")["total"] in (1234.56, None)


def test_defaut_le_total_negatif_d_un_avoir_perd_son_signe():
    assert extract_fields("Facture d'avoir n° AV-2024-0012\nTotal TTC -82,80 €")["total"] == -82.80


def test_production_valeurs_aux_limites_du_montant():
    assert extract_fields("Total TTC 0,00 €")["total"] == 0.0
    assert extract_fields("Total TTC 999,99 €")["total"] == 999.99
    assert extract_fields("Total TTC 1 000,00 €")["total"] == 1000.00
    assert extract_fields("Total TTC 1 234 567,89 €")["total"] == 1234567.89
    assert extract_fields("Total TTC 12,5 €")["total"] is None


def test_production_un_motif_concu_pour_faire_exploser_la_reference_termine():
    debut = time.perf_counter()
    extract_fields("Facture n° " + "1-" * 50_000 + "!")
    extract_fields("Total TTC " + "1 " * 50_000 + "x")
    assert time.perf_counter() - debut < 10
