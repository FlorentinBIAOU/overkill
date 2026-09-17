import builtins
import json
import logging
import os
import shutil
import subprocess
import time
import unicodedata
import warnings
from pathlib import Path

import pytest

from n0 import DEFAULT_WEIGHTS, SIGNALS, fold, out_of_scale, rank, score, signals, terms, text_match

ICI = Path(__file__).parent

# An autumn catalogue, small enough to reason about by hand. Margin and
# popularity are shares between nought and one, as the snippet expects.
CATALOGUE = [
    {"title": "Chaussures de course Route 5", "tags": ["running", "bitume"],
     "in_stock": True, "margin": 0.35, "popularity": 0.80},
    {"title": "Chaussures de course Trail 3", "tags": ["running", "sentier"],
     "in_stock": True, "margin": 0.42, "popularity": 0.30},
    {"title": "Chaussettes de running", "tags": ["running"],
     "in_stock": True, "margin": 0.60, "popularity": 0.55},
    {"title": "Montre GPS Crème", "tags": ["running", "montre"],
     "in_stock": False, "margin": 0.25, "popularity": 0.70},
    {"title": "Sac à dos de randonnée", "tags": ["randonnée"],
     "in_stock": True, "margin": 0.48, "popularity": 0.20},
]

# The order the two language versions of the snippet must both produce. The
# same list appears in n0.test.js.
EXPECTED_ORDER = [
    "Chaussures de course Route 5",
    "Chaussures de course Trail 3",
    "Chaussettes de running",
    "Sac à dos de randonnée",
    "Montre GPS Crème",
]

# Weights tuned on the autumn catalogue, where the popular products were also
# the relevant ones. The same numbers sit in the tryout.
TUNED = {"text": 3.0, "availability": 2.0, "margin": 1.0, "popularity": 6.0}

SPRING = [
    {"title": "Sandales de randonnée Ultra", "tags": ["randonnée", "été"],
     "in_stock": True, "margin": 0.40, "popularity": 0.05},
    *CATALOGUE,
]


def titles(ranked):
    return [row["product"]["title"] for row in ranked]


def en_javascript(appels):
    """Exécute le vrai n0.js : pour chaque (produits au format JS, requête, poids), rend rank()."""
    node = shutil.which("node")
    assert node, "node est requis pour comparer les deux implémentations"
    script = (
        f"import {{ rank }} from {json.dumps((ICI / 'n0.js').as_uri())};"
        "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{"
        "process.stdout.write(JSON.stringify(JSON.parse(d).map(([p,q,w])=>"
        "rank(p,q,w).map(r=>[r.product.title,r.score,r.signals]))));});"
    )
    sortie = subprocess.run(
        [node, "--input-type=module", "-e", script],
        input=json.dumps(appels), capture_output=True, text=True, timeout=60, check=True,
    )
    return json.loads(sortie.stdout)


def au_format_js(produits):
    return [{"title": p["title"], "tags": p.get("tags", []), "inStock": p["in_stock"],
             "margin": p["margin"], "popularity": p["popularity"]} for p in produits]


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_les_poids_regles_a_lautomne_font_le_bon_ordre_sur_le_catalogue_dautomne():
    """« Le test les règle sur le catalogue d'automne, où les produits populaires étaient aussi les pertinents »."""
    assert titles(rank(CATALOGUE, "chaussures de course", TUNED))[0] == EXPECTED_ORDER[0]


def test_point_de_rupture_au_printemps_sandales_randonnee_perd_contre_le_succes_de_la_saison_precedente(caplog, capsys):
    """
    « au printemps, une gamme qui n'a presque rien vendu perd sur sa propre
    requête, "sandales randonnée", contre le succès de la saison précédente —
    mêmes poids, même code. Rien ne le signale : ni exception, ni test rouge, ni
    ligne de journal ».
    """
    with warnings.catch_warnings():
        warnings.simplefilter("error")
        caplog.set_level(logging.DEBUG)
        ranked = rank(SPRING, "sandales randonnée", TUNED)
    assert titles(ranked)[0] == "Chaussures de course Route 5"
    # La nouveauté est la seule à répondre entièrement à la requête…
    sandales = next(r for r in ranked if r["product"]["title"] == "Sandales de randonnée Ultra")
    assert sandales["signals"]["text"] == 1.0
    assert ranked[0]["signals"]["text"] == 0.0
    # … et rien n'a été écrit nulle part.
    assert caplog.records == []
    assert capsys.readouterr() == ("", "")


