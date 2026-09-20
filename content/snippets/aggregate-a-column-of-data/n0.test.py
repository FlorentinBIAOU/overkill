import json
import math
import shutil
import subprocess
import time
from pathlib import Path

from n0 import MEAN_EXTRA, SIGNS, aggregate

ICI = Path(__file__).parent

# Une colonne de facture ordinaire, telle qu'un fichier la donne : du texte.
FACTURE = ["83.87", "60.07", "12.35", "55.95", "1.38", "31.36"]

# La même colonne telle qu'un fichier réel la donne : avec ses trous.
REELLE = ["1250.00", "125.00", "", "n/a", "1125.50", "19,90", "3"]

TOUS = [[FACTURE, "."], [REELLE, "."], [["1250,00", "125,00"], ","],
        [["1250,00", "125,00"], "."], [[], "."], [["-5", "3", "-0.5"], "."],
        [["0.001", "1"], "."], [["+7"], "."], [["  12  "], "."],
        [[" ", None, 12, 3.5, True, [], {}], "."], [["1 250.00"], "."],
        [["1e3"], "."], [["00012.50"], "."], [["1", "2"], "!"],
        ["pas une liste", "."], [["0.07"] * 100, "."]]


def kahan(valeurs):
    """La somme compensée, l'autre réponse classique au problème."""
    total, correction = 0.0, 0.0
    for valeur in valeurs:
        ajuste = valeur - correction
        provisoire = total + ajuste
        correction = (provisoire - total) - ajuste
        total = provisoire
    return total


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_la_moyenne_est_celle_de_ce_qui_a_ete_lu():
    """
    « La moyenne porte sur les lignes lues, pas sur les lignes du fichier :
    trois des sept lignes de la colonne réelle ne sont pas des nombres. »
    """
    rapport = aggregate(REELLE)
    assert rapport["figures"]["count"] == 4
    assert len(rapport["skipped"]) == 3
    # La moyenne de quatre valeurs, pas de sept : 2503,50 / 4.
    assert rapport["figures"]["mean"] == "625.8750"


def test_point_de_rupture_temoin_chaque_ligne_ecartee_revient_avec_sa_raison():
    """
    « Le témoin est dans le même test : chaque ligne écartée revient avec son
    numéro et la raison, et le compte des lignes lues est rendu à côté de la
    moyenne. »
    """
    ecartees = aggregate(REELLE)["skipped"]
    assert [(e["row"], e["why"]) for e in ecartees] == [
        (2, "empty"), (3, "not a number"),
        (5, "written with « , » as the decimal sign")]


# ---------------------------------------------------------------------------
# Le verdict, confronté aux données de la fiche
# ---------------------------------------------------------------------------


def test_verdict_la_somme_flottante_nest_pas_la_somme_de_la_facture():
    """
    R4 : la même colonne, additionnée en flottants et exactement. Le total
    imprimé sur la facture est 244,98.
    """
    flottante = sum(float(valeur) for valeur in FACTURE)
    assert repr(flottante) == "244.98000000000002"
    assert aggregate(FACTURE)["figures"]["sum"] == "244.98"
    assert flottante != 244.98


def test_verdict_la_somme_compensee_ny_change_rien():
    """
    L'autre réponse classique — Kahan, ou `math.fsum` — corrige l'accumulation,
    pas la représentation : sur cette colonne, les trois donnent la même valeur
    fausse, parce que « 83.87 » n'est déjà pas 83,87 en binaire.
    """
    valeurs = [float(valeur) for valeur in FACTURE]
    assert repr(kahan(valeurs)) == "244.98000000000002"
    assert repr(math.fsum(valeurs)) == "244.98000000000002"


# ---------------------------------------------------------------------------
# Les autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_la_somme_est_exacte_quelle_que_soit_la_longueur_de_la_colonne():
    assert aggregate(["0.01"] * 10_000)["figures"]["sum"] == "100.00"
    assert aggregate(["0.07"] * 100)["figures"]["sum"] == "7.00"


def test_les_valeurs_sont_alignees_sur_le_plus_grand_nombre_de_decimales():
    figures = aggregate(["0.001", "1"])["figures"]
    assert (figures["sum"], figures["decimals"]) == ("1.001", 3)
    assert figures["minimum"] == "0.001" and figures["maximum"] == "1.000"


def test_la_moyenne_est_rendue_deux_decimales_au_dela_des_donnees():
    figures = aggregate(["1", "2"])["figures"]
    assert figures["mean"] == "1.50" and MEAN_EXTRA == 2
    # Arrondie en s'éloignant de zéro, ce que la docstring annonce.
    assert aggregate(["0", "0", "1"])["figures"]["mean"] == "0.33"
    assert aggregate(["-1", "-2"])["figures"]["mean"] == "-1.50"
    assert aggregate(["0.005", "0.005", "0.005"])["figures"]["mean"] == "0.00500"


