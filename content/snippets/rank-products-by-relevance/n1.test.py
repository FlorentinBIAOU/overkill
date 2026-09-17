import json
import shutil
import subprocess
import time
from pathlib import Path

import numpy as np
import pytest
from sklearn.linear_model import LogisticRegression

import n0
from n1 import SIGNALS, learn_weights, pairs, rank

ICI = Path(__file__).parent

# A click log, the kind two weeks of traffic leaves behind. Each row is
# (text, availability, margin, popularity, clicked), and each page is one
# result list a shopper saw.
LOG = [
    [(1.0, 1.0, 0.30, 0.20, True), (0.5, 1.0, 0.55, 0.90, False), (0.0, 1.0, 0.60, 0.80, False)],
    [(1.0, 1.0, 0.25, 0.55, True), (0.5, 1.0, 0.50, 0.95, False), (0.0, 1.0, 0.45, 0.70, False)],
    [(0.5, 1.0, 0.35, 0.80, True), (0.5, 1.0, 0.65, 0.25, False)],
    [(1.0, 1.0, 0.20, 0.45, True), (1.0, 0.0, 0.60, 0.90, False)],
    [(1.0, 1.0, 0.40, 0.60, True), (0.5, 0.0, 0.55, 0.85, False), (0.0, 1.0, 0.50, 0.60, False)],
    [(0.5, 1.0, 0.30, 0.70, True), (0.5, 0.0, 0.45, 0.75, False)],
    [(1.0, 1.0, 0.45, 0.85, True), (1.0, 1.0, 0.30, 0.20, False)],
    [(0.5, 1.0, 0.25, 0.90, True), (0.0, 1.0, 0.70, 0.95, False)],
]

FLAT_MARGIN = [[(row[0], row[1], 0.40, row[3], row[4]) for row in rows] for rows in LOG]

# Un journal où l'acheteur a pris, sur chaque page, le produit le moins
# pertinent et le moins rentable : les poids appris sont tous négatifs ou nuls.
AGAINST_THE_SHOP = [
    [(0.0, 1.0, 0.10, 0.50, True), (1.0, 1.0, 0.90, 0.50, False)],
    [(0.5, 1.0, 0.20, 0.50, True), (0.5, 1.0, 0.80, 0.50, False)],
]


def page(rows):
    """
    Une page, dans l'ordre où elle a été affichée.

    Les lignes des journaux ci-dessus écrivent le produit cliqué en premier,
    par commodité de lecture. L'ordre d'affichage est l'inverse : les produits
    ignorés au-dessus, le clic en dessous — c'est la seule forme dont N1
    apprenne quelque chose, puisqu'il n'apparie un clic qu'aux produits montrés
    au-dessus de lui.
    """
    ordre = sorted(rows, key=lambda row: bool(row[4]))
    return [
        {"signals": dict(zip(("text", "availability", "margin", "popularity"), row[:4])),
         "clicked": row[4]}
        for row in ordre
    ]


def impressions(log=LOG):
    return [page(rows) for rows in log]


def synthetique(pages, vrais=(0.5, 0.3, 0.0, 0.2), graine=1):
    """
    Un journal dont on connaît la réponse : quatre produits par page, signaux
    tirés d'un générateur MINSTD (entier, identique en JavaScript), et
    l'acheteur prend toujours le meilleur produit selon `vrais`.
    """
    etat = graine
    log = []
    for _ in range(pages):
        items = []
        for _ in range(4):
            valeurs = []
            for _ in range(4):
                etat = etat * 48271 % 2147483647
                valeurs.append(etat % 101 / 100)
            items.append(tuple(valeurs))
        meilleur = max(range(4), key=lambda j: sum(v * s for v, s in zip(vrais, items[j])))
        # `page` remettra le clic en dernier : les trois autres sont au-dessus.
        log.append([items[j] + (j == meilleur,) for j in range(4)])
    return log


