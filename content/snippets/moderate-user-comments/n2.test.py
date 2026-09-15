"""
Ces tests injectent un double local au lieu de charger le vrai modèle.

Ce qu'ils prouvent : le lot part en un appel, les notes deviennent la bonne
décision, les seuils sont respectés, une réponse inexploitable part chez un
humain. Ce qu'ils ne prouvent pas : que le modèle note bien les commentaires.
"""

import json
import re
import time
from pathlib import Path

import pytest

import n2
from _harness.fake_model import FakeClassifier
from n2 import DEFAULT_THRESHOLDS, MODEL_NAME, ModerationUnavailable, ToxicityModel, moderate

ATTACK = "get off this forum you blorptard"
BORDERLINE = "that was a spectacularly bad take, honestly"
CALM = "the diagram is much clearer than the text"
DOXXING = "he lives at the corner of rue des Lilas by the way, go and say hello"

# Les notes sont les nôtres : le test exerce nos seuils, pas l'avis du modèle.
SCORES = {
    ATTACK: {"toxicity": 0.96, "insult": 0.91, "threat": 0.04},
    BORDERLINE: {"toxicity": 0.71, "insult": 0.35, "threat": 0.01},
    CALM: {"toxicity": 0.02, "insult": 0.01, "threat": 0.0},
}

ESSAI = Path(__file__).parents[2] / "tryouts" / "frozen" / "moderate-user-comments.js"


def essai_cases():
    """(saisie anglaise, notes simulées, seuils simulés) de chaque cas de l'essai figé."""
    source = ESSAI.read_text(encoding="utf-8")
    cases = []
    for block in source.split("label: {")[1:]:
        english = re.search(r"en: '([^']*)',\s*\},\s*simulate", block).group(1)
        scores = re.search(r"scores: (\{[^}]*\})", block).group(1)
        thresholds = re.search(r"thresholds: (\{[^}]*\})", block)
        as_json = lambda text: json.loads(re.sub(r"(\w+):", r'"\1":', text))
        cases.append((english, as_json(scores), as_json(thresholds.group(1)) if thresholds else None))
    return cases


# ---------------------------------------------------------------------------
# Point de rupture (plomberie seulement)
# ---------------------------------------------------------------------------


def test_point_de_rupture_un_prejudice_sans_etiquette_note_bas_partout_part_en_publication():
    """
    « le test lui soumet « he lives at the corner of rue des Lilas by the way, go and
    say hello », qui n'est aucune des trois, ressort bas partout et part en publication ».
    Les notes basses sont écrites par le test ; ce qui est démontré, c'est ce que le code en fait.
    """
    classifier = FakeClassifier({DOXXING: {"toxicity": 0.08, "insult": 0.03, "threat": 0.06}})
    assert moderate([DOXXING], classifier) == [{"action": "allow", "label": "toxicity", "score": 0.08}]
    # Témoin : la même plomberie bloque ce qui est noté haut.
    assert moderate([ATTACK], FakeClassifier(SCORES))[0]["action"] == "block"


# ---------------------------------------------------------------------------
# Autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_oriente_chaque_commentaire_vers_sa_decision():
    actions = [d["action"] for d in moderate([ATTACK, BORDERLINE, CALM], FakeClassifier(SCORES))]
    assert actions == ["block", "review", "allow"]


def test_garde_l_etiquette_la_plus_forte_pour_que_le_relecteur_sache_pourquoi():
    assert moderate([ATTACK], FakeClassifier(SCORES))[0] == {"action": "block", "label": "toxicity", "score": 0.96}


def test_deux_seuils_une_bande_pour_un_humain():
    """« Two thresholds, not one » ; valeurs aux limites : 0,9 bloque, 0,6 part en relecture, juste en dessous publie."""
    assert DEFAULT_THRESHOLDS == {"block": 0.9, "review": 0.6}
    rows = {"a": {"toxicity": 0.9}, "b": {"toxicity": 0.8999}, "c": {"toxicity": 0.6}, "d": {"toxicity": 0.5999}}
    assert [d["action"] for d in moderate(list(rows), FakeClassifier(rows))] == ["block", "review", "review", "allow"]


def test_une_decision_de_blocage_est_prise_sans_humain():
    """regulatory : « Décision de modération prise sans intervention humaine dès qu'un commentaire franchit le seuil de blocage »."""
    assert moderate([ATTACK], FakeClassifier(SCORES))[0]["action"] == "block"


def test_le_lot_entier_part_en_un_appel():
    classifier = FakeClassifier(SCORES)
    moderate([ATTACK, BORDERLINE, CALM], classifier)
    assert classifier.calls == [[ATTACK, BORDERLINE, CALM]]


def test_les_seuils_sont_a_l_appelant():
    strict = moderate([BORDERLINE], FakeClassifier(SCORES), {"block": 0.7, "review": 0.3})[0]
    lenient = moderate([BORDERLINE], FakeClassifier(SCORES), {"block": 0.99, "review": 0.95})[0]
    assert strict["action"] == "block" and lenient["action"] == "allow"


