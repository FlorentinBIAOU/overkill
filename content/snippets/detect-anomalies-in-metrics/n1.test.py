"""
Le score d'un point dépend de l'endroit où sont tombées les coupes : Python et
JavaScript ne s'accordent pas à la troisième décimale. Ils s'accordent sur ce
qui compte, les minutes qui passent le seuil.
"""

import ast
import math
import random
import time
from pathlib import Path

import pytest

from n1 import SEED, anomalies, score, train

THRESHOLD = 0.65


def wobble(minute: int, metric: int) -> float:
    """Un petit écart déterministe, entre moins un demi et un demi."""
    step = minute * (0.6180339887498949 + 0.1 * metric)
    return step - math.floor(step) - 0.5


def daytime(minute: int) -> list[float]:
    """Requêtes, erreurs, latence en millisecondes : le régime chargé."""
    return [1000 + 80 * wobble(minute, 0), 10 + wobble(minute, 1), 130 + 10 * wobble(minute, 2)]


def nighttime(minute: int) -> list[float]:
    """Les trois mêmes métriques, régime calme."""
    return [300 + 80 * wobble(minute, 3), 3 + wobble(minute, 4), 60 + 10 * wobble(minute, 5)]


def nighttime_with_daytime_errors(minute: int) -> list[float]:
    """Trafic calme, latence calme, et le nombre d'erreurs d'une heure chargée."""
    return [320 + 80 * wobble(minute, 6), 9.6 + wobble(minute, 7), 62 + 10 * wobble(minute, 8)]


ORDINARY = [daytime(minute) for minute in range(45)] + [nighttime(minute) for minute in range(45)]
BROKEN_ERRORS = [320.0, 9.6, 62.0]  # trafic de nuit, erreurs de jour
BROKEN_LATENCY = [980.0, 9.8, 63.0]  # trafic de jour, latence de nuit
ROWS = ORDINARY + [BROKEN_ERRORS, BROKEN_LATENCY]
HABITUATED = ORDINARY + [nighttime_with_daytime_errors(minute) for minute in range(15)]


def average_depth(n):
    """c(n) de l'article d'origine : profondeur moyenne d'une recherche infructueuse."""
    return 2 * (math.log(n - 1) + 0.5772156649015329) - 2 * (n - 1) / n if n > 1 else 0.0


def cuts(model_score, n):
    """Nombre moyen de coupes qu'il a fallu, déduit du score : s = 2^(-E(h)/c(n))."""
    return -math.log2(model_score) * average_depth(n)


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_quinze_minutes_d_entrainement_font_un_troisieme_regime():
    """
    breaking_point : « Quinze minutes de trafic de nuit portant un nombre
    d'erreurs de plein jour, glissées dans les données d'entraînement, suffisent
    pour que la forêt en fasse un troisième régime ordinaire ».
    """
    model = train(HABITUATED)
    assert anomalies(model, HABITUATED, THRESHOLD) == []


def test_point_de_rupture_la_minute_signalee_juste_avant_ne_l_est_plus():
    """
    breaking_point : « La minute que le test signalait juste avant ne l'est
    plus ». Témoin : sans les quinze minutes, elle est signalée.
    """
    assert anomalies(train(ROWS), ROWS, THRESHOLD) == [90, 91]
    assert score(train(ROWS), BROKEN_ERRORS) > THRESHOLD
    assert score(train(HABITUATED), BROKEN_ERRORS) < THRESHOLD


def test_point_de_rupture_rien_dans_la_sortie_ne_dit_que_quelque_chose_a_change():
    """
    breaking_point : « rien dans la sortie ne dit que quoi que ce soit a
    changé ». La sortie est une liste d'indices et un nombre : une forêt
    habituée rend la même liste vide qu'une flotte immobile.
    """
    habituated = anomalies(train(HABITUATED), HABITUATED, THRESHOLD)
    flat = [[100.0, 5.0, 20.0]] * 40
    assert habituated == anomalies(train(flat), flat, THRESHOLD) == []
    assert isinstance(score(train(HABITUATED), BROKEN_ERRORS), float)


