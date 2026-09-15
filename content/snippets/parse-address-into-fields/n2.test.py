"""
Ces tests injectent un double local au lieu d'installer le vrai analyseur.

Ce qu'ils prouvent : le lot part en un appel, une adresse trop longue est refusée
avant toute analyse, un échec est retenté, le jeu d'étiquettes de l'analyseur est
ramené au nôtre. Ce qu'ils ne prouvent pas : que libpostal étiquette bien.
"""

import time
from collections import Counter

import pytest

import n2
from _harness.fake_model import FakeClassifier
from n2 import COMPONENTS as COMPONENT_MAP
from n2 import FIELDS, MAX_CHARACTERS, LibpostalParser, ParsingUnavailable, parse_addresses

# Adresses inventées, et les composants que libpostal rendrait, dans son propre
# vocabulaire. Les valeurs sont les nôtres : le test exerce notre correspondance.
FRENCH = "8 rue des Lilas, Appartement 12, 75011 Paris"
GERMAN = "Hauptstrasse 5, 10115 Berlin"
BRITISH = "42 Rowan Street, Bristol BS1 4TQ"

COMPONENTS = {
    FRENCH: {
        "house_number": "8",
        "road": "rue des lilas",
        "unit": "appartement 12",
        "postcode": "75011",
        "city": "paris",
    },
    GERMAN: {"house_number": "5", "road": "hauptstrasse", "postcode": "10115", "city": "berlin"},
    BRITISH: {"house_number": "42", "road": "rowan street", "postcode": "bs1 4tq", "city": "bristol"},
}

EMPTY = dict.fromkeys(FIELDS, "")


# ---------------------------------------------------------------------------
# Point de rupture (plomberie)
# ---------------------------------------------------------------------------


def test_point_de_rupture_une_ligne_qui_n_est_pas_une_adresse_ressort_en_champs():
    """
    « Une ligne qui n'est pas une adresse — « the meeting is at ten in room four » —
    ressort avec un numéro et une rue ». Les étiquettes sont écrites par le test ;
    ce qui est démontré, c'est que le code les rend telles quelles.
    """
    nonsense = "the meeting is at ten in room four"
    parser = FakeClassifier({nonsense: {"house_number": "ten", "road": "room four"}})
    assert parse_addresses([nonsense], parser) == [{**EMPTY, "number": "ten", "street": "room four"}]


def test_point_de_rupture_un_code_postal_d_une_autre_ville_ressort_en_champs_propres():
    """« « 8 rue des Lilas, 75011 Lyon » […] ressort en champs propres. L'analyseur ne rend ni score ni refus. »"""
    wrong_town = "8 rue des Lilas, 75011 Lyon"
    parser = FakeClassifier({wrong_town: {"house_number": "8", "road": "rue des lilas", "postcode": "75011", "city": "lyon"}})
    wrong = parse_addresses([wrong_town], parser)[0]
    right = parse_addresses([FRENCH], FakeClassifier(COMPONENTS))[0]
    # « rien, dans le code, ne distingue ce résultat d'un bon » : même forme, aucun champ de confiance.
    assert set(wrong) == set(right) == set(FIELDS)
    assert wrong == {**EMPTY, "number": "8", "street": "rue des lilas", "postcode": "75011", "city": "lyon"}


# ---------------------------------------------------------------------------
# Autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_decoupe_une_adresse_dans_nos_champs():
    assert parse_addresses([FRENCH], FakeClassifier(COMPONENTS)) == [
        {"number": "8", "street": "rue des lilas", "complement": "appartement 12", "postcode": "75011", "city": "paris"}]


def test_lit_les_adresses_etrangeres_qui_cassaient_les_niveaux_du_dessous():
    german, british = parse_addresses([GERMAN, BRITISH], FakeClassifier(COMPONENTS))
    assert german["number"] == "5" and german["street"] == "hauptstrasse"
    assert british["postcode"] == "bs1 4tq" and british["city"] == "bristol"


def test_le_lot_entier_part_en_un_appel():
    parser = FakeClassifier(COMPONENTS)
    parse_addresses([FRENCH, GERMAN, BRITISH], parser)
    assert parser.calls == [[FRENCH, GERMAN, BRITISH]]


@pytest.mark.xfail(
    strict=True,
    reason="INFIRMÉ : la docstring dit qu'« un lot de cent est un seul passage » dans le modèle ; "
    "LibpostalParser.predict appelle parse_address une fois par adresse, cent appels pour cent adresses",
)
def test_un_lot_de_cent_adresses_est_un_seul_passage_dans_le_modele():
    calls = []
    parser = object.__new__(LibpostalParser)
    parser._parse_address = lambda address: calls.append(address) or [("8", "house_number")]
    parse_addresses([f"{i} rue des Lilas" for i in range(100)], parser)
    assert len(calls) == 1


def test_predict_fusionne_les_paires_valeur_etiquette_et_les_etiquettes_repetees():
    """« libpostal yields (value, label) pairs, and repeats a label freely » ; « One label-to-value mapping per address, in the order given »."""
    parser = object.__new__(LibpostalParser)
    parser._parse_address = lambda address: [("8", "house_number"), ("bâtiment c", "unit"), ("appartement 12", "unit")]
    assert parser.predict(["a", "b"]) == [{"house_number": "8", "unit": "bâtiment c appartement 12"}] * 2
    assert parse_addresses(["a"], parser) == [{**EMPTY, "number": "8", "complement": "bâtiment c appartement 12"}]


