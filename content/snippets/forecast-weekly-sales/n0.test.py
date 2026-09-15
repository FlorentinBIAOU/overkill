import ast
import math
import sys
import time
from pathlib import Path

import pytest

from n0 import forecast, seasonal_coefficients

SEASON = 52


def steady_shop(week: int) -> float:
    """
    Trois ans d'un magasin dont le niveau ne bouge pas.

    Mille euros par semaine, une vague annuelle qui culmine au printemps, et
    une petite ondulation pour que la série ne soit pas un sinus parfait.
    Chaque valeur sort de cette formule : aucun tirage, aucun fichier.
    """
    return 1000 + 200 * math.sin(2 * math.pi * week / SEASON) + 10 * ((week % 5) - 2)


def shape(week: int) -> float:
    """Une forme saisonnière pure, multipliée par un niveau fixe : le modèle exact de N0."""
    return 1 + 0.2 * math.sin(2 * math.pi * week / SEASON) + 0.1 * math.cos(4 * math.pi * week / SEASON)


def noise(count: int, seed: int = 20260915) -> list[float]:
    """Bruit uniforme dans [-0,5 ; 0,5), générateur MINSTD : identique en JavaScript."""
    values, state = [], seed
    for _ in range(count):
        state = state * 48271 % 2147483647
        values.append(state / 2147483647 - 0.5)
    return values


HISTORY = [steady_shop(week) for week in range(3 * SEASON)]
NEXT_WEEK_IN_TRUTH = steady_shop(3 * SEASON)


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_une_rupture_de_tendance_laisse_la_prevision_loin_au_dessus():
    """
    « Un concurrent ouvre, les huit dernières semaines reculent l'une après
    l'autre, et la prévision reste loin au-dessus de ce que le magasin encaisse. »
    """
    declining = [steady_shop(week) for week in range(148)]
    declining += [steady_shop(week) * 0.95 ** (week - 147) for week in range(148, 156)]
    truth = steady_shop(156) * 0.95**9

    predicted = forecast(declining)[0]
    assert predicted / truth == pytest.approx(1.274, abs=0.005)  # 27 % au-dessus

    # Témoin : sans le recul, la même série est prévue à 2 % près.
    assert abs(forecast(HISTORY)[0] - NEXT_WEEK_IN_TRUTH) / NEXT_WEEK_IN_TRUTH < 0.02


def test_point_de_rupture_la_prevision_reste_au_dessus_tant_que_le_recul_continue():
    """
    « — elle y reste tant que le recul continue. » Seize semaines de recul de
    plus, seize prévisions trop hautes de plus de vingt pour cent. Témoin : si le
    niveau se stabilise après les huit semaines de recul, l'écart retombe sous
    quinze pour cent dès la quatrième semaine.
    """
    series = [steady_shop(w) if w < 148 else steady_shop(w) * 0.95 ** (w - 147) for w in range(172)]
    for end in range(156, 172):
        assert forecast(series[:end])[0] > 1.2 * series[end]
    stable = [steady_shop(w) if w < 148 else steady_shop(w) * 0.95 ** min(w - 147, 8) for w in range(172)]
    for end in range(160, 172):
        assert forecast(stable[:end])[0] < 1.15 * stable[end]


def test_point_de_rupture_une_semaine_de_promotion_gonfle_la_prevision_suivante():
    """
    « Une seule semaine de promotion entre dans la moyenne comme du commerce
    ordinaire et gonfle la prévision de la semaine suivante. »
    """
    with_promotion = list(HISTORY)
    with_promotion[-1] *= 2

    # Une semaine sur quatre de la fenêtre a doublé : environ +12 %.
    assert forecast(with_promotion)[0] / forecast(HISTORY)[0] == pytest.approx(1.124, abs=0.005)

    # Témoin : la semaine sans promotion est prévue à 2 % près.
    assert abs(forecast(HISTORY)[0] - NEXT_WEEK_IN_TRUTH) / NEXT_WEEK_IN_TRUTH < 0.02


def test_point_de_rupture_la_moyenne_mobile_n_a_pas_de_pente():
    """
    « La moyenne mobile n'a pas de pente », et escalate_when : « toujours sous
    le réalisé pendant que vous grandissez, toujours au-dessus pendant que vous
    reculez ».
    """
    def growing(w):
        return 800 + 4 * w + 150 * math.sin(2 * math.pi * w / SEASON)

    def shrinking(w):
        return 2000 - 4 * w + 150 * math.sin(2 * math.pi * w / SEASON)

    for end in range(104, 156):
        assert forecast([growing(w) for w in range(end)])[0] < growing(end)
        assert forecast([shrinking(w) for w in range(end)])[0] > shrinking(end)