def test_constat_cinq_minutes_suffisent_deja():
    """Précision sur « quinze minutes suffisent » : cinq suffisent en Python, une seule en JavaScript."""
    five = ORDINARY + [nighttime_with_daytime_errors(minute) for minute in range(5)]
    assert score(train(five), BROKEN_ERRORS) < THRESHOLD
    one = ORDINARY + [nighttime_with_daytime_errors(0)]
    assert score(train(one), BROKEN_ERRORS) > THRESHOLD


# ---------------------------------------------------------------------------
# Autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_signale_les_deux_minutes_dont_la_combinaison_est_impossible():
    assert anomalies(train(ROWS), ROWS, THRESHOLD) == [90, 91]


def test_chaque_minute_signalee_est_ordinaire_sur_chaque_metrique_prise_seule():
    """
    docstring : « every metric stays inside its usual range, and only the
    combination is impossible ». Vrai de la plage de toute l'exploitation ; voir
    n0.test.py pour ce qu'en dit une fenêtre glissante.
    """
    for metric in range(3):
        column = [row[metric] for row in ORDINARY]
        for flagged in (BROKEN_ERRORS, BROKEN_LATENCY):
            assert min(column) <= flagged[metric] <= max(column)


def test_un_point_a_l_ecart_demande_trois_ou_quatre_coupes():
    """docstring : « a point out on its own needs three or four », « A point in the middle of the crowd needs many »."""
    model = train(ROWS)
    assert round(cuts(score(model, BROKEN_ERRORS), 92), 2) == 3.97
    assert round(cuts(score(model, BROKEN_LATENCY), 92), 2) == 3.87
    assert cuts(score(model, ORDINARY[0]), 92) > 5.5


@pytest.mark.xfail(
    strict=True,
    reason=(
        "DÉFAUT : une minute bien au-delà de tout ce que la forêt a vu (un million de "
        "requêtes, un million d'erreurs, mille secondes de latence) n'est pas signalée "
        "au seuil de 0,65 : elle suit toujours la même branche et finit dans la feuille "
        "des plus grandes valeurs d'entraînement, 5,7 coupes, score 0,616, à peine plus "
        "qu'une minute ordinaire (0,610). En JavaScript, 0,605"
    ),
)
def test_defaut_une_minute_hors_de_toute_plage_n_est_pas_signalee():
    model = train(ROWS)
    assert score(model, [1e6, 1e6, 1e6]) > THRESHOLD


def test_au_dessus_d_un_demi_le_point_a_demande_moins_de_coupes_que_la_foule():
    """docstring de score : « Above one half, the point took fewer cuts to isolate than the crowd did »."""
    model = train(ROWS)
    for row in ROWS:
        assert (score(model, row) > 0.5) == (cuts(score(model, row), 92) < average_depth(92))


def test_une_flotte_immobile_n_a_aucune_anomalie():
    flat = [[100.0, 5.0, 20.0]] * 40
    model = train(flat)
    assert score(model, flat[0]) == pytest.approx(0.5)
    assert anomalies(model, flat, THRESHOLD) == []


def test_le_score_est_un_rang_entre_zero_et_un():
    """docstring : « The output is a rank between zero and one » ; verdict : « on apprend que la minute était inhabituelle, pas en quoi »."""
    model = train(ROWS)
    assert all(0 < score(model, row) < 1 for row in ROWS)


@pytest.mark.xfail(
    strict=True,
    reason=(
        "INFIRMÉ : « the only real knob is the size of the forest ». Sur ces données, de "
        "10 à 500 arbres, les minutes signalées ne changent pas ; le seuil, lui, les "
        "fait passer de 43 à 2 entre 0,5 et 0,65. La molette réelle est le seuil, que "
        "la docstring d'anomalies laisse d'ailleurs à l'appelant"
    ),
)
def test_infirme_la_taille_de_la_foret_est_la_seule_vraie_molette():
    by_size = {trees: anomalies(train(ROWS, trees=trees), ROWS, THRESHOLD) for trees in (10, 50, 500)}
    assert len({tuple(flagged) for flagged in by_size.values()}) > 1


def test_constat_le_seuil_change_tout_la_taille_de_la_foret_rien():
    model = train(ROWS)
    assert [len(anomalies(model, ROWS, t)) for t in (0.5, 0.55, 0.6, 0.65)] == [43, 7, 4, 2]
    assert all(anomalies(train(ROWS, trees=t), ROWS, THRESHOLD) == [90, 91] for t in (10, 50, 500))


