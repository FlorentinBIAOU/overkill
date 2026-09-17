"""
Tests du niveau N1 : inférence du type de colonne par régression logistique.

Les colonnes étiquetées vivent ici, jamais dans l'extrait : vingt et une
colonnes, ce que produit un après-midi d'étiquetage.
"""

import ast
import time
import unicodedata
from pathlib import Path

import pytest

from n0 import clean_csv
from n1 import FEATURE_NAMES, LONG_VALUE, classify, column_features, infer_schema, train

LABELLED = {
    "integer": [
        ["1", "2", "3", "4", "5", "6"],
        ["1024", "2048", "4096", "8192"],
        ["12", "7", "103", "5", "88", "41"],
        ["-3", "14", "0", "27", "5"],
    ],
    "number": [
        ["1.5", "2.75", "3.0", "4.25"],
        ["12,50", "0,99", "1234,56", "7,10"],
        ["-0.5", "10.25", "3.75", "0.1"],
        ["100.0", "250.5", "99.99", "12.30"],
    ],
    "date": [
        ["2023-04-12", "2023-05-01", "2024-01-09"],
        ["01/05/2023", "12/11/2022", "30/06/2021"],
        ["09.01.2024", "28.02.2023", "15.07.2022"],
        ["2020-12-31", "2021-01-01", "2022-06-15", "2023-03-03"],
    ],
    "boolean": [
        ["yes", "no", "yes", "no", "yes"],
        ["true", "false", "true", "true", "false"],
        ["0", "1", "1", "0", "1", "0"],
        ["oui", "non", "oui", "non"],
    ],
    "text": [
        ["Alice", "Bob", "Carol", "Dan"],
        ["Paris", "Lyon", "Marseille", "Lille"],
        ["a short note", "another note here", "something else entirely"],
        ["AB1", "CD2", "EF3", "GH4"],
        ["thé vert", "café au lait", "jus d'orange"],
    ],
}

COLUMNS = [column for kind in LABELLED for column in LABELLED[kind]]
LABELS = [kind for kind in LABELLED for _ in LABELLED[kind]]

HEADER = ["id", "name", "joined", "amount", "active"]
ROWS = [
    ["1", "Alice", "2023-04-12", "12.50", "yes"],
    ["2", "Bob", "2023-05-01", "3.99", "no"],
    ["3", "Carol", "2023-06-30", "120.00", "yes"],
    ["4", "Dan", "2023-07-14", "7.25", "no"],
    ["5", "Eve", "2023-08-02", "45.10", "yes"],
]


MODEL = train(COLUMNS, LABELS)


def repeat(values, n):
    return [values[i % len(values)] for i in range(n)]


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_un_identifiant_fait_de_chiffres():
    """
    « Une colonne de codes postaux — 01000, 06400, 75014 — a tous les traits
    d'une colonne d'entiers, le classifieur répond « integer », et la
    coercition de N0 rend 1000 et 6400. […] rien n'est rejeté » (existant, complété).
    """
    postcodes = ["01000", "06400", "75014", "02100", "13008"]
    assert classify(MODEL, postcodes) == "integer"
    result = clean_csv(b"postcode\n01000\n06400\n75014\n", {"postcode": classify(MODEL, postcodes)})
    assert result["rejects"] == []
    assert [row["postcode"] for row in result["rows"]] == [1000, 6400, 75014]
    # Témoin : les mêmes codes portant une lettre sont du texte, et gardent leur zéro.
    lettered = ["F-01000", "F-06400", "F-75014", "F-02100", "F-13008"]
    assert classify(MODEL, lettered) == "text"
    assert clean_csv(b"postcode\nF-01000\n", {"postcode": "text"})["rows"] == [{"postcode": "F-01000"}]


# ---------------------------------------------------------------------------
# Nom, docstring, commentaires
# ---------------------------------------------------------------------------


def test_n1_est_une_regression_logistique_de_bibliotheque():
    """name « par régression logistique sur des traits d'échantillon » ; risks `vendor_lock: library`."""
    assert type(MODEL).__name__ == "LogisticRegression"
    assert list(MODEL.classes_) == ["boolean", "date", "integer", "number", "text"]
    source = ast.parse(Path(__file__).with_name("n1.py").read_text(encoding="utf-8"))
    modules = {a.name for n in ast.walk(source) if isinstance(n, ast.Import) for a in n.names}
    modules |= {n.module.split(".")[0] for n in ast.walk(source) if isinstance(n, ast.ImportFrom)}
    assert modules == {"re", "numpy", "sklearn"}