# ---------------------------------------------------------------------------
# Autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_prevoit_la_semaine_suivante_a_deux_pour_cent_pres():
    predicted = forecast(HISTORY)[0]
    assert abs(predicted - NEXT_WEEK_IN_TRUTH) / NEXT_WEEK_IN_TRUTH < 0.02


def test_les_deux_langages_donnent_le_meme_nombre_a_la_sixieme_decimale():
    """Le même nombre est affirmé dans n0.test.js."""
    assert forecast(HISTORY)[0] == pytest.approx(1003.624843, abs=1e-6)


def test_la_forme_saisonniere_est_lue_dans_l_historique():
    """« Coefficients saisonniers lus dans l'historique » : pic en semaine 13, creux en semaine 39."""
    coefficients = seasonal_coefficients(HISTORY, SEASON)
    assert coefficients[13] > 1.15
    assert coefficients[39] < 0.85
    assert sum(coefficients) / SEASON == pytest.approx(1.0, abs=1e-9)


def test_un_coefficient_de_1_2_signifie_vingt_pour_cent_au_dessus_du_niveau_de_l_annee():
    """« Un coefficient de 1,2 pour la semaine 50 : elle vend vingt pour cent au-dessus du niveau de l'année. »"""
    ordinary = 1000.0
    # b = 1,2 × (51 a + b) / 52, résolu en b : la semaine 50 vaut 1,2 fois la moyenne de l'année.
    peak = 1.2 * 51 * ordinary / (52 - 1.2)
    history = [peak if week % SEASON == 50 else ordinary for week in range(2 * SEASON)]
    assert seasonal_coefficients(history, SEASON)[50] == pytest.approx(1.2, abs=1e-12)


def test_remettre_la_forme_ne_gonfle_ni_ne_degonfle_la_prevision():
    """
    « Remis à une moyenne de un, remettre la forme ne gonfle ni ne dégonfle la
    prévision » : sur un cycle entier, la prévision moyenne vaut le niveau, même
    quand l'historique ne compte pas un nombre entier de cycles.
    """
    history = [1000 * shape(week) for week in range(130)]
    year = forecast(history, horizon=SEASON)
    mean_shape = sum(shape(w) for w in range(SEASON)) / SEASON
    assert sum(year) / SEASON == pytest.approx(1000 * mean_shape, rel=1e-12)


def test_diviser_la_saison_moyenner_puis_remettre_la_forme_retrouve_une_serie_multiplicative():
    """
    « Estimez la forme, divisez-la, faites la moyenne de ce qui reste, puis
    remettez la forme » ; commentaire : « la moyenne ci-dessous mesure le niveau
    seul ». Sur un niveau fixe multiplié par une forme, la prévision est exacte.
    """
    history = [1000 * shape(week) for week in range(3 * SEASON)]
    expected = [1000 * shape(week) for week in range(3 * SEASON, 4 * SEASON)]
    assert forecast(history, horizon=SEASON) == pytest.approx(expected, rel=1e-12)


def test_l_historique_et_la_prevision_partagent_une_meme_horloge():
    """
    « La semaine qui suit l'historique est la position len(history) du cycle.
    L'appelant n'a jamais à caler la série sur un mois de janvier. »
    """
    offset = 13  # l'historique commence un 1er avril
    history = [1000 * shape(week) for week in range(offset, offset + 3 * SEASON)]
    predicted = forecast(history, horizon=4)
    # La position 156 du cycle, c'est la semaine réelle 169 : même phase.
    assert predicted == pytest.approx([1000 * shape(offset + 156 + s) for s in range(4)], rel=1e-12)


def test_une_fenetre_courte_reagit_vite_une_fenetre_longue_est_plus_stable():
    """
    « Une fenêtre courte réagit vite et fait confiance aux dernières semaines ;
    une longue est plus stable et plus lente à remarquer un changement. »
    """
    # Réactivité : le niveau tombe à 800 sur les six dernières semaines.
    step = [1000 * shape(w) * (0.8 if w >= 150 else 1) for w in range(3 * SEASON)]
    truth = 800 * shape(156)
    short_error = abs(forecast(step, window=2)[0] - truth)
    long_error = abs(forecast(step, window=12)[0] - truth)
    # Pas zéro : le recul entre aussi dans les coefficients de ces six semaines.
    assert short_error < long_error / 2

    # Stabilité : sur un niveau fixe bruité, les prévisions successives
    # dispersent moins avec une fenêtre longue.
    bruit = noise(200)
    noisy = [1000 * shape(w) + 200 * bruit[w] for w in range(200)]

    def spread(window):
        levels = [forecast(noisy[:end], window=window)[0] / shape(end) for end in range(120, 200)]
        mean = sum(levels) / len(levels)
        return math.sqrt(sum((x - mean) ** 2 for x in levels) / len(levels))

    assert spread(12) < spread(2)


