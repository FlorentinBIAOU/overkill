import ast
import re
import time
from pathlib import Path

import pytest

from n0 import (
    AMOUNT,
    UnreadableInvoice,
    extract_fields,
    find_after_label,
    parse_amount,
    read_invoice,
    read_structured,
)

# La même facture dans les deux syntaxes du socle, réduite aux éléments que
# l'extrait lit. Une facture réelle en porte cent de plus, à la même place.
CII = b"""<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
                          xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
                          xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocument>
    <ram:ID>FA-2026-0187</ram:ID>
    <ram:IssueDateTime><udt:DateTimeString format="102">20260915</udt:DateTimeString></ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:TaxBasisTotalAmount>69.00</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">13.80</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>82.80</ram:GrandTotalAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>"""

UBL = b"""<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2">
  <cbc:ID>FA-2026-0187</cbc:ID>
  <cbc:IssueDate>2026-09-15</cbc:IssueDate>
  <cac:TaxTotal><cbc:TaxAmount currencyID="EUR">13.80</cbc:TaxAmount></cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:TaxExclusiveAmount>69.00</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount>82.80</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount>82.80</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
</Invoice>"""

READ = {
    "source": "structured",
    "invoice_number": "FA-2026-0187",
    "date": "2026-09-15",
    "total_excluding_vat": 69.00,
    "vat": 13.80,
    "total": 82.80,
    "totals_agree": True,
}

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
# La porte structurée : ce que la réforme fait arriver depuis le 1er septembre 2026
# ---------------------------------------------------------------------------


def test_lit_les_deux_syntaxes_du_socle_et_dit_par_ou_la_reponse_est_passee():
    """
    docstring : « the minimum set of formats is UBL, CII and Factur-X » ; « say
    which door the answer came through ». Factur-X porte le CII dans le PDF :
    c'est le même XML.
    """
    assert read_structured(CII) == READ
    assert read_structured(UBL) == READ
    assert read_invoice(CII)["source"] == "structured"
    assert read_invoice(LAMBERT)["source"] == "text"


def test_les_dates_des_deux_syntaxes_rendent_la_meme_forme():
    """docstring de `_date` : « CII writes 20260915, UBL writes 2026-09-15; the caller gets one shape »."""
    assert read_structured(CII)["date"] == read_structured(UBL)["date"] == "2026-09-15"
    sans_date = CII.replace(b"20260915", b"")
    assert read_structured(sans_date)["date"] is None


def test_la_regle_br_co_15_attrape_une_facture_dont_les_totaux_ne_tombent_pas():
    """
    docstring : « total with VAT = total without VAT + VAT ». Règle BR-CO-15 de
    la norme : « Montant total de la facture TVA comprise (BT-112) = Montant
    total de la facture hors TVA (BT-109) + Montant total de TVA de la facture
    (BT-110) ».
    """
    assert read_structured(CII)["totals_agree"] is True
    faux = CII.replace(b"<ram:GrandTotalAmount>82.80", b"<ram:GrandTotalAmount>83.80")
    lu = read_structured(faux)
    assert lu["totals_agree"] is False
    # La facture est rendue quand même : « a reason to look, not a reason to reject ».
    assert lu["total"] == 83.80
    # Un centime d'écart se voit aussi ; le même centime de tolérance ne le cache pas.
    limite = CII.replace(b"<ram:GrandTotalAmount>82.80", b"<ram:GrandTotalAmount>82.81")
    assert read_structured(limite)["totals_agree"] is False


def test_sans_les_trois_montants_la_regle_ne_dit_rien_plutot_que_faux():
    """docstring de `_totals_agree` : « None when the invoice does not carry the three amounts the rule needs »."""
    sans_tva = CII.replace(b"<ram:TaxTotalAmount currencyID=\"EUR\">13.80</ram:TaxTotalAmount>", b"")
    lu = read_structured(sans_tva)
    assert lu["vat"] is None
    assert lu["totals_agree"] is None
    # Et le reste de la facture est lu.
    assert lu["invoice_number"] == "FA-2026-0187"


def test_un_document_qui_n_est_pas_une_facture_est_refuse_plutot_que_lu_a_moitie():
    """docstring : « The document is neither of the two syntaxes this reads »."""
    with pytest.raises(UnreadableInvoice, match="neither CII nor UBL"):
        read_structured(b"<Order xmlns='urn:x'><ID>1</ID></Order>")
    with pytest.raises(UnreadableInvoice, match="no invoice number"):
        read_structured(CII.replace(b"<ram:ID>FA-2026-0187</ram:ID>", b""))


