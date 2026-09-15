import ast
import math
import time
from pathlib import Path

import pytest

from n0 import blocking_key, edit_distance, find_duplicates, normalise, record_text, similarity

# A customer file as it really looks: the same person entered twice, by two
# people, on two days.
CUSTOMERS = [
    {"name": "Jean Dupont", "postcode": "75011", "city": "Paris"},
    {"name": "Jean Dupônt", "postcode": "75011", "city": "PARIS"},
    {"name": "Marie Martin", "postcode": "69003", "city": "Lyon"},
    {"name": "Marie Martln", "postcode": "69003", "city": "Lyon"},
    {"name": "Paul Bernard", "postcode": "33000", "city": "Bordeaux"},
]

LETTERS = "abcdefghijklmnopqrstuvwxyz"


def synthetic_file(size):
    """A file with varied family names and twenty postcodes, built without randomness."""
    return [
        {
            "name": f"Client {LETTERS[i % 26]}{LETTERS[(i * 7) % 26]}{LETTERS[(i * 13) % 23]}{LETTERS[(i // 26) % 26]}eau",
            "postcode": str(75001 + i % 20),
            "city": "Paris",
        }
        for i in range(size)
    ]


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_un_chiffre_faux_dans_le_code_postal_les_textes_a_0_96_et_la_paire_absente():
    """
    breaking_point : « Un chiffre faux dans le code postal suffit : le test montre
    les deux textes à 0,96, très au-dessus du seuil, et la paire absente du
    résultat ». Témoin : avec le bon code postal, la paire sort.
    """
    moved = [
        {"name": "Jean Dupont", "postcode": "75011", "city": "Paris"},
        {"name": "Jean Dupont", "postcode": "75012", "city": "Paris"},
    ]
    assert blocking_key(moved[0]) != blocking_key(moved[1])
    assert round(similarity(record_text(moved[0]), record_text(moved[1])), 2) == 0.96
    assert find_duplicates(moved) == []
    assert find_duplicates([moved[0], dict(moved[1], postcode="75011")]) == [(0, 1, 1.0)]


def test_point_de_rupture_jamais_comparees_quel_que_soit_le_seuil():
    """breaking_point : « ne sont jamais comparées, quel que soit le seuil »."""
    moved = [
        {"name": "Jean Dupont", "postcode": "75011", "city": "Paris"},
        {"name": "Jean Dupont", "postcode": "75012", "city": "Paris"},
    ]
    for threshold in (0.0, 0.5, 0.85):
        assert find_duplicates(moved, threshold=threshold) == []


def test_point_de_rupture_dupont_jean_est_manque_deux_fois_la_cle_et_la_distance():
    """
    breaking_point : « « Dupont Jean » saisi à la place de « Jean Dupont » est
    manqué deux fois : la clé sépare les deux fiches, et la distance d'édition ne
    les aurait pas rapprochées non plus ».
    """
    swapped = [
        {"name": "Jean Dupont", "postcode": "75011", "city": "Paris"},
        {"name": "Dupont Jean", "postcode": "75011", "city": "Paris"},
    ]
    assert blocking_key(swapped[0]) != blocking_key(swapped[1])
    assert find_duplicates(swapped, threshold=0.0) == []
    assert similarity(record_text(swapped[0]), record_text(swapped[1])) < 0.85


# ---------------------------------------------------------------------------
# Autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_trouve_les_deux_paires_en_doublon_et_rien_d_autre():
    """name : « Normalisation, clé de blocage, puis distance d'édition »."""
    assert [(i, j) for i, j, _ in find_duplicates(CUSTOMERS)] == [(0, 1), (2, 3)]


def test_la_normalisation_retire_casse_accents_ponctuation_et_espaces_doubles():
    """docstring : « la casse, les accents, la ponctuation, les espaces doubles »."""
    assert normalise("Jean DUPÔNT") == "jean dupont"
    assert normalise("  Jean-Pierre,   d'Arc.  ") == "jean pierre d arc"
    assert record_text(CUSTOMERS[0]) == record_text(CUSTOMERS[1])


def test_une_faute_d_un_caractere_garde_un_score_haut():
    assert similarity("marie martin", "marie martln") > 0.9


def test_la_distance_d_edition_est_celle_de_levenshtein():
    """docstring de edit_distance : « Levenshtein distance »."""
    assert edit_distance("kitten", "sitting") == 3
    assert edit_distance("", "abc") == 3
    assert edit_distance("abc", "abc") == 0


def test_la_similarite_vaut_un_pour_des_chaines_identiques_et_zero_sans_rien_en_commun():
    """docstring de similarity : « 1.0 for identical strings, 0.0 for strings sharing nothing »."""
    assert similarity("dupont", "dupont") == 1.0
    assert similarity("abc", "xyz") == 0.0
    assert similarity("", "") == 1.0


def test_la_cle_prend_trois_lettres_du_nom_de_famille_et_le_code_postal():
    """docstring de blocking_key : « Three letters of the family name and the postcode »."""
    assert blocking_key({"name": "Jean Dupônt", "postcode": "75011"}) == "dup:75011"


