import builtins
import json
import os
import shutil
import subprocess
import time
import unicodedata
from collections import Counter
from pathlib import Path

import pytest

import n1
from n0 import generate_rows
from n1 import pick, sample_rows

ICI = Path(__file__).parent

# The distributions live in the test, never in the snippet. These are the shape
# a `GROUP BY city` and a bucketed count would return: raw observed counts, not
# probabilities, and no need to make them sum to anything in particular.
#
# The figures below are invented for the example, and the postcodes are those
# of the cities they sit next to, nothing more.
SESSIONS = {
    "city": {"type": "categorical", "counts": {"Paris": 4120, "Lyon": 980, "Nantes": 410, "Lille": 190}},
    "postcode": {"type": "categorical", "counts": {"75011": 4120, "69003": 980, "44000": 410, "59000": 190}},
    # Most baskets hold one item; the long tail is real but thin.
    "items": {"type": "histogram", "edges": [1, 2, 3, 6, 21], "counts": [6900, 1800, 900, 400]},
    "delay_days": {"type": "histogram", "edges": [0, 1, 3, 8, 31], "counts": [5200, 2400, 1600, 800]},
}

# The exact rows expected for one seed. The same literal appears in n1.test.js,
# which is what pins the two implementations to each other.
GOLDEN = [
    {"city": "Lyon", "postcode": "69003", "items": 2, "delay_days": 4},
    {"city": "Paris", "postcode": "75011", "items": 2, "delay_days": 0},
    {"city": "Nantes", "postcode": "75011", "items": 1, "delay_days": 0},
]

SEED = "sessions-week-24"
POSTCODE_OF = {"Paris": "75011", "Lyon": "69003", "Nantes": "44000", "Lille": "59000"}


def sample_rows_en_javascript(appels):
    """Exécute le vrai n1.js dans Node, pour chaque (distributions, count, seed)."""
    node = shutil.which("node")
    assert node, "node est requis pour comparer les deux implémentations"
    script = (
        f"import {{ sampleRows }} from {json.dumps((ICI / 'n1.js').as_uri())};"
        "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{"
        "process.stdout.write(JSON.stringify(JSON.parse(d).map(([s,n,g])=>sampleRows(s,n,g))));});"
    )
    sortie = subprocess.run(
        [node, "--input-type=module", "-e", script],
        input=json.dumps(appels), capture_output=True, text=True, timeout=60, check=True,
    )
    return json.loads(sortie.stdout)


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_les_parts_par_ville_sont_justes():
    """« les parts par ville sont justes » : à deux points près sur 4 000 lignes."""
    rows = sample_rows(SESSIONS, 4000, SEED)
    seen = Counter(row["city"] for row in rows)
    total = sum(SESSIONS["city"]["counts"].values())
    for city, observed in SESSIONS["city"]["counts"].items():
        assert abs(seen[city] / 4000 - observed / total) < 0.02, city


def test_point_de_rupture_pres_dune_ligne_sur_deux_associe_une_ville_a_un_autre_code_postal():
    """« près d'une ligne sur deux associe une ville à un code postal qui n'est pas le sien »."""
    rows = sample_rows(SESSIONS, 2000, SEED)
    impossible = [row for row in rows if POSTCODE_OF[row["city"]] != row["postcode"]]
    assert len(impossible) == 908  # 45,4 %
    # Ce qu'annonce l'indépendance des deux colonnes : 1 - somme des parts au carré.
    parts = [c / 5700 for c in SESSIONS["city"]["counts"].values()]
    assert abs(len(impossible) / 2000 - (1 - sum(p * p for p in parts))) < 0.02


def test_point_de_rupture_une_ligne_sur_vingt_annonce_nantes_avec_un_code_postal_parisien():
    """« une sur vingt annonce Nantes avec un code postal parisien »."""
    rows = sample_rows(SESSIONS, 2000, SEED)
    nantes_paris = [row for row in rows if row["city"] == "Nantes" and row["postcode"] == "75011"]
    assert len(nantes_paris) == 100  # exactement 1 sur 20


