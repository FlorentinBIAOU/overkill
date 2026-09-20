import json
import shutil
import subprocess
import time
from pathlib import Path

from price_parser import Price

from n0 import extract_amounts, read_number

ICI = Path(__file__).parent

# Une ligne de facture française ordinaire : le numéro de pièce, la date, et
# le montant qui porte son symbole.
FACTURE = "Facture n° 2026-118 du 10 octobre 2026 — total 1 250,00 €"

DEVIS = ("Sous-total 1 250,00 €, remise 125,00 €, total 1 125,00 € TTC. "
         "TVA 20 % incluse.")

# Le même document, avec la devise écrite une fois, en tête.
ENTETE = ("Facture n° 2026-118. Montants exprimés en euros.\n"
          "Sous-total : 1 250,00\nRemise : 125,00\nTotal : 1 125,00")

TOUS = [FACTURE, DEVIS, ENTETE, "1,859 € le litre", "1 859,00 €",
        "Montants en euros. Total : $1,250.00", "Le prix est de 1 250 euros.",
        "12,5 % de remise", "¥1000", "il y a 3, 4 ou 5 euros", "CHF 1 234.50",
        "le total est 1.234 EUR", "1 250 EURé", "USD 1,250.00 and 1.250,00 EUR",
        "0,10 € + 0,20 €", "", "1 250,00 €", "1 250,00 €", "kr 1 250",
        "£0.01", "1,2345 €", "12 5 €", "1.234.567,89 €", "9 999 999 999 €"]


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_trois_chiffres_derriere_un_separateur_se_lisent_deux_facons():
    """
    « « 1,859 € » : trois chiffres derrière une virgule, c'est un groupe de
    milliers sous une convention et trois décimales sous l'autre. »
    """
    francais = extract_amounts("1,859 € le litre", "fr")["amounts"][0]
    anglais = extract_amounts("1,859 € le litre", "en")["amounts"][0]
    assert francais["value"] == "1.859"
    assert anglais["value"] == "1859"
    # La lecture dépend de la déclaration, et le drapeau le dit — il ne dit pas
    # laquelle des deux est juste.
    assert francais["ambiguous"] is True and anglais["ambiguous"] is True


def test_point_de_rupture_temoin_une_espace_tranche_le_groupement():
    """
    « Le témoin est dans le même test : « 1 859,00 € », où l'espace tranche le
    groupement, revient sans drapeau et vaut la même chose des deux côtés. »
    """
    for convention in ("fr", "en"):
        lu = extract_amounts("1 859,00 €", convention)["amounts"][0]
        assert lu["value"] == "1859.00"
        assert lu["ambiguous"] is False


# ---------------------------------------------------------------------------
# Le verdict, confronté à l'outil de référence
# ---------------------------------------------------------------------------


def test_verdict_loutil_de_reference_rend_le_numero_de_facture_comme_total():
    """
    R4 : `price-parser` lit un prix dans une chaîne, et cette fiche cherche les
    montants d'un texte. Sur la même ligne de facture, il rend 2026.
    """
    assert Price.fromstring(FACTURE).amount == 2026
    lus = extract_amounts(FACTURE, "fr")["amounts"]
    assert [a["value"] for a in lus] == ["1250.00"]
    assert lus[0]["currency"] == "EUR"


def test_verdict_loutil_de_reference_attribue_la_devise_dune_entete():
    """R4, suite : la devise est cherchée dans toute la chaîne, pas à côté du nombre."""
    melange = "Montants en euros. Total : $1,250.00"
    assert Price.fromstring(melange).currency == "euro"
    lu = extract_amounts(melange, "fr")["amounts"][0]
    assert lu["currency"] is None  # « $ » ne désigne pas une seule monnaie
    assert lu["currency_candidates"][0] == "USD"


def test_verdict_loutil_de_reference_tranche_le_separateur_par_defaut():
    """
    R7 : son défaut décide, et il décide à mille près. Les deux lectures sont
    les siennes ; la fiche demande la déclaration au lieu d'en choisir une.
    """
    assert Price.fromstring("1,859 € le litre").amount == 1859
    assert Price.fromstring("1,859 € le litre", decimal_separator=",").amount_float == 1.859


def test_verdict_un_texte_a_plusieurs_montants_nen_rend_quun():
    assert Price.fromstring(DEVIS).amount == 1250.00
    assert [a["value"] for a in extract_amounts(DEVIS, "fr")["amounts"]] == [
        "1250.00", "125.00", "1125.00"]


# ---------------------------------------------------------------------------
# Les autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_la_convention_est_exigee_et_il_ny_a_pas_de_defaut():
    for convention in (None, "", "de", "FR"):
        rapport = extract_amounts(FACTURE, convention)
        assert rapport["amounts"] == []
        assert rapport["reason"] == "declare a convention among ['en', 'fr']"


def test_un_symbole_partage_nest_pas_tranche():
    lu = extract_amounts("$100", "en")["amounts"][0]
    assert lu["currency"] is None
    assert "USD" in lu["currency_candidates"] and "CAD" in lu["currency_candidates"]
    # Un code, lui, ne désigne qu'une monnaie.
    assert extract_amounts("USD 100", "en")["amounts"][0]["currency"] == "USD"