def test_le_seuil_est_a_vous():
    """docstring : « The threshold is yours to set »."""
    strict = find_duplicates(CUSTOMERS, threshold=0.99)
    assert [(i, j) for i, j, _ in strict] == [(0, 1)]


def test_les_paires_sont_rendues_du_score_le_plus_haut_au_plus_bas():
    scores = [score for _, _, score in find_duplicates(CUSTOMERS, threshold=0.0)]
    assert scores == sorted(scores, reverse=True)


def test_dix_mille_fiches_font_cinquante_millions_de_paires():
    """docstring et scenario : « dix mille fiches font cinquante millions de paires »."""
    assert math.comb(10_000, 2) == 49_995_000


@pytest.mark.xfail(
    strict=True,
    reason=(
        "INFIRMÉ : la docstring dit que ce niveau « ne compare jamais toutes les "
        "paires » ; quand toutes les fiches partagent la clé (même code postal, même "
        "début de nom), il les compare toutes : 300 fiches, 44 850 paires rendues au "
        "seuil zéro"
    ),
)
def test_infirme_le_niveau_ne_compare_jamais_toutes_les_paires():
    same_block = [{"name": f"Jean Dupont{i}", "postcode": "75011", "city": "Paris"} for i in range(300)]
    assert len(find_duplicates(same_block, threshold=0.0)) < math.comb(300, 2)


def test_l_extrait_est_deterministe_et_n_importe_que_unicodedata():
    """docstring : « Deterministic, standard library only » ; risks.data_egress: none."""
    source = ast.parse(Path(__file__).with_name("n0.py").read_text(encoding="utf-8"))
    imported = {a.name.split(".")[0] for n in ast.walk(source) if isinstance(n, ast.Import) for a in n.names}
    imported |= {n.module.split(".")[0] for n in ast.walk(source) if isinstance(n, ast.ImportFrom)}
    assert imported == {"unicodedata"}
    assert find_duplicates(CUSTOMERS) == find_duplicates(list(CUSTOMERS))


def test_il_propose_des_paires_et_un_score_il_ne_fusionne_rien():
    """regulatory : « l'extrait propose des paires et un score, il ne fusionne rien »."""
    records = [dict(record) for record in CUSTOMERS]
    pairs = find_duplicates(records)
    assert records == CUSTOMERS
    assert all(len(pair) == 3 for pair in pairs)


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_fichier_vide_et_fiche_unique():
    assert find_duplicates([]) == []
    assert find_duplicates([CUSTOMERS[0]]) == []


def test_production_un_nom_vide_ne_fait_pas_lever():
    """Test d'origine gardé ; constat : deux fiches sans nom au même code postal sortent comme doublons certains."""
    blank = {"name": "", "postcode": "75011", "city": "Paris"}
    assert find_duplicates([blank, dict(blank)]) == [(0, 1, 1.0)]


@pytest.mark.xfail(
    strict=True,
    reason="DÉFAUT : un nom absent (None, une cellule vide lue d'un CSV) fait lever AttributeError dans normalise",
)
def test_defaut_un_nom_nul_ne_fait_pas_lever():
    records = [{"name": None, "postcode": "75011", "city": "Paris"}, {"name": "Jean Dupont", "postcode": "75011", "city": "Paris"}]
    assert find_duplicates(records) == []


def test_production_dix_mille_fiches_variees_dans_une_borne_large():
    records = synthetic_file(10_000)
    debut = time.perf_counter()
    find_duplicates(records)
    assert time.perf_counter() - debut < 30


def test_production_accents_decomposes_espaces_insecables_et_casse_mixte():
    assert normalise("Jean Dupo\u0302nt") == "jean dupont"
    assert normalise("Jean\u00a0DUPONT") == "jean dupont"
    assert blocking_key({"name": "JEAN\u00a0Dupo\u0302nt", "postcode": " 75011 "}) == "dup:75011"


@pytest.mark.xfail(
    strict=True,
    reason=(
        "DÉFAUT : un caractère de largeur nulle collé dans le nom (« Du\\u200bpont ») "
        "coupe le mot : la clé devient « pon:75011 » et la paire n'est jamais comparée"
    ),
)
def test_defaut_un_caractere_de_largeur_nulle_dans_le_nom_change_la_cle():
    records = [
        {"name": "Jean Dupont", "postcode": "75011", "city": "Paris"},
        {"name": "Jean Du\u200bpont", "postcode": "75011", "city": "Paris"},
    ]
    assert [(i, j) for i, j, _ in find_duplicates(records)] == [(0, 1)]


def test_production_seuil_exactement_atteint_et_valeurs_aux_limites():
    pair = [
        {"name": "Marie Martin", "postcode": "69003", "city": "Lyon"},
        {"name": "Marie Martln", "postcode": "69003", "city": "Lyon"},
    ]
    score = similarity(record_text(pair[0]), record_text(pair[1]))
    assert find_duplicates(pair, threshold=score)[0][:2] == (0, 1)
    assert find_duplicates(pair, threshold=score + 1e-9) == []
    same = [pair[0], dict(pair[0])]
    assert find_duplicates(same, threshold=1.0) == [(0, 1, 1.0)]