def test_infere_le_schema_d_un_fichier_que_personne_n_a_documente():
    """Existant."""
    assert infer_schema(MODEL, HEADER, ROWS) == {
        "id": "integer", "name": "text", "joined": "date", "amount": "number", "active": "boolean",
    }


def test_le_schema_infere_est_celui_que_n0_prend():
    """« The output is exactly the schema `clean_csv` of rung N0 takes as its second argument » (existant)."""
    data = (
        "id,name,joined,amount,active\n"
        "1,Alice,2023-04-12,12.50,yes\n"
        "2,Bob,2023-05-01,3.99,no\n"
        "3,Carol,2023-06-30,120.00,yes\n"
        "4,Dan,2023-07-14,7.25,no\n"
        "5,Eve,2023-08-02,45.10,yes\n"
    ).encode("utf-8")
    result = clean_csv(data, infer_schema(MODEL, HEADER, ROWS))
    assert result["rejects"] == []
    assert result["rows"][0] == {"id": 1, "name": "Alice", "joined": "2023-04-12", "amount": 12.50, "active": True}


def test_huit_traits_tous_entre_zero_et_un():
    """« Describe one column with eight numbers, all between zero and one » (existant, complété)."""
    features = column_features(["12", "7", "103"])
    assert len(features) == len(FEATURE_NAMES) == 8
    assert all(0.0 <= value <= 1.0 for value in features)
    assert features[0] == 1.0 and features[3] == 0.0
    long_text = column_features(["x" * 500, "y" * 800])
    assert long_text[6] == 1.0  # LONG_VALUE : la longueur moyenne plafonne à un
    assert column_features(["x" * LONG_VALUE])[6] == 1.0
    assert column_features(["x" * (LONG_VALUE // 2)])[6] == 0.5


def test_les_traits_de_forme_ne_dependent_pas_de_la_taille_de_l_echantillon():
    """« Every trait is a proportion rather than a count » : vrai pour les cinq traits de forme (existant)."""
    features = column_features(["12", "7", "103"])
    deeper = column_features(["12", "7", "103", "44", "9", "271"])
    assert deeper[:5] == features[:5]


def test_la_part_de_valeurs_distinctes_baisse_avec_l_echantillon():
    """`column_features` : « Small integers repeated, 0 to 3, read as integer on eight rows and as boolean on two hundred, and rung N0 then refuses every 2 and every 3 »."""
    assert classify(MODEL, repeat(["0", "1", "2", "3"], 8)) == "integer"
    assert classify(MODEL, repeat(["0", "1", "2", "3"], 200)) == "boolean"
    # Et le journal de N0 le paie, comme la docstring l'annonce.
    data = ("flag\n" + "\n".join(repeat(["0", "1", "2", "3"], 200)) + "\n").encode("utf-8")
    rejects = clean_csv(data, {"flag": "boolean"})["rejects"]
    assert len(rejects) == 100
    assert {r["reason"] for r in rejects} == {"not a true or false value"}


def test_les_valeurs_vides_sont_mises_de_cote_et_comptees_a_part():
    """« Blank values are set aside before the proportions are taken, and counted separately »."""
    assert column_features(["2023-04-12", "", "  ", "2024-01-09"])[:7] == column_features(["2023-04-12", "2024-01-09"])[:7]
    assert column_features(["2023-04-12", "", "  ", "2024-01-09"])[7] == 0.5


def test_les_colonnes_ou_il_n_y_a_presque_rien():
    """`classify` : « A column with nothing in it is text, and the model is not consulted » (existant, complété)."""
    assert classify(None, ["", "  ", ""]) == "text"
    assert classify(None, []) == "text"
    assert classify(MODEL, ["2023-04-12", "", "", "2024-01-09", ""]) == "date"
    assert classify(MODEL, ["2023-04-12"]) == "date"


def test_seules_les_deux_cents_premieres_lignes_sont_lues():
    """`infer_schema` : « whole amounts on the first two hundred rows and decimals after give integer, and rung N0 then refuses every decimal »."""
    rows = [[str(i)] for i in range(1, 201)] + [["12.50"]] * 50
    assert infer_schema(MODEL, ["amount"], rows) == {"amount": "integer"}
    assert infer_schema(MODEL, ["amount"], rows[150:]) == {"amount": "number"}
    data = ("amount\n" + "\n".join(row[0] for row in rows) + "\n").encode("utf-8")
    rejects = clean_csv(data, infer_schema(MODEL, ["amount"], rows))["rejects"]
    assert len(rejects) == 50
    assert {r["reason"] for r in rejects} == {"not an integer"}


def test_l_echantillon_est_de_deux_cents_lignes_et_les_lignes_courtes_comptent_vide():
    rows = [["1", "Alice"], ["2"]] + [["x", "y"]] * 300
    assert infer_schema(MODEL, ["id", "name"], rows[:2]) == {"id": "integer", "name": "text"}
    assert infer_schema(MODEL, ["id"], [[str(i)] for i in range(200)] + [["abc"]] * 1000) == {"id": "integer"}


def test_n1_est_deterministe():
    """risks `deterministic: true`."""
    again = train(COLUMNS, LABELS)
    assert (again.coef_ == MODEL.coef_).all()
    assert infer_schema(again, HEADER, ROWS) == infer_schema(MODEL, HEADER, ROWS)


def test_le_fichier_nominal_s_infere_sous_la_milliseconde():
    """latency « <1 ms », mesurée sur le fichier nominal des tests, comme N0."""
    best = float("inf")
    for _ in range(3):
        start = time.perf_counter()
        infer_schema(MODEL, HEADER, ROWS)
        best = min(best, time.perf_counter() - start)
    # Marge de dix sur la classe déclarée : la borne attrape un effondrement,
    # elle ne mesure pas.
    assert best < 0.010, f"{best * 1000:.3f} ms"


def test_production_deux_cents_colonnes_terminent_dans_une_borne_large():
    """Cent fois le cas nominal : la borne attrape un algorithme quadratique caché, pas une classe de latence."""
    header = [f"c{i}" for i in range(200)]
    rows = [[str(j * i % 97) if i % 3 == 0 else ("2023-04-12" if i % 3 == 1 else "Alice") for i in range(200)] for j in range(200)]
    start = time.perf_counter()
    infer_schema(MODEL, header, rows)
    assert time.perf_counter() - start < 5.0


def test_verdict_n1_devine_le_schema_que_n0_reclame():
    """verdict_rationale : « N1 devine le schéma que N0 réclame » ; docstring « This rung replaces the typing, not the cleaning »."""
    data = b"id,joined\n1,2023-04-12\n2,31/02/2024\n"
    schema = infer_schema(MODEL, ["id", "joined"], [["1", "2023-04-12"], ["2", "31/02/2024"]])
    assert schema == {"id": "integer", "joined": "date"}
    assert [(r["line"], r["reason"]) for r in clean_csv(data, schema)["rejects"]] == [(3, "not a real date")]


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_un_jeu_d_entrainement_vide_ou_a_une_seule_classe_est_refuse():
    with pytest.raises(ValueError):
        train([], [])
    with pytest.raises(ValueError):
        train([["1"], ["2"]], ["integer", "integer"])


def test_production_deux_cents_colonnes_de_deux_cents_lignes_terminent():
    header = [f"c{i}" for i in range(200)]
    rows = [["1"] * 200 for _ in range(2000)]
    start = time.perf_counter()
    assert set(infer_schema(MODEL, header, rows).values()) == {"boolean"}
    assert time.perf_counter() - start < 5


def test_production_encodage_nfd_emoji_insecables():
    names = [unicodedata.normalize("NFD", n) for n in ("Zoé", "Anaïs", "Léon 🙂")]
    assert classify(MODEL, names) == "text"
    assert classify(MODEL, ["1\u00a0234,50", "12,00", "7\u202f000,25"]) == "number"


def test_production_echantillon_nul():
    assert infer_schema(MODEL, HEADER, ROWS, sample=0) == {name: "text" for name in HEADER}
