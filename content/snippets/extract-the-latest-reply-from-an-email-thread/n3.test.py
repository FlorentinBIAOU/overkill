import json
import time

import pytest

from _harness.fake_llm import FakeLLM
from _harness.fake_sdk import FakeSDK
from n3 import MAX_CHARACTERS, MODEL, ProviderClient, ReadingUnavailable, read_reply

# La réponse est écrite entre les lignes citées : c'est le cas pour lequel ce
# niveau existe, et le seul que le niveau N0 ne sait pas lire.
FIL_INTERCALE = """Le 10 octobre 2026 à 13:55, Marie Martin <marie@exemple.fr> a écrit :
> Pouvez-vous confirmer le devis DV-2026-118 avant vendredi ?
Oui, il est signé de ce matin.
> Et la livraison est-elle toujours prévue le 20 ?
Non, le 22 : le transporteur a décalé la tournée.
"""

# Outlook recopie l'ancien message sans le préfixer.
FIL_OUTLOOK_FR = """Bonjour Marie,

C'est noté, je m'en occupe.

Jean

________________________________
De : Marie Martin <marie@exemple.fr>
Envoyé : jeudi 10 octobre 2026 13:55
À : Jean Dupont <jean@exemple.fr>
Objet : RE: Devis DV-2026-118

Bonjour Jean,
Pouvez-vous confirmer le devis avant vendredi ?
Marie
"""


def double(lignes, **extra) -> FakeLLM:
    return FakeLLM(response=json.dumps({"lines": lignes}), **extra)


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_la_garde_refuse_une_ligne_citee_pas_une_ligne_ancienne():
    """
    « La garde refuse les lignes préfixées par « > », pas les lignes d'un
    message recopié sans préfixe. »
    """
    # Lignes 13 et 14 : le message de la semaine dernière, sous le trait.
    rapport = read_reply(FIL_OUTLOOK_FR, double([13, 14]))
    assert rapport["dropped"] == []
    assert rapport["reply"] == "Bonjour Jean,\nPouvez-vous confirmer le devis avant vendredi ?"


def test_point_de_rupture_temoin_une_ligne_citee_est_bien_ecartee():
    """
    « Le témoin est dans le même test : sur un fil cité ligne à ligne, la ligne
    de la citation est refusée et nommée. »
    """
    rapport = read_reply(FIL_INTERCALE, double([2, 3]))
    assert rapport["dropped"] == [2]
    assert rapport["lines"] == [3]
    assert rapport["reply"] == "Oui, il est signé de ce matin."


# ---------------------------------------------------------------------------
# Les autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_la_reponse_est_faite_de_lignes_du_fil_dans_leur_ordre():
    rapport = read_reply(FIL_INTERCALE, double([5, 3, 3]))
    assert rapport["lines"] == [3, 5]
    assert rapport["reply"] == ("Oui, il est signé de ce matin.\n"
                                "Non, le 22 : le transporteur a décalé la tournée.")


def test_un_numero_qui_nest_pas_une_ligne_du_fil_est_ecarte():
    rapport = read_reply(FIL_INTERCALE, double([0, 3, 99, "trois", None, 2.0]))
    assert rapport["lines"] == [3]
    assert rapport["dropped"] == [0, 99, "trois", None, 2.0]


def test_le_fil_est_coupe_au_budget_pas_refuse():
    long_fil = "ligne\n" * 5000
    rapport = read_reply(long_fil, double([1]))
    assert rapport["characters_sent"] == MAX_CHARACTERS


def test_la_requete_porte_le_fil_numerote_ligne_a_ligne():
    client = double([3])
    read_reply(FIL_INTERCALE, client)
    envoye = client.last_request["prompt"]
    assert "3: Oui, il est signé de ce matin." in envoye
    assert "2: > Pouvez-vous confirmer" in envoye


def test_une_reponse_dans_une_cloture_de_code_est_decodee():
    client = FakeLLM(response='```json\n{"lines": [3]}\n```')
    assert read_reply(FIL_INTERCALE, client)["lines"] == [3]


def test_un_refus_du_modele_nest_pas_passe_au_decodeur():
    with pytest.raises(ReadingUnavailable):
        read_reply(FIL_INTERCALE, FakeLLM(response=None), attempts=1)


def test_une_panne_est_retentee_le_nombre_de_fois_annonce():
    client = double([3], fail_times=2)
    assert read_reply(FIL_INTERCALE, client)["lines"] == [3]
    trop = double([3], fail_times=3)
    with pytest.raises(ReadingUnavailable):
        read_reply(FIL_INTERCALE, trop)
    assert trop.call_count == 3


def test_ladaptateur_par_defaut_parle_au_vrai_kit():
    """T2 : l'adaptateur est exécuté contre le double du harnais."""
    sdk = FakeSDK(content=json.dumps({"lines": [3, 5]}))
    rapport = read_reply(FIL_INTERCALE, ProviderClient(sdk=sdk))
    assert rapport["lines"] == [3, 5]
    envoye = sdk.last_request
    assert envoye["endpoint"] == "chat.completions"
    assert envoye["model"] == MODEL
    assert envoye["temperature"] == 0
    assert envoye["messages"][0]["role"] == "user"
    assert "1: Le 10 octobre 2026" in envoye["messages"][0]["content"]
    # Un refus du fournisseur : content nul, lu comme tel.
    with pytest.raises(ReadingUnavailable):
        read_reply(FIL_INTERCALE, ProviderClient(sdk=FakeSDK(content=None)), attempts=1)


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_entree_banale_une_reponse_intercalee():
    """T5 : l'entrée ordinaire du public visé — le fil que N0 a signalé."""
    rapport = read_reply(FIL_INTERCALE, double([3, 5]))
    assert rapport["source"] == "model"
    assert "Oui, il est signé de ce matin." in rapport["reply"]


def test_production_entree_vide():
    rapport = read_reply("", double([]))
    assert rapport["reply"] == ""
    assert rapport["characters_sent"] == 0


def test_production_encodages_inattendus():
    crlf = FIL_INTERCALE.replace("\n", "\r\n")
    assert read_reply(crlf, double([3]))["reply"] == "Oui, il est signé de ce matin."
    cr = FIL_INTERCALE.replace("\n", "\r")
    assert read_reply(cr, double([3]))["reply"] == "Oui, il est signé de ce matin."


def test_production_valeurs_aux_limites():
    # Aucune ligne retenue : une réponse vide, pas une exception.
    assert read_reply(FIL_INTERCALE, double([]))["reply"] == ""
    # Une réponse qui n'a pas la forme attendue.
    assert read_reply(FIL_INTERCALE, FakeLLM(response="[3]"))["lines"] == []
    assert read_reply(FIL_INTERCALE, FakeLLM(response='{"lines": "3"}'))["lines"] == []


def test_production_une_ligne_refusee_nempeche_pas_de_garder_les_autres():
    """T8 : un numéro faux ne fait pas tomber la lecture."""
    rapport = read_reply(FIL_INTERCALE, double([2, 3, 5]))
    assert rapport["lines"] == [3, 5]
    assert rapport["dropped"] == [2]


def test_production_la_lecture_tient_la_classe_de_latence_annoncee():
    """latency « ~1 s » : le travail local, hors appel, reste négligeable."""
    debut = time.perf_counter()
    for _ in range(200):
        read_reply(FIL_INTERCALE, double([3, 5]))
    assert time.perf_counter() - debut < 10.0