def test_point_de_rupture_temoin_deplacer_un_nombre_remet_la_nouveaute_en_tete():
    """« Il faut que quelqu'un s'en aperçoive et déplace un nombre » : même code, un poids changé."""
    retuned = dict(TUNED, text=12.0)
    assert titles(rank(SPRING, "sandales randonnee", retuned))[0] == "Sandales de randonnée Ultra"


# ---------------------------------------------------------------------------
# Les autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_classe_dabord_les_produits_qui_correspondent():
    assert titles(rank(CATALOGUE, "chaussures de course")) == EXPECTED_ORDER


def test_python_et_javascript_rendent_le_meme_classement_et_les_memes_scores():
    """
    Commentaire : « Fixing it keeps the arithmetic identical everywhere, which is
    what makes a ranking reproducible » ; test : « The order the two language
    versions of the snippet must both produce ». Scores comparés au bit près.
    """
    appels = []
    for requete in ["chaussures de course", "CRÈME", "sandales randonnée", "", "chauss", "!!!",
                    unicodedata.normalize("NFD", "randonnée"), "running\u00a0montre", "🥾 randonnée"]:
        for poids in (DEFAULT_WEIGHTS, TUNED, {"text": 1.0, "availability": 0.0, "margin": 9.0, "popularity": 0.0}):
            appels.append((SPRING, requete, poids))
    attendu = [[[r["product"]["title"], r["score"], r["signals"]] for r in rank(*a)] for a in appels]
    obtenu = en_javascript([[au_format_js(p), q, w] for p, q, w in appels])
    assert obtenu == attendu


def test_un_prefixe_suffit():
    """Docstring : « a shopper who types "chauss" is looking for "chaussures" »."""
    assert text_match("chauss", CATALOGUE[0]) == 1.0
    assert text_match("chaussures course", CATALOGUE[2]) == 0.0


def test_une_requete_au_pluriel_ne_trouve_pas_le_produit_au_singulier():
    """Docstring de text_match : « Not the other way round: "sandales" does not find "sandale". »"""
    assert text_match("sandales", {"title": "Sandale de marche"}) == 0.0
    assert text_match("sandales randonnée", {"title": "Sandale de randonnée"}) == 0.5


def test_le_singulier_trouve_le_pluriel():
    """Docstring de text_match : « and "sandale" finds "sandales" » ; témoin du test précédent."""
    assert text_match("sandale", {"title": "Sandales de marche"}) == 1.0


def test_les_accents_et_la_casse_sont_ignores():
    """Docstring de fold : « Lowercase and drop accents, so that "crème" finds "creme" »."""
    assert text_match("CRÈME", CATALOGUE[3]) == 1.0
    assert text_match("creme", CATALOGUE[3]) == 1.0
    assert text_match("randonnee", CATALOGUE[4]) == 1.0
    assert text_match("crème", {"title": "Montre creme"}) == 1.0
    assert fold("Crème") == "creme"
    assert fold("Việt Nam, Évry, Ångström") == "viet nam, evry, angstrom"
    assert text_match("evry", {"title": unicodedata.normalize("NFD", "Magasin d'Évry")}) == 1.0


def test_seules_les_diacritiques_de_u0300_a_u036f_sont_retirees():
    """
    Docstring de fold : « Only the diacritics Latin scripts use (U+0300 to U+036F) are dropped ».
    Limites : U+0300 et U+036F retirés ; U+1DC4 (supplément de diacritiques) et le virama gardés.
    """
    assert fold("a\u0300b\u036fc") == "abc"
    assert fold("e\u1dc4") == "e\u1dc4"
    assert fold("हिंदी") == "हिंदी"


def test_les_voyelles_du_devanagari_et_de_l_arabe_restent_des_mots_differents():
    """
    Docstring de fold : « in Devanagari or Arabic the vowel signs are marks too, and dropping them
    would turn one word into another » ; de terms : « Split on anything that is not a letter, a mark or a digit ».
    """
    assert terms("हिंदी फ़िल्में") == ["हिंदी", "फ़िल्में"]
    assert text_match("हिंदी", {"title": "हद"}) == 0.0
    assert text_match("मलक", {"title": "मालिक"}) == 0.0
    # « مَلِك » (roi) et « مَلَك » (ange) ne diffèrent que par une voyelle : ils restent deux mots.
    assert text_match("مَلِك", {"title": "مَلَك"}) == 0.0
    # Témoin : le mot lui-même est trouvé.
    assert text_match("हिंदी", {"title": "हिंदी फ़िल्में"}) == 1.0
    assert text_match("مَلِك", {"title": "كتاب مَلِك"}) == 1.0


