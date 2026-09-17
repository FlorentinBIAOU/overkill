"""
Ces tests injectent un double local au lieu d'appeler un fournisseur.

Ce qu'ils prouvent : le dossier arrive dans l'invite, la température demandée
est celle envoyée, un dossier trop grand est refusé avant toute dépense, une
panne est retentée, une réponse inutilisable lève, et une copie qui affirme un
attribut absent du dossier est refusée.

Ce qu'ils ne prouvent pas : que le modèle écrit bien, ni qu'il écrit autrement
demain.
"""

import json
import unicodedata

import pytest

from _harness.fake_llm import FakeLLM
from _harness.fake_sdk import FakeSDK
from n3 import (
    MAX_CHARACTERS,
    MIN_CHARACTERS,
    MODEL,
    PROMPT,
    DescriptionUnavailable,
    ProviderClient,
    UngroundedDescription,
    describe,
)

PRODUCT = {
    "name": "Aurore 500",
    "category": "sac à dos",
    "material": "toile recyclée",
    "audience": "les randonneurs",
    "features": ["poche pour ordinateur", "sangle ventrale"],
    "colours": ["ardoise", "sable"],
    "warranty": "deux ans",
}

VOCABULARY = ("toile recyclée", "cuir pleine fleur", "étanche", "poche pour ordinateur", "garanti à vie")

COPY = (
    "Aurore 500 tient la journée de marche sans se rappeler à vous. Sa toile "
    "recyclée encaisse les ronces, et sa poche pour ordinateur rentre au bureau le lundi."
)

FOR_LIFE = (
    "Aurore 500 tient la journée de marche sans se rappeler à vous. Sa toile "
    "recyclée encaisse les ronces, et le sac est garanti à vie contre les défauts de couture."
)


def answer(description) -> str:
    return json.dumps({"description": description})


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_le_modele_promet_ce_que_la_boutique_ne_vend_pas():
    """
    « Le test fait écrire au double local que le sac est « garanti à vie »
    quand le dossier dit deux ans […] Ce qui l'attrape est le contrôle du
    niveau du dessous, terme à terme contre le dossier » (existant).
    """
    with pytest.raises(UngroundedDescription) as refused:
        describe(PRODUCT, FakeLLM(response=answer(FOR_LIFE)), vocabulary=VOCABULARY)
    assert str(refused.value) == "garanti à vie"
    # Témoin : pour un dossier dont la garantie est réellement à vie, la phrase passe.
    for_life = {**PRODUCT, "warranty": "garanti à vie"}
    assert describe(for_life, FakeLLM(response=answer(FOR_LIFE)), vocabulary=VOCABULARY) == FOR_LIFE


def test_point_de_rupture_et_il_ne_vaut_que_ce_que_vaut_votre_liste():
    """« et il ne vaut que ce que vaut votre liste » : sans « garanti à vie » dans la liste, la promesse passe."""
    assert describe(PRODUCT, FakeLLM(response=answer(FOR_LIFE)), vocabulary=("étanche",)) == FOR_LIFE


def test_point_de_rupture_l_extrait_demande_une_temperature_non_nulle():
    """« l'extrait demande une température non nulle » : 0,7 par défaut, et celle de l'appelant sinon (existant, complété)."""
    client = FakeLLM(response=answer(COPY))
    describe(PRODUCT, client)
    assert client.last_request["temperature"] == 0.7
    describe(PRODUCT, client, temperature=0.4)
    assert client.last_request["temperature"] == 0.4


def test_point_de_rupture_deux_reponses_differentes_passent_toutes_deux_le_controle():
    """
    « deux appels sur le même produit ne rendent pas le même texte » : non
    testable sur le modèle. Ce test (existant) montre seulement que deux copies
    différentes, écrites par le double, passent toutes deux : il ne démontre
    rien sur la variation du modèle. Voir le relevé.
    """
    first = describe(PRODUCT, FakeLLM(response=answer(COPY)), vocabulary=VOCABULARY)
    second_copy = (
        "Aurore 500 part en week-end sans y penser. Sa toile recyclée passe la pluie "
        "et les ronces, et son ardoise discrète se fait oublier en réunion."
    )
    second = describe(PRODUCT, FakeLLM(response=answer(second_copy)), vocabulary=VOCABULARY)
    assert first != second


