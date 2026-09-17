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
LILAS = {"number": "8", "street_type": "rue", "street": "rue des Lilas", "complement": "",
         "postcode": "75011", "city": "Paris"}


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_un_complement_ecrit_apres_la_voie_sort_dans_son_champ():
    """docstring : « The complement is the part the postal standard puts on lines of its own »."""
    assert parse("8 rue des Lilas Bâtiment C Appartement 12, 75011 Paris") == {
        **LILAS, "complement": "Bâtiment C Appartement 12"}
    assert parse("8 rue des Lilas Bât C Apt 12, 75011 Paris") == {
        **LILAS, "complement": "Bât C Apt 12"}
    # Témoin : sans complément, l'adresse est découpée juste, et le champ est vide.
    assert parse("8 rue des Lilas, 75011 Paris") == LILAS


def test_un_complement_ecrit_devant_la_voie_sort_aussi_dans_son_champ():
    """`_cut_complement` : « Found at the start, it closes on the first house number or street type that follows »."""
    assert parse("Appartement 12, Bâtiment C, 8 rue des Lilas, 75011 Paris") == {
        **LILAS, "complement": "Appartement 12 Bâtiment C"}
    assert parse("Résidence du Parc, 3 rue de la Paix, 75002 Paris") == {
        "number": "3", "street_type": "rue", "street": "rue de la Paix",
        "complement": "Résidence du Parc", "postcode": "75002", "city": "Paris"}


def test_un_complement_seul_sans_voie_occupe_toute_la_ligne():
    """`_cut_complement` : « Found at the start with nothing after it that looks like a street, the whole line is the complement »."""
    assert parse("Lieu-dit Les Granges 24200 Sarlat-la-Canéda") == {
        "number": "", "street_type": "", "street": "", "complement": "Lieu-dit Les Granges",
        "postcode": "24200", "city": "Sarlat-la-Canéda"}


def test_les_adresses_ordinaires_que_le_niveau_recommande_doit_lire_juste():
    """
    Entrée ordinaire de la population visée (règle T5) : une rue au nom d'une
    personne, une ville à trait d'union, une abréviation de type de voie, un
    CEDEX.
    """
    assert parse("15 rue Victor Hugo 92100 Boulogne-Billancourt") == {
        "number": "15", "street_type": "rue", "street": "rue Victor Hugo", "complement": "",
        "postcode": "92100", "city": "Boulogne-Billancourt"}
    assert parse("10 bd Saint-Michel 75005 Paris") == {
        "number": "10", "street_type": "boulevard", "street": "boulevard Saint-Michel",
        "complement": "", "postcode": "75005", "city": "Paris"}
    assert parse("3 rue de la République, CEDEX 5, 69002 Lyon") == {
        "number": "3", "street_type": "rue", "street": "rue de la République",
        "complement": "CEDEX 5", "postcode": "69002", "city": "Lyon"}


def test_point_de_rupture_hors_de_france_le_numero_allemand_reste_dans_la_rue():
    """« « Hauptstrasse 5, 10115 Berlin » laisse le numéro dans la rue »."""
    assert parse("Hauptstrasse 5, 10115 Berlin") == {
        "number": "", "street_type": "", "street": "Hauptstrasse 5", "complement": "",
        "postcode": "10115", "city": "Berlin"}


def test_point_de_rupture_une_adresse_britannique_ressort_sans_code_postal_ni_ville():
    """« « 42 Rowan Street, Bristol BS1 4TQ », sans suite de cinq chiffres, ressort sans code postal ni ville »."""
    assert parse("42 Rowan Street, Bristol BS1 4TQ") == {
        "number": "42", "street_type": "", "street": "Rowan Street Bristol BS1 4TQ",
        "complement": "", "postcode": "", "city": ""}


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


def test_une_lettre_isolee_n_est_un_indice_que_collee_au_numero_le_r_reste_un_type_de_voie():
    """Commentaire : « A lone letter counts only when it touches the number, so the "r" of "8 r des Lilas" stays a street type. »"""
    assert STREET_TYPES["r"] == "rue"
    assert parse("8 r des Lilas 75011 Paris") == LILAS
    assert parse("8 r. des Lilas 75011 Paris") == LILAS
    assert parse("12b rue des Lilas 75011 Paris")["number"] == "12 b"
    # Décision du rédacteur : une lettre séparée du numéro passe dans la voie, qui perd son type.
    assert parse("12 B rue des Lilas 75011 Paris") == {
        "number": "12", "street_type": "", "street": "B rue des Lilas", "complement": "",
        "postcode": "75011", "city": "Paris"}


