import ast
import sys
import time
from pathlib import Path

import pytest

import n0
from n0 import FIELDS, STREET_TYPES, fold, normalise, parse

# Toutes les adresses sont inventées : aucune n'est le domicile d'une personne
# réelle ni le siège d'une société réelle.
EMPTY = dict.fromkeys(FIELDS, "")
LILAS = {"number": "8", "street_type": "rue", "street": "rue des Lilas", "postcode": "75011", "city": "Paris"}


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_un_complement_ecrit_apres_finit_dans_le_nom_de_la_rue():
    """« dans « 8 rue des Lilas Bâtiment C Appartement 12, 75011 Paris », le bâtiment et l'appartement finissent dans le nom de la rue »."""
    assert parse("8 rue des Lilas Bâtiment C Appartement 12, 75011 Paris") == {
        **LILAS, "street": "rue des Lilas Bâtiment C Appartement 12"}
    # Témoin : sans complément, l'adresse est découpée juste.
    assert parse("8 rue des Lilas, 75011 Paris") == LILAS


def test_point_de_rupture_un_complement_ecrit_devant_vide_le_numero():
    """« Écrit devant, le même complément fait pire : la ligne ne commence plus par un chiffre, le numéro revient vide »."""
    parsed = parse("Appartement 12, Bâtiment C, 8 rue des Lilas, 75011 Paris")
    assert parsed["number"] == "" and parsed["street_type"] == ""
    assert parsed["street"] == "Appartement 12 Bâtiment C 8 rue des Lilas"


@pytest.mark.xfail(
    strict=True,
    reason="INFIRMÉ : la fiche dit que « l'adresse entière passe en nom de rue » ; seule la ligne de voie y passe, "
    "le code postal et la ville sont bien lus",
)
def test_un_complement_ecrit_devant_fait_passer_l_adresse_entiere_en_nom_de_rue():
    parsed = parse("Appartement 12, Bâtiment C, 8 rue des Lilas, 75011 Paris")
    assert parsed["postcode"] == "" and "75011 Paris" in parsed["street"]


def test_point_de_rupture_hors_de_france_le_numero_allemand_reste_dans_la_rue():
    """« « Hauptstrasse 5, 10115 Berlin » laisse le numéro dans la rue »."""
    assert parse("Hauptstrasse 5, 10115 Berlin") == {
        "number": "", "street_type": "", "street": "Hauptstrasse 5", "postcode": "10115", "city": "Berlin"}


def test_point_de_rupture_une_adresse_britannique_ressort_sans_code_postal_ni_ville():
    """« « 42 Rowan Street, Bristol BS1 4TQ », sans suite de cinq chiffres, ressort sans code postal ni ville »."""
    assert parse("42 Rowan Street, Bristol BS1 4TQ") == {
        "number": "42", "street_type": "", "street": "Rowan Street Bristol BS1 4TQ", "postcode": "", "city": ""}


def test_point_de_rupture_la_ville_ecrite_d_abord_aspire_la_rue():
    """Test existant : « Town first: everything after the postcode is taken for the town. »"""
    parsed = parse("75011 Paris, 8 rue des Lilas")
    assert parsed["street"] == "" and parsed["city"] == "Paris 8 rue des Lilas"


# ---------------------------------------------------------------------------
# Autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_cinq_chiffres_coupent_une_adresse_en_deux():
    """« Cinq chiffres d'affilée coupent une adresse française en deux : ce qui précède est la voie, ce qui suit est la ville. »"""
    assert parse("3, Allée du Château\n33000 BORDEAUX")["city"] == "BORDEAUX"
    assert parse("8 rue des Lilas 7501 Paris")["postcode"] == ""  # quatre chiffres : pas d'ancre
    assert parse("8 rue des Lilas 750110 Paris")["postcode"] == ""  # six chiffres : pas d'ancre


def test_les_abreviations_tapees_ressortent_sous_une_seule_orthographe():
    """« les abréviations que les gens tapent vraiment — « av. », « bd », « imp. » — ressortent sous une seule orthographe canonique »."""
    assert parse("12 av. des Cerisiers 69003 Lyon")["street"] == "avenue des Cerisiers"
    assert parse("3 bd Voltaire 75011 Paris")["street"] == "boulevard Voltaire"
    assert parse("12 imp. des Roses 44000 Nantes")["street"] == "impasse des Roses"
    for written in ("12 av. des Cerisiers", "12 avenue des Cerisiers", "12 AV DES CERISIERS"):
        assert parse(f"{written} 69003 Lyon")["street_type"] == "avenue", written


@pytest.mark.xfail(
    strict=True,
    reason="DÉFAUT : « r » est dans le dictionnaire, mais après un numéro l'expression du numéro le prend pour "
    "un indice de répétition : « 8 r des Lilas » donne le numéro « 8 r » et aucune rue",
)
def test_defaut_l_abreviation_r_apres_un_numero_est_lue_comme_rue():
    assert STREET_TYPES["r"] == "rue"
    assert parse("8 r des Lilas 75011 Paris") == LILAS


