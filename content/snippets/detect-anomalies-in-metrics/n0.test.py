"""
Les séries sont construites par formule : les nombres sont les mêmes sur toutes
les machines et dans les deux langages, et n0.test.js affirme les mêmes.
"""

import ast
import math
import statistics
import time
from pathlib import Path

import pytest

import n0
from n0 import anomalies, scan

RESTING = 1200


def quiet_metric(minute: int) -> float:
    """Douze cents requêtes par minute, avec une petite oscillation qui se répète."""
    return RESTING + 40 * ((minute % 7) - 3)


QUIET = [quiet_metric(minute) for minute in range(60)]

TOTAL_RISE = 40 * 72
DRIFTING = [quiet_metric(m) if m < 48 else quiet_metric(m) + 40 * (m - 47) for m in range(120)]
STEPPING = [quiet_metric(m) if m < 48 else quiet_metric(m) + TOTAL_RISE for m in range(120)]


def gaussian_noise(count, mean=1000.0, sigma=50.0):
    """Bruit gaussien reproductible : Park-Miller puis Box-Muller, écrit à l'identique en JavaScript."""
    state, values = 1, []
    def uniform():
        nonlocal state
        state = (state * 16807) % 2147483647
        return state / 2147483647
    while len(values) < count:
        u, v = uniform(), uniform()
        values.append(mean + sigma * math.sqrt(-2 * math.log(u)) * math.cos(2 * math.pi * v))
    return values


def mean_std_scan(series, window, threshold=3.5, include_point=False):
    """Le piège de la docstring : moyenne et écart type, fenêtre avec ou sans le point jugé."""
    flagged = []
    for index in range(window, len(series)):
        start = index - window + (1 if include_point else 0)
        reference = series[start : index + (1 if include_point else 0)]
        mean, spread = statistics.fmean(reference), statistics.pstdev(reference)
        if abs(series[index] - mean) > threshold * spread:
            flagged.append(index)
    return flagged


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_une_derive_lente_n_est_jamais_signalee():
    """
    breaking_point : « Le test fait grimper la métrique de quarante points par
    minute pendant plus d'une heure […] Pas un seul point n'est signalé ».
    Témoin : la même hausse d'un coup est signalée.
    """
    assert sum(1 for m in range(120) if m >= 48) == 72  # plus d'une heure
    assert anomalies(DRIFTING) == []
    assert anomalies(STEPPING) != []


def test_point_de_rupture_la_serie_finit_a_plus_du_triple_de_son_niveau_de_repos():
    """breaking_point : « la série finit à plus du triple de son niveau de repos »."""
    assert DRIFTING[-1] == quiet_metric(119) + TOTAL_RISE == STEPPING[-1] == 3960
    assert DRIFTING[-1] > 3 * RESTING


def test_point_de_rupture_chaque_pas_reste_en_deca_de_l_ecart_tolere():
    """
    breaking_point : « chaque pas reste loin en deçà de l'écart toléré, et la
    fenêtre a déjà avalé les précédents ». Le pas (40) vaut 13 % de l'écart
    toléré le plus étroit (311,346). Précision : l'écart mesuré, lui, monte
    jusqu'à 96 % de la tolérance ; la dérive passe à 4 % de l'alerte.
    """
    verdicts = scan(DRIFTING)
    narrowest = min(verdict.limit for verdict in verdicts)
    assert narrowest == pytest.approx(311.346)
    assert 40 / narrowest < 0.13
    assert round(max(v.deviation / v.limit for v in verdicts), 4) == 0.9636
    # La fenêtre a avalé les pas : l'habituel suit la série.
    assert verdicts[-1].usual > 3000


def test_point_de_rupture_la_marche_est_signalee_des_sa_premiere_minute_et_douze_minutes_seulement():
    """
    breaking_point : « La même hausse totale livrée d'un coup est signalée dès
    sa première minute, et pour une douzaine de minutes seulement : elle aussi
    devient la nouvelle normale ».
    """
    assert [verdict.index for verdict in anomalies(STEPPING)] == list(range(48, 60))


# ---------------------------------------------------------------------------
# Autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_signale_une_pointe_et_rien_d_autre():
    series = list(QUIET)
    series[40] = 4800.0
    assert [verdict.index for verdict in anomalies(series)] == [40]


def test_le_verdict_porte_le_raisonnement_pas_seulement_un_booleen():
    """
    docstring : « "measured 4800, usual 1200, allowed up to 1511" is already half
    the diagnosis, and it is the same three numbers the threshold itself used » ;
    verdict_rationale : « le test la vérifie nombre par nombre ».
    """
    series = list(QUIET)
    series[40] = 4800.0
    verdict = anomalies(series)[0]
    assert verdict.value == 4800.0
    assert verdict.usual == pytest.approx(1200.0)
    assert verdict.deviation == pytest.approx(3600.0)
    assert verdict.limit == pytest.approx(311.346, abs=1e-9)
    assert round(verdict.usual + verdict.limit) == 1511
    assert verdict.is_anomaly == (verdict.deviation > verdict.limit)