def test_le_seuil_est_a_vous():
    """docstring d'anomalies : « Move it towards one to be woken up less often and miss more »."""
    model = train(ROWS)
    counts = [len(anomalies(model, ROWS, t)) for t in (0.0, 0.5, 0.6, 0.7, 1.0)]
    assert counts == sorted(counts, reverse=True)
    assert counts[0] == len(ROWS) and counts[-1] == 0


def test_la_graine_fait_partie_du_contrat():
    """Commentaire SEED : « an alert that changes between two runs on the same data is not an alert »."""
    assert SEED == 0
    assert score(train(ROWS), BROKEN_ERRORS) == score(train(ROWS), BROKEN_ERRORS)
    assert score(train(ROWS, seed=1), BROKEN_ERRORS) != score(train(ROWS), BROKEN_ERRORS)


def test_rien_n_est_mis_a_l_echelle_une_metrique_en_secondes_pese_autant_qu_en_millisecondes():
    """docstring de train : « a metric counted in milliseconds and one counted in requests weigh the same »."""
    seconds = [[r[0], r[1], r[2] / 1000] for r in ROWS]
    model, scaled = train(ROWS), train(seconds)
    for original, rescaled in zip(ROWS, seconds):
        assert score(scaled, rescaled) == pytest.approx(score(model, original), abs=1e-12)


def test_les_coupes_sont_tirees_entre_le_minimum_et_le_maximum_observes():
    """regulatory : « ses coupes sont tirées entre la plus petite et la plus grande valeur observée de chaque métrique »."""
    model = train(ROWS)
    low = [min(r[k] for r in ROWS) for k in range(3)]
    high = [max(r[k] for r in ROWS) for k in range(3)]
    for tree in model.estimators_:
        for feature, cut in zip(tree.tree_.feature, tree.tree_.threshold):
            if feature >= 0:
                assert low[feature] <= cut <= high[feature]


def test_l_extrait_n_importe_que_scikit_learn():
    """risks.data_egress : none ; rien n'est étiqueté (train ne prend que les lignes)."""
    source = ast.parse(Path(__file__).with_name("n1.py").read_text(encoding="utf-8"))
    assert {n.module for n in ast.walk(source) if isinstance(n, ast.ImportFrom)} == {"sklearn.ensemble"}


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_aucune_ligne_leve_une_ligne_vaut_un_demi():
    with pytest.raises(ValueError):
        train([])
    model = train([[1.0, 2.0, 3.0]])
    assert score(model, [1.0, 2.0, 3.0]) == 0.5


def test_production_une_valeur_manquante_est_acceptee_et_le_reste_tient():
    """scikit-learn 1.7 accepte les NaN : la minute [NaN, 1, 1] ressort, les minutes cassées aussi. (JavaScript : DÉFAUT.)"""
    rows = ROWS[:-1] + [[float("nan"), 1.0, 1.0]]
    assert anomalies(train(rows), rows, THRESHOLD) == [90, 91]


def test_production_score_egal_au_seuil_n_est_pas_signale():
    model = train(ROWS)
    exact = score(model, BROKEN_ERRORS)
    assert 90 not in anomalies(model, ROWS, exact)
    assert 90 in anomalies(model, ROWS, exact - 1e-12)


@pytest.mark.xfail(
    strict=True,
    reason=(
        "DÉFAUT : anomalies appelle score_samples ligne par ligne ; 4 600 minutes "
        "(cinquante fois le cas des tests, trois jours à la minute) prennent une dizaine "
        "de secondes, quand un seul appel groupé sur les mêmes lignes en prend quelques "
        "dizaines de millisecondes"
    ),
)
def test_defaut_quatre_mille_six_cents_minutes_se_jugent_en_moins_de_deux_secondes():
    rng = random.Random(0)
    rows = [[rng.gauss(1000, 50), rng.gauss(10, 1), rng.gauss(130, 10)] for _ in range(4600)]
    model = train(rows)
    started = time.monotonic()
    anomalies(model, rows, THRESHOLD)
    assert time.monotonic() - started < 2