def test_garde_l_indice_de_repetition_avec_le_numero():
    """Commentaire : « A house number, and the repetition index that may follow it: 8, 8 bis, 12B. »"""
    assert parse("12 bis rue des Lilas 75011 Paris")["number"] == "12 bis"
    assert parse("12 ter rue des Lilas 75011 Paris")["number"] == "12 ter"
    assert parse("12B rue des Lilas 75011 Paris")["number"] == "12 B"


@pytest.mark.xfail(
    strict=True,
    reason="INFIRMÉ : le commentaire justifie « le dernier code postal » par l'année qu'un nom de rue peut porter ; "
    "une année a quatre chiffres et ne peut jamais être prise pour un code postal",
)
def test_une_annee_dans_le_nom_de_rue_peut_etre_prise_pour_un_code_postal():
    assert n0.POSTCODE.findall("rue du 8 Mai 1945") != []


def test_une_annee_dans_le_nom_de_rue_reste_dans_la_rue():
    assert parse("8 rue du 8 Mai 1945, 75011 Paris")["street"] == "rue du 8 Mai 1945"


def test_lit_accents_casse_et_ponctuation():
    parsed = parse("3, Allée du Château\n33000 BORDEAUX")
    assert parsed["street_type"] == "allée" and parsed["street"] == "allée du Château" and parsed["city"] == "BORDEAUX"


def test_normalisation_et_repli():
    """normalise : « Reduce commas, line breaks and exotic spaces to a single plain space » ; fold : « Lowercase, drop the accents and the trailing dot »."""
    assert normalise("8 rue  des Lilas,\n75011 Paris") == "8 rue des Lilas 75011 Paris"
    assert fold("Av.") == "av" and fold("Allée") == "allee" and fold(".av") == ".av"


def test_chaque_champ_est_une_chaine_vide_quand_l_adresse_ne_le_porte_pas():
    """« Every field is a string, empty when the address does not carry it. »"""
    assert parse("") == EMPTY
    parsed = parse("Paris")
    assert set(parsed) == set(FIELDS) and all(isinstance(v, str) for v in parsed.values())


def test_garde_la_mention_cedex_avec_la_ville():
    assert parse("2 place des Tilleuls 31081 Toulouse Cedex 9")["city"] == "Toulouse Cedex 9"


def test_n0_est_deterministe_et_n_emploie_que_la_bibliotheque_standard():
    assert all(parse("8 rue des Lilas, 75011 Paris") == LILAS for _ in range(20))
    source = (Path(__file__).parent / "n0.py").read_text(encoding="utf-8")
    modules = set()
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, ast.Import):
            modules |= {alias.name.split(".")[0] for alias in node.names}
        elif isinstance(node, ast.ImportFrom):
            modules.add(node.module.split(".")[0])
    assert modules and modules <= set(sys.stdlib_module_names)


def test_une_adresse_se_decoupe_en_moins_d_une_milliseconde():
    runs = []
    for _ in range(5):
        start = time.perf_counter()
        for _ in range(100):
            parse("8 rue des Lilas, 75011 Paris")
        runs.append((time.perf_counter() - start) / 100)
    assert min(runs) < 0.001


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_une_adresse_de_trois_mille_caracteres_termine():
    start = time.perf_counter()
    parsed = parse("8 rue des Lilas Bâtiment C " * 120 + " 75011 Paris")
    assert time.perf_counter() - start < 1
    assert parsed["postcode"] == "75011"


def test_production_chiffres_pleine_largeur_espaces_insecables_nfd():
    assert parse("８ rue des Lilas ７５０１１ Paris") == LILAS
    assert parse("8 rue des Lilas 75011 Paris") == LILAS
    assert parse("3 Allée du Château 33000 Bordeaux")["street_type"] == "allée"


@pytest.mark.xfail(
    strict=True,
    reason="DÉFAUT : une marque d'ordre des octets en tête n'est retirée ni par NFKC ni par strip() ; le numéro revient vide "
    "et « \\ufeff8 rue des Lilas » passe en rue (JavaScript la retire avec trim())",
)
def test_defaut_une_marque_d_ordre_des_octets_ne_casse_pas_le_numero():
    assert parse("﻿8 rue des Lilas, 75011 Paris") == LILAS


@pytest.mark.xfail(
    strict=True,
    reason="DÉFAUT : une plage de numéros « 8-10 » donne le numéro « 8 » et la rue « -10 rue des Lilas », sans type de voie",
)
def test_defaut_une_plage_de_numeros_ne_passe_pas_dans_la_rue():
    parsed = parse("8-10 rue des Lilas 75011 Paris")
    assert parsed["street"] == "rue des Lilas" and parsed["street_type"] == "rue"