def test_garde_l_indice_de_repetition_et_la_plage_avec_le_numero():
    """Commentaire : « A house number or a range of them, and the repetition index that may follow: 8, 8-10, 8 bis, 12B. »"""
    assert parse("12 bis rue des Lilas 75011 Paris")["number"] == "12 bis"
    assert parse("12 ter rue des Lilas 75011 Paris")["number"] == "12 ter"
    assert parse("8 quater rue des Lilas 75011 Paris")["number"] == "8 quater"
    assert parse("8bis rue des Lilas 75011 Paris")["number"] == "8 bis"
    assert parse("12B rue des Lilas 75011 Paris")["number"] == "12 B"
    assert parse("8-10 rue des Lilas 75011 Paris") == {**LILAS, "number": "8-10"}
    assert parse("8-10bis rue des Lilas 75011 Paris")["number"] == "8-10 bis"
    # Témoin : « ter » au début d'un mot plus long n'est pas un indice.
    assert parse("8 Terrasse des Lilas 75011 Paris")["street"] == "Terrasse des Lilas"


def test_un_nombre_de_cinq_chiffres_place_avant_le_vrai_code_postal_n_est_pas_pris():
    """Commentaire : « Take the last run of five digits […] a five-digit number earlier in the line is not taken for the postcode. »"""
    parsed = parse("BP 40012, 8 rue des Lilas, 75011 Paris")
    assert parsed["postcode"] == "75011" and parsed["city"] == "Paris"
    # « BP » est un mot du dictionnaire de compléments : la boîte postale sort là.
    assert parsed["complement"] == "BP 40012" and parsed["street"] == "rue des Lilas"


def test_un_mot_de_complement_dans_un_nom_de_rue_reste_dans_la_rue():
    """`_cut_complement` : « Without that condition "rue de la Porte Maillot" would lose half its name to the word "Porte" »."""
    parsed = parse("8 rue de la Porte Maillot 75017 Paris")
    assert parsed["street"] == "rue de la Porte Maillot" and parsed["complement"] == ""
    # Témoin : le même mot suivi d'un numéro, lui, ouvre bien un complément.
    assert parse("8 rue des Lilas Porte 4 75011 Paris")["complement"] == "Porte 4"


def test_une_annee_dans_le_nom_de_rue_reste_dans_la_rue():
    assert parse("8 rue du 8 Mai 1945, 75011 Paris")["street"] == "rue du 8 Mai 1945"


def test_lit_accents_casse_et_ponctuation():
    parsed = parse("3, Allée du Château\n33000 BORDEAUX")
    assert parsed["street_type"] == "allée" and parsed["street"] == "allée du Château" and parsed["city"] == "BORDEAUX"


def test_normalisation_et_repli():
    """normalise : « Reduce commas, line breaks, exotic spaces and byte order marks to a single plain space » ; fold : « Lowercase, drop the accents and the trailing dot »."""
    assert normalise("8 rue  des Lilas,\n75011\u00a0Paris") == "8 rue des Lilas 75011 Paris"
    assert normalise("\ufeff8 rue des\ufeffLilas\u2009 75011 Paris") == "8 rue des Lilas 75011 Paris"
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


def test_production_une_marque_d_ordre_des_octets_ne_casse_pas_le_numero():
    assert parse("\ufeff8 rue des Lilas, 75011 Paris") == LILAS
    assert parse("8 rue des\ufeffLilas 75011 Paris") == LILAS


def test_production_une_plage_de_numeros_ne_passe_pas_dans_la_rue():
    parsed = parse("8-10 rue des Lilas 75011 Paris")
    assert parsed["street"] == "rue des Lilas" and parsed["street_type"] == "rue"
    assert parse("1234-5678 rue X 75011 Paris")["number"] == "1234-5678"
    # Une plage écrite avec des espaces n'est pas reconnue : « - 10 » passe dans la voie.
    assert parse("8 - 10 rue des Lilas 75011 Paris") == {
        "number": "8", "street_type": "", "street": "- 10 rue des Lilas", "complement": "",
        "postcode": "75011", "city": "Paris"}
