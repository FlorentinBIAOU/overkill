import ast
import math
import re
import time
from pathlib import Path

import numpy as np
import pytest

from n0 import forecast as forecast_n0
from n1 import calendar_features, fit, forecast

SEASON = 52
ESSAI = Path(__file__).parents[2] / "tryouts" / "live" / "forecast-weekly-sales.js"


def growing_shop(week: int) -> float:
    """
    Trois ans d'un magasin qui grandit de deux cent huit par an.

    Un niveau, une tendance droite, une vague annuelle avec une seconde
    harmonique, et une petite ondulation pour que la série ne soit pas
    exactement la forme du modèle. Aucun tirage, aucun fichier.
    """
    return (
        800
        + 4 * week
        + 150 * math.sin(2 * math.pi * week / SEASON)
        + 60 * math.cos(4 * math.pi * week / SEASON)
        + 20 * ((week % 7) - 3)
    )


def noise(count: int, seed: int = 20260915) -> list[float]:
    """Bruit uniforme dans [-0,5 ; 0,5), générateur MINSTD : identique en JavaScript."""
    values, state = [], seed
    for _ in range(count):
        state = state * 48271 % 2147483647
        values.append(state / 2147483647 - 0.5)
    return values


def essai_histories() -> list[list[float]]:
    """Les historiques des cas de l'essai, lus dans le fichier de l'essai lui-même."""
    inputs = re.findall(r"input: '([^']*)'", ESSAI.read_text(encoding="utf-8"))
    return [[float(n) for n in re.findall(r"-?\d+(?:\.\d+)?", text)] for text in inputs]


HISTORY = [growing_shop(week) for week in range(3 * SEASON)]
NEXT_WEEK_IN_TRUTH = growing_shop(3 * SEASON)
REGIME_CHANGE = [growing_shop(week) * (0.7 if week >= 136 else 1.0) for week in range(3 * SEASON)]
# Quatre ans, rupture au début de la quatrième année : un cycle complet d'après rupture.
REGIME_CHANGE_ONE_CYCLE_AFTER = [growing_shop(week) * (0.7 if week >= 156 else 1.0) for week in range(4 * SEASON)]


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_une_rupture_de_regime_est_moyennee():
    """
    « Les vingt dernières semaines s'installent à un niveau nettement plus bas :
    l'ajustement coupe la poire en deux entre l'ancien monde et le nouveau, et
    prévoit un niveau que le magasin n'a plus atteint depuis cinq mois. »
    """
    predicted = forecast(fit(REGIME_CHANGE))[0]
    new_world = growing_shop(156) * 0.7
    old_world = growing_shop(156)

    assert predicted == pytest.approx(1310.320702, abs=1e-6)
    assert new_world < predicted < old_world  # la poire coupée en deux
    assert predicted > max(REGIME_CHANGE[-20:])  # jamais atteint en vingt semaines

    # Témoin : sans la rupture, la même série est prévue à 2 % près.
    assert abs(forecast(fit(HISTORY))[0] - NEXT_WEEK_IN_TRUTH) / NEXT_WEEK_IN_TRUTH < 0.02


def test_point_de_rupture_les_moindres_carres_pesent_chaque_semaine_pareil():
    """
    « Les moindres carrés pèsent une semaine d'il y a trois ans exactement comme
    la semaine dernière. » La solution annule le gradient de la somme des carrés
    NON pondérée : Xᵀ (X b − y) = 0. Une pondération la déplacerait.
    """
    model = fit(REGIME_CHANGE)
    design = np.array([calendar_features(w, SEASON, 2) for w in range(156)])
    gradient = design.T @ (design @ np.array(model["coefficients"]) - np.array(REGIME_CHANGE))
    assert np.max(np.abs(gradient)) < 1e-6 * np.max(np.abs(design.T @ np.array(REGIME_CHANGE)))


