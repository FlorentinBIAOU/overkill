import ast
import math
import time
from pathlib import Path

import pytest

from n0 import (
    DEFAULT_KEYS,
    blocking_key,
    compare_records,
    edit_distance,
    field_key,
    find_duplicates,
    normalise,
    record_text,
    similarity,
)

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


MOVED = [
    {"name": "Jean Dupont", "postcode": "75011", "city": "Paris"},
    {"name": "Jean Dupont", "postcode": "75012", "city": "Paris"},
]


def test_point_de_rupture_aucune_cle_ne_rapproche_la_paire_et_elle_n_est_jamais_comparee():
    """
    breaking_point : « Ni le nom et le code postal, ni le courriel, ni le
    téléphone : « Jean Dupont » à 75011 et le même à 75012, sans courriel ni
    téléphone, ne partagent aucune clé […] 0,96 de ressemblance sur le texte
    entier, et rien dans le résultat ». Témoin : le même couple avec le même
    courriel des deux côtés est comparé, et sort.
    """
    assert all(key(MOVED[0]) != key(MOVED[1]) or key(MOVED[0]) == "" for key in DEFAULT_KEYS)
    assert round(similarity(record_text(MOVED[0]), record_text(MOVED[1])), 2) == 0.96
    assert find_duplicates(MOVED) == []
    with_email = [dict(record, email="j.dupont@example.fr") for record in MOVED]
    assert find_duplicates(with_email) == [(0, 1, 0.863)]


def test_une_seconde_cle_rattrape_ce_que_la_premiere_a_manque():
    """docstring : « A key that misses a duplicate is answered with a second key, not with the removal of the key »."""
    # Sans la clé du courriel, la paire n'est même pas comparée.
    with_email = [dict(record, email="j.dupont@example.fr") for record in MOVED]
    assert find_duplicates(with_email, keys=(blocking_key,)) == []
    assert find_duplicates(with_email, keys=(field_key("email"),)) == [(0, 1, 0.863)]
    # L'union, et non l'intersection : ajouter une règle ne peut que trouver plus.
    assert find_duplicates(with_email) == [(0, 1, 0.863)]


def test_point_de_rupture_jamais_comparees_quel_que_soit_le_seuil():
    """breaking_point : « ne sont jamais comparées, quel que soit le seuil »."""
    for threshold in (0.0, 0.5, 0.85):
        assert find_duplicates(MOVED, threshold=threshold) == []


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


def test_un_champ_absent_d_un_cote_n_est_pas_une_difference():
    """docstring : « A field only one of the two carries is not a difference »."""
    complete = {"name": "Jean Dupont", "postcode": "75011", "email": "jean.dupont@example.fr", "phone": "0612345678"}
    partial = {"name": "Jean Dupont", "postcode": "75011", "email": None, "phone": None}
    assert find_duplicates([complete, partial]) == [(0, 1, 1.0)]
    # Témoin : deux personnes différentes au même code postal ne sortent pas.
    other = {"name": "Marie Durand", "postcode": "75011", "email": "m.durand@example.fr", "phone": "0611111111"}
    assert find_duplicates([complete, other]) == []


def test_l_ordre_des_colonnes_ne_change_rien():
    """docstring de record_text : « Sorted by column name, so that two exports of the same data give the same text »."""
    complete = {"name": "Jean Dupont", "postcode": "75011", "email": "jean.dupont@example.fr", "phone": "0612345678"}
    reordered = {"postcode": "75011", "name": "Jean Dupont", "phone": "0612345678", "email": "jean.dupont@example.fr"}
    assert record_text(complete) == record_text(reordered)
    assert find_duplicates([complete, reordered]) == [(0, 1, 1.0)]


