"""
These tests inject a local double instead of loading the real model.

What they prove: the page is sent in one pass with its lines in order, the
scores are decoded into fields, the threshold sends a doubtful field to a
human, an oversized document is refused before the model runs, a failed pass is
retried, and an unusable answer never passes for a reading.

What they do not prove: that the model tags the right lines. That is why this
snippet is declared `verification: stubbed` on the entry, and why the page says
so next to the code.
"""

import time

import pytest

from _harness.fake_model import FakeClassifier
from n2 import (
    DEFAULT_THRESHOLD,
    MAX_LINES,
    MODEL_NAME,
    ExtractionUnavailable,
    LayoutModel,
    boxes_for,
    extract_fields,
)

LINES = [
    "NORD FOURNITURES SAS",
    "                            N° 2024-000431",
    "                            Émise le 3 avril 2024",
    "Cartouche encre noire            2    38,50      77,00",
    "                    Sous-total                     77,00",
    "                    TVA (20 %)                     15,40",
    "                    NET A PAYER                    92,40 EUR",
]
INVOICE = "\n".join(LINES)

# The labels are the ones an invoice model exposes; the scores are ours, so the
# test exercises our thresholds and not the model's opinions.
SCORES = {
    LINES[1]: {"invoice_number": 0.97, "date": 0.11},
    LINES[2]: {"date": 0.95},
    LINES[6]: {"total": 0.93, "invoice_number": 0.02},
}

DEPOSIT = [
    "VERRERIE DU CENTRE",
    "Facture V-2451 du 12/09/2024",
    "Bocaux 500 ml x 200                          264,00",
    "Total TTC                                    360,00 €",
    "Acompte versé le 02/09                       120,00 €",
    "Solde à régler                               240,00 €",
]
DEPOSIT_SCORES = {DEPOSIT[4]: {"total": 0.96}, DEPOSIT[3]: {"total": 0.41}}


class FlakyModel:
    """A model that drops a pass, the way a machine under load does."""

    def __init__(self, model, failures: int = 1):
        self.model = model
        self.failures = failures
        self.passes = 0

    def predict(self, lines):
        self.passes += 1
        if self.failures > 0:
            self.failures -= 1
            raise RuntimeError("the model was not ready")
        return self.model.predict(lines)


class RealShapedTokenPipeline:
    """
    The surface of `transformers.pipeline("token-classification", ...)`: it is
    called with a string or a list of strings, and answers one dict per token,
    keyed `entity`, `score`, `index`, `word` (`entity_group` only appears with
    an `aggregation_strategy`). A dict of words and boxes is not an input it
    takes: LayoutLMv3 needs its processor, with the page image.
    """

    def __call__(self, inputs, **kwargs):
        if not isinstance(inputs, (str, list)) or (isinstance(inputs, list) and not all(isinstance(i, str) for i in inputs)):
            raise TypeError("token-classification takes text, not words and boxes")
        texts = [inputs] if isinstance(inputs, str) else inputs
        return [[{"entity": "total", "score": 0.9, "index": 1, "word": t.split()[0]}] for t in texts]


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_une_ligne_d_acompte_bien_notee_revient_avec_un_nombre_un_bon_score_et_aucun_drapeau():
    """
    breaking_point : « le champ revient avec un nombre, un bon score, et aucun
    drapeau de relecture ». Témoin : la même ligne notée bas part en relecture.
    Que le modèle réel note ainsi la ligne d'acompte n'est pas testable ici : le
    score est écrit par le double.
    """
    total = extract_fields("\n".join(DEPOSIT), FakeClassifier(DEPOSIT_SCORES))["total"]
    assert total == {"value": 120.00, "score": 0.96, "review": False}
    doubtful = extract_fields("\n".join(DEPOSIT), FakeClassifier({DEPOSIT[4]: {"total": 0.5}}))["total"]
    assert doubtful["review"] is True


def test_point_de_rupture_relever_le_seuil_ne_change_pas_la_valeur_lue():
    """breaking_point : « Relever le seuil n'y change rien » : la valeur reste celle de l'acompte."""
    for threshold in (0.8, 0.9, 0.95, 0.99):
        total = extract_fields("\n".join(DEPOSIT), FakeClassifier(DEPOSIT_SCORES), threshold=threshold)["total"]
        assert total["value"] == 120.00