def test_point_de_rupture_l_essai_du_concurrent_prevoit_plus_de_mille_et_lit_encore_une_croissance():
    """
    Essai, cas qui échoue : « moins de neuf cents pains par semaine depuis
    l'ouverture d'un concurrent, il y a vingt semaines, et la prévision en
    annonce plus de mille […] et lit encore une croissance de plus de
    quatre-vingts pains par an sur un commerce qui a perdu trente pour cent de
    ses ventes ».
    """
    up, _, _, competitor = essai_histories()
    assert len(competitor) == 104
    # La rupture est bien il y a vingt semaines, et elle vaut bien -30 %.
    assert competitor[:84] == up[:84] and competitor[84] != up[84]
    assert all(c / u == pytest.approx(0.7, abs=0.002) for c, u in zip(competitor[84:], up[84:]))

    model = fit(competitor)
    assert max(competitor[-20:]) < 900
    assert forecast(model)[0] > 1000
    assert model["coefficients"][1] > 80

    # Témoin : sans concurrent, la prévision prolonge la dernière semaine.
    assert abs(forecast(fit(up))[0] - up[-1]) / up[-1] < 0.05


# ---------------------------------------------------------------------------
# Autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_prevoit_la_semaine_suivante_a_deux_pour_cent_pres():
    predicted = forecast(fit(HISTORY))[0]
    assert abs(predicted - NEXT_WEEK_IN_TRUTH) / NEXT_WEEK_IN_TRUTH < 0.02


def test_les_deux_langages_donnent_le_meme_nombre_a_la_sixieme_decimale():
    """numpy d'un côté, équations normales et Gauss de l'autre : le même nombre."""
    assert forecast(fit(HISTORY))[0] == pytest.approx(1481.923623, abs=1e-6)


def test_relit_la_croissance_annuelle_dans_la_serie():
    """
    scenario : « la croissance annuelle lue dans vos propres ventes » ;
    docstring : « coefficients[1] est la croissance par cycle, dans l'unité de
    la série ». La série grandit de 4 par semaine, donc 208 par an.
    """
    assert fit(HISTORY)["coefficients"][1] == pytest.approx(208, abs=2)


def test_le_coefficient_est_la_croissance_par_cycle_donc_par_an_avec_la_saison_de_52_semaines():
    """
    docstring : « it is the growth per cycle, per year with the default 52-week
    season ». Une série qui grandit d'une unité par semaine : 13 avec une saison
    de 13 semaines, 52 avec la saison par défaut.
    """
    series = [float(w) + 10 * math.sin(2 * math.pi * w / 13) for w in range(104)]
    assert fit(series, season_length=13)["coefficients"][1] == pytest.approx(13, abs=1e-9)
    assert fit([float(w) for w in range(104)])["coefficients"][1] == pytest.approx(52, abs=1e-6)


def test_estime_la_pente_que_n0_ignore():
    """
    verdict_rationale : « Il estime la pente que N0 ignore. » Sur la même série
    qui grandit, N0 se trompe toujours par défaut ; N1 se trompe des deux côtés,
    et moins.
    """
    ends = range(104, 156)
    errors_n0 = [forecast_n0(HISTORY[:end])[0] - HISTORY[end] for end in ends]
    errors_n1 = [forecast(fit(HISTORY[:end]))[0] - HISTORY[end] for end in ends]
    assert all(e < 0 for e in errors_n0)
    assert any(e < 0 for e in errors_n1) and any(e > 0 for e in errors_n1)
    assert np.mean(np.abs(errors_n1)) < np.mean(np.abs(errors_n0)) / 2


def test_prolonge_la_tendance_sur_six_mois():
    six_months = forecast(fit(HISTORY), horizon=26)
    assert six_months[-1] - six_months[0] > 80