def test_refuse_un_historique_plus_court_que_deux_cycles():
    """« Un coefficient saisonnier a besoin de deux cycles complets au strict minimum. »"""
    with pytest.raises(ValueError, match="two full cycles"):
        forecast(HISTORY[: 2 * SEASON - 1])
    # Exactement deux cycles : accepté.
    assert len(forecast(HISTORY[: 2 * SEASON])) == 1


def test_un_horizon_rend_une_valeur_par_semaine():
    assert len(forecast(HISTORY, horizon=3)) == 3
    assert forecast(HISTORY, horizon=0) == []


def test_une_serie_plate_est_prevue_a_la_meme_valeur():
    assert forecast([750.0] * (2 * SEASON))[0] == pytest.approx(750.0, abs=1e-9)


def test_n0_n_emploie_que_la_bibliotheque_standard():
    """Docstring : « Standard library only » ; risks : vendor_lock none."""
    source = (Path(__file__).parent / "n0.py").read_text(encoding="utf-8")
    modules = set()
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, ast.Import):
            modules |= {alias.name.split(".")[0] for alias in node.names}
        elif isinstance(node, ast.ImportFrom):
            modules.add(node.module.split(".")[0])
    assert modules and modules <= set(sys.stdlib_module_names)


def test_n0_est_deterministe():
    """risks : deterministic true ; scenario : « se rejoue à l'identique »."""
    first = forecast(list(HISTORY), horizon=8)
    assert all(forecast(list(HISTORY), horizon=8) == first for _ in range(20))


def test_une_prevision_prend_moins_d_une_milliseconde():
    """latency : « <1 ms », sur trois ans d'historique. Meilleur de cinq séries de cinquante appels."""
    runs = []
    for _ in range(5):
        start = time.perf_counter()
        for _ in range(50):
            forecast(HISTORY)
        runs.append((time.perf_counter() - start) / 50)
    assert min(runs) < 0.001


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_une_entree_vide_est_refusee_par_une_erreur_nommee():
    with pytest.raises(ValueError, match="two full cycles"):
        forecast([])


def test_production_trois_cents_ans_de_semaines_terminent_vite_et_juste():
    history = [steady_shop(week) for week in range(100 * 3 * SEASON)]
    start = time.perf_counter()
    predicted = forecast(history)[0]
    assert time.perf_counter() - start < 2
    assert abs(predicted - steady_shop(len(history))) / steady_shop(len(history)) < 0.03


def test_production_une_valeur_non_numerique_leve_une_erreur_de_type():
    with pytest.raises(TypeError):
        forecast(HISTORY[:-1] + [None])
    with pytest.raises(TypeError):
        forecast(HISTORY[:-1] + ["1000"])


def test_production_une_semaine_manquante_nan_ou_infinie_est_refusee():
    """commentaire : « A missing week must be refused, not averaged into a NaN forecast »."""
    for missing in (float("nan"), float("inf")):
        with pytest.raises(ValueError, match="finite number"):
            forecast(HISTORY[:-1] + [missing])


def test_production_une_semaine_fermee_chaque_annee_ne_fait_pas_tomber_la_prevision():
    """
    commentaire : « A week closed every year has a zero coefficient and says
    nothing about the level ». La dernière semaine de l'historique est fermée :
    le niveau est la moyenne des quatre semaines ouvertes qui la précèdent, et
    la prévision de la semaine fermée vaut zéro.
    """
    history = [0.0 if week % SEASON == 51 else steady_shop(week) for week in range(3 * SEASON)]
    coefficients = seasonal_coefficients(history, SEASON)
    assert coefficients[51] == 0
    level = sum(history[w] / coefficients[w % SEASON] for w in range(151, 155)) / 4
    predicted = forecast(history, horizon=SEASON)
    assert all(math.isfinite(x) for x in predicted)
    assert predicted[0] == pytest.approx(level * coefficients[0], rel=1e-12)
    assert predicted[51] == 0


def test_production_un_historique_entierement_nul_prevoit_zero():
    assert forecast([0.0] * (2 * SEASON), horizon=2) == [0.0, 0.0]


def test_production_une_fenetre_d_une_semaine_ne_garde_que_la_derniere():
    history = [1000 * shape(w) for w in range(3 * SEASON)]
    history[-1] = 1500 * shape(155)
    # Pas 1650 : la semaine forte gonfle aussi le coefficient de sa propre position.
    assert forecast(history, window=1)[0] == pytest.approx(1414.285714, abs=1e-6)
    assert forecast(history, window=4)[0] == pytest.approx(1178.571429, abs=1e-6)


def test_production_une_fenetre_nulle_ou_negative_est_refusee():
    """Une fenêtre de zéro semaine faisait la moyenne de tout l'historique (`[-0:]`)."""
    for window in (0, -1, -4):
        with pytest.raises(ValueError, match="at least one week"):
            forecast(HISTORY, window=window)
    assert len(forecast(HISTORY, window=1)) == 1