def test_un_champ_partage_par_tous_ne_porte_pas_une_paire_a_lui_seul():
    """WEIGHTS : « Agreeing on a town says almost nothing […] while agreeing on an email address says nearly everything »."""
    # Deux personnes d'un même foyer : entrée tout à fait ordinaire d'un
    # carnet d'adresses.
    household = [
        {"name": "Jean Dupont", "postcode": "75011", "city": "Paris", "country": "France"},
        {"name": "Sophie Dupont", "postcode": "75011", "city": "Paris", "country": "France"},
    ]
    # Sans pondération — chaque champ à un —, la ville, le pays et le code
    # postal portent la paire au-dessus du seuil : ce n'est pas ce que fait
    # l'extrait.
    assert compare_records(household[0], household[1], {}) >= 0.85
    assert compare_records(household[0], household[1]) < 0.85
    assert find_duplicates(household) == []
    # Témoin : la même personne saisie deux fois sort malgré ces champs.
    twice = [household[0], dict(household[0], name="Jean Dupônt")]
    assert find_duplicates(twice) == [(0, 1, 1.0)]


def test_un_courriel_different_pese_autant_qu_un_nom_identique():
    """IDENTIFYING : « Two different addresses at the same domain share most of their characters »."""
    pair = [
        {"name": "Jean Dupont", "postcode": "75011", "email": "jean.dupont@example.fr"},
        {"name": "Jean Dupont", "postcode": "75011", "email": "jeanne.dupont@example.fr"},
    ]
    # La distance d'édition les dirait proches ; l'égalité dit non.
    assert similarity(normalise(pair[0]["email"]), normalise(pair[1]["email"])) > 0.9
    assert find_duplicates(pair) == []


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


def test_toutes_les_paires_sont_comparees_quand_tout_tombe_dans_un_seul_groupe():
    """docstring : « all of them when every record lands in the same group »."""
    same_block = [{"name": f"Jean Dupont{i}", "postcode": "75011", "city": "Paris"} for i in range(300)]
    assert len(find_duplicates(same_block, threshold=0.0)) == math.comb(300, 2)
    # Témoin : vingt codes postaux différents, et les groupes redeviennent petits.
    spread = [dict(record, postcode=str(75001 + i % 20)) for i, record in enumerate(same_block)]
    assert len(find_duplicates(spread, threshold=0.0)) < math.comb(300, 2) / 10


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


def test_production_un_nom_vide_ou_nul_ne_produit_aucune_cle():
    """docstring de blocking_key : « A record missing either half produces no key »."""
    blank = {"name": "", "postcode": "75011", "city": "Paris"}
    assert blocking_key(blank) == ""
    assert find_duplicates([blank, dict(blank)]) == []
    nul = {"name": None, "postcode": "75011", "city": "Paris"}
    assert find_duplicates([nul, {"name": "Jean Dupont", "postcode": "75011", "city": "Paris"}]) == []
    # Témoin : avec un courriel des deux côtés, la seconde clé les rapproche.
    assert find_duplicates([dict(blank, email="a@b.fr"), dict(blank, email="a@b.fr")]) == [(0, 1, 1.0)]


def test_production_dix_mille_fiches_variees_dans_une_borne_large():
    records = synthetic_file(10_000)
    debut = time.perf_counter()
    find_duplicates(records)
    assert time.perf_counter() - debut < 30


def test_production_accents_decomposes_espaces_insecables_et_casse_mixte():
    assert normalise("Jean Dupo\u0302nt") == "jean dupont"
    assert normalise("Jean\u00a0DUPONT") == "jean dupont"
    assert blocking_key({"name": "JEAN\u00a0Dupo\u0302nt", "postcode": " 75011 "}) == "dup:75011"


def test_production_un_caractere_de_largeur_nulle_dans_le_nom_ne_change_pas_la_cle():
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
    score = compare_records(pair[0], pair[1])
    assert find_duplicates(pair, threshold=score)[0][:2] == (0, 1)
    assert find_duplicates(pair, threshold=score + 1e-9) == []
    same = [pair[0], dict(pair[0])]
    assert find_duplicates(same, threshold=1.0) == [(0, 1, 1.0)]