def test_sur_une_serie_plate_n0_et_n1_rendent_la_meme_prevision_a_l_erreur_d_arrondi_pres():
    """
    verdict_rationale : « sur une série plate les deux niveaux rendent la même
    prévision, à l'erreur d'arrondi près », et N1 n'y lit aucune croissance.
    """
    flat = [750.0] * (2 * SEASON)
    model = fit(flat)
    assert forecast(model)[0] == pytest.approx(forecast_n0(flat)[0], abs=1e-9)
    assert model["coefficients"][1] == pytest.approx(0.0, abs=1e-6)


def test_refuse_un_historique_plus_court_que_le_nombre_de_variables():
    """
    Garde « fewer weeks of history than features », atteinte en premier : cinq
    semaines pour six variables, ou un cycle complet quand `harmonics` demande
    plus de variables qu'il n'y a de semaines (30 paires : 62 variables).
    """
    with pytest.raises(ValueError, match="fewer weeks"):
        fit(HISTORY[:5])
    with pytest.raises(ValueError, match="fewer weeks"):
        fit(HISTORY[:SEASON], harmonics=30)
    # Témoin : 25 paires, 52 variables pour 52 semaines, accepté.
    assert len(fit(HISTORY[:SEASON], harmonics=25)["coefficients"]) == 52


def test_refuse_moins_d_un_cycle_complet_et_accepte_exactement_un_cycle():
    """
    docstring : « Less than one full cycle of history cannot tell the trend from
    the season, so it is refused ». Six semaines passaient la garde des
    variables ; elles sont désormais refusées, comme 51. Exactement 52 : accepté.
    """
    for weeks in (6, 10, 20, 26, SEASON - 1):
        with pytest.raises(ValueError, match="less than one full cycle"):
            fit(HISTORY[:weeks])
    assert len(fit(HISTORY[:SEASON])["coefficients"]) == 6
    # Le cycle est celui qu'on passe : 13 semaines suffisent pour une saison de 13.
    assert len(fit(HISTORY[:13], season_length=13)["coefficients"]) == 6
    with pytest.raises(ValueError, match="less than one full cycle"):
        fit(HISTORY[:12], season_length=13)


def test_la_ligne_de_la_matrice_est_tout_le_modele():
    """
    name : « tendance et harmoniques » ; docstring : « une constante, le nombre
    de cycles écoulés, et quelques paires de sinus et de cosinus dont la période
    est la saison ». « C'est tout le modèle » : la prévision est ce produit.
    """
    row = calendar_features(13, SEASON, 2)
    assert row == pytest.approx([1.0, 0.25, 1.0, 0.0, 0.0, -1.0], abs=1e-12)

    model = fit(HISTORY)
    expected = sum(c * x for c, x in zip(model["coefficients"], calendar_features(160, SEASON, 2)))
    assert forecast(model, horizon=5)[4] == pytest.approx(expected, abs=1e-9)


def test_six_coefficients_lisibles_un_par_un_sur_cent_cinquante_six_nombres():
    """unavailable_reason N2 : « cent cinquante-six nombres, dont N1 tire déjà six coefficients »."""
    assert len(HISTORY) == 156
    model = fit(HISTORY)
    assert len(model["coefficients"]) == 6
    assert set(model) == {"coefficients", "season_length", "harmonics", "start"}


def test_compter_en_cycles_garde_la_matrice_a_des_echelles_comparables():
    """
    « Compter la tendance en cycles plutôt qu'en semaines […] garde les colonnes
    de la matrice de conception à des échelles comparables » (JS : « garde ces
    équations bien conditionnées »).
    """
    in_cycles = np.array([calendar_features(w, SEASON, 2) for w in range(156)])
    in_weeks = in_cycles.copy()
    in_weeks[:, 1] *= SEASON

    def diagonal_ratio(x):
        diagonal = np.diag(x.T @ x)
        return diagonal.max() / diagonal.min()

    assert diagonal_ratio(in_cycles) < 10
    assert diagonal_ratio(in_weeks) > 10_000
    assert np.linalg.cond(in_cycles) < np.linalg.cond(in_weeks) / 10