def test_defaut_un_dossier_qui_nie_l_attribut_ne_l_ancre_pas():
    record = {**PRODUCT, "features": [*PRODUCT["features"], "non étanche"]}
    copy = "Aurore 500 suit les randonneurs par tous les temps, sa toile recyclée est étanche."
    with pytest.raises(UngroundedDescription):
        describe(record, FakeLLM(response=answer(copy)), vocabulary=VOCABULARY)


def test_defaut_un_terme_de_la_liste_accorde_est_refuse_aussi():
    lamp = {**PRODUCT, "category": "lampe de bureau", "gender": "f"}
    copy = "Aurore 500 est une lampe de bureau solide, garantie à vie contre les défauts."
    with pytest.raises(UngroundedDescription):
        describe(lamp, FakeLLM(response=answer(copy)), vocabulary=VOCABULARY)


# ---------------------------------------------------------------------------
# Docstring et commentaires
# ---------------------------------------------------------------------------


def test_ecrit_la_copie_que_le_modele_a_rendue():
    """Cas nominal (existant)."""
    assert describe(PRODUCT, FakeLLM(response=answer(COPY)), vocabulary=VOCABULARY) == COPY


def test_envoie_des_consignes_en_francais_et_le_dossier_entier():
    """
    « the request » ; commentaire « The instructions are written in the language
    of the shop » ; risks `data_egress: third-party` (existant, resserré : invite exacte).
    """
    client = FakeLLM(response=answer(COPY))
    describe(PRODUCT, client)
    assert client.last_request["prompt"] == PROMPT + "\n" + "\n".join(
        [
            "- name : Aurore 500",
            "- category : sac à dos",
            "- material : toile recyclée",
            "- audience : les randonneurs",
            "- features : poche pour ordinateur, sangle ventrale",
            "- colours : ardoise, sable",
            "- warranty : deux ans",
        ]
    )
    assert PROMPT.startswith("Tu rédiges la présentation d'un article")


def test_replie_les_retours_a_la_ligne_que_le_modele_laisse():
    """Existant."""
    assert describe(PRODUCT, FakeLLM(response=answer(f"  {COPY}\n\n  "))) == COPY


def test_refuse_un_dossier_trop_grand_avant_de_depenser_quoi_que_ce_soit():
    """Commentaire : « Refusing an oversized record is not an optimisation, it is a cost control » (existant, complété : limites)."""
    client = FakeLLM(response=answer(COPY))
    with pytest.raises(ValueError):
        describe({"name": "Aurore 500", "features": ["détail interminable " * 40]}, client)
    assert client.call_count == 0
    assert describe({"n": "x" * (MAX_CHARACTERS - 6)}, client) == COPY
    with pytest.raises(ValueError):
        describe({"n": "x" * (MAX_CHARACTERS - 5)}, client)
    assert client.call_count == 1


def test_une_panne_est_retentee_le_nombre_de_fois_annonce():
    """« the retry » (existant, complété)."""
    client = FakeLLM(response=answer(COPY), fail_times=2)
    assert describe(PRODUCT, client, attempts=3) == COPY
    assert client.call_count == 3
    client = FakeLLM(response=answer(COPY), fail_times=5)
    with pytest.raises(DescriptionUnavailable, match="simulated provider failure"):
        describe(PRODUCT, client)
    assert client.call_count == 3


def test_une_reponse_qui_n_est_pas_du_json_leve_plutot_que_d_etre_publiee():
    """« an answer that is only probably JSON » (existant) : chaque essai est un appel facturé."""
    client = FakeLLM(response="Bien sûr ! Voici une proposition de description :")
    with pytest.raises(DescriptionUnavailable):
        describe(PRODUCT, client, attempts=2)
    assert client.call_count == 2


def test_une_reponse_d_une_autre_forme_leve():
    """JSON sans description, description vide, nombre, liste, `null`, clôture non refermée, prose autour d'une clôture."""
    for response in (
        json.dumps({"titre": "Aurore 500"}),
        answer(""),
        answer(42),
        answer(["Aurore 500 tient la journée de marche.", "Sa toile recyclée encaisse les ronces."]),
        "null",
        "```json\n" + answer(COPY),
        "Voici la description :\n```json\n" + answer(COPY) + "\n```",
    ):
        with pytest.raises(DescriptionUnavailable):
            describe(PRODUCT, FakeLLM(response=response), attempts=1)