def test_point_de_rupture_temoin_une_colonne_conjointe_ne_produit_aucune_ligne_impossible():
    """
    Témoin : c'est le tirage colonne par colonne, et lui seul, qui casse le lien.
    Les mêmes effectifs tirés comme une seule catégorie « ville|code » ne donnent
    aucune ligne impossible, avec les mêmes parts par ville.
    """
    conjointe = {"place": {"type": "categorical", "counts": {
        f"{city}|{code}": SESSIONS["city"]["counts"][city] for city, code in POSTCODE_OF.items()
    }}}
    rows = sample_rows(conjointe, 2000, SEED)
    couples = [row["place"].split("|") for row in rows]
    assert all(POSTCODE_OF[city] == code for city, code in couples)
    assert abs(sum(city == "Paris" for city, _ in couples) / 2000 - 4120 / 5700) < 0.02


# ---------------------------------------------------------------------------
# Les autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_produit_les_lignes_attendues():
    assert sample_rows(SESSIONS, 3, SEED) == GOLDEN


def test_python_et_javascript_produisent_les_memes_lignes_pour_la_meme_table_observee():
    """
    Docstring de pick : « identical in both languages » ; commentaire : « It is
    also what keeps the two languages together: a JavaScript object reorders its
    numeric-looking keys, and a postcode is one of those ».
    """
    codes = {"75011": 4120, "69003": 980, "44000": 410, "59000": 190, "2A004": 3, "10": 5, "9": 7}
    variees = dict(SESSIONS, postcode={"type": "categorical", "counts": codes}, **{
        "ville accentuée": {"type": "categorical", "counts": {"Orléans": 3, "Besançon": 2, "Évry": 1}},
        "montant": {"type": "histogram", "edges": [0, 10, 1000, 100000], "counts": [50, 30, 1]},
    })
    appels = [[SESSIONS, 3, SEED], [variees, 500, SEED]]
    for graine in ["", "🧪", unicodedata.normalize("NFD", "semaine-été"), "\ufeffx"]:
        appels.append([variees, 50, graine])
    assert sample_rows_en_javascript(appels) == [sample_rows(*a) for a in appels]


@pytest.mark.xfail(strict=True, reason=(
    "INFIRMÉ : la docstring de pick et le commentaire des libellés disent que les "
    "deux langages restent ensemble ; le tri des libellés diverge dès qu'un libellé "
    "contient un caractère hors du plan de base (emoji) et un autre un caractère "
    "entre U+E000 et U+FFFF (formes pleine chasse, usage privé) : Python trie par "
    "point de code, JavaScript par unité UTF-16, et les deux tirent des lignes "
    "différentes pour la même graine"
))
def test_infirme_les_deux_langages_saccordent_sur_des_libelles_emoji_et_pleine_chasse():
    appel = [{"x": {"type": "categorical", "counts": {"🍕 restauration": 1, "Ｚ": 1}}}, 6, SEED]
    assert sample_rows_en_javascript([appel]) == [sample_rows(*appel)]


def test_la_meme_graine_redonne_les_memes_lignes_et_une_autre_graine_non():
    """Docstring : « Determinism works exactly as in N0 »."""
    assert sample_rows(SESSIONS, 50, SEED) == sample_rows(SESSIONS, 50, SEED)
    assert sample_rows(SESSIONS, 50, SEED) != sample_rows(SESSIONS, 50, "sessions-week-25")


def test_le_cas_courant_reste_courant_la_ou_n0_donne_le_meme_poids_a_chaque_cas():
    """
    Docstring : « A schema says a quantity is between one and nine; it does not
    say that most orders are for one item […] Data drawn uniformly inside the
    bounds gives every rare case the same weight as the common one ».
    """
    n0_rows = generate_rows({"items": {"type": "int", "min": 1, "max": 9}}, 9000, SEED)
    parts_n0 = Counter(r["items"] for r in n0_rows)
    assert all(abs(parts_n0[k] / 9000 - 1 / 9) < 0.02 for k in range(1, 10))

    rows = sample_rows(SESSIONS, 4000, SEED)
    one_item = sum(1 for row in rows if row["items"] == 1) / 4000
    assert abs(one_item - 6900 / 10000) < 0.02


