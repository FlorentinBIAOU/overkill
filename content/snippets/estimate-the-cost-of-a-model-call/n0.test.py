import json
import shutil
import subprocess
import time
from pathlib import Path

from n0 import DECIMALS, PER, estimate_cost

ICI = Path(__file__).parent

# Un travail ordinaire : dix mille documents à faire lire, une page chacun.
ITEMS = 10_000
PRIX_ENTREE, PRIX_SORTIE = "0.15", "0.60"

# La même page, comptée par un tokeniseur et estimée depuis ses caractères.
PAGE_COMPTEE = 1200
PAGE_ESTIMEE = {"characters": 4800, "characters_per_token": "4"}
PAGE_ESTIMEE_AUTREMENT = {"characters": 4800, "characters_per_token": "2.5"}

TOUS = [[ITEMS, PAGE_COMPTEE, 300, PRIX_ENTREE, PRIX_SORTIE, {}],
        [ITEMS, PAGE_ESTIMEE, 300, PRIX_ENTREE, PRIX_SORTIE, {"fixedAlternative": "800"}],
        [1, 0, 0, "0", "0", {"fixedAlternative": "800"}],
        [-1, 1, 1, "1", "1", {}], [1, 1, 1, "abc", "1", {}], [1, "x", 1, "1", "1", {}],
        [0, 1000, 100, "3", "15", {}],
        [1, {"characters": 1001, "characters_per_token": "4"}, 0, "1", "1", {}],
        [1, PAGE_ESTIMEE_AUTREMENT, 0, "1", "1", {}],
        [1000, 500, 500, "0.0001", "0.0002", {"decimals": 2}],
        [1000, 500, 500, "1", "1", {"per": 1000}],
        [1, 1, 1, "1", "1", {"per": 0}],
        [3, 1_000_000, 0, "2.50", "0", {"fixedAlternative": "7.5"}],
        [1, {"characters": 0, "characters_per_token": "4"}, 0, "1", "1", {"fixedAlternative": "0"}]]


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_une_estimation_depend_du_rapport_quon_a_declare():
    """
    « Le même texte, estimé avec deux rapports également plausibles, ne donne
    pas le même nombre de jetons ni le même coût. »
    """
    quatre = estimate_cost(ITEMS, PAGE_ESTIMEE, 300, PRIX_ENTREE, PRIX_SORTIE)
    deux_et_demi = estimate_cost(ITEMS, PAGE_ESTIMEE_AUTREMENT, 300, PRIX_ENTREE, PRIX_SORTIE)
    assert quatre["tokens"]["in"] == 1200
    assert deux_et_demi["tokens"]["in"] == 1920  # soixante pour cent de plus
    assert quatre["cost"]["total"] != deux_et_demi["cost"]["total"]
    # Rien dans le rapport ne dit lequel des deux rapports est le bon.
    assert quatre["reason"] is None and deux_et_demi["reason"] is None


def test_point_de_rupture_temoin_le_rapport_dit_toujours_sil_a_compte_ou_estime():
    """
    « Le témoin est dans le même test : la même page, comptée par un
    tokeniseur, revient avec `source` à « counted », et l'estimation avec
    « estimated ». »
    """
    compte = estimate_cost(ITEMS, PAGE_COMPTEE, 300, PRIX_ENTREE, PRIX_SORTIE)
    estime = estimate_cost(ITEMS, PAGE_ESTIMEE, 300, PRIX_ENTREE, PRIX_SORTIE)
    assert compte["tokens"]["source"] == "counted"
    assert estime["tokens"]["source"] == "mixed"  # entrée estimée, sortie comptée
    assert estimate_cost(1, PAGE_ESTIMEE, PAGE_ESTIMEE, "1", "1")["tokens"]["source"] == "estimated"


# ---------------------------------------------------------------------------
# Ce que la fiche s'interdit
# ---------------------------------------------------------------------------


def test_lextrait_ne_porte_aucun_prix():
    """
    R : « il ne nomme jamais un prix ». Le fichier lui-même est relu : aucun
    symbole monétaire, aucun code de devise, aucun tarif.
    """
    import re

    source = (ICI / "n0.py").read_text(encoding="utf-8")
    # Un tarif, pas le « $ » d'une fin d'expression régulière.
    tarif = re.compile(r"[€£¥₹]|\b(?:USD|EUR|GBP|JPY)\b|\$\s?[0-9]")
    assert tarif.search(source) is None


def test_le_resultat_est_dans_lunite_des_prix_donnes():
    """Le rapport ne nomme pas de devise : il rend des nombres."""
    rapport = estimate_cost(1, 1_000_000, 0, "2.50", "0")
    assert rapport["cost"]["total"] == "2.500000"
    assert "currency" not in rapport and "currency" not in rapport["cost"]


# ---------------------------------------------------------------------------
# Les autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_le_calcul_est_exact_et_ne_passe_par_aucun_flottant():
    rapport = estimate_cost(ITEMS, PAGE_COMPTEE, 300, PRIX_ENTREE, PRIX_SORTIE)
    # 1200 × 0,15 / 10^6 + 300 × 0,60 / 10^6 = 0,00018 + 0,00018
    assert rapport["cost"]["per_item"] == "0.000360"
    assert rapport["cost"]["total"] == "3.600000"
    assert isinstance(rapport["cost"]["total"], str)


def test_le_seuil_de_bascule_est_le_premier_appel_qui_depasse():
    rapport = estimate_cost(1, 1_000_000, 0, "2.50", "0", fixed_alternative="7.5")
    # 2,50 par appel : le troisième atteint 7,50.
    assert rapport["break_even_items"] == 3
    assert estimate_cost(1, 1_000_000, 0, "2.50", "0",
                         fixed_alternative="7.51")["break_even_items"] == 4