def _peak_and_dip(harmonics: int, weeks: int = 156):
    """Un pic de Noël (semaine 50, trois semaines de large) et un creux d'été (semaine 30), bruités."""
    def season(p):
        distance = min(abs(p - 50), SEASON - abs(p - 50))
        return 1000 + 350 * math.exp(-(distance**2) / 18) - 200 * math.exp(-((p - 30) ** 2) / 50)

    bruit = noise(weeks + SEASON)
    series = [season(w % SEASON) + 120 * bruit[w] for w in range(weeks)]
    model = fit(series, harmonics=harmonics)
    ahead = forecast(model, horizon=SEASON)
    error = sum(abs(a - season((weeks + i) % SEASON)) for i, a in enumerate(ahead)) / SEASON
    return ahead, error


def test_deux_paires_placent_un_pic_de_noel_et_un_creux_d_ete():
    """Docstring Python : « Two pairs are enough to place a Christmas peak and a summer dip »."""
    ahead, _ = _peak_and_dip(2)
    # L'horizon commence en position 0 du cycle : l'indice est la semaine de l'année.
    assert 47 <= int(np.argmax(ahead)) <= 51
    assert 27 <= int(np.argmin(ahead)) <= 33


def test_un_pic_de_quelques_semaines_demande_plus_de_paires_pour_atteindre_toute_sa_hauteur():
    """
    Docstring Python : « a peak only a few weeks wide needs more pairs to reach
    its full height ». Pic de trois semaines culminant à 1 350 : deux paires
    plafonnent à 1 239, quatre à 1 325, six l'atteignent ; l'erreur moyenne suit
    (36,5, 14,6, 7,8).
    """
    (ahead_two, error_two), (ahead_four, error_four), (ahead_six, error_six) = (
        _peak_and_dip(h) for h in (2, 4, 6)
    )
    assert max(ahead_two) < 1350 - 80
    assert max(ahead_two) < max(ahead_four) < max(ahead_six)
    assert max(ahead_six) > 1350 - 20
    assert error_six < error_four < error_two


def test_n1_n_emploie_que_numpy_hors_bibliotheque_standard():
    """risks : vendor_lock library ; côté Python, la seule bibliothèque est numpy."""
    source = (Path(__file__).parent / "n1.py").read_text(encoding="utf-8")
    modules = set()
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, ast.Import):
            modules |= {alias.name.split(".")[0] for alias in node.names}
        elif isinstance(node, ast.ImportFrom):
            modules.add(node.module.split(".")[0])
    assert modules == {"math", "numpy"}


def test_n1_est_deterministe():
    """risks : deterministic true ; scenario : « se rejoue à l'identique »."""
    first = forecast(fit(list(HISTORY)), horizon=8)
    assert all(forecast(fit(list(HISTORY)), horizon=8) == first for _ in range(20))


def test_un_ajustement_et_une_prevision_prennent_moins_d_une_milliseconde():
    """latency : « <1 ms », trois ans d'historique. Meilleur de cinq séries de cinquante appels."""
    runs = []
    for _ in range(5):
        start = time.perf_counter()
        for _ in range(50):
            forecast(fit(HISTORY))
        runs.append((time.perf_counter() - start) / 50)
    assert min(runs) < 0.001


def test_reajuster_sur_un_cycle_complet_apres_la_rupture_rapproche_la_prevision():
    """
    escalate_when : « réajuster sur la période qui suit la rupture dès qu'elle
    couvre un cycle complet ». Quatre ans, rupture au début de la quatrième : la
    prévision réajustée revient à 3 % du réalisé, deux fois plus près que
    l'ajustement sur tout l'historique. (Le test du tour 1 réajustait sur vingt
    semaines, désormais refusées : série et bornes refaites.)
    """
    truth = growing_shop(4 * SEASON) * 0.7
    refit = forecast(fit(REGIME_CHANGE_ONE_CYCLE_AFTER[-SEASON:]))[0]
    whole = forecast(fit(REGIME_CHANGE_ONE_CYCLE_AFTER))[0]
    assert abs(refit - truth) / truth < 0.03
    assert abs(refit - truth) < abs(whole - truth) / 2