def test_une_premiere_pointe_ne_cache_pas_la_seconde():
    """docstring : la médiane et l'écart absolu médian ne sont pas entraînés par un incident."""
    series = list(QUIET)
    series[40] = 4800.0
    series[41] = 4700.0
    assert [verdict.index for verdict in anomalies(series)] == [40, 41]


def test_moyenne_et_ecart_type_une_pointe_assez_grosse_elargit_la_bande():
    """
    docstring : « One incident drags both, so a large enough spike widens the
    very band that was supposed to catch it ». Sur une fenêtre qui précède le
    point, une pointe à 20 000 cache la suivante à 4 800 ; sur une fenêtre de
    douze qui contient le point, aucune pointe, si grosse soit-elle, ne dépasse
    3,5 écarts types (le maximum est 11/√12 ≈ 3,18). Témoin : N0 signale.
    Constat sur l'exemple des tests (4 800 puis 4 700) : la moyenne et l'écart
    type signalent aussi les deux ; il faut une pointe plus grosse.
    """
    series = list(QUIET)
    series[40], series[41] = 20000.0, 4800.0
    assert mean_std_scan(series, 24) == [40]
    assert [v.index for v in anomalies(series)] == [40, 41]
    spike = list(QUIET)
    spike[40] = 1e9
    assert mean_std_scan(spike, 12, include_point=True) == []
    assert [v.index for v in anomalies(spike, window=12)] == [40]
    example = list(QUIET)
    example[40], example[41] = 4800.0, 4700.0
    assert mean_std_scan(example, 24) == [40, 41]


def test_la_mediane_resiste_jusqu_a_moins_de_la_moitie_de_la_fenetre():
    """
    docstring : « The median and the median absolute deviation ignore up to half
    the window ». Onze valeurs aberrantes sur vingt-quatre : l'habituel reste à
    1 320, mais l'écart toléré quadruple (1 245 au lieu de 311) ; « ignorer » est
    trop fort. Douze, exactement la moitié : l'habituel part à 50 660. Sans
    aberration, 1 180 et 311.
    """
    base = [quiet_metric(m) for m in range(24)]
    judged = []
    for outliers in (0, 11, 12):
        series = [100000.0] * outliers + base[outliers:] + [1200.0]
        judged.append(scan(series)[0])
    assert (judged[0].usual, round(judged[0].limit, 3)) == (1180.0, 311.346)
    assert (judged[1].usual, round(judged[1].limit, 3)) == (1320.0, 1245.384)
    assert judged[2].usual == 50660.0


def test_le_facteur_1_4826_met_l_ecart_absolu_median_a_l_echelle_d_un_ecart_type():
    """Commentaire NORMAL_SCALE : « on the same footing as a standard deviation for normally distributed data »."""
    assert n0.NORMAL_SCALE == round(1 / statistics.NormalDist().inv_cdf(0.75), 4)
    alternating = [0.0, 2.0] * 12 + [1.0]
    assert scan(alternating)[0].limit == pytest.approx(3.5 * 1.4826)


@pytest.mark.xfail(
    strict=True,
    reason=(
        "INFIRMÉ : « so that a threshold of 3.5 keeps the meaning it has everywhere "
        "else ». Sur du bruit gaussien pur, 3,5 écarts types devraient signaler 0,047 % "
        "des points ; avec la fenêtre de 24 par défaut, l'écart absolu médian estimé sur "
        "24 points est si bruité que 0,75 % des points sont signalés, seize fois plus, "
        "soit une dizaine d'alertes par jour sur une métrique saine à la minute"
    ),
)
def test_infirme_le_seuil_de_3_5_garde_son_sens_sur_une_fenetre_de_24():
    noise = gaussian_noise(20000)
    nominal = 2 * (1 - statistics.NormalDist().cdf(3.5))
    rate = len(anomalies(noise)) / (len(noise) - 24)
    assert rate < 2 * nominal


def test_constat_taux_de_fausses_alertes_sur_bruit_gaussien():
    """Mesure de l'infirmation précédente : entre 0,5 % et 1 % à 24, plus de 2 % à 12 (la fenêtre de l'essai)."""
    noise = gaussian_noise(20000)
    assert 0.005 < len(anomalies(noise)) / (len(noise) - 24) < 0.01
    assert len(anomalies(noise, window=12)) / (len(noise) - 12) > 0.02


def test_une_serie_plus_courte_que_la_fenetre_ne_recoit_aucun_verdict():
    """docstring de scan : « The first `window` points get no verdict at all »."""
    assert scan([1.0, 2.0, 3.0]) == []
    assert [v.index for v in scan(QUIET)][0] == 24
    assert len(scan(QUIET)) == 60 - 24


def test_l_habituel_est_la_mediane_de_la_fenetre_qui_precede():
    """Commentaires de Verdict : « median of the window that came before » ; écart et limite."""
    series = list(QUIET)
    series[30] = 9999.0
    verdict = scan(series)[30 - 24 + 1]  # le point 31 a le 30 dans sa fenêtre
    assert verdict.usual == statistics.median(series[7:31])
    assert verdict.deviation == abs(series[31] - verdict.usual)