def test_la_porte_structuree_ne_depend_pas_des_prefixes_de_namespace():
    """Commentaire de STRUCTURED : « One pair is enough to find them without carrying a page of namespace declarations »."""
    autre = CII
    for ancien, nouveau in ((b"rsm", b"a"), (b"ram", b"b"), (b"udt", b"c")):
        autre = autre.replace(b"xmlns:" + ancien + b"=", b"xmlns:" + nouveau + b"=")
        autre = autre.replace(ancien + b":", nouveau + b":")
    assert read_structured(autre) == READ


def test_la_porte_structuree_n_est_pas_trompee_par_un_identifiant_de_ligne():
    """
    Une facture réelle porte un `ram:ID` par ligne de produit, et un
    `cbc:ID` par ligne UBL : c'est le couple (parent, enfant) qui les écarte.
    """
    avec_lignes = CII.replace(
        b"<rsm:SupplyChainTradeTransaction>",
        b"<rsm:SupplyChainTradeTransaction>"
        b"<ram:IncludedSupplyChainTradeLineItem><ram:AssociatedDocumentLineDocument>"
        b"<ram:LineID>1</ram:LineID><ram:ID>LIGNE-1</ram:ID>"
        b"</ram:AssociatedDocumentLineDocument></ram:IncludedSupplyChainTradeLineItem>",
    )
    assert read_structured(avec_lignes)["invoice_number"] == "FA-2026-0187"


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
    assert extract_fields(LAMBERT)["invoice_number"] == "FA-2024-0187"
    assert extract_fields(LAMBERT)["total"] == 82.80


def test_point_de_rupture_deux_champs_tombent_a_vide_et_cela_se_voit():
    """breaking_point : « Deux tombent à vide, et cela se voit »."""
    fields = extract_fields(NORD)
    lus = ("invoice_number", "date", "total")
    assert [name for name in lus if fields[name] is None] == ["invoice_number", "date"]


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
    """name : « la page seulement s'il n'y a pas de fichier structuré »."""
    assert extract_fields(LAMBERT) == {
        "source": "text",
        "invoice_number": "FA-2024-0187",
        "date": "14/03/2024",
        "total": 82.80,
        "total_excluding_vat": None,
        "vat": None,
        "totals_agree": None,
    }


def test_lit_des_libelles_en_capitales_et_un_montant_groupe():
    invoice = "FACTURE N° FA-2024-0201\nDATE : 02/12/2024\nTOTAL TTC : 1 234,56 €"
    fields = extract_fields(invoice)
    assert (fields["invoice_number"], fields["date"], fields["total"]) == ("FA-2024-0201", "02/12/2024", 1234.56)


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


def test_trois_chiffres_par_groupe_separent_une_quantite_d_un_prix_mais_pas_toujours():
    """
    Commentaire d'AMOUNT : « Exactly three digits per group keeps "2 38,50"
    apart, a quantity then a price; "2 380,50" still reads as one number. »
    C'est la limite de la règle, écrite dans le commentaire et démontrée ici.
    """
    assert re.search(AMOUNT, "Cartouche encre noire 2 38,50").group(0) == "38,50"
    assert re.search(AMOUNT, "Cartouche encre noire 2 380,50").group(0) == "2 380,50"


def test_l_extrait_n_importe_que_la_bibliotheque_standard():
    """docstring : « No model, no training set, no service » ; risks.data_egress: none."""
    source = ast.parse(Path(__file__).with_name("n0.py").read_text(encoding="utf-8"))
    imported = {a.name.split(".")[0] for n in ast.walk(source) if isinstance(n, ast.Import) for a in n.names}
    imported |= {n.module.split(".")[0] for n in ast.walk(source) if isinstance(n, ast.ImportFrom)}
    assert imported == {"re", "xml"}
    assert extract_fields(LAMBERT) == extract_fields(LAMBERT)


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_document_vide_ou_blanc():
    vide = {"source": "text", "invoice_number": None, "date": None, "total": None,
            "total_excluding_vat": None, "vat": None, "totals_agree": None}
    assert extract_fields("") == vide
    assert extract_fields("\n   \n\t") == vide


def test_production_un_document_de_neuf_megaoctets_dans_une_borne_large():
    big = LAMBERT * 20_000
    debut = time.perf_counter()
    assert extract_fields(big)["total"] == 82.80
    assert time.perf_counter() - debut < 10


def test_production_espace_insecable_et_espace_fine_dans_le_montant():
    assert extract_fields("Total TTC 1\u00a0234,56 €")["total"] == 1234.56
    assert extract_fields("Total TTC 1\u202f234,56 €")["total"] == 1234.56


def test_production_une_espace_insecable_dans_total_ttc_rend_le_total_ht():
    assert extract_fields(LAMBERT.replace("Total TTC", "Total\u00a0TTC"))["total"] == 82.80


def test_production_un_montant_a_l_anglaise_est_lu_sans_erreur_et_faux():
    assert extract_fields("TOTAL TTC : 1,234.56 USD")["total"] in (1234.56, None)


def test_production_le_total_negatif_d_un_avoir_garde_son_signe():
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