def test_une_ligne_inexploitable_part_chez_un_humain_plutot_que_publiee():
    """« Falling back to "allow" would […] mean that a model failure silently publishes everything. »"""
    rows = {"a": {}, "b": {"toxicity": "very"}, "c": None, "d": {"toxicity": float("nan")},
            "e": {"toxicity": True}, "f": {"toxicity": 1.5}, "g": {"toxicity": -0.1}}
    decisions = moderate(list(rows), FakeClassifier(rows))
    assert decisions == [{"action": "review", "label": None, "score": None}] * len(rows)


def test_une_reponse_de_mauvaise_longueur_leve_plutot_que_de_decaler_les_commentaires():
    class Short:
        def predict(self, comments):
            return [{"toxicity": 0.99}]

    class Long:
        def predict(self, comments):
            return [{"toxicity": 0.1}] * (len(comments) + 1)

    for classifier in (Short(), Long()):
        with pytest.raises(ModerationUnavailable):
            moderate([ATTACK, CALM], classifier)


def test_un_lot_vide_n_atteint_jamais_le_modele():
    classifier = FakeClassifier(SCORES)
    assert moderate([], classifier) == []
    assert classifier.calls == []


def test_le_classifieur_est_injecte_et_par_defaut_c_est_le_vrai():
    """« `classifier` is injected so this can be tested without downloading the weights. »"""
    with pytest.raises(ModuleNotFoundError, match="transformers"):
        moderate([CALM])
    assert MODEL_NAME == "unitary/unbiased-toxic-roberta"


def test_predict_convertit_la_sortie_du_pipeline_une_ligne_par_commentaire():
    """ToxicityModel.predict : « One label-to-score mapping per comment, in the order given » ; forme de `pipeline(..., top_k=None)`."""
    model = object.__new__(ToxicityModel)
    model._pipe = lambda comments: [[{"label": "toxicity", "score": 0.9}, {"label": "insult", "score": 0.1}] for _ in comments]
    assert model.predict([ATTACK, CALM]) == [{"toxicity": 0.9, "insult": 0.1}] * 2


def test_le_vrai_modele_est_charge_une_fois_pour_le_processus(monkeypatch):
    loads = []

    class Counting:
        def __init__(self):
            loads.append(1)

        def predict(self, comments):
            return [{"toxicity": 0.0}] * len(comments)

    monkeypatch.setattr(n2, "ToxicityModel", Counting)
    moderate([CALM])
    moderate([CALM])
    assert len(loads) == 1


def test_defaut_une_etiquette_de_mention_d_identite_ne_bloque_pas_un_commentaire():
    comment = "as a muslim woman i found the second section very useful"
    row = {"toxicity": 0.01, "severe_toxicity": 0.0, "obscene": 0.0, "identity_attack": 0.01, "insult": 0.0,
           "threat": 0.0, "sexual_explicit": 0.0, "male": 0.02, "female": 0.91, "muslim": 0.95}
    assert moderate([comment], FakeClassifier({comment: row}))[0]["action"] == "allow"


def test_defaut_une_ligne_d_une_autre_forme_ne_devient_pas_une_decision():
    rows = {ATTACK: {"label": "toxicity", "score": 0.95}}
    assert moderate([ATTACK], FakeClassifier(rows))[0]["action"] == "review"


def test_l_essai_fige_six_cas():
    """Essai : six cas ; la note la plus forte, les seuils, le cas inexploitable, et l'adresse publiée."""
    cases = essai_cases()
    assert len(cases) == 6
    decisions = []
    for text, scores, thresholds in cases:
        decisions.append(moderate([text], FakeClassifier({text: scores}), thresholds)[0])
    assert [d["action"] for d in decisions] == ["block", "allow", "review", "block", "review", "allow"]
    assert decisions[0]["label"] == "toxicity" and decisions[0]["score"] == 0.96
    assert decisions[4]["label"] is None


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_mille_commentaires_en_un_lot():
    comments = [f"comment {i}" for i in range(1000)]
    classifier = FakeClassifier({}, default={"toxicity": 0.1})
    start = time.perf_counter()
    decisions = moderate(comments, classifier)
    assert time.perf_counter() - start < 2
    assert len(decisions) == 1000 and len(classifier.calls) == 1


def test_production_egalite_entre_etiquettes_la_premiere_gagne():
    rows = {"x": {"insult": 0.7, "toxicity": 0.7}}
    assert moderate(["x"], FakeClassifier(rows))[0]["label"] == "insult"


def test_production_commentaires_vides_nfd_emoji_passent_au_classifieur_tels_quels():
    comments = ["", "quel flarnwît", "🙂", "﻿hello"]
    classifier = FakeClassifier({}, default={"toxicity": 0.2})
    assert [d["action"] for d in moderate(comments, classifier)] == ["allow"] * 4
    assert classifier.calls == [comments]