def test_tout_ce_qui_nest_ni_lettre_ni_marque_ni_chiffre_separe_les_termes():
    """Docstring de terms : « Split on anything that is not a letter, a mark or a digit »."""
    assert terms("T-shirt  col-V, taille 42/44") == ["t", "shirt", "col", "v", "taille", "42", "44"]


def test_le_classement_dit_pourquoi():
    """Docstring de rank : « hand back the reason for each place »."""
    top = rank(CATALOGUE, "chaussures de course")[0]
    assert top["signals"] == {"text": 1.0, "availability": 1.0, "margin": 0.35, "popularity": 0.80}
    assert 0.0 <= top["score"] <= 1.0
    assert top["score"] == pytest.approx((6 * 1 + 2 * 1 + 1 * 0.35 + 3 * 0.80) / 12)


def test_un_poids_de_deux_compte_vraiment_deux_fois_plus():
    """Docstring : « a weight of two really does mean twice as much »."""
    mesure = {"text": 1.0, "availability": 0.0, "margin": 1.0, "popularity": 0.0}
    un = score(mesure, {"text": 1.0, "availability": 1.0, "margin": 0.0, "popularity": 0.0})
    deux = score(mesure, {"text": 2.0, "availability": 1.0, "margin": 0.0, "popularity": 0.0})
    assert (un, deux) == (pytest.approx(1 / 2), pytest.approx(2 / 3))


def test_le_texte_et_la_disponibilite_sont_entre_zero_et_un_par_construction():
    """Docstring : « text and availability by construction » ; name : « quatre signaux compris entre zéro et un »."""
    for requete in ("chaussures de course", "", "chauss randonnée zzz", "!!!"):
        for produit in SPRING + [dict(CATALOGUE[0], in_stock="oui"), dict(CATALOGUE[0], in_stock=0)]:
            mesure = signals(produit, requete)
            assert 0.0 <= mesure["text"] <= 1.0 and mesure["availability"] in (0.0, 1.0)


def test_une_marge_ou_une_popularite_hors_de_l_echelle_est_ramenee_et_signalee():
    """
    Docstring : « margin and popularity because a value outside is brought back
    onto it […] Brought back, and not refused: a margin of -0.05 is a real thing
    […] and one badly filled product must not take the whole category page down
    with it ».
    """
    # Une marge saisie en pourcentage, une marge négative de déstockage.
    assert signals(dict(CATALOGUE[0], margin=35), "chaussures")["margin"] == 1.0
    assert signals(dict(CATALOGUE[0], margin=-0.05), "chaussures")["margin"] == 0.0
    assert signals(dict(CATALOGUE[0], popularity=80), "chaussures")["popularity"] == 1.0
    for hors in (-0.0001, 1.0000001, float("nan"), float("inf"), None, "0.5"):
        assert out_of_scale(dict(CATALOGUE[0], margin=hors)) == ["margin"]
        assert 0.0 <= signals(dict(CATALOGUE[0], margin=hors), "chaussures")["margin"] <= 1.0
    for limite in (0.0, 1.0):
        produit = dict(CATALOGUE[0], margin=limite, popularity=limite)
        mesure = signals(produit, "chaussures")
        assert (mesure["margin"], mesure["popularity"]) == (limite, limite)
        assert out_of_scale(produit) == []


def test_un_seul_produit_mal_renseigne_ne_fait_pas_tomber_la_page():
    """
    Docstring : « One badly filled product must not take the whole category
    page down with it. The products whose signals had to be moved come back
    named ».
    """
    produits = [CATALOGUE[0], dict(CATALOGUE[1], margin=-0.05), CATALOGUE[2]]
    classement = rank(produits, "chaussures")
    assert len(classement) == 3
    fautif = next(row for row in classement if row["product"]["title"] == CATALOGUE[1]["title"])
    assert fautif["out_of_scale"] == ["margin"] and fautif["signals"]["margin"] == 0.0
    # Témoin : les deux autres produits sortent sans rien de signalé.
    assert [row["out_of_scale"] for row in classement if row is not fautif] == [[], []]


def test_un_poids_negatif_est_refuse():
    """Docstring : « a mean over weights that cannot be negative » ; texte 2, marge -1 lève."""
    mesure = {"text": 1.0, "availability": 0.0, "margin": 0.0, "popularity": 0.0}
    with pytest.raises(ValueError, match="nought or above"):
        score(mesure, {"text": 2.0, "availability": 0.0, "margin": -1.0, "popularity": 0.0})
    with pytest.raises(ValueError):
        rank(CATALOGUE, "chaussures", dict(DEFAULT_WEIGHTS, popularity=-1e-9))
    # Limite : un poids nul est accepté.
    assert score(mesure, {"text": 2.0, "availability": 0.0, "margin": 0.0, "popularity": 0.0}) == 1.0


