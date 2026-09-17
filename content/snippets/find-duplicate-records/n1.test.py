import ast
import time
from pathlib import Path

import pytest
from sklearn.feature_extraction.text import TfidfVectorizer

import n0
from n1 import find_duplicates, normalise, record_text

LETTERS = "abcdefghijklmnopqrstuvwxyz"

# The same file as N0, with two pairs its blocking key cannot see: a name
# entered family-name first, and a postcode off by one digit.
CUSTOMERS = [
    {"name": "Jean Dupont", "city": "Paris", "postcode": "75011"},
    {"name": "Dupont Jean", "city": "Paris", "postcode": "75011"},
    {"name": "Marie Martin", "city": "Lyon", "postcode": "69003"},
    {"name": "Marie Martin", "city": "Lyon", "postcode": "69004"},
    {"name": "Paul Bernard", "city": "Bordeaux", "postcode": "33000"},
]

# Two records of one supplier, and a third company that merely spells like it.
SUPPLIERS = [
    {"name": "SNCF", "city": "Paris"},
    {"name": "Société Nationale des Chemins de Fer", "city": "Paris"},
    {"name": "SNEF", "city": "Paris"},
]



def scores(records):
    """Every pair and its score, threshold set aside."""
    return {(i, j): score for i, j, score in find_duplicates(records, threshold=0.0)}


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_snef_obtient_un_meilleur_score_que_la_forme_developpee_de_sncf():
    """
    breaking_point : « « SNCF » et « Société Nationale des Chemins de Fer » sont
    une seule entreprise et ne partagent presque aucune tranche de lettres, tandis
    que « SNEF », qui en est une autre, obtient un meilleur score ».
    """
    pairs = scores(SUPPLIERS)
    assert pairs[(0, 2)] > pairs[(0, 1)]
    assert pairs[(0, 1)] < 0.2
    assert find_duplicates(SUPPLIERS) == []


def test_point_de_rupture_baisser_le_seuil_jusqu_au_vrai_doublon_fusionne_d_abord_les_deux_societes():
    """breaking_point : « baisser le seuil jusqu'à faire apparaître le vrai doublon fusionne d'abord les deux sociétés »."""
    pairs = scores(SUPPLIERS)
    loose = [(i, j) for i, j, _ in find_duplicates(SUPPLIERS, threshold=pairs[(0, 1)])]
    assert (0, 1) in loose and (0, 2) in loose
    between = [(i, j) for i, j, _ in find_duplicates(SUPPLIERS, threshold=(pairs[(0, 1)] + pairs[(0, 2)]) / 2)]
    assert between == [(0, 2)]


# ---------------------------------------------------------------------------
# Autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_trouve_les_paires_que_la_cle_de_n0_ne_compare_jamais():
    """name : « TF-IDF sur n-grammes de caractères, voisins par cosinus » ; docstring : « Ce niveau abandonne la clé »."""
    assert [(i, j) for i, j, _ in find_duplicates(CUSTOMERS)] == [(0, 1), (2, 3)]
    assert n0.find_duplicates(CUSTOMERS, threshold=0.0) == []


def test_l_ordre_des_mots_ne_change_pas_le_score():
    """docstring : les n-grammes survivent « à un ordre des mots inversé »."""
    assert scores(CUSTOMERS)[(0, 1)] == 1.0


def test_une_faute_de_frappe_et_un_champ_tronque_gardent_un_score_au_dessus_du_seuil():
    """docstring : « ils survivent à une faute de frappe […] et à un champ tronqué »."""
    typo = [{"name": "Jean Dupont", "city": "Paris"}, {"name": "Jean Dupond", "city": "Paris"}]
    truncated = [{"name": "Société Générale", "city": "Paris"}, {"name": "Société Génér", "city": "Paris"}]
    assert find_duplicates(typo)[0][:2] == (0, 1)
    assert find_duplicates(truncated)[0][:2] == (0, 1)


def test_des_fiches_sans_rapport_ont_un_score_proche_de_zero():
    assert scores(CUSTOMERS)[(0, 4)] < 0.1