@pytest.mark.xfail(
    strict=True,
    reason=(
        "INFIRMÉ : la fiche dit « Relever le seuil n'y change rien » ; au-dessus du "
        "score de l'erreur (0,97 contre 0,96), le champ part en relecture : le seuil "
        "rattrape l'erreur, au prix de tous les champs notés plus bas"
    ),
)
def test_infirme_relever_le_seuil_ne_change_rien_au_drapeau_de_relecture():
    total = extract_fields("\n".join(DEPOSIT), FakeClassifier(DEPOSIT_SCORES), threshold=0.97)["total"]
    assert total["review"] is False


# ---------------------------------------------------------------------------
# Autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_lit_les_trois_champs():
    """name : « Modèle de compréhension de document auto-hébergé, avec seuil de relecture »."""
    fields = extract_fields(INVOICE, FakeClassifier(SCORES))
    assert fields["invoice_number"]["value"] == "2024-000431"
    assert fields["date"]["value"] == "3 avril 2024"
    assert fields["total"]["value"] == 92.40
    assert [f["review"] for f in fields.values()] == [False, False, False]


def test_envoie_toute_la_page_en_une_passe_lignes_dans_l_ordre():
    """docstring de _tag : « The whole page in one pass »."""
    model = FakeClassifier(SCORES)
    extract_fields(INVOICE, model)
    assert model.calls == [LINES]


def test_un_score_douteux_part_en_relecture_avec_sa_valeur():
    """commentaire : « A doubtful field is not thrown away: it goes to a human with the score that earned the doubt »."""
    fields = extract_fields(INVOICE, FakeClassifier(SCORES), threshold=0.99)
    assert fields["total"] == {"value": 92.40, "score": 0.93, "review": True}


def test_le_seuil_par_defaut_est_0_75_et_un_score_egal_au_seuil_ne_part_pas_en_relecture():
    assert DEFAULT_THRESHOLD == 0.75
    at = extract_fields(INVOICE, FakeClassifier({LINES[6]: {"total": 0.75}}))["total"]
    below = extract_fields(INVOICE, FakeClassifier({LINES[6]: {"total": 0.7499}}))["total"]
    assert at["review"] is False
    assert below["review"] is True


def test_une_ligne_designee_sans_valeur_n_est_pas_une_reponse():
    """docstring de _read : « deciding what happens when it cannot be done »."""
    total = extract_fields(INVOICE, FakeClassifier({LINES[0]: {"total": 0.99}}))["total"]
    assert total == {"value": None, "score": 0.99, "review": True}


def test_un_score_qui_n_est_pas_un_nombre_entre_zero_et_un_n_est_pas_un_score():
    """docstring de _score : « A number the caller can act on, rather than whatever came back »."""
    for bad in ("very", True, None, 1.5, -0.1, float("nan")):
        total = extract_fields(INVOICE, FakeClassifier({LINES[6]: {"total": bad}}))["total"]
        assert total == {"value": None, "score": 0.0, "review": True}, bad


def test_refuse_un_document_trop_long_avant_que_le_modele_tourne():
    model = FakeClassifier(SCORES)
    with pytest.raises(ValueError):
        extract_fields("ligne\n" * (MAX_LINES + 1), model)
    assert model.calls == []
    extract_fields("ligne\n" * MAX_LINES, model)
    assert len(model.calls) == 1


def test_une_passe_tombee_est_retentee():
    model = FlakyModel(FakeClassifier(SCORES))
    assert extract_fields(INVOICE, model)["total"]["value"] == 92.40
    assert model.passes == 2


def test_abandonne_apres_le_dernier_essai_pas_une_passe_de_plus():
    model = FlakyModel(FakeClassifier(SCORES), failures=5)
    with pytest.raises(ExtractionUnavailable):
        extract_fields(INVOICE, model)
    assert model.passes == 2