def test_une_metrique_constante_n_est_une_anomalie_qu_au_premier_mouvement():
    assert anomalies([500.0] * 30) == []
    verdict = anomalies([500.0] * 29 + [501.0])[0]
    assert verdict.limit == 0.0
    assert verdict.deviation == 1.0


def test_anomalies_est_le_sous_ensemble_de_scan():
    """docstring d'anomalies : « The subset a pager should see, each one still carrying its numbers »."""
    series = list(QUIET)
    series[40] = 4800.0
    assert anomalies(series) == [v for v in scan(series) if v.is_anomaly]


def test_l_extrait_n_importe_que_la_bibliotheque_standard():
    """docstring : « standard library only » ; risks.data_egress : none."""
    source = ast.parse(Path(__file__).with_name("n0.py").read_text(encoding="utf-8"))
    assert {n.module for n in ast.walk(source) if isinstance(n, ast.ImportFrom)} == {"dataclasses", "statistics"}
    assert not [n for n in ast.walk(source) if isinstance(n, ast.Import)]


def test_deux_executions_rendent_les_memes_verdicts():
    """risks.deterministic : true ; scenario : « se rejouer à l'identique »."""
    assert scan(DRIFTING) == scan(list(DRIFTING))


@pytest.mark.xfail(
    strict=True,
    reason=(
        "INFIRMÉ : la docstring N1 et le verdict disent qu'aucun seuil sur une série "
        "unique, « N0's included », ne sonnera pour la minute de trafic de nuit à "
        "erreurs de jour. Dans la série des tests N1, où cette minute suit la nuit, N0 "
        "signale les erreurs aux minutes 90 et 91, et le trafic à la minute 91 : la "
        "fenêtre glissante juge contre les minutes précédentes, pas contre la plage de "
        "toute l'exploitation"
    ),
)
def test_infirme_n0_ne_sonne_pas_pour_les_minutes_que_n1_signale():
    def wobble(minute, metric):
        step = minute * (0.6180339887498949 + 0.1 * metric)
        return step - math.floor(step) - 0.5
    day = [[1000 + 80 * wobble(m, 0), 10 + wobble(m, 1), 130 + 10 * wobble(m, 2)] for m in range(45)]
    night = [[300 + 80 * wobble(m, 3), 3 + wobble(m, 4), 60 + 10 * wobble(m, 5)] for m in range(45)]
    rows = day + night + [[320.0, 9.6, 62.0], [980.0, 9.8, 63.0]]
    flagged = {v.index for metric in range(3) for v in anomalies([row[metric] for row in rows])}
    assert not flagged & {90, 91}


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_serie_vide():
    assert scan([]) == []
    assert anomalies([]) == []


def test_production_douze_mille_minutes_et_une_semaine_en_fenetre_d_un_jour():
    started = time.monotonic()
    assert anomalies([quiet_metric(m) for m in range(12000)]) == []
    assert len(scan([quiet_metric(m) for m in range(10080)], window=1440)) == 10080 - 1440
    assert time.monotonic() - started < 30


def test_production_valeurs_aux_limites_du_seuil():
    """Un écart égal à la limite n'est pas une anomalie ; seuil zéro : tout écart non nul sonne."""
    assert anomalies([500.0] * 30) == []  # écart 0, limite 0
    verdicts = anomalies(QUIET[:30], threshold=0)
    assert all(v.deviation > 0 for v in verdicts)
    assert len(verdicts) == sum(1 for v in scan(QUIET[:30]) if v.deviation > 0)


def test_production_valeurs_negatives_et_tres_grandes():
    shifted = [v - 10_000 for v in QUIET]
    shifted[40] = 10_000
    assert [v.index for v in anomalies(shifted)] == [40]
    huge = [v * 1e290 for v in QUIET]
    huge[40] = 4800 * 1e290
    assert [v.index for v in anomalies(huge)] == [40]


def test_production_un_point_manquant_nan_n_est_jamais_signale():
    """Constat : un NaN (point manquant) n'est pas une anomalie, et la pointe suivante reste signalée."""
    series = list(QUIET)
    series[30] = float("nan")
    series[40] = 4800.0
    assert [v.index for v in anomalies(series)] == [40]


@pytest.mark.xfail(
    strict=True,
    reason=(
        "DÉFAUT : une métrique de comptage nulle plus d'une minute sur deux (des "
        "erreurs, typiquement) a un écart absolu médian nul : chaque erreur isolée "
        "sonne. Le besoin est d'être réveillé « pas le reste du temps »"
    ),
)
def test_defaut_une_metrique_de_comptage_presque_toujours_nulle_sonne_a_chaque_unite():
    errors = [0.0] * 30 + [1.0] + [0.0] * 5 + [1.0] + [0.0] * 5
    assert anomalies(errors) == []


def test_production_une_fenetre_nulle_leve_une_erreur_de_valeur():
    """Python lève StatisticsError (sous-classe de ValueError) ; le JavaScript, lui, rend des NaN (DÉFAUT côté js)."""
    with pytest.raises(ValueError):
        scan([1.0, 2.0, 3.0], window=0)