def test_apres_reajustement_sur_un_cycle_complet_le_coefficient_de_croissance_se_relit():
    """
    escalate_when : « puis relire le coefficient de croissance ». Après la
    rupture la série vaut 0,7 × (800 + 4 t + …) : +145,6 par an ; un cycle
    d'après rupture en lit 138,8.
    """
    growth = fit(REGIME_CHANGE_ONE_CYCLE_AFTER[-SEASON:])["coefficients"][1]
    assert growth == pytest.approx(138.8, abs=0.1)
    assert 0.9 * 145.6 < growth < 1.1 * 145.6


def test_sur_vingt_semaines_l_extrait_refuse_et_la_tendance_se_confond_avec_la_saison():
    """
    escalate_when : « Plus tôt, l'extrait refuse l'ajustement : sur vingt
    semaines, la tendance et la saison se confondent, et le coefficient de
    croissance ne se relit plus ». Le refus, puis la raison : les mêmes moindres
    carrés, résolus hors de l'extrait sur ces vingt semaines, lisent -7 760 par
    an pour +145,6.
    """
    with pytest.raises(ValueError, match="less than one full cycle"):
        fit(REGIME_CHANGE[-20:])
    design = np.array([calendar_features(w, SEASON, 2) for w in range(20)])
    growth = np.linalg.lstsq(design, np.array(REGIME_CHANGE[-20:]), rcond=None)[0][1]
    assert growth == pytest.approx(-7759.68, abs=0.01)


def test_l_essai_lit_la_croissance_des_boulangeries_et_refuse_cinq_semaines():
    """
    Essai : « Deux ans dans une boulangerie qui monte », « Deux ans sans
    tendance, mais avec des saisons », « Cinq semaines d'historique » refusé.
    """
    up, flat, five, _ = essai_histories()
    assert len(up) == 104 and len(flat) == 104
    assert fit(up)["coefficients"][1] == pytest.approx(207.37, abs=0.01)
    assert abs(fit(flat)["coefficients"][1]) < 1
    assert len(five) == 5
    with pytest.raises(ValueError, match="fewer weeks of history than features"):
        fit(five)


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_une_entree_vide_est_refusee_par_une_erreur_nommee():
    """Le nombre de variables est calculé avant la matrice : plus d'IndexError sur `design[0]`."""
    with pytest.raises(ValueError, match="fewer weeks"):
        fit([])


def test_production_trois_cents_ans_de_semaines_terminent_vite_et_juste():
    history = [growing_shop(w) for w in range(100 * 3 * SEASON)]
    start = time.perf_counter()
    predicted = forecast(fit(history))[0]
    assert time.perf_counter() - start < 5
    # Le même nombre est affirmé en JavaScript.
    assert predicted == pytest.approx(63259.968239, abs=1e-5)


def test_production_une_semaine_manquante_est_refusee():
    """commentaire : « a missing week (None) becomes NaN here », puis la garde de finitude."""
    for missing in (None, float("nan"), float("inf")):
        with pytest.raises(ValueError, match="finite number"):
            fit(HISTORY[:-1] + [missing])


def test_production_un_historique_de_moins_d_un_cycle_ne_rend_pas_une_croissance_absurde():
    """Dix semaines rendaient +899 850 par an pour 208 : elles sont refusées, par une erreur nommée."""
    for weeks in (10, 20, 26):
        with pytest.raises(ValueError, match="less than one full cycle"):
            fit(HISTORY[:weeks])


def test_production_un_horizon_nul_rend_une_liste_vide():
    assert forecast(fit(HISTORY), horizon=0) == []