def test_une_reponse_trop_courte_ou_trop_longue_leve_plutot_que_decaler_les_lignes():
    class WrongLength:
        def __init__(self, extra):
            self.extra = extra

        def predict(self, lines):
            return [{"total": 0.99}] * (len(lines) + self.extra)

    for extra in (-6, 1):
        with pytest.raises(ExtractionUnavailable):
            extract_fields(INVOICE, WrongLength(extra))


def test_les_boites_sont_sur_la_grille_des_milliemes_de_page():
    """docstring de boxes_for : « A box per line, on the thousandth-of-a-page grid » ; « how far a line is indented, and how far down the page it sits »."""
    lines = ["tout à gauche", " " * 200 + "très indentée", "    bas de page"]
    boxes = boxes_for(lines)
    assert len(boxes) == 3
    for x0, y0, x1, y1 in boxes:
        assert 0 <= x0 <= x1 <= 1000 and 0 <= y0 < y1 <= 1000
    assert boxes[0][0] == 0 and boxes[1][0] == 960 and boxes[2][0] == 48
    assert [b[1] for b in boxes] == [0, 333, 666]


@pytest.mark.xfail(
    strict=True,
    reason=(
        "DÉFAUT : LayoutModel appelle `pipeline('token-classification', "
        "model='microsoft/layoutlmv3-base')` avec {'words': …, 'boxes': …} et lit "
        "`entity_group` ligne par ligne. Documentation transformers : ce pipeline "
        "prend du texte et rend un dict par jeton (`entity`, `score`, `index`, `word` ; "
        "`entity_group` seulement avec `aggregation_strategy`) ; LayoutLMv3 exige son "
        "processeur et l'image de la page. L'appel n'existe pas sous cette forme"
    ),
)
def test_defaut_le_modele_par_defaut_a_la_forme_du_vrai_pipeline():
    model = LayoutModel.__new__(LayoutModel)
    model._pipe = RealShapedTokenPipeline()
    fields = extract_fields(INVOICE, model)
    assert fields["total"]["value"] is not None


def test_le_point_de_controle_nomme_est_la_base_non_affinee():
    """commentaire : « A base encoder is a starting point, not an extractor: this rung assumes the checkpoint was fine-tuned »."""
    assert MODEL_NAME == "microsoft/layoutlmv3-base"


def test_verdict_un_score_par_champ_donc_une_file_de_relecture():
    """verdict_rationale : « ce qu'il vous donne, c'est un score par champ, donc une file de relecture »."""
    fields = extract_fields(INVOICE, FakeClassifier(SCORES), threshold=0.94)
    assert {name: f["review"] for name, f in fields.items()} == {"invoice_number": False, "date": False, "total": True}
    assert all(isinstance(f["score"], float) for f in fields.values())


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_document_vide_aucune_passe_et_tout_en_relecture():
    model = FakeClassifier(SCORES)
    fields = extract_fields("\n  \n", model)
    assert model.calls == []
    assert all(f == {"value": None, "score": 0.0, "review": True} for f in fields.values())


def test_production_cent_vingt_lignes_longues_dans_une_borne_large():
    lines = [f"Ligne {i} " + "x" * 5000 + " 1 234,56" for i in range(MAX_LINES)]
    debut = time.perf_counter()
    fields = extract_fields("\n".join(lines), FakeClassifier({lines[-1]: {"total": 0.9}}))
    assert fields["total"]["value"] == 1234.56
    assert time.perf_counter() - debut < 10


def test_production_espaces_insecables_dans_le_montant_et_la_date():
    lines = ["Facture n° FA-1", "Émise le 3\u00a0avril\u00a02024", "NET A PAYER 1\u202f092,40\u00a0EUR"]
    fields = extract_fields("\n".join(lines), FakeClassifier({lines[1]: {"date": 0.9}, lines[2]: {"total": 0.9}}))
    assert fields["date"]["value"] == "3\u00a0avril\u00a02024"
    assert fields["total"]["value"] == 1092.40


def test_production_des_lignes_nulles_ou_vides_dans_la_reponse_ne_font_pas_lever():
    class Sparse:
        def predict(self, lines):
            return [None] * (len(lines) - 1) + [{"total": 0.9}]

    assert extract_fields(INVOICE, Sparse())["total"]["value"] == 92.40