def learn_weights_en_javascript(journaux, regularisation=1.0):
    node = shutil.which("node")
    assert node, "node est requis pour comparer les deux implémentations"
    script = (
        f"import {{ learnWeights }} from {json.dumps((ICI / 'n1.js').as_uri())};"
        "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{"
        f"process.stdout.write(JSON.stringify(JSON.parse(d).map((j)=>learnWeights(j, {{ regularisation: {regularisation} }}))));}});"
    )
    sortie = subprocess.run(
        [node, "--input-type=module", "-e", script],
        input=json.dumps([impressions(j) for j in journaux]),
        capture_output=True, text=True, timeout=120, check=True,
    )
    return json.loads(sortie.stdout)


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_une_marge_identique_partout_donne_une_colonne_de_zeros():
    """« Le test donne la même marge à tous les produits de toutes les pages : la colonne correspondante ne contient plus que des zéros »."""
    rows, _ = pairs(impressions(FLAT_MARGIN))
    assert len(rows) > 0
    assert list(rows[:, SIGNALS.index("margin")]) == [0.0] * len(rows)


def test_point_de_rupture_le_poids_appris_vaut_exactement_zero():
    """« le poids appris vaut exactement zéro »."""
    weights = learn_weights(impressions(FLAT_MARGIN))
    assert weights["margin"] == 0.0
    assert weights["text"] > 0.0
    # Témoin : sur le journal où la marge a varié, le poids n'est pas nul.
    assert learn_weights(impressions())["margin"] != 0.0


def test_point_de_rupture_une_page_ou_seule_la_marge_differe_rend_deux_scores_identiques():
    """« une page où la marge est la seule différence entre deux produits ressort avec deux scores identiques »."""
    candidates = page([(0.5, 1.0, 0.10, 0.50, False), (0.5, 1.0, 0.90, 0.50, False)])
    scores = [row["score"] for row in rank(candidates, learn_weights(impressions(FLAT_MARGIN)))]
    assert scores[0] == scores[1]
    # Témoin : avec les poids du journal où la marge a varié, les deux scores diffèrent.
    temoin = [row["score"] for row in rank(candidates, learn_weights(impressions()))]
    assert temoin[0] != temoin[1]


def test_point_de_rupture_aucun_surcroit_de_trafic_ny_change_rien():
    """« aucun surcroît de trafic n'y changera rien : seul un changement de ce qu'on montre le peut »."""
    dix_fois = impressions(FLAT_MARGIN * 10)
    assert learn_weights(dix_fois)["margin"] == 0.0
    # Montrer une seule page où la marge varie suffit à rendre le poids non nul.
    montre_autrement = dix_fois + [page([(1.0, 1.0, 0.10, 0.5, True), (1.0, 1.0, 0.90, 0.5, False)])]
    assert learn_weights(montre_autrement)["margin"] != 0.0


# ---------------------------------------------------------------------------
# Les autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_une_paire_devient_deux_lignes_de_sens_oppose():
    """Docstring : « Each such pair becomes one training row, the difference […] Every pair is added in both directions »."""
    rows, labels = pairs([page(LOG[3])])
    assert list(labels) == [1, 0]
    assert list(rows[0]) == pytest.approx([0.0, 1.0, -0.4, -0.45])
    assert list(rows[1]) == pytest.approx([0.0, -1.0, 0.4, 0.45])


def test_les_deux_classes_sont_equilibrees():
    """Docstring : « That keeps the two classes balanced »."""
    _, labels = pairs(impressions(synthetique(50)))
    assert int(labels.sum()) * 2 == len(labels)


def test_une_ordonnee_a_lorigine_sortirait_nulle_sur_des_paires_symetriques():
    """Docstring : « it is why the model carries no intercept: a constant would shift both directions of the same pair the same way »."""
    rows, labels = pairs(impressions())
    avec = LogisticRegression(C=1.0, fit_intercept=True, max_iter=1000).fit(rows, labels)
    assert abs(avec.intercept_[0]) < 1e-6


def test_la_regression_redonne_les_poids_du_score_dorigine():
    """Docstring : « a logistic regression on those differences gives back the weights of the original score »."""
    vrais = {"text": 0.5, "availability": 0.3, "margin": 0.0, "popularity": 0.2}
    appris = learn_weights(impressions(synthetique(300, tuple(vrais.values()))))
    for name in SIGNALS:
        assert abs(appris[name] - vrais[name]) < 0.05, (name, appris)


def test_apprend_que_la_pertinence_et_le_stock_guident_les_acheteurs():
    weights = learn_weights(impressions())
    assert weights["text"] > weights["availability"] > 0
    # Shoppers in this log follow relevance far more than popularity.
    assert weights["popularity"] < weights["text"]


