import json
import time

import pytest

from _harness.fake_llm import FakeLLM, FakeLLMError
from _harness.fake_sdk import FakeSDK
from n3 import (FIELDS, MAX_CHARACTERS, MAX_HTML, MODEL, ProviderClient, ReadingUnavailable,
                read_product, to_text)

PAGE = (
    "<!doctype html><html><head><style>.prix{color:red}</style>"
    "<script>window.tracking={}</script></head><body>"
    "<nav>Accueil  Boutique</nav>"
    "<h1>Moulin à café Lumière</h1><p>Référence MC-4501</p>"
    '<p class="prix">19,90 €</p><p>En stock</p></body></html>'
)

LU = {"name": "Moulin à café Lumière", "sku": "MC-4501", "brand": "Lumière",
      "price": "19,90", "currency": "EUR", "availability": "En stock"}


def double(reponse=None, **extra) -> FakeLLM:
    return FakeLLM(response=json.dumps(reponse if reponse is not None else LU,
                                       ensure_ascii=False), **extra)


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_la_garde_verifie_dou_vient_une_valeur_pas_ce_quelle_veut_dire():
    """
    « La devise écrite « € » dans la page et rendue « EUR » par le modèle est
    comptée comme inventée, alors qu'elle est juste. »
    """
    rapport = read_product(PAGE, double())
    assert "€" in PAGE and "EUR" not in PAGE
    assert rapport["invented"] == ["currency"]
    assert rapport["product"]["currency"] is None


def test_point_de_rupture_temoin_un_prix_absent_de_la_page_est_bien_ecarte():
    """
    « Le témoin : un prix que la page ne contient pas — « 24,90 » sur une page
    à 19,90 — est bien écarté. »
    """
    rapport = read_product(PAGE, double({**LU, "price": "24,90"}))
    assert "24,90" not in PAGE
    assert rapport["product"]["price"] is None
    assert "price" in rapport["invented"]
    # Témoin du témoin : le prix de la page, lui, est gardé.
    assert read_product(PAGE, double())["product"]["price"] == "19,90"


# ---------------------------------------------------------------------------
# Les autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_la_page_est_debarrassee_de_son_balisage_avant_de_partir():
    """Docstring : « the tags come off and what is left is capped »."""
    texte = to_text(PAGE)
    assert "<" not in texte and ">" not in texte
    assert "window.tracking" not in texte and "color:red" not in texte
    assert "Moulin à café Lumière" in texte and "19,90 €" in texte
    assert len(texte) < len(PAGE) / 3


def test_la_page_est_coupee_au_budget_pas_refusee():
    """
    Docstring : « A page that does not fit is cut, not refused: a scraper that
    raises on a long page returns nothing at all ».
    """
    enorme = PAGE.replace("</body>", "<p>" + "x" * 500_000 + "</p></body>")
    rapport = read_product(enorme, double())
    assert rapport["characters_sent"] == MAX_CHARACTERS
    assert rapport["product"]["name"] == "Moulin à café Lumière"


def test_la_requete_porte_le_texte_de_la_page_et_les_champs_demandes():
    client = double()
    read_product(PAGE, client)
    envoye = client.last_request["prompt"]
    assert "Moulin à café Lumière" in envoye
    for champ in FIELDS:
        assert champ in envoye
    assert client.last_request["temperature"] == 0


def test_une_reponse_dans_une_cloture_de_code_est_decodee():
    """Charte des tests : une seule clôture de code se décode comme si elle n'y était pas."""
    client = FakeLLM(response="```json\n" + json.dumps(LU, ensure_ascii=False) + "\n```")
    assert read_product(PAGE, client)["product"]["sku"] == "MC-4501"
    # Deux blocs, ou du texte autour, ne se décodent pas.
    for mauvaise in ["Voici : " + json.dumps(LU), "```json\n{}\n```\n```json\n{}\n```",
                     "```json\n{}", ""]:
        with pytest.raises(ReadingUnavailable):
            read_product(PAGE, FakeLLM(response=mauvaise), attempts=1)


def test_un_refus_du_modele_nest_pas_passe_au_decodeur():
    """Docstring : « `content` of None is not a value »."""
    with pytest.raises(ReadingUnavailable) as leve:
        read_product(PAGE, FakeLLM(response=None), attempts=1)
    assert "the model answered no text" in str(leve.value)


def test_une_panne_est_retentee_le_nombre_de_fois_annonce():
    client = double(fail_times=2)
    assert read_product(PAGE, client, attempts=3)["product"]["sku"] == "MC-4501"
    assert client.call_count == 3
    # Une panne de plus que d'essais, et l'erreur remonte.
    trop = double(fail_times=3)
    with pytest.raises(ReadingUnavailable):
        read_product(PAGE, trop, attempts=3)
    assert trop.call_count == 3


