import json
import time

import pytest

from _harness.fake_llm import FakeLLM
from _harness.fake_sdk import FakeSDK
from n3 import MAX_CHARACTERS, MODEL, ProviderClient, ReadingUnavailable, read_amounts

# La devise est écrite une fois, en tête ; les montants n'ont rien à côté
# d'eux. C'est le cas que le niveau N0 signale et ne sait pas lire.
ENTETE = ("Facture n° 2026-118. Montants exprimés en euros.\n"
          "Sous-total : 1 250,00\nRemise : 125,00\nTotal : 1 125,00")

TROUVES = [{"text": "1 250,00", "currency": "EUR"},
           {"text": "125,00", "currency": "EUR"},
           {"text": "1 125,00", "currency": "EUR"}]


def double(amounts, **extra) -> FakeLLM:
    return FakeLLM(response=json.dumps({"amounts": amounts}, ensure_ascii=False), **extra)


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_la_garde_verifie_dou_vient_un_nombre_pas_ce_quil_designe():
    """
    « La garde vérifie que les chiffres sont dans le document et que la devise
    y est nommée, pas que le nombre était un montant. »
    """
    rapport = read_amounts(ENTETE, "fr", double([{"text": "2026", "currency": "EUR"}]))
    assert rapport["dropped"] == []
    assert rapport["amounts"][0]["value"] == "2026"  # le numéro de facture


def test_point_de_rupture_temoin_un_total_absent_du_document_est_ecarte():
    """
    « Le témoin est dans le même test : un total que le document ne contient
    pas — « 9 999,00 » — est écarté, et la raison est dite. »
    """
    rapport = read_amounts(ENTETE, "fr", double(TROUVES + [
        {"text": "9 999,00", "currency": "EUR"}]))
    assert [a["value"] for a in rapport["amounts"]] == ["1250.00", "125.00", "1125.00"]
    assert rapport["dropped"] == [{"text": "9 999,00", "why": "not in the document"}]


# ---------------------------------------------------------------------------
# Les autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_une_devise_nommee_nulle_part_dans_le_document_est_refusee():
    rapport = read_amounts(ENTETE, "fr", double([{"text": "1 250,00", "currency": "USD"}]))
    assert rapport["amounts"] == []
    assert rapport["dropped"][0]["why"] == "USD is named nowhere in the document"


def test_une_devise_qui_nest_pas_un_code_est_refusee():
    rapport = read_amounts(ENTETE, "fr", double([{"text": "1 250,00", "currency": "euros"}]))
    assert rapport["dropped"][0]["why"] == "EUROS is not a code this rung knows"


def test_la_valeur_est_relue_par_le_niveau_n0_pas_par_le_modele():
    """Le modèle rend une portion du document ; l'arithmétique reste ici."""
    rapport = read_amounts(ENTETE, "fr", double([{"text": "1 250,00", "currency": "EUR"}]))
    assert rapport["amounts"][0]["value"] == "1250.00"
    anglais = read_amounts(ENTETE, "en", double([{"text": "1 250,00", "currency": "EUR"}]))
    assert anglais["amounts"][0]["value"] == "1250.00"


def test_le_document_est_coupe_au_budget_pas_refuse():
    long_doc = ENTETE + " euros " * 5000
    rapport = read_amounts(long_doc, "fr", double([]))
    assert rapport["characters_sent"] == MAX_CHARACTERS


def test_la_requete_porte_le_document():
    client = double(TROUVES)
    read_amounts(ENTETE, "fr", client)
    assert "Montants exprimés en euros." in client.last_request["prompt"]


def test_une_reponse_dans_une_cloture_de_code_est_decodee():
    client = FakeLLM(response='```json\n{"amounts": [{"text": "125,00", "currency": "EUR"}]}\n```')
    assert read_amounts(ENTETE, "fr", client)["amounts"][0]["value"] == "125.00"


def test_un_refus_du_modele_nest_pas_passe_au_decodeur():
    with pytest.raises(ReadingUnavailable):
        read_amounts(ENTETE, "fr", FakeLLM(response=None), attempts=1)


def test_une_panne_est_retentee_le_nombre_de_fois_annonce():
    client = double(TROUVES, fail_times=2)
    assert len(read_amounts(ENTETE, "fr", client)["amounts"]) == 3
    trop = double(TROUVES, fail_times=3)
    with pytest.raises(ReadingUnavailable):
        read_amounts(ENTETE, "fr", trop)
    assert trop.call_count == 3


def test_ladaptateur_par_defaut_parle_au_vrai_kit():
    """T2 : l'adaptateur est exécuté contre le double du harnais."""
    sdk = FakeSDK(content=json.dumps({"amounts": TROUVES}, ensure_ascii=False))
    rapport = read_amounts(ENTETE, "fr", ProviderClient(sdk=sdk))
    assert len(rapport["amounts"]) == 3
    envoye = sdk.last_request
    assert envoye["endpoint"] == "chat.completions"
    assert envoye["model"] == MODEL
    assert envoye["temperature"] == 0
    assert envoye["messages"][0]["role"] == "user"
    assert "Sous-total : 1 250,00" in envoye["messages"][0]["content"]
    with pytest.raises(ReadingUnavailable):
        read_amounts(ENTETE, "fr", ProviderClient(sdk=FakeSDK(content=None)), attempts=1)


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_entree_banale_un_document_a_devise_en_entete():
    """T5 : l'entrée ordinaire du public visé — le document que N0 signale."""
    rapport = read_amounts(ENTETE, "fr", double(TROUVES))
    assert rapport["source"] == "model"
    assert [a["currency"] for a in rapport["amounts"]] == ["EUR"] * 3


def test_production_entree_vide():
    rapport = read_amounts("", "fr", double([]))
    assert rapport["amounts"] == []
    assert rapport["characters_sent"] == 0


def test_production_encodages_inattendus():
    insecable = ENTETE.replace("1 250,00", "1 250,00")
    rapport = read_amounts(insecable, "fr", double([{"text": "1 250,00", "currency": "EUR"}]))
    assert rapport["amounts"][0]["value"] == "1250.00"


def test_production_valeurs_aux_limites():
    assert read_amounts(ENTETE, "fr", double([]))["amounts"] == []
    assert read_amounts(ENTETE, "fr", FakeLLM(response="[]"))["amounts"] == []
    assert read_amounts(ENTETE, "fr", FakeLLM(response='{"amounts": "1 250,00"}'))["amounts"] == []
    vide = read_amounts(ENTETE, "fr", double([{"text": "", "currency": "EUR"}]))
    assert vide["dropped"][0]["why"] == "not in the document"


def test_production_un_montant_ecarte_nempeche_pas_de_garder_les_autres():
    """T8 : un élément faux ne fait pas tomber la lecture."""
    rapport = read_amounts(ENTETE, "fr", double([
        {"text": "9 999,00", "currency": "EUR"}] + TROUVES))
    assert len(rapport["amounts"]) == 3
    assert len(rapport["dropped"]) == 1


def test_production_la_lecture_tient_la_classe_de_latence_annoncee():
    """latency « ~1 s » : le travail local, hors appel, reste négligeable."""
    debut = time.perf_counter()
    for _ in range(200):
        read_amounts(ENTETE, "fr", double(TROUVES))
    assert time.perf_counter() - debut < 10.0
