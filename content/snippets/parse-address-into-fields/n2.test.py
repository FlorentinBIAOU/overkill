"""
Ces tests injectent un double local au lieu d'installer le vrai analyseur.

Ce qu'ils prouvent : le lot part en un appel, une adresse trop longue est refusée
avant toute analyse, un échec est retenté, le jeu d'étiquettes de l'analyseur est
ramené au nôtre. Ce qu'ils ne prouvent pas : que libpostal étiquette bien.
"""

import sys
import textwrap
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
    « Si une ligne qui n'est pas une adresse — « the meeting is at ten in room four » — revient étiquetée en
    numéro et en rue […] — deux réponses que le test simule —, rien dans le code ne distingue ce résultat d'un bon. »
    """
    nonsense = "the meeting is at ten in room four"
    parser = FakeClassifier({nonsense: {"house_number": "ten", "road": "room four"}})
    assert parse_addresses([nonsense], parser) == [{**EMPTY, "number": "ten", "street": "room four"}]


def test_point_de_rupture_libpostal_rend_des_etiquettes_ni_score_ni_refus():
    """« libpostal rend des étiquettes, ni score ni refus » : ce que `predict` garde d'une réponse, ce sont des paires."""
    parser = object.__new__(LibpostalParser)
    parser._parse_address = lambda address: [("ten", "house_number"), ("room four", "road")]
    assert parser.predict(["the meeting is at ten in room four"]) == [{"house_number": "ten", "road": "room four"}]


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


def test_libpostal_n_a_pas_de_lots_predict_analyse_les_adresses_l_une_apres_l_autre():
    """« The whole batch goes to the parser object in one call, but libpostal has no batching: `LibpostalParser.predict` parses the addresses one after the other. »"""
    calls = []
    parser = object.__new__(LibpostalParser)
    parser._parse_address = lambda address: calls.append(address) or [("8", "house_number")]
    batch = [f"{i} rue des Lilas" for i in range(100)]
    assert len(parse_addresses(batch, parser)) == 100
    assert calls == batch


def test_predict_fusionne_les_paires_valeur_etiquette_et_les_etiquettes_repetees():
    """« libpostal yields (value, label) pairs, and repeats a label freely » ; « One label-to-value mapping per address, in the order given »."""
    parser = object.__new__(LibpostalParser)
    parser._parse_address = lambda address: [("8", "house_number"), ("bâtiment c", "unit"), ("appartement 12", "unit")]
    assert parser.predict(["a", "b"]) == [{"house_number": "8", "unit": "bâtiment c appartement 12"}] * 2
    assert parse_addresses(["a"], parser) == [{**EMPTY, "number": "8", "complement": "bâtiment c appartement 12"}]


def test_les_etiquettes_qui_partagent_un_champ_sont_jointes_le_reste_est_ecarte():
    """« everything unmapped is dropped on purpose » ; « "house" among them »."""
    parser = FakeClassifier({FRENCH: {"level": "étage 3", "unit": "porte b", "staircase": "escalier a", "entrance": "entrée 2",
                                      "house": "résidence les ormes", "country": "france", "po_box": "bp 12", "suburb": "x"}})
    parsed = parse_addresses([FRENCH], parser)[0]
    assert parsed == {**EMPTY, "complement": "étage 3 porte b escalier a entrée 2 résidence les ormes"}


def test_cinq_etiquettes_tombent_dans_le_complement_house_parmi_elles():
    """Commentaire : « Five of its labels land in our complement, "house" among them ». Les autres champs n'en reçoivent qu'une."""
    shared = Counter(COMPONENT_MAP.values())
    assert shared == {"complement": 5, "number": 1, "street": 1, "postcode": 1, "city": 1}
    assert COMPONENT_MAP["house"] == "complement"


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
    # Sans analyseur injecté non plus : le refus précède le chargement.
    with pytest.raises(ValueError, match="300"):
        parse_addresses(["x" * (MAX_CHARACTERS + 1)])


@pytest.mark.xfail(
    strict=True,
    reason="INFIRMÉ : le commentaire dit que La Poste permet six lignes de 38 caractères et que tout ce qui est plus long "
    "est refusé ; le plafond vaut 300, et une adresse de 239 caractères (six lignes pleines séparées par « , », plus un) passe",
)
def test_une_adresse_plus_longue_que_six_lignes_de_trente_huit_caracteres_est_refusee():
    parser = FakeClassifier({}, default={"city": "paris"})
    six_lignes = ", ".join(["x" * 38] * 6)
    assert len(six_lignes) == 238
    with pytest.raises(ValueError):
        parse_addresses([six_lignes + "x"], parser)


def test_un_echec_est_retente_une_fois_pas_davantage():
    """« Retry a failed parse once » : deux essais au total, puis ParsingUnavailable."""
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


def test_le_chargement_n_est_pas_retente_son_erreur_sort_telle_quelle(monkeypatch):
    """« Loading is not retried: a parser that cannot load its data files fails before this point, with its own error. »"""
    loads = []

    class FlakyLoad:
        def __init__(self):
            loads.append(1)
            if len(loads) == 1:
                raise MemoryError("data files could not be mapped")

        def predict(self, addresses):
            return [COMPONENTS[a] for a in addresses]

    monkeypatch.setattr(n2, "LibpostalParser", FlakyLoad)
    with pytest.raises(MemoryError, match="data files could not be mapped"):
        parse_addresses([FRENCH])
    assert len(loads) == 1


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


def test_par_defaut_la_bibliotheque_est_chargee_une_fois_par_processus_a_l_import(tmp_path, monkeypatch):
    """
    « The real parser: a C library and its data files, loaded once per process on import. » Double du paquet
    `postal` écrit sur disque : son module compte ses exécutions.
    """
    package = tmp_path / "postal"
    package.mkdir()
    (package / "__init__.py").write_text("")
    (package / "parser.py").write_text(textwrap.dedent('''
        import builtins
        builtins.postal_loads = getattr(builtins, "postal_loads", 0) + 1

        def parse_address(address):
            return [("8", "house_number"), ("rue des lilas", "road"), ("bâtiment c", "house"), ("75011", "postcode"), ("paris", "city")]
    '''))
    monkeypatch.syspath_prepend(str(tmp_path))
    for name in ("postal", "postal.parser"):
        monkeypatch.delitem(sys.modules, name, raising=False)
    import builtins
    monkeypatch.setattr(builtins, "postal_loads", 0, raising=False)
    expected = {"number": "8", "street": "rue des lilas", "complement": "bâtiment c", "postcode": "75011", "city": "paris"}
    assert parse_addresses([FRENCH]) == [expected]
    assert parse_addresses([FRENCH, GERMAN]) == [expected, expected]
    assert builtins.postal_loads == 1
    for name in ("postal", "postal.parser"):
        sys.modules.pop(name, None)


def test_production_une_ligne_d_un_autre_type_leve_l_erreur_nommee():
    """`None` reste une réponse vide ; une liste, une chaîne, un nombre lèvent ParsingUnavailable."""
    for row in ([("8", "house_number"), ("rue des lilas", "road")], "8 rue des lilas", 8):
        parser = FakeClassifier({FRENCH: row})
        with pytest.raises(ParsingUnavailable, match="not a mapping"):
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
    batch = ["3 Allée du Château", "🏠 8 rue des Lilas", "\ufeff8 rue des Lilas", "🏠" * MAX_CHARACTERS]
    assert [r["city"] for r in parse_addresses(batch, parser)] == ["paris"] * 4
    assert parser.calls == [batch]
    with pytest.raises(ValueError):
        parse_addresses(["🏠" * (MAX_CHARACTERS + 1)], parser)
