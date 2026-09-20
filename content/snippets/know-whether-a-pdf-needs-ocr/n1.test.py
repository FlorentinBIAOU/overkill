import time
import unicodedata

from n0 import triage_pages
from fixtures import CORPUS, MOJIBAKE, MOJIBAKE_TEXTE, PAGE_ANGLAISE, TABLEAU_DE_CHIFFRES
from n1 import MARGIN, fit, is_readable, normalise, score

MODELE = fit(CORPUS)


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_une_page_de_chiffres_nest_pas_de_la_langue():
    """
    « Un tableau de montants — « 12/01/2026 1 250,00 4 300,50 » — tombe sous le
    seuil comme la page cassée, alors que c'est du texte parfaitement lu. »
    """
    chiffres = is_readable(TABLEAU_DE_CHIFFRES, MODELE)
    assert chiffres["readable"] is False
    assert round(chiffres["score"], 2) == -4.10
    assert round(MODELE["threshold"], 2) == -2.69
    # Le tableau est du vrai texte : il n'a rien d'illisible pour un humain.
    assert "12/01/2026" in TABLEAU_DE_CHIFFRES


def test_point_de_rupture_temoin_une_page_de_prose_passe_largement():
    """« Le témoin : une page de contrat marque −2,39, au-dessus du seuil. »"""
    prose = is_readable(CORPUS[0], MODELE)
    assert prose["readable"] is True
    assert round(prose["score"], 2) == -2.39


# ---------------------------------------------------------------------------
# Les autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_n1_attrape_la_page_que_n0_avait_rangee_parmi_les_lisibles():
    """
    R4 : le niveau recommandé et celui du dessus, sur le point de rupture de
    N0. N0 range la page cassée parmi les lisibles ; N1 la refuse.
    """
    assert triage_pages(MOJIBAKE)["readable"] == [1]
    casse = is_readable(MOJIBAKE_TEXTE, MODELE)
    assert casse["readable"] is False
    assert round(casse["score"], 2) == -4.14
    # Témoin : sur la page de prose, les deux niveaux sont d'accord.
    assert is_readable(CORPUS[1], MODELE)["readable"] is True


def test_le_seuil_vient_du_lot_dentrainement_et_de_rien_dautre():
    """
    Docstring : « The threshold comes from the same place: the lowest score
    among the training pages, with a margin ».
    """
    scores = [score(page, MODELE) for page in CORPUS]
    assert MODELE["threshold"] == min(scores) - MARGIN
    # Toutes les pages d'entraînement passent leur propre seuil.
    assert all(is_readable(page, MODELE)["readable"] for page in CORPUS)


def test_une_autre_langue_sur_le_meme_alphabet_tombe_sous_le_seuil():
    """
    T3 : une entrée qui viole l'hypothèse du modèle. L'anglais s'écrit avec les
    mêmes lettres et n'a pas les mêmes paires ; le modèle est celui de vos
    documents, pas celui de l'alphabet latin.
    """
    anglais = is_readable(PAGE_ANGLAISE, MODELE)
    assert anglais["readable"] is False
    assert round(anglais["score"], 2) == -3.17
    # Et il remonte au-dessus du seuil dès que l'anglais entre dans le lot.
    bilingue = fit(CORPUS + [PAGE_ANGLAISE])
    assert is_readable(PAGE_ANGLAISE, bilingue)["readable"] is True


def test_le_modele_est_reproductible_et_ne_depend_daucun_tirage():
    """Deux ajustements sur le même lot donnent exactement le même seuil."""
    assert fit(CORPUS)["threshold"] == fit(CORPUS)["threshold"]
    assert fit(CORPUS[::-1])["threshold"] == MODELE["threshold"]


def test_tout_ce_qui_nest_pas_une_lettre_devient_un_seul_symbole():
    """Docstring : « Anything else […] becomes a single « other » class »."""
    assert normalise("Le Prix : 1 250,00 EUR !") == "le prix # # ###### eur #"
    assert normalise("") == ""


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_entree_banale_les_pages_que_n0_vient_de_declarer_lisibles():
    """T5 : le cas d'usage exact — N0 liste, N1 vérifie."""
    for page in CORPUS:
        assert is_readable(page, MODELE)["readable"] is True, page[:40]


def test_production_entree_vide():
    vide = is_readable("", MODELE)
    assert vide["score"] == float("-inf")
    assert vide["readable"] is False
    assert is_readable("a", MODELE)["score"] == float("-inf")


def test_production_entree_tres_grande_et_terminaison_rapide():
    enorme = " ".join(CORPUS) * 500
    debut = time.perf_counter()
    resultat = is_readable(enorme, MODELE)
    assert time.perf_counter() - debut < 30.0
    assert resultat["readable"] is True


def test_production_encodages_inattendus():
    # Accents décomposés : le « é » composé est dans l'alphabet, le décomposé
    # est un « e » suivi d'un accent seul, qui tombe dans « autre ». Les deux
    # formes s'affichent pareil et ne donnent pas le même texte au modèle.
    compose = unicodedata.normalize("NFC", "réception préalable")
    decompose = unicodedata.normalize("NFD", "réception préalable")
    assert normalise(compose) == "réception préalable"
    assert normalise(decompose) == "re#ception pre#alable"
    assert score(decompose, MODELE) != score(compose, MODELE)
    # Emoji, largeur nulle, espace insécable : tous dans « autre ».
    assert normalise("ok​ 🙂") == "ok###"


def test_production_valeurs_aux_limites():
    # Zéro, un, deux caractères.
    assert score("", MODELE) == float("-inf")
    assert score("a", MODELE) == float("-inf")
    assert score("es", MODELE) > float("-inf")
    # Un lot d'entraînement vide donne un seuil qui n'accepte rien de fini.
    assert fit([])["threshold"] == float("-inf")
    assert is_readable("le contrat", fit([]))["readable"] is True


def test_production_une_page_illisible_dans_un_lot_nempeche_pas_les_autres():
    """T8 : une page cassée ne fait pas tomber le lot."""
    lot = [CORPUS[0], MOJIBAKE_TEXTE, CORPUS[1], "", TABLEAU_DE_CHIFFRES]
    assert [is_readable(p, MODELE)["readable"] for p in lot] == [
        True, False, True, False, False]


def test_production_le_score_tient_la_classe_de_latence_annoncee():
    """latency « <1 ms » : dix mille scores sous une borne d'effondrement large."""
    debut = time.perf_counter()
    for _ in range(10_000):
        score(CORPUS[0], MODELE)
    assert time.perf_counter() - debut < 60.0
