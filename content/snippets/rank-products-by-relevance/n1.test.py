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
    return [
        {"signals": dict(zip(("text", "availability", "margin", "popularity"), row[:4])),
         "clicked": row[4]}
        for row in rows
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
        log.append([items[j] + (j == meilleur,) for j in range(4)])
    return log


def learn_weights_en_javascript(journaux):
    node = shutil.which("node")
    assert node, "node est requis pour comparer les deux implémentations"
    script = (
        f"import {{ learnWeights }} from {json.dumps((ICI / 'n1.js').as_uri())};"
        "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{"
        "process.stdout.write(JSON.stringify(JSON.parse(d).map((j)=>learnWeights(j))));});"
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
    """Test JavaScript : « Two decimals of agreement is what says the thirty lines above are the same model »."""
    journaux = [LOG, FLAT_MARGIN, synthetique(300), AGAINST_THE_SHOP]
    for python, javascript in zip([learn_weights(impressions(j)) for j in journaux], learn_weights_en_javascript(journaux)):
        for name in SIGNALS:
            assert abs(python[name] - javascript[name]) < 0.01, (name, python, javascript)


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


@pytest.mark.xfail(strict=True, reason=(
    "INFIRMÉ : la docstring dit « Nothing else changes: […] the scale of the "
    "score, all stay as they were » ; le score de N0 est une moyenne dans [0, 1], "
    "celui de N1 une somme de poids signés normalisés par leur valeur absolue, "
    "dans [-1, 1] : avec les poids appris du journal du test, un produit rentable "
    "sans autre signal reçoit -0,25"
))
def test_infirme_lechelle_du_score_reste_celle_de_n0():
    weights = learn_weights(impressions())
    candidate = page([(0.0, 0.0, 1.0, 0.0, False)])
    assert 0.0 <= rank(candidate, weights)[0]["score"] <= 1.0


@pytest.mark.xfail(strict=True, reason=(
    "INFIRMÉ : verdict_rationale dit « la même somme pondérée » et « gardez la "
    "même fonction de service » ; la fonction de N0 divise par la somme signée des "
    "poids. Des poids appris dont la somme est négative (journal où l'acheteur "
    "prend le produit le moins pertinent) inversent l'ordre si on les passe à "
    "n0.rank, et une somme nulle y rend tous les scores à zéro"
))
def test_infirme_la_fonction_de_service_de_n0_classe_comme_n1_avec_les_poids_appris():
    weights = learn_weights(impressions(AGAINST_THE_SHOP))
    assert sum(weights.values()) < 0
    produits = [
        {"title": "pertinent et rentable", "tags": [], "in_stock": True, "margin": 0.9, "popularity": 0.5},
        {"title": "hors sujet et sans marge", "tags": [], "in_stock": True, "margin": 0.1, "popularity": 0.5},
    ]
    requete = "pertinent"
    ordre_n0 = [r["product"]["title"] for r in n0.rank(produits, requete, weights)]
    candidates = [{"title": p["title"], "signals": n0.signals(p, requete)} for p in produits]
    ordre_n1 = [r["candidate"]["title"] for r in rank(candidates, weights)]
    assert ordre_n0 == ordre_n1


def test_meme_somme_ponderee_meme_tri_stable_meme_explication():
    """Docstring de rank : « Same weighted sum as N0, same stable sort, same explanation returned »."""
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


@pytest.mark.xfail(strict=True, reason=(
    "DÉFAUT : un journal où chaque produit cliqué a exactement les signaux d'un "
    "produit ignoré ne contient aucune information ; au lieu de l'erreur nommée "
    "« nothing to learn from », Python lève ZeroDivisionError (échelle nulle) et "
    "JavaScript rend quatre poids NaN, sans erreur"
))
def test_defaut_un_journal_sans_aucune_difference_leve_lerreur_nommee():
    identiques = [[(0.5, 1.0, 0.3, 0.2, True), (0.5, 1.0, 0.3, 0.2, False)]]
    with pytest.raises(ValueError, match="nothing to learn from"):
        learn_weights(impressions(identiques))


def test_production_un_signal_manquant_leve_une_erreur():
    """Python lève TypeError sur None (JavaScript rend des poids NaN, voir n1.test.js)."""
    with pytest.raises(TypeError):
        learn_weights([page([(0.5, 1.0, 0.3, None, True), (0.4, 1.0, 0.3, 0.2, False)])])
    with pytest.raises(ValueError):
        learn_weights([page([(0.5, 1.0, 0.3, float("nan"), True), (0.4, 1.0, 0.3, 0.2, False)])])


@pytest.mark.xfail(strict=True, reason=(
    "DÉFAUT : rien ne refuse un signal hors de [0, 1] ; avec une popularité en "
    "pourcentage, scikit-learn converge (popularité ≈ 0,00) mais la descente de "
    "gradient à pas fixe de n1.js oscille et rend une popularité ≈ -0,49 : les "
    "deux langages ne sont plus le même modèle, sans erreur ni avertissement"
))
def test_defaut_des_signaux_hors_echelle_font_diverger_les_deux_langages():
    en_pourcent = [[(r[0], r[1], r[2], r[3] * 100, r[4]) for r in rows] for rows in LOG]
    python = learn_weights(impressions(en_pourcent))
    (javascript,) = learn_weights_en_javascript([en_pourcent])
    for name in SIGNALS:
        assert abs(python[name] - javascript[name]) < 0.01, name