def test_le_journal_peut_contredire_la_boutique():
    # In this log the profitable products are the ones shoppers skip, so the
    # learnt margin weight comes out negative.
    assert learn_weights(impressions())["margin"] < 0


def test_python_et_javascript_apprennent_les_memes_poids_a_deux_decimales():
    """Test JavaScript : « Two decimals of agreement is what says the […] lines above are the same model »."""
    journaux = [LOG, FLAT_MARGIN, synthetique(300), AGAINST_THE_SHOP]
    for python, javascript in zip([learn_weights(impressions(j)) for j in journaux], learn_weights_en_javascript(journaux)):
        for name in SIGNALS:
            assert abs(python[name] - javascript[name]) < 0.01, (name, python, javascript)


def test_la_penalite_divisee_par_le_nombre_de_lignes_fait_le_meme_modele_pour_plusieurs_c():
    """
    Commentaire JS : « The penalty of scikit-learn's `C`, divided by the row count because the gradient above
    is a mean: it is what makes both versions fit one model. » Pour C = 0,1 et 1, sur un journal et sur le
    même journal triplé (trois fois plus de lignes, donc une pénalité relative trois fois plus faible),
    les deux langages rendent les mêmes poids à deux décimales.
    """
    journaux = [LOG, LOG * 3]
    for regularisation in (0.1, 1.0):
        python = [learn_weights(impressions(j), regularisation) for j in journaux]
        javascript = learn_weights_en_javascript(journaux, regularisation)
        for py, js in zip(python, javascript):
            for name in SIGNALS:
                assert abs(py[name] - js[name]) < 0.01, (regularisation, name, py, js)
    # Le nombre de lignes compte : le journal triplé n'apprend pas les mêmes poids, et JavaScript a suivi.
    assert abs(learn_weights(impressions(LOG))["text"] - learn_weights(impressions(LOG * 3))["text"]) > 0.03


def test_les_poids_appris_classent_une_nouvelle_page_comme_le_journal():
    weights = learn_weights(impressions())
    candidates = page([
        (0.0, 1.0, 0.70, 0.95, False),  # popular, profitable, off topic
        (1.0, 1.0, 0.20, 0.05, False),  # on topic, new, thin margin
    ])
    assert rank(candidates, weights)[0]["candidate"]["signals"]["text"] == 1.0


def test_les_poids_sont_sur_une_echelle_lisible_et_la_mise_a_lechelle_ne_change_aucun_ordre():
    """Docstring : « Dividing by the total absolute weight […] It changes no ranking »."""
    weights = learn_weights(impressions())
    assert sum(abs(value) for value in weights.values()) == pytest.approx(1.0)
    rows, labels = pairs(impressions())
    brut = LogisticRegression(C=1.0, fit_intercept=False, max_iter=1000).fit(rows, labels).coef_[0]
    candidates = [c for p in impressions() for c in p]
    ordre = [id(r["candidate"]) for r in rank(candidates, weights)]
    ordre_brut = [id(r["candidate"]) for r in rank(candidates, dict(zip(SIGNALS, brut)))]
    assert ordre == ordre_brut


def test_le_score_de_n1_est_une_somme_entre_moins_un_et_un_la_ou_n0_est_une_moyenne():
    """
    Docstring : « The signals shown to the shop stay the same; the score does not. Learned weights can be
    negative, so the score is a plain sum over weights whose absolute values add up to one, between minus
    one and one, where N0 takes a mean of weights that cannot be negative. »
    """
    weights = learn_weights(impressions())
    assert weights["margin"] < 0
    assert sum(abs(v) for v in weights.values()) == pytest.approx(1.0)
    candidat = page([(0.0, 0.0, 1.0, 0.0, False)])
    (ligne,) = rank(candidat, weights)
    assert ligne["score"] == pytest.approx(weights["margin"]) and ligne["score"] < 0
    assert ligne["candidate"]["signals"] == candidat[0]["signals"]
    # Somme, pas moyenne : bornes atteintes avec des signaux à 0 ou à 1.
    tous_positifs = {"text": 0.25, "availability": 0.25, "margin": 0.25, "popularity": 0.25}
    tous_negatifs = {name: -v for name, v in tous_positifs.items()}
    un = page([(1.0, 1.0, 1.0, 1.0, False)])
    assert rank(un, tous_positifs)[0]["score"] == 1.0
    assert rank(un, tous_negatifs)[0]["score"] == -1.0
    # Sur toutes les pages du journal synthétique, avec les poids appris : dans [-1, 1].
    for item in [c for p in impressions(synthetique(100)) for c in p]:
        assert -1.0 <= rank([item], weights)[0]["score"] <= 1.0
    # N0, lui, refuse ces poids : sa moyenne n'accepte pas de poids négatif.
    with pytest.raises(ValueError, match="nought or above"):
        n0.score(candidat[0]["signals"], weights)