def test_les_valeurs_restent_dans_les_tranches_observees_semi_ouvertes():
    """Docstring : « the buckets are half-open »."""
    rows = sample_rows(SESSIONS, 2000, SEED)
    assert min(row["items"] for row in rows) == 1
    assert max(row["items"] for row in rows) <= 20
    assert min(row["delay_days"] for row in rows) == 0
    assert max(row["delay_days"] for row in rows) <= 30
    # La borne haute n'est jamais atteinte, même pour une tranche d'une unité.
    etroite = sample_rows({"v": {"type": "histogram", "edges": [5, 6], "counts": [1]}}, 200, SEED)
    assert {r["v"] for r in etroite} == {5}


def test_la_valeur_est_uniforme_a_linterieur_de_sa_tranche():
    """Commentaire : « Within a bucket the shape is unknown, so uniform is the only honest choice »."""
    rows = sample_rows({"v": {"type": "histogram", "edges": [0, 10], "counts": [1]}}, 10_000, SEED)
    parts = Counter(r["v"] for r in rows)
    assert set(parts) == set(range(10))
    assert all(abs(parts[k] / 10_000 - 0.1) < 0.02 for k in range(10))


def test_pick_repartit_exactement_selon_les_effectifs_entiers():
    """Docstring de pick : « Cumulating integers […] keeps the result exact »."""
    assert [pick([1, 2, 3], n) for n in range(12)] == [0, 1, 1, 2, 2, 2] * 2
    # Un tirage sur 2^32 - 1 reste exact : pas de flottant, pas d'arrondi.
    assert pick([1, 2**32], 2**32 - 1) == 1


def test_une_categorie_observee_zero_fois_nest_jamais_tiree():
    # It did not happen in production, so it does not happen here either.
    counts = {"type": "categorical", "counts": {"Paris": 100, "Ajaccio": 0}}
    rows = sample_rows({"city": counts}, 200, SEED)
    assert {row["city"] for row in rows} == {"Paris"}


def test_une_categorie_observee_une_seule_fois_finit_dans_le_jeu_de_test():
    """
    risks.regulatory : « Une catégorie observée une seule fois désigne une
    personne aussi sûrement que son nom ». Elle sort bel et bien dans le jeu.
    """
    counts = {"type": "categorical", "counts": {"Paris": 9999, "Saint-Pierre-et-Miquelon": 1}}
    rows = sample_rows({"city": counts}, 20_000, SEED)
    assert any(row["city"] == "Saint-Pierre-et-Miquelon" for row in rows)


def test_lordre_de_la_requete_ne_change_pas_le_jeu():
    """Commentaire : « The labels are sorted rather than taken in the order the query returned them »."""
    a = {"city": {"type": "categorical", "counts": {"Paris": 4120, "Lyon": 980, "Nantes": 410}}}
    b = {"city": {"type": "categorical", "counts": {"Nantes": 410, "Paris": 4120, "Lyon": 980}}}
    assert sample_rows(a, 100, SEED) == sample_rows(b, 100, SEED)


def test_une_distribution_impossible_a_tirer_est_refusee():
    with pytest.raises(ValueError):
        # Nothing was observed, so there is nothing to sample from. Falling
        # back to a uniform draw here would quietly invent a distribution.
        sample_rows({"city": {"type": "categorical", "counts": {"Paris": 0}}}, 1, SEED)
    with pytest.raises(ValueError):
        sample_rows({"items": {"type": "histogram", "edges": [1, 5], "counts": [10, 2]}}, 1, SEED)
    with pytest.raises(ValueError):
        sample_rows({"items": {"type": "gaussian", "mean": 3}}, 1, SEED)


def test_aucun_fichier_ecrit(monkeypatch):
    """Docstring : « Standard library only, no file written, and still no network »."""
    def refuser(*args, **kwargs):
        raise AssertionError("un fichier a été ouvert")

    monkeypatch.setattr(builtins, "open", refuser)
    monkeypatch.setattr(os, "open", refuser)
    rows = sample_rows(SESSIONS, 50, SEED)
    monkeypatch.undo()
    assert len(rows) == 50


