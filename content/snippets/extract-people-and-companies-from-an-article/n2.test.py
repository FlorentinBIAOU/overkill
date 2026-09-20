import time

import pytest

from _harness.fake_model import FakeClassifier
from n0 import extract_names as extract_names_n0
from n2 import LABELS, MAX_CHARACTERS, RecognitionUnavailable, extract_names

ARTICLE = ("Le contrat lie la société Lumière SARL à Jean de La Fontaine et à "
           "Mme Marie Martin, de Lyon. M. Boulanger a livré le colis mercredi.")


def entites(*trouvees):
    return {"entities": [{"text": t, "label": l, "start": ARTICLE.index(t),
                          "end": ARTICLE.index(t) + len(t)} for t, l in trouvees]}


def double(reponse=None, **extra):
    return FakeClassifier({ARTICLE: reponse if reponse is not None else entites(
        ("Lumière SARL", "ORG"), ("Jean de La Fontaine", "PER"),
        ("Marie Martin", "PER"), ("Lyon", "LOC"), ("Boulanger", "PER"))},
        default={"entities": []}, **extra)


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_le_modele_type_tout_et_ne_rend_aucun_doute():
    """
    « Le pipeline rend une étiquette pour chaque nom qu'il trouve, et rien à
    côté : il n'y a pas de seuil à monter ni d'« unknown » sur quoi retomber. »
    """
    lu = extract_names([ARTICLE], double(entites(("Lyon", "ORG"))))[0]
    assert lu["names"] == [{"text": "Lyon", "type": "company", "evidence": "ORG",
                            "start": ARTICLE.index("Lyon"),
                            "end": ARTICLE.index("Lyon") + 4}]
    # Rien dans le rapport ne permet d'en douter : pas de score, pas de doute.
    assert "score" not in lu["names"][0]


def test_point_de_rupture_temoin_le_niveau_n0_repond_unknown_sur_le_meme_nom():
    """
    « Le témoin est dans le même test : sur ce même nom, le niveau N0 répond
    `unknown`, parce que la phrase ne prouve rien. »
    """
    lu = extract_names_n0(ARTICLE)["names"]
    lyon = [n for n in lu if n["text"] == "Lyon"][0]
    assert (lyon["type"], lyon["evidence"]) == ("unknown", None)


# ---------------------------------------------------------------------------
# Les autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_une_etiquette_non_cartographiee_est_ecartee_et_comptee():
    lu = extract_names([ARTICLE], double(entites(("Lyon", "LOC"), ("colis", "MISC"))))[0]
    assert [n["text"] for n in lu["names"]] == ["Lyon"]
    assert lu["unmapped"] == ["MISC"]


def test_les_etiquettes_des_deux_jeux_courants_sont_cartographiees():
    assert LABELS["PER"] == "person" and LABELS["PERSON"] == "person"
    assert LABELS["ORG"] == "company" and LABELS["LOC"] == LABELS["GPE"] == "place"


def test_un_nom_absent_du_texte_envoye_est_ecarte():
    """Le modèle rend une portion du texte ; ce qui n'y est pas n'en vient pas."""
    lu = extract_names([ARTICLE], FakeClassifier(
        {ARTICLE: {"entities": [{"text": "Marseille", "label": "LOC", "start": 0, "end": 9}]}},
        default={"entities": []}))[0]
    assert lu["names"] == []


def test_le_texte_est_coupe_au_budget_pas_refuse():
    long_texte = ARTICLE * 1000
    lu = extract_names([long_texte], FakeClassifier({}, default={"entities": []}))[0]
    assert lu["characters_read"] == MAX_CHARACTERS


def test_une_panne_du_modele_est_nommee():
    class Casse:
        def predict(self, texts):
            raise RuntimeError("modèle introuvable")

    with pytest.raises(RecognitionUnavailable):
        extract_names([ARTICLE], Casse())


def test_une_reponse_qui_na_pas_la_forme_attendue_est_refusee():
    class Bavard:
        def predict(self, texts):
            return [{"entities": []}, {"entities": []}]

    with pytest.raises(RecognitionUnavailable):
        extract_names([ARTICLE], Bavard())


def test_le_lot_est_envoye_en_une_fois():
    client = double()
    extract_names([ARTICLE, "Autre texte."], client)
    assert client.calls == [[ARTICLE, "Autre texte."]]


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_entree_banale_un_paragraphe_de_presse():
    """T5 : l'entrée ordinaire du public visé."""
    lu = extract_names([ARTICLE], double())[0]
    assert [(n["text"], n["type"]) for n in lu["names"]] == [
        ("Lumière SARL", "company"), ("Jean de La Fontaine", "person"),
        ("Marie Martin", "person"), ("Lyon", "place"), ("Boulanger", "person")]


def test_production_entree_vide():
    lu = extract_names([""], FakeClassifier({}, default={"entities": []}))[0]
    assert lu == {"names": [], "unmapped": [], "characters_read": 0}


def test_production_valeurs_aux_limites():
    vide = FakeClassifier({}, default={"entities": []})
    assert extract_names([], vide) == []
    # Une entrée qui n'est pas du texte devient un texte vide, pas une exception.
    assert extract_names([None, 42], vide)[0]["characters_read"] == 0
    # Une réponse sans clé « entities ».
    assert extract_names([ARTICLE], FakeClassifier({}, default={}))[0]["names"] == []


def test_production_un_texte_illisible_nempeche_pas_de_lire_les_autres():
    """T8 : un texte muet dans le lot ne fait pas tomber les autres."""
    rapports = extract_names([ARTICLE, None], double())
    assert len(rapports[0]["names"]) == 5
    assert rapports[1]["names"] == []


def test_production_la_lecture_tient_la_classe_de_latence_annoncee():
    """latency « ~100 ms » : le travail local, hors modèle, reste négligeable."""
    client = double()
    debut = time.perf_counter()
    for _ in range(500):
        extract_names([ARTICLE], client)
    assert time.perf_counter() - debut < 10.0