def test_un_poids_qui_n_est_pas_un_nombre_fini_est_refuse():
    """Docstring : « a weight that is not a finite number, zero or above, is refused »."""
    mesure = {"text": 1.0, "availability": 0.0, "margin": 0.5, "popularity": 0.2}
    for poids in (float("nan"), float("inf"), float("-inf"), None, "2", True):
        with pytest.raises(ValueError, match="finite number"):
            score(mesure, dict(DEFAULT_WEIGHTS, text=poids))
    # Et les quatre poids doivent être là.
    with pytest.raises(ValueError, match="every signal needs a weight"):
        score(mesure, {"text": 1.0, "availability": 1.0})


def test_le_score_reste_entre_zero_et_un_pour_des_poids_positifs_et_des_signaux_dans_lechelle():
    for poids in (DEFAULT_WEIGHTS, TUNED, {"text": 0.0, "availability": 0.0, "margin": 0.0, "popularity": 1e9}):
        for row in rank(SPRING, "chaussures randonnée", poids):
            assert 0.0 <= row["score"] <= 1.0


def test_la_disponibilite_est_un_signal_parmi_dautres_pas_un_filtre():
    # With the default weights the text match wins, so an exact match that
    # cannot be sold still comes first. Whether that is right is a decision
    # for the shop, and it is taken by moving a weight, not by editing code.
    assert titles(rank(CATALOGUE, "montre"))[0] == "Montre GPS Crème"
    stock_first = dict(DEFAULT_WEIGHTS, availability=20.0)
    assert titles(rank(CATALOGUE, "montre", stock_first))[-1] == "Montre GPS Crème"


def test_les_poids_sont_des_arguments_pas_des_constantes_cachees():
    """Docstring : « the four weights are arguments, not constants buried in the code »."""
    greedy = {"text": 1.0, "availability": 0.0, "margin": 9.0, "popularity": 0.0}
    assert titles(rank(CATALOGUE, "chaussures de course", greedy))[0] == "Chaussettes de running"
    assert titles(rank(CATALOGUE, "chaussures de course", DEFAULT_WEIGHTS))[0] == EXPECTED_ORDER[0]


def test_le_tri_est_stable_a_egalite():
    """Docstring : « two products the score cannot separate stay in the order the catalogue gave them »."""
    twin_a = dict(CATALOGUE[1], title="Trail 3 bleu")
    twin_b = dict(CATALOGUE[1], title="Trail 3 rouge")
    assert titles(rank([twin_a, twin_b], "trail")) == ["Trail 3 bleu", "Trail 3 rouge"]
    assert titles(rank([twin_b, twin_a], "trail")) == ["Trail 3 rouge", "Trail 3 bleu"]
    # Et sur cent jumeaux, l'ordre du catalogue est rendu intact.
    jumeaux = [dict(CATALOGUE[1], title=f"Trail {i}") for i in range(100)]
    assert titles(rank(jumeaux, "trail")) == [f"Trail {i}" for i in range(100)]


def test_deterministe_le_meme_appel_rend_le_meme_ordre():
    """risks.deterministic, scenario : « se rejoue à l'identique le lendemain »."""
    assert rank(SPRING, "chaussures de course") == rank(SPRING, "chaussures de course")


def test_aucune_donnee_hors_des_quatre_signaux_nentre_dans_le_score():
    """risks.regulatory : « aucune donnée personnelle n'entre dans le score »."""
    avec_client = [dict(p, last_buyer_email="i.fontaine@example.test", buyer_age=41) for p in SPRING]
    assert [r["score"] for r in rank(avec_client, "randonnée")] == [r["score"] for r in rank(SPRING, "randonnée")]


def test_aucun_fichier_ecrit(monkeypatch):
    """Docstring : « standard library only » ; risks.data_egress : « none »."""
    def refuser(*args, **kwargs):
        raise AssertionError("un fichier a été ouvert")

    monkeypatch.setattr(builtins, "open", refuser)
    monkeypatch.setattr(os, "open", refuser)
    ranked = rank(SPRING, "randonnée")
    monkeypatch.undo()
    assert len(ranked) == 6


def test_un_classement_de_six_produits_prend_moins_dune_milliseconde():
    """latency « <1 ms » : mille classements du catalogue de printemps en moins d'une seconde."""
    debut = time.perf_counter()
    for _ in range(1000):
        rank(SPRING, "sandales randonnée", TUNED)
    assert time.perf_counter() - debut < 1.0