def test_les_etiquettes_qui_partagent_un_champ_sont_jointes_le_reste_est_ecarte():
    """« everything unmapped is dropped on purpose »."""
    parser = FakeClassifier({FRENCH: {"level": "étage 3", "unit": "porte b", "staircase": "escalier a", "entrance": "entrée 2",
                                      "house": "résidence les ormes", "country": "france", "po_box": "bp 12", "suburb": "x"}})
    parsed = parse_addresses([FRENCH], parser)[0]
    assert parsed == {**EMPTY, "complement": "étage 3 porte b escalier a entrée 2"}


@pytest.mark.xfail(
    strict=True,
    reason="INFIRMÉ : le commentaire dit que deux étiquettes de libpostal peuvent tomber dans un de nos champs ; "
    "quatre tombent dans complement (unit, level, staircase, entrance)",
)
def test_deux_etiquettes_seulement_partagent_un_champ():
    shared = Counter(COMPONENT_MAP.values())
    assert max(shared.values()) == 2


def test_une_valeur_vide_blanche_ou_non_textuelle_est_ecartee():
    parser = FakeClassifier({FRENCH: {"house_number": 8, "road": "   ", "postcode": None, "city": "paris"}})
    assert parse_addresses([FRENCH], parser)[0] == {**EMPTY, "city": "paris"}


def test_une_reponse_vide_donne_des_champs_vides_plutot_qu_une_erreur():
    assert parse_addresses([FRENCH], FakeClassifier({FRENCH: {}})) == [EMPTY]
    assert parse_addresses([FRENCH], FakeClassifier({FRENCH: None})) == [EMPTY]


def test_un_lot_vide_n_atteint_jamais_l_analyseur():
    parser = FakeClassifier(COMPONENTS)
    assert parse_addresses([], parser) == [] and parser.calls == []


def test_refuse_une_adresse_trop_longue_avant_d_analyser_quoi_que_ce_soit():
    parser = FakeClassifier({}, default={"city": "paris"})
    with pytest.raises(ValueError, match="300"):
        parse_addresses([FRENCH, "x" * (MAX_CHARACTERS + 1)], parser)
    assert parser.calls == []
    assert parse_addresses(["x" * MAX_CHARACTERS], parser)[0]["city"] == "paris"


def test_un_echec_est_retente_une_fois_pas_davantage():
    """« Retry once » : deux essais au total, puis ParsingUnavailable."""
    class Failing:
        def __init__(self, failures):
            self.calls, self.failures = 0, failures

        def predict(self, addresses):
            self.calls += 1
            if self.calls <= self.failures:
                raise MemoryError("model not loaded")
            return [COMPONENTS[a] for a in addresses]

    once = Failing(1)
    assert parse_addresses([FRENCH], once)[0]["postcode"] == "75011" and once.calls == 2
    always = Failing(10)
    with pytest.raises(ParsingUnavailable, match="model not loaded"):
        parse_addresses([FRENCH], always)
    assert always.calls == 2


@pytest.mark.xfail(
    strict=True,
    reason="INFIRMÉ : le commentaire dit « Retry once: loading the data files is the call that fails » ; le chargement a lieu "
    "dans LibpostalParser(), avant la boucle de réessai, et son échec sort brut, sans réessai ni ParsingUnavailable",
)
def test_le_chargement_des_fichiers_de_donnees_est_retente(monkeypatch):
    loads = []

    class FlakyLoad:
        def __init__(self):
            loads.append(1)
            if len(loads) == 1:
                raise MemoryError("data files could not be mapped")

        def predict(self, addresses):
            return [COMPONENTS[a] for a in addresses]

    monkeypatch.setattr(n2, "LibpostalParser", FlakyLoad)
    assert parse_addresses([FRENCH])[0]["postcode"] == "75011"


def test_une_reponse_de_mauvaise_longueur_leve():
    class Truncating:
        def predict(self, addresses):
            return [COMPONENTS[FRENCH]]

    with pytest.raises(ParsingUnavailable):
        parse_addresses([FRENCH, GERMAN], Truncating())


def test_l_analyseur_est_injecte_et_par_defaut_c_est_le_vrai():
    """« `parser` is injected so this can be tested without installing the model. »"""
    with pytest.raises(ModuleNotFoundError, match="postal"):
        parse_addresses([FRENCH])


@pytest.mark.xfail(
    strict=True,
    reason="DÉFAUT : une ligne d'un autre type (les paires brutes de parse_address au lieu d'un dictionnaire) lève "
    "AttributeError au lieu de ParsingUnavailable",
)
def test_defaut_une_ligne_d_un_autre_type_leve_l_erreur_nommee():
    parser = FakeClassifier({FRENCH: [("8", "house_number"), ("rue des lilas", "road")]})
    with pytest.raises(ParsingUnavailable):
        parse_addresses([FRENCH], parser)


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_mille_adresses_en_un_lot():
    parser = FakeClassifier({}, default={"house_number": "8", "city": "paris"})
    start = time.perf_counter()
    rows = parse_addresses([f"{i} rue des Lilas" for i in range(1000)], parser)
    assert time.perf_counter() - start < 2 and len(rows) == 1000 and len(parser.calls) == 1


def test_production_accents_nfd_emoji_et_trois_cents_points_de_code():
    parser = FakeClassifier({}, default={"city": "paris"})
    batch = ["3 Allée du Château", "🏠 8 rue des Lilas", "﻿8 rue des Lilas", "🏠" * MAX_CHARACTERS]
    assert [r["city"] for r in parse_addresses(batch, parser)] == ["paris"] * 4
    assert parser.calls == [batch]