def test_le_signe_decimal_est_declare_et_lautre_est_refuse():
    assert aggregate(["1250,00", "125,00"], ",")["figures"]["sum"] == "1375.00"
    refuse = aggregate(["1250,00"], ".")
    assert refuse["figures"]["count"] == 0
    assert refuse["skipped"][0]["why"] == "written with « , » as the decimal sign"
    assert aggregate(["1"], "!")["reason"] == f"the decimal sign must be one of {' '.join(SIGNS)}"


def test_un_separateur_de_milliers_nest_pas_lu_ici():
    """La fiche voisine sur les montants d'un texte est celle qui les lit."""
    assert aggregate(["1 250.00"])["skipped"][0]["why"] == "not a number"


def test_une_colonne_sans_aucun_nombre_ne_rend_pas_zero():
    figures = aggregate(["", "n/a"])["figures"]
    assert figures["count"] == 0
    assert figures["sum"] is None and figures["mean"] is None


def test_aucune_entree_ne_leve():
    assert aggregate("pas une liste")["reason"] == "expected a list of values"
    assert aggregate(None)["reason"] == "expected a list of values"
    assert aggregate([None, [], {}, True])["figures"]["count"] == 0


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_entree_banale_une_colonne_de_facture():
    """T5 : l'entrée ordinaire du public visé."""
    figures = aggregate(FACTURE)["figures"]
    assert (figures["count"], figures["sum"], figures["minimum"]) == (6, "244.98", "1.38")


def test_production_entree_vide():
    rapport = aggregate([])
    assert rapport["figures"]["count"] == 0
    assert rapport["skipped"] == []


def test_production_entree_tres_grande_et_terminaison_rapide():
    enorme = ["1234567890123456789.99"] * 100_000
    debut = time.perf_counter()
    rapport = aggregate(enorme)
    assert time.perf_counter() - debut < 60.0
    # Un total que le flottant ne sait même pas représenter.
    assert rapport["figures"]["sum"] == "123456789012345678999000.00"


def test_production_encodages_inattendus():
    # L'espace insécable est une espace pour les deux langages : la valeur est lue.
    assert aggregate(["\u00a012\u00a0"])["figures"]["sum"] == "12"
    assert aggregate(["١٢"])["skipped"][0]["why"] == "not a number"
    assert aggregate(["  12  "])["figures"]["sum"] == "12"


def test_production_valeurs_aux_limites():
    assert aggregate(["+7"])["figures"]["sum"] == "7"
    assert aggregate(["00012.50"])["figures"]["sum"] == "12.50"
    assert aggregate(["-5", "3", "-0.5"])["figures"]["sum"] == "-2.5"
    assert aggregate(["1e3"])["skipped"][0]["why"] == "not a number"


def test_production_une_ligne_illisible_nempeche_pas_de_lire_les_autres():
    """T8 : une ligne de total au milieu du fichier ne fait pas tomber la colonne."""
    avec_total = ["10", "20", "Total", "30"]
    rapport = aggregate(avec_total)
    assert rapport["figures"]["sum"] == "60"
    assert rapport["skipped"] == [{"row": 2, "value": "Total", "why": "not a number"}]


def test_production_la_lecture_tient_la_classe_de_latence_annoncee():
    """latency « ~10 ms » : mille colonnes de mille lignes sous une borne large."""
    colonne = ["12.34"] * 1000
    debut = time.perf_counter()
    for _ in range(1000):
        aggregate(colonne)
    assert time.perf_counter() - debut < 60.0


# ---------------------------------------------------------------------------
# Parité entre les deux langages
# ---------------------------------------------------------------------------


def test_python_et_javascript_rendent_le_meme_rapport():
    """La fiche montre les deux extraits : elle affirme la même chose des deux."""
    node = shutil.which("node")
    assert node, "node est requis pour comparer les deux implémentations"
    attendu = [aggregate(valeurs, signe) for valeurs, signe in TOUS]
    script = (
        f"import {{ aggregate }} from {json.dumps((ICI / 'n0.js').as_uri())};"
        "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{"
        "process.stdout.write(JSON.stringify(JSON.parse(d).map(([v,s])=>aggregate(v,s))));});"
    )
    sortie = subprocess.run([node, "--input-type=module", "-e", script],
                            input=json.dumps(TOUS), capture_output=True,
                            text=True, timeout=60, check=True)
    assert json.loads(sortie.stdout) == attendu