def test_lessai_la_nouveaute_arrive_troisieme_derriere_des_chaussures_de_course_et_des_chaussettes():
    """
    Essai, why : « Le seul produit qui répond exactement à la requête arrive troisième, derrière une paire de
    chaussures de course et des chaussettes » ; « cette nouveauté n'a presque aucune popularité » (0,05, la
    plus faible du catalogue ; vérifié sur l'essai lui-même en JavaScript).
    """
    spring_essai = [dict(p, title="Montre GPS Cadence") if p["title"] == "Montre GPS Crème" else p for p in SPRING]
    ranked = rank(spring_essai, "sandales randonnée", TUNED)
    assert titles(ranked)[:3] == ["Chaussures de course Route 5", "Chaussettes de running", "Sandales de randonnée Ultra"]
    assert [r["signals"]["text"] for r in ranked].count(1.0) == 1
    sandales = SPRING[0]
    assert sandales["popularity"] == 0.05 == min(p["popularity"] for p in SPRING)
    # « la popularité pèse deux fois le texte ».
    assert TUNED["popularity"] == 2 * TUNED["text"]


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_une_requete_vide_laisse_les_signaux_commerciaux_decider():
    ranked = rank(CATALOGUE, "")
    assert all(row["signals"]["text"] == 0.0 for row in ranked)
    # No query, so the ranking becomes the shop's own preference order.
    assert titles(ranked)[0] == "Chaussures de course Route 5"
    assert all(r["signals"]["text"] == 0.0 for r in rank(CATALOGUE, " ,;!? "))


def test_production_un_catalogue_vide_donne_un_classement_vide():
    assert rank([], "chaussures") == []


def test_production_des_poids_tous_nuls_rendent_zero_et_lordre_du_catalogue():
    zero = {name: 0.0 for name in SIGNALS}
    ranked = rank(SPRING, "randonnée", zero)
    assert [r["score"] for r in ranked] == [0.0] * 6
    assert titles(ranked) == [p["title"] for p in SPRING]


def test_production_dix_mille_produits_et_une_longue_requete_terminent_vite():
    produits = [dict(CATALOGUE[i % 5], title=f"{CATALOGUE[i % 5]['title']} {i}") for i in range(10_000)]
    debut = time.perf_counter()
    ranked = rank(produits, "chaussures de course trail route sentier bitume " * 10)
    assert time.perf_counter() - debut < 10.0
    assert len(ranked) == 10_000


def test_production_nfd_insecable_largeur_nulle_emoji_et_casse_mixte():
    nfd = {"title": unicodedata.normalize("NFD", "Sac à dos de randonnée")}
    assert text_match("randonnée", nfd) == 1.0
    assert text_match("RANDONNÉE", {"title": "sac de randonnee"}) == 1.0
    assert text_match("sac\u00a0dos", {"title": "Sac à dos"}) == 1.0
    assert text_match("🥾 randonnée", {"title": "Sac de randonnée"}) == 1.0
    # Un espace de largeur nulle coupe le mot en deux termes : « rando » et « nnée ».
    assert text_match("rando\u200bnnée", {"title": "randonnée"}) == 0.5


def test_production_un_mot_en_devanagari_ou_en_arabe_voyelle_ne_trouve_pas_un_autre_mot():
    """Même sortie en JavaScript (n0.test.js) : les deux langages gardent les mêmes marques."""
    assert text_match("हिंदी", {"title": "हद"}) == 0.0
    assert text_match("مَلِك", {"title": "مَلَك"}) == 0.0
    assert terms("مَكْتَبَة") == ["مَكْتَبَة"]


def test_production_un_champ_manquant_leve_et_un_champ_sali_est_signale():
    """
    Un champ absent du produit lève — le catalogue n'a pas la colonne —, mais
    une valeur du mauvais type y est ramenée à zéro et signalée, dans les deux
    langages.
    """
    with pytest.raises(KeyError):
        rank([{"title": "Sans stock", "margin": 0.1, "popularity": 0.1}], "x")
    with pytest.raises(KeyError):
        rank([{"title": "Sans marge", "in_stock": True, "popularity": 0.1}], "x")
    for sale in (None, "0.5"):
        classement = rank([dict(CATALOGUE[0], popularity=sale)], "x")
        assert classement[0]["signals"]["popularity"] == 0.0
        assert classement[0]["out_of_scale"] == ["popularity"]
    with pytest.raises(ValueError, match="every signal needs a weight"):
        rank(CATALOGUE, "x", {"text": 1.0})