def test_un_appel_gratuit_na_pas_de_seuil_de_bascule():
    assert estimate_cost(1, 0, 0, "0", "0", fixed_alternative="800")["break_even_items"] is None


def test_une_fraction_de_jeton_est_facturee_comme_un_jeton():
    un_peu_plus = {"characters": 1001, "characters_per_token": "4"}
    assert estimate_cost(1, un_peu_plus, 0, "1", "1")["tokens"]["in"] == 251


def test_lunite_de_prix_est_un_parametre():
    par_millier = estimate_cost(1000, 500, 500, "1", "1", per=1000)
    par_million = estimate_cost(1000, 500, 500, "1", "1", per=PER)
    assert par_millier["cost"]["total"] == "1000.000000"
    assert par_million["cost"]["total"] == "1.000000"


def test_les_decimales_suivent_les_prix_donnes():
    fin = estimate_cost(1000, 500, 500, "0.0001", "0.0002", decimals=2)
    assert fin["cost"]["decimals"] == max(2, 4) == 4
    assert DECIMALS == 6


def test_chaque_entree_impossible_est_nommee():
    assert estimate_cost(-1, 1, 1, "1", "1")["reason"].startswith("items must be")
    assert estimate_cost(1, 1, 1, "abc", "1")["reason"].startswith("the in price")
    assert estimate_cost(1, "x", 1, "1", "1")["reason"].startswith("the in tokens")
    assert estimate_cost(1, 1, 1, "1", "1", per=0)["reason"].startswith("the price unit")
    assert estimate_cost(1, 1, 1, "1", "1",
                         fixed_alternative="beaucoup")["reason"].startswith("the alternative")


def test_aucune_entree_ne_leve():
    for items in [None, 1.5, True, "10", []]:
        assert estimate_cost(items, 1, 1, "1", "1")["cost"] is None


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_entree_banale_dix_mille_documents():
    """T5 : l'entrée ordinaire du public visé."""
    rapport = estimate_cost(ITEMS, PAGE_COMPTEE, 300, PRIX_ENTREE, PRIX_SORTIE,
                            fixed_alternative="800")
    assert rapport["tokens"]["total"] == 1500
    assert rapport["cost"]["total"] == "3.600000"
    assert rapport["break_even_items"] == 2_222_223


def test_production_entree_vide():
    rapport = estimate_cost(0, 0, 0, "0", "0")
    assert rapport["cost"]["total"] == "0.000000"
    assert rapport["tokens"]["total"] == 0


def test_production_entree_tres_grande_et_terminaison_rapide():
    debut = time.perf_counter()
    rapport = estimate_cost(10 ** 9, 10 ** 9, 10 ** 9, "999.999999", "999.999999")
    assert time.perf_counter() - debut < 10.0
    # Un montant qu'aucun flottant ne représenterait exactement.
    assert rapport["cost"]["total"] == "1999999998000000.000000"


def test_production_valeurs_aux_limites():
    assert estimate_cost(1, 0, 0, "0", "0")["cost"]["per_item"] == "0.000000"
    assert estimate_cost(1, 1, 0, "0.000001", "0")["cost"]["per_item"] == "0.000000"
    # Un demi est arrondi en s'éloignant de zéro, comme la docstring l'annonce.
    assert estimate_cost(1, 500_000, 0, "0.000001", "0")["cost"]["per_item"] == "0.000001"


def test_production_un_champ_impossible_nempeche_pas_de_dire_pourquoi():
    """T8 : une entrée fausse rend une raison, pas une exception."""
    rapport = estimate_cost(1, {"characters": -1, "characters_per_token": "4"}, 0, "1", "1")
    assert rapport["cost"] is None
    assert rapport["reason"].startswith("the in tokens")


def test_production_la_lecture_tient_la_classe_de_latence_annoncee():
    """latency « <1 ms » : cent mille estimations sous une borne large."""
    debut = time.perf_counter()
    for _ in range(100_000):
        estimate_cost(ITEMS, PAGE_COMPTEE, 300, PRIX_ENTREE, PRIX_SORTIE)
    assert time.perf_counter() - debut < 20.0


# ---------------------------------------------------------------------------
# Parité entre les deux langages
# ---------------------------------------------------------------------------


def test_python_et_javascript_rendent_le_meme_rapport():
    """La fiche montre les deux extraits : elle affirme la même chose des deux."""
    node = shutil.which("node")
    assert node, "node est requis pour comparer les deux implémentations"
    attendu = []
    for items, entree, sortie, prix_e, prix_s, options in TOUS:
        kw = {}
        if "fixedAlternative" in options:
            kw["fixed_alternative"] = options["fixedAlternative"]
        if "decimals" in options:
            kw["decimals"] = options["decimals"]
        if "per" in options:
            kw["per"] = options["per"]
        attendu.append(estimate_cost(items, entree, sortie, prix_e, prix_s, **kw))
    script = (
        f"import {{ estimateCost }} from {json.dumps((ICI / 'n0.js').as_uri())};"
        "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{"
        "process.stdout.write(JSON.stringify(JSON.parse(d)"
        ".map(([i,a,b,p,q,o])=>estimateCost(i,a,b,p,q,o))));});"
    )
    sortie = subprocess.run([node, "--input-type=module", "-e", script],
                            input=json.dumps(TOUS), capture_output=True,
                            text=True, timeout=60, check=True)
    assert json.loads(sortie.stdout) == attendu