def test_diviser_par_le_total_signe_inverserait_l_ordre_ou_l_effacerait():
    """
    Docstring de rank : « Not N0's mean: dividing by the signed total of learned weights would reverse the
    order when that total is negative, and wipe it out when it is nought. »
    """
    def moyenne_signee(signaux, poids):
        total = sum(poids[name] for name in SIGNALS)
        return sum(poids[name] * signaux[name] for name in SIGNALS) / total if total else 0.0

    weights = learn_weights(impressions(AGAINST_THE_SHOP))
    assert sum(weights.values()) < 0
    candidats = page([(1.0, 1.0, 0.9, 0.5, False), (0.0, 1.0, 0.1, 0.5, False)])
    somme = [r["score"] for r in rank(candidats, weights)]
    ordre_somme = [r["candidate"]["signals"]["text"] for r in rank(candidats, weights)]
    ordre_moyenne = [c["signals"]["text"] for c in sorted(candidats, key=lambda c: -moyenne_signee(c["signals"], weights))]
    assert somme[0] > somme[1]
    assert ordre_moyenne == list(reversed(ordre_somme))
    nuls = {"text": 0.5, "availability": 0.0, "margin": -0.5, "popularity": 0.0}
    assert [moyenne_signee(c["signals"], nuls) for c in candidats] == [0.0, 0.0]
    assert len({r["score"] for r in rank(candidats, nuls)}) == 2


def test_n0_refuse_les_poids_appris_negatifs_il_faut_servir_avec_la_fonction_de_n1():
    """
    verdict_rationale : « servez alors avec sa propre fonction : des poids appris peuvent être négatifs, et la
    moyenne de N0 les refuse » ; « une somme pondérée des mêmes signaux, rendus à côté du score ».
    """
    weights = learn_weights(impressions(AGAINST_THE_SHOP))
    assert min(weights.values()) < 0
    produits = [
        {"title": "pertinent et rentable", "tags": [], "in_stock": True, "margin": 0.9, "popularity": 0.5},
        {"title": "hors sujet et sans marge", "tags": [], "in_stock": True, "margin": 0.1, "popularity": 0.5},
    ]
    with pytest.raises(ValueError, match="nought or above"):
        n0.rank(produits, "pertinent", weights)
    candidates = [{"title": p["title"], "signals": n0.signals(p, "pertinent")} for p in produits]
    ranked = rank(candidates, weights)
    assert [r["candidate"]["title"] for r in ranked] == ["hors sujet et sans marge", "pertinent et rentable"]
    assert all(set(r["candidate"]["signals"]) == set(SIGNALS) and "score" in r for r in ranked)


def test_somme_ponderee_des_memes_signaux_meme_tri_stable_signaux_rendus():
    """
    Docstring de rank : « A sum weighted over the same signals, the same stable sort, the signals handed
    back with each candidate. » Pour des poids positifs dont la somme vaut un, l'ordre est celui de N0.
    """
    weights = {"text": 0.5, "availability": 0.25, "margin": 0.0, "popularity": 0.25}
    jumeaux = page([(0.5, 1.0, 0.1, 0.5, False)] * 3)
    for i, c in enumerate(jumeaux):
        c["id"] = i
    ranked = rank(jumeaux, weights)
    assert [r["candidate"]["id"] for r in ranked] == [0, 1, 2]
    assert ranked[0]["candidate"]["signals"] == jumeaux[0]["signals"]
    # Pour des poids positifs, l'ordre est celui de N0.
    produits = [{"title": t, "tags": [], "in_stock": s, "margin": m, "popularity": p}
                for t, s, m, p in [("a", True, 0.2, 0.9), ("b", False, 0.9, 0.1), ("c", True, 0.5, 0.5)]]
    ordre_n0 = [r["product"]["title"] for r in n0.rank(produits, "a", weights)]
    ordre_n1 = [r["candidate"]["title"] for r in rank(
        [{"title": p["title"], "signals": n0.signals(p, "a")} for p in produits], weights)]
    assert ordre_n0 == ordre_n1