def test_la_marque_doit_toucher_le_nombre():
    assert extract_amounts(ENTETE, "fr")["amounts"] == []
    assert extract_amounts(ENTETE, "fr")["unmarked"] == 5
    # Le même document, la marque à côté du nombre.
    assert len(extract_amounts(ENTETE.replace("1 250,00", "1 250,00 €"), "fr")["amounts"]) == 1


def test_la_valeur_est_les_chiffres_ecrits_jamais_un_flottant():
    lus = extract_amounts("0,10 € + 0,20 €", "fr")["amounts"]
    assert [a["value"] for a in lus] == ["0.10", "0.20"]
    for a in lus:
        assert isinstance(a["value"], str)
    # Ce que cette fiche refuse de faire, et pourquoi.
    assert 0.10 + 0.20 != 0.30


def test_les_formes_de_nombre_connues_sont_lues():
    assert read_number("1.234.567,89", "fr") == ("1234567.89", False)
    assert read_number("1,234,567.89", "en") == ("1234567.89", False)
    assert read_number("1 234 567,89", "fr") == ("1234567.89", False)
    assert read_number("12", "fr") == ("12", False)
    assert read_number("1,2345", "fr") == ("1.2345", False)
    # Ce qui n'est pas un nombre revient nul, et n'est pas rendu comme montant.
    assert read_number("12 5", "fr") == (None, False)
    assert read_number("1,2345,6", "fr") == (None, False)
    assert extract_amounts("12 5 €", "fr")["amounts"] == []


def test_les_espaces_de_groupement_de_lecriture_francaise_sont_lues():
    for espace in (" ", " ", " "):
        lu = extract_amounts(f"1{espace}250,00 €", "fr")["amounts"][0]
        assert lu["value"] == "1250.00"
    # L'apostrophe suisse aussi.
    assert extract_amounts("CHF 1'234.50", "fr")["amounts"][0]["value"] == "1234.50"


def test_un_pourcentage_nest_pas_un_montant():
    assert extract_amounts("12,5 % de remise", "fr")["amounts"] == []


def test_aucune_entree_ne_leve():
    for entree in [None, 42, [], {}, b"octets", ""]:
        rapport = extract_amounts(entree, "fr")
        assert rapport["amounts"] == []
        if not isinstance(entree, str):
            assert rapport["reason"].startswith("expected text")


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_entree_banale_une_ligne_de_facture():
    """T5 : l'entrée ordinaire du public visé."""
    lu = extract_amounts(FACTURE, "fr")["amounts"][0]
    assert (lu["value"], lu["currency"], lu["mark"]) == ("1250.00", "EUR", "€")


def test_production_entree_vide():
    assert extract_amounts("", "fr") == {"amounts": [], "unmarked": 0, "reason": None}


def test_production_entree_tres_grande_et_terminaison_rapide():
    enorme = DEVIS * 2000
    debut = time.perf_counter()
    rapport = extract_amounts(enorme, "fr")
    assert time.perf_counter() - debut < 60.0
    assert len(rapport["amounts"]) == 6000


def test_production_encodages_inattendus():
    assert extract_amounts("1 250,00 €", "fr")["amounts"][0]["value"] == "1250.00"
    assert extract_amounts("﻿1 250,00 €", "fr")["amounts"][0]["value"] == "1250.00"
    assert extract_amounts("١٢٣ €", "fr")["amounts"] == []  # chiffres arabes


def test_production_valeurs_aux_limites():
    assert extract_amounts("£0.01", "en")["amounts"][0]["value"] == "0.01"
    grand = extract_amounts("9 999 999 999 €", "fr")["amounts"][0]
    assert grand["value"] == "9999999999"
    # Un nombre collé à son symbole, des deux côtés.
    assert extract_amounts("€1 250", "fr")["amounts"][0]["value"] == "1250"
    assert extract_amounts("1 250€", "fr")["amounts"][0]["value"] == "1250"


def test_production_un_nombre_illisible_nempeche_pas_de_lire_les_autres():
    """T8 : une forme que le niveau ne sait pas lire ne fait pas tomber le texte."""
    lus = extract_amounts("12 5 € puis 1 250,00 €", "fr")["amounts"]
    assert [a["value"] for a in lus] == ["1250.00"]


def test_production_la_lecture_tient_la_classe_de_latence_annoncee():
    """latency « ~10 ms » : mille lectures d'une facture sous une borne large."""
    debut = time.perf_counter()
    for _ in range(1000):
        extract_amounts(DEVIS, "fr")
    assert time.perf_counter() - debut < 20.0


# ---------------------------------------------------------------------------
# Parité entre les deux langages
# ---------------------------------------------------------------------------


def test_python_et_javascript_rendent_le_meme_rapport():
    """La fiche montre les deux extraits : elle affirme la même chose des deux."""
    node = shutil.which("node")
    assert node, "node est requis pour comparer les deux implémentations"
    cas = [(texte, convention) for texte in TOUS for convention in ("fr", "en")]
    attendu = [extract_amounts(t, c) for t, c in cas]
    script = (
        f"import {{ extractAmounts }} from {json.dumps((ICI / 'n0.js').as_uri())};"
        "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{"
        "process.stdout.write(JSON.stringify(JSON.parse(d)"
        ".map(([t,c])=>extractAmounts(t,c))));});"
    )
    sortie = subprocess.run([node, "--input-type=module", "-e", script],
                            input=json.dumps(cas), capture_output=True,
                            text=True, timeout=60, check=True)
    assert json.loads(sortie.stdout) == attendu