def test_ladaptateur_par_defaut_parle_au_vrai_kit():
    """T2 : l'adaptateur est exécuté contre le double du harnais."""
    sdk = FakeSDK(content=json.dumps(LU, ensure_ascii=False))
    client = ProviderClient(sdk=sdk)
    rapport = read_product(PAGE, client)
    assert rapport["product"]["sku"] == "MC-4501"
    envoye = sdk.last_request
    assert envoye["endpoint"] == "chat.completions"
    assert envoye["model"] == MODEL
    assert envoye["temperature"] == 0
    assert envoye["messages"][0]["role"] == "user"
    assert "Moulin à café Lumière" in envoye["messages"][0]["content"]
    # Un refus du fournisseur : content nul, lu comme tel.
    with pytest.raises(ReadingUnavailable):
        read_product(PAGE, ProviderClient(sdk=FakeSDK(content=None)), attempts=1)


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_entree_banale_une_fiche_sans_donnees_structurees():
    """T5 : l'entrée ordinaire du public visé — la boutique qui n'émet rien."""
    rapport = read_product(PAGE, double())
    assert rapport["source"] == "model"
    assert rapport["product"]["name"] == "Moulin à café Lumière"
    assert rapport["product"]["sku"] == "MC-4501"


def test_production_entree_vide():
    rapport = read_product("", double({f: None for f in FIELDS}))
    assert rapport["characters_sent"] == 0
    assert all(v is None for v in rapport["product"].values())
    assert rapport["invented"] == []


def test_production_encodages_inattendus():
    # Emoji, insécables, entités : le texte envoyé les garde tels quels.
    page = PAGE.replace("Moulin à café Lumière", "Bouilloire 🫖 Lumière")
    rapport = read_product(page, double({**LU, "name": "Bouilloire 🫖 Lumière"}))
    assert rapport["product"]["name"] == "Bouilloire 🫖 Lumière"
    # La comparaison ignore la casse, pas les accents.
    assert read_product(PAGE, double({**LU, "name": "MOULIN À CAFÉ LUMIÈRE"}))[
        "product"]["name"] == "MOULIN À CAFÉ LUMIÈRE"
    assert "name" in read_product(PAGE, double({**LU, "name": "Moulin a cafe Lumiere"}))["invented"]


def test_production_entree_tres_grande_la_page_hostile_du_niveau_N0():
    """
    La page que le niveau N0 de cette fiche est écrit pour survivre : vingt
    mille balises `<script>` jamais refermées. Le nettoyage de ce niveau la
    traversait en quarante secondes de processeur, **avant** l'appel au
    modèle — c'est-à-dire qu'il réintroduisait, deux fichiers plus loin,
    l'effondrement que le N0 évite.

    La charte des tests demande qu'une entrée trop grande soit refusée avant
    l'appel. Le plafond de balisage est donc appliqué en premier, et les blocs
    sont balayés plutôt que reconnus par une expression régulière.
    """
    hostile = '<script type="application/ld+json">' * 20_000
    debut = time.perf_counter()
    assert to_text(hostile) == ""
    assert time.perf_counter() - debut < 1.0
    # Les mêmes balises, en `<style>` : c'est la seconde branche du motif.
    hostile_style = "<style>" * 20_000
    debut = time.perf_counter()
    assert to_text(hostile_style) == ""
    assert time.perf_counter() - debut < 1.0
    # Témoin : une page ordinaire, cent fois le cas nominal, reste lisible.
    grande = PAGE + "<p>Livraison offerte.</p>" * 10_000
    debut = time.perf_counter()
    texte = to_text(grande)
    assert time.perf_counter() - debut < 1.0
    assert "Moulin à café Lumière" in texte


def test_production_le_plafond_de_balisage_sapplique_avant_le_nettoyage():
    """
    Commentaire : « a cap applied after the cleaning protects nothing, since
    the cleaning is the part that costs ».
    """
    # Au-delà du plafond, le balisage n'est pas lu du tout : le nom qui suit
    # ne peut pas ressortir.
    loin = "<p>a</p>" * (MAX_HTML // 8 + 10) + "<p>Moulin à café Lumière</p>"
    assert len(loin) > MAX_HTML
    assert "Moulin" not in to_text(loin)
    # Juste en dessous, il l'est.
    proche = "<p>a</p>" * 10 + "<p>Moulin à café Lumière</p>"
    assert len(proche) < MAX_HTML
    assert "Moulin à café Lumière" in to_text(proche)


def test_production_valeurs_aux_limites():
    # Exactement le budget, et un caractère de plus.
    texte = "a" * MAX_CHARACTERS
    assert read_product(texte, double({f: None for f in FIELDS}))["characters_sent"] == MAX_CHARACTERS
    assert read_product(texte + "b", double({f: None for f in FIELDS}))[
        "characters_sent"] == MAX_CHARACTERS
    # Une réponse qui n'est pas un objet, et une réponse sans les clés.
    assert read_product(PAGE, FakeLLM(response="[]"))["product"] == {f: None for f in FIELDS}
    assert read_product(PAGE, FakeLLM(response="{}"))["invented"] == []


def test_production_un_champ_invente_nempeche_pas_de_garder_les_autres():
    """T8 : une valeur fausse ne fait pas tomber la lecture."""
    rapport = read_product(PAGE, double({**LU, "sku": "MC-0000", "price": "24,90"}))
    assert rapport["product"]["name"] == "Moulin à café Lumière"
    assert rapport["invented"] == ["sku", "price", "currency"]


def test_production_la_lecture_tient_la_classe_de_latence_annoncee():
    """
    latency « ~1 s » : la classe est celle de l'appel au fournisseur, que le
    double ne mesure pas. Ce test ne borne que la part locale — découpe du
    balisage et vérification des valeurs — sur mille lectures.
    """
    client = double()
    debut = time.perf_counter()
    for _ in range(1_000):
        read_product(PAGE, client)
    assert time.perf_counter() - debut < 60.0