def test_deterministe_le_meme_journal_redonne_les_memes_poids():
    """risks.deterministic : true."""
    assert learn_weights(impressions()) == learn_weights(impressions())


def test_un_journal_sans_un_clic_nenseigne_rien():
    silent = [page([row[:4] + (False,) for row in rows]) for rows in LOG]
    with pytest.raises(ValueError, match="nothing to learn from"):
        learn_weights(silent)


def test_une_page_dun_seul_resultat_ne_fait_aucune_paire():
    rows, _ = pairs([page([LOG[0][0]])])
    assert len(rows) == 0


def test_servir_une_page_de_cinq_produits_prend_moins_dune_milliseconde():
    """latency « <1 ms » : mille classements de page en moins d'une seconde (le service, pas l'apprentissage)."""
    weights = learn_weights(impressions())
    candidates = impressions()[0] + impressions()[4]
    debut = time.perf_counter()
    for _ in range(1000):
        rank(candidates, weights)
    assert time.perf_counter() - debut < 1.0


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_un_journal_vide_et_des_pages_vides_levent_lerreur_nommee():
    with pytest.raises(ValueError, match="nothing to learn from"):
        learn_weights([])
    with pytest.raises(ValueError, match="nothing to learn from"):
        learn_weights([[], []])
    assert rank([], {"text": 1.0, "availability": 0.0, "margin": 0.0, "popularity": 0.0}) == []


def test_production_cent_fois_le_journal_du_test_apprend_vite_et_les_memes_poids():
    debut = time.perf_counter()
    weights = learn_weights(impressions(LOG * 100))
    assert time.perf_counter() - debut < 20.0
    assert weights["text"] > weights["availability"] > 0 > weights["margin"]


def test_production_valeurs_aux_limites_tous_les_signaux_a_zero_ou_a_un():
    extremes = [[(1.0, 1.0, 1.0, 1.0, True), (0.0, 0.0, 0.0, 0.0, False)]]
    weights = learn_weights(impressions(extremes))
    assert all(v == pytest.approx(0.25) for v in weights.values())


def test_production_un_journal_sans_aucune_difference_leve_lerreur_nommee():
    identiques = [[(0.5, 1.0, 0.3, 0.2, True), (0.5, 1.0, 0.3, 0.2, False)]]
    with pytest.raises(ValueError, match="nothing to learn from"):
        learn_weights(impressions(identiques))


def test_production_un_signal_nul_en_chaine_ou_nan_est_refuse_comme_en_javascript():
    """Commentaire : « The type is checked, not only the range: a signal logged as None or as a string is a broken log »."""
    for sale in (None, "0.9", float("nan"), float("inf"), True):
        with pytest.raises(ValueError, match="between 0 and 1"):
            learn_weights([page([(0.5, 1.0, 0.3, sale, True), (0.4, 1.0, 0.3, 0.2, False)])])


def test_production_des_signaux_hors_echelle_sont_refuses():
    """
    Docstring : « The score is built on the same four signals as N0, each between nought and one » ; une
    popularité en pourcentage lève, dans les deux langages (JavaScript : RangeError). Limites 0 et 1 acceptées.
    """
    en_pourcent = [[(r[0], r[1], r[2], r[3] * 100, r[4]) for r in rows] for rows in LOG]
    with pytest.raises(ValueError, match="between 0 and 1"):
        learn_weights(impressions(en_pourcent))
    for hors in (-0.0001, 1.0000001, float("inf")):
        with pytest.raises(ValueError):
            pairs([page([(0.5, 1.0, 0.3, hors, True), (0.4, 1.0, 0.3, 0.2, False)])])
    # Une page fautive, même sans clic, est refusée : le contrôle précède la recherche des paires.
    with pytest.raises(ValueError):
        pairs([page([(0.5, 1.0, 0.3, 2.0, False)])])
    rows, _ = pairs([page([(0.0, 0.0, 0.0, 0.0, True), (1.0, 1.0, 1.0, 1.0, False)])])
    assert len(rows) == 2