def test_un_fragment_est_refuse():
    """`MIN_CHARACTERS` (existant, complété : limites)."""
    with pytest.raises(DescriptionUnavailable):
        describe(PRODUCT, FakeLLM(response=answer("Un sac à dos.")))
    assert describe(PRODUCT, FakeLLM(response=answer("A" * MIN_CHARACTERS))) == "A" * MIN_CHARACTERS
    with pytest.raises(DescriptionUnavailable):
        describe(PRODUCT, FakeLLM(response=answer("A" * (MIN_CHARACTERS - 1))))


def test_la_recherche_ignore_casse_et_accents():
    """`_fold` : « so « À vie » meets « a vie » »."""
    with pytest.raises(UngroundedDescription):
        describe(PRODUCT, FakeLLM(response=answer(FOR_LIFE.replace("garanti à vie", "GARANTI A VIE"))), vocabulary=VOCABULARY)
    record = {**PRODUCT, "warranty": unicodedata.normalize("NFD", "Garanti À VIE")}
    assert describe(record, FakeLLM(response=answer(FOR_LIFE)), vocabulary=VOCABULARY) == FOR_LIFE


def test_le_client_est_injecte_pour_tester_sans_reseau():
    """« `client` is injected so this can be tested without a network call »."""
    with pytest.raises(ModuleNotFoundError, match="openai"):
        describe(PRODUCT)


def test_production_l_adaptateur_appelle_la_surface_du_vrai_kit():
    """
    docstring de `ProviderClient` : « The one call this snippet makes, on top of
    the provider's SDK ». Sur le double du harnais, à la forme du kit `openai`
    publié, sans méthode `complete` : `chat.completions.create(model=...,
    messages=[...], temperature=...)`, réponse lue dans
    `choices[0].message.content`.
    """
    sdk = FakeSDK(content=answer(COPY))
    assert not hasattr(sdk, "complete")
    assert describe(PRODUCT, ProviderClient(sdk=sdk), temperature=0.4) == COPY
    request = sdk.last_request
    assert request["endpoint"] == "chat.completions"
    assert request["model"] == MODEL == "gpt-4.1-mini"
    assert request["messages"][0]["role"] == "user"
    assert PRODUCT["name"] in request["messages"][0]["content"]
    # La température demandée est celle qui arrive au kit, pas une valeur par défaut.
    assert request["temperature"] == 0.4
    assert len(sdk.requests) == 1
    tiede = FakeSDK(content=answer(COPY))
    describe(PRODUCT, ProviderClient(sdk=tiede))
    assert tiede.last_request["temperature"] == 0.7


def test_production_l_adaptateur_une_reponse_sans_contenu_leve_apres_les_essais():
    """Le kit type `content` comme facultatif : `None` n'est pas une copie, et il est redemandé."""
    sdk = FakeSDK(content=None)
    with pytest.raises(DescriptionUnavailable):
        describe(PRODUCT, ProviderClient(sdk=sdk))
    assert len(sdk.requests) == 3


def test_production_l_adaptateur_une_panne_du_kit_est_retentee():
    sdk = FakeSDK(content=answer(COPY), fail_times=2)
    assert describe(PRODUCT, ProviderClient(sdk=sdk)) == COPY
    assert len(sdk.requests) == 3
    mort = FakeSDK(content=answer(COPY), fail_times=3)
    with pytest.raises(DescriptionUnavailable):
        describe(PRODUCT, ProviderClient(sdk=mort))
    assert len(mort.requests) == 3


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_un_dossier_vide_ne_part_pas_chez_le_fournisseur():
    """Un dossier sans un attribut ne peut rien donner : il est refusé avant de coûter un appel."""
    client = FakeLLM(response=answer(COPY))
    with pytest.raises(ValueError, match="empty product record"):
        describe({}, client)
    assert client.call_count == 0


def test_production_zero_essai_leve_sans_appel():
    client = FakeLLM(response=answer(COPY))
    with pytest.raises(DescriptionUnavailable):
        describe(PRODUCT, client, attempts=0)
    assert client.call_count == 0


def test_production_le_plafond_compte_des_caracteres():
    """Python : 296 emojis font 305 caractères d'attributs, acceptés (JavaScript les refuse, voir n3.test.js)."""
    assert describe({"name": "🙂" * 296}, FakeLLM(response=answer(COPY))) == COPY