def test_les_n_grammes_restent_dans_les_mots():
    """docstring : « "dupont paris" borrows nothing from the join between the two words »."""
    analyser = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 4)).build_analyzer()
    assert not any(" " in gram.strip() for gram in analyser("dupont paris"))


def test_accents_et_casse_ne_sont_pas_une_difference():
    assert normalise("Société Générale") == "societe generale"
    pair = [{"name": "Société Générale", "city": "Paris"}, {"name": "SOCIETE GENERALE", "city": "paris"}]
    assert record_text(pair[0]) == record_text(pair[1])
    assert find_duplicates(pair)[0][2] == 1.0


def test_un_champ_tres_long_ne_noie_pas_le_score():
    note = "customer since 2019, prefers delivery in the afternoon, " * 20
    padded = [dict(record, note=note) for record in CUSTOMERS[:2]]
    assert find_duplicates(padded)[0][2] > 0.9


def test_rien_n_est_appris_ni_conserve_d_un_appel_a_l_autre():
    """docstring : « Rien ici n'est appris d'un corpus » ; regulatory : « rien du fichier n'est appris ni conservé au-delà de l'exécution »."""
    before = find_duplicates(CUSTOMERS)
    find_duplicates(SUPPLIERS * 50)
    assert find_duplicates(CUSTOMERS) == before


def test_sans_cle_toutes_les_paires_sont_examinees():
    """docstring : « sans clé, dans le pire des cas, toutes les paires » ; verdict : « les deux autres comparent, dans le pire des cas, toutes les paires »."""
    records = [{"name": f"Jean Dupont {i}", "city": "Paris"} for i in range(40)]
    assert len(find_duplicates(records, threshold=0.0)) == 40 * 39 // 2


def test_l_extrait_n_importe_que_scikit_learn_et_unicodedata():
    """risks.data_egress: none ; risks.deterministic: true."""
    source = ast.parse(Path(__file__).with_name("n1.py").read_text(encoding="utf-8"))
    imported = {a.name.split(".")[0] for n in ast.walk(source) if isinstance(n, ast.Import) for a in n.names}
    imported |= {n.module.split(".")[0] for n in ast.walk(source) if isinstance(n, ast.ImportFrom)}
    assert imported == {"unicodedata", "sklearn"}
    assert find_duplicates(CUSTOMERS) == find_duplicates(CUSTOMERS)


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_fichier_vide_et_fiche_unique():
    assert find_duplicates([]) == []
    assert find_duplicates([CUSTOMERS[0]]) == []


def test_production_des_fiches_sans_aucune_lettre_ne_font_pas_lever():
    assert find_duplicates([{"name": "", "city": ""}, {"name": "—", "city": "..."}]) == []


def test_production_deux_mille_fiches_dans_une_borne_large():
    records = [{"name": f"Client {i:05d} {LETTERS[i % 26]}{LETTERS[(i * 7) % 26]}", "city": "Paris"} for i in range(2000)]
    debut = time.perf_counter()
    find_duplicates(records)
    assert time.perf_counter() - debut < 30


def test_production_accents_decomposes_espaces_insecables_et_largeur_nulle():
    pair = [{"name": "Jean Dupont", "city": "Paris"}, {"name": "Jean\u00a0Dupo\u0302nt", "city": "PARIS"}]
    assert find_duplicates(pair)[0][2] == 1.0
    zero_width = [{"name": "Jean Dupont", "city": "Paris"}, {"name": "Jean Du\u200bpont", "city": "Paris"}]
    assert find_duplicates(zero_width)[0][:2] == (0, 1)


def test_production_au_seuil_zero_toutes_les_paires_sortent():
    assert len(find_duplicates(CUSTOMERS, threshold=0.0)) == 10


def test_production_des_fiches_identiques_sortent_au_seuil_un():
    assert find_duplicates([CUSTOMERS[0], dict(CUSTOMERS[0])], threshold=1.0) == [(0, 1, 1.0)]