def test_trois_lignes_prennent_moins_dune_milliseconde():
    """latency « <1 ms » : mille jeux de trois lignes en moins d'une seconde."""
    debut = time.perf_counter()
    for _ in range(1000):
        sample_rows(SESSIONS, 3, SEED)
    assert time.perf_counter() - debut < 1.0


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_aucune_distribution_zero_ligne_et_une_ligne():
    assert sample_rows({}, 2, SEED) == [{}, {}]
    assert sample_rows(SESSIONS, 0, SEED) == []
    assert len(sample_rows(SESSIONS, 1, SEED)) == 1
    assert sample_rows({"c": {"type": "categorical", "counts": {}}}, 0, SEED) == []
    with pytest.raises(ValueError):
        sample_rows({"c": {"type": "categorical", "counts": {}}}, 1, SEED)


def test_production_cinquante_mille_lignes_sur_quatre_colonnes_terminent_vite():
    debut = time.perf_counter()
    rows = sample_rows(SESSIONS, 50_000, SEED)
    assert time.perf_counter() - debut < 15.0
    assert len(rows) == 50_000


@pytest.mark.xfail(strict=True, reason=(
    "DÉFAUT : les libellés d'une colonne catégorielle sont triés, et la liste "
    "des effectifs reconstruite, à chaque cellule ; le coût est lignes × libellés "
    "× log(libellés) au lieu d'un tri par colonne. Un GROUP BY code_postal "
    "(environ 6 000 codes en France) sur 10 000 lignes coûte 10 000 tris de "
    "6 000 libellés (observé : environ 2,4 s en Python, 5 s en Node)"
))
def test_defaut_les_libelles_sont_tries_une_fois_par_colonne_et_non_a_chaque_cellule(monkeypatch):
    appels = []
    vrai_sorted = builtins.sorted

    def sorted_compte(*args, **kwargs):
        appels.append(1)
        return vrai_sorted(*args, **kwargs)

    monkeypatch.setattr(n1, "sorted", sorted_compte, raising=False)
    codes = {"type": "categorical", "counts": {f"{i:05d}": i % 7 + 1 for i in range(6000)}}
    sample_rows({"postcode": codes}, 1000, SEED)
    assert len(appels) <= 1


def test_production_libelles_accentues_nfd_emoji_et_bom():
    counts = {"type": "categorical", "counts": {
        "Orléans": 3, unicodedata.normalize("NFD", "Orléans"): 2, "🍕": 1, "\ufeffLyon": 1, "Lyon\u00a0": 1,
    }}
    rows = sample_rows({"c": counts}, 2000, SEED)
    assert {r["c"] for r in rows} == set(counts["counts"])
    # NFC et NFD restent deux catégories distinctes, comme la base les a renvoyées.
    assert len({r["c"] for r in rows if r["c"].startswith("Orl")}) == 2


def test_production_valeurs_aux_limites_des_tranches():
    # Une tranche de largeur nulle rend sa borne basse, qui est aussi la haute.
    nulle = sample_rows({"v": {"type": "histogram", "edges": [3, 3], "counts": [1]}}, 20, SEED)
    assert {r["v"] for r in nulle} == {3}
    # Une seule observation au total.
    assert sample_rows({"c": {"type": "categorical", "counts": {"seul": 1}}}, 5, SEED) == [{"c": "seul"}] * 5
    # Un effectif négatif n'est pas refusé : il est ignoré au tirage si le total reste positif.
    negatif = sample_rows({"c": {"type": "categorical", "counts": {"a": -5, "b": 10}}}, 50, SEED)
    assert {r["c"] for r in negatif} == {"b"}


def test_production_des_bornes_flottantes_de_moins_dune_unite_ne_rendent_que_les_bornes_basses():
    """`max(high - low, 1)` : une tranche de largeur 0,5 rend toujours sa borne basse."""
    rows = sample_rows({"v": {"type": "histogram", "edges": [0, 0.5, 1], "counts": [1, 1]}}, 200, SEED)
    assert {r["v"] for r in rows} == {0, 0.5}
