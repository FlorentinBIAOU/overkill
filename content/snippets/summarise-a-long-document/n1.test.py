"""
Quatre documents dont quelqu'un a coché les phrases de résumé. Les poids appris
par scikit-learn sont affirmés ici ; n1.test.js vérifie que sa descente de
gradient atterrit au même endroit.
"""

import ast
import time
from pathlib import Path

import numpy as np
import pytest

from n0 import summarise as summarise_n0
from n1 import CUES, LONG_SENTENCE, sentence_features, split_sentences, summarise, train

DOCUMENTS = [
    [
        "The payment service was unavailable for most of Tuesday morning.",
        "A configuration change was deployed at 8 in the morning and rolled back at 11.",
        "The on-call engineer was paged twice before the cause was found.",
        "Support answered the calls that came in during the outage.",
        "The queue drained on its own once the change was reverted.",
        "Overall the payment service lost a morning of availability.",
    ],
    [
        "The regional sales review covers the shops in the north.",
        "2 shops opened during the period and one closed.",
        "The staff in Lille asked for a second till.",
        "Deliveries arrive on Tuesday and on Friday.",
        "The window display was changed for the season.",
        "Therefore the north region grew despite the closure.",
    ],
    [
        "The migration project moved the archive to the new storage.",
        "40 nights of copying were needed to move the archive.",
        "The old drives were kept in the basement for now.",
        "Nobody reported a missing file during the check.",
        "The copy tool was written by the infrastructure team.",
        "In conclusion the archive migration is complete.",
    ],
    [
        "The committee met on Thursday in the small room.",
        "The budget for the next year was presented to the committee.",
        "Three members asked about the training line.",
        "The training line was raised by 12 in the budget.",
        "The coffee machine will be replaced.",
        "Finally the committee approved the budget.",
    ],
]

LABELS = [[1, 1, 0, 0, 0, 1], [1, 1, 0, 0, 0, 1], [1, 1, 0, 0, 0, 1], [0, 1, 0, 1, 0, 1]]

AUDIT_LEAD = "The warehouse audit looked at how stock is counted."
AUDIT_FIGURE = "The count needs 2 people and takes a full day."
AUDIT_WRAP_UP = "Overall the audit recommends counting the spare parts aisle weekly."
AUDIT = " ".join([
    AUDIT_LEAD,
    "The count is done by hand on the last Friday of the month.",
    AUDIT_FIGURE,
    "The audit found that the count matches the system in most aisles.",
    "The aisle holding spare parts was the only one out of line.",
    AUDIT_WRAP_UP,
])

SUPPLY = "The Rouen plant supplies every battery cell used on the Lyon assembly line."
CLOSURE = "The Rouen plant will close at the end of March."
FACTORY = " ".join([
    SUPPLY,
    "The warehouse in Rouen keeps four weeks of packaging material on site.",
    "Packaging is ordered from two suppliers, and the second supplier was added last year.",
    "The warehouse team works two shifts, and a third shift is added before the summer.",
    "Deliveries leave the warehouse every morning except on Sunday.",
    "The warehouse floor was repainted in April and the racks were replaced at the same time.",
    "A new forklift was bought for the warehouse, and two drivers were trained on it.",
    "The packaging supplier in Lille raised its prices, and the warehouse renegotiated the contract.",
    "The warehouse now reports its stock levels every week instead of every month.",
    "Staff turnover in the warehouse fell after the shift pattern was changed.",
    CLOSURE,
])

DECOY = "Overall the warehouse audit ordered 6 new clipboards for counting stock."
FINDING = "The spare parts aisle has been miscounted every month since the spring."
DRESSED_UP = [
    "The warehouse audit looked at how stock is counted.",
    DECOY,
    FINDING,
    "Nobody has reconciled the spare parts aisle against the supplier notes.",
    "The counting staff work on the last Friday of each month.",
    "The clipboards will be delivered next week.",
]

MODEL = train(DOCUMENTS, LABELS)


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_la_phrase_leurre_a_les_quatre_signes_et_est_retenue():
    """
    breaking_point : « une phrase placée tôt, portant un chiffre, ouverte par
    « Overall » et reprenant les mots de la première ligne est retenue alors
    qu'elle annonce une commande de porte-blocs ».
    """
    position, _, figure, cue, echo = sentence_features(DRESSED_UP, 1)
    assert (position, figure, cue) == (0.5, 1.0, 1.0)
    assert echo == 0.375
    assert DECOY.split()[0] == "Overall"
    assert DECOY in summarise(MODEL, " ".join(DRESSED_UP), max_sentences=2)


def test_point_de_rupture_la_vraie_trouvaille_n_a_aucun_de_ces_signes_et_reste_dehors():
    """
    breaking_point : « la vraie trouvaille de l'audit — un rayon mal compté
    depuis le printemps — n'a aucun de ces signes et reste dehors ». Précision :
    elle est troisième sur six, sa position vaut 1/3 ; chiffre, mot-signal et
    reprise sont à zéro.
    """
    position, _, figure, cue, echo = sentence_features(DRESSED_UP, 2)
    assert (round(position, 4), figure, cue, echo) == (0.3333, 0.0, 0.0, 0.0)
    assert FINDING not in summarise(MODEL, " ".join(DRESSED_UP), max_sentences=2)


def test_point_de_rupture_etiqueter_davantage_n_y_change_rien():
    """
    breaking_point : « étiqueter davantage n'y change rien, puisque le sens n'est
    jamais montré au modèle ». Même en ajoutant cinq fois ce document au jeu,
    leurre coché 0 et trouvaille cochée 1, le leurre reste retenu et la
    trouvaille dehors.
    """
    relabelled = train(DOCUMENTS + [DRESSED_UP] * 5, LABELS + [[1, 0, 1, 1, 0, 0]] * 5)
    summary = summarise(relabelled, " ".join(DRESSED_UP), max_sentences=2)
    assert DECOY in summary and FINDING not in summary


def test_point_de_rupture_il_retrouve_les_deux_premisses_et_n_enonce_pas_la_conclusion():
    """
    breaking_point : « sur le document à deux bouts il retrouve bien les deux
    prémisses, et n'énonce toujours pas la conclusion ». Témoin : N0 perd la
    seconde prémisse.
    """
    both = summarise(MODEL, FACTORY, max_sentences=2)
    assert SUPPLY in both and CLOSURE in both
    assert not any("assembly" in s and "March" in s for s in split_sentences(both))
    assert CLOSURE not in summarise_n0(FACTORY, max_sentences=2)


# ---------------------------------------------------------------------------
# Autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_cinq_traits_position_longueur_chiffre_mot_signal_et_reprise():
    """name : « cinq traits de surface » ; docstring de sentence_features."""
    sentences = DOCUMENTS[0]
    lead, length, figure, cue, echo = sentence_features(sentences, 0)
    assert lead == 1.0 and figure == 0.0 and cue == 0.0
    assert 0.0 < length < 1.0
    assert echo == 1.0
    assert sentence_features(sentences, 1)[2] == 1.0
    assert sentence_features(sentences, 5)[3] == 1.0
    assert len(sentence_features(sentences, 3)) == 5


def test_le_trait_de_longueur_sature_sur_une_phrase_tres_longue():
    """Commentaire LONG_SENTENCE : « the feature saturates »."""
    assert LONG_SENTENCE == 25
    long_one = ["Short one.", " ".join(["word"] * 200) + "."]
    assert sentence_features(long_one, 1)[1] == 1.0
    assert sentence_features(["Short one.", " ".join(["word"] * 24) + "."], 1)[1] == 0.96


def test_les_poids_sont_appris_scikit_learn():
    """docstring : « the weights are learnt instead of guessed ». n1.test.js compare sa descente à ces valeurs."""
    assert np.round(MODEL.coef_[0], 3).tolist() == [0.496, 0.134, 1.281, 1.246, 1.061]
    assert round(float(MODEL.intercept_[0]), 3) == -0.944


def test_garde_l_ouverture_le_chiffre_et_la_conclusion_de_l_audit():
    summary = summarise(MODEL, AUDIT, max_sentences=3)
    assert AUDIT_LEAD in summary and AUDIT_FIGURE in summary and AUDIT_WRAP_UP in summary
    assert summarise(MODEL, AUDIT, max_sentences=2) == f"{AUDIT_LEAD} {AUDIT_WRAP_UP}"


@pytest.mark.xfail(
    strict=True,
    reason=(
        "INFIRMÉ : la docstring dit que si la conclusion en fin de document compte plus "
        "que l'ouverture, « the model will find that out and N0 never will ». Le trait de "
        "position est 1/(rang+1) : il ne peut pas dire « la dernière ». Ce que le modèle "
        "apprend ici, c'est le mot-signal : la même conclusion sans « Overall » sort du "
        "résumé. Et N0, lui, garde déjà cette conclusion (le test d'origine « keeps the "
        "wrap-up a fixed lead bonus would drop » n'exécutait pas N0)"
    ),
)
def test_infirme_le_modele_decouvre_que_la_conclusion_compte_et_n0_jamais():
    without_cue = AUDIT.replace(AUDIT_WRAP_UP, "The audit recommends counting the spare parts aisle weekly.")
    assert "The audit recommends counting" in summarise(MODEL, without_cue, max_sentences=3)
    assert AUDIT_WRAP_UP not in summarise_n0(AUDIT, max_sentences=3)


def test_le_resume_est_toujours_fait_des_phrases_du_document():
    """docstring : « Same extractive shape as N0 »."""
    for width in range(1, 7):
        assert all(s in AUDIT for s in split_sentences(summarise(MODEL, AUDIT, max_sentences=width)))


def test_garde_l_ordre_du_document():
    summary = split_sentences(summarise(MODEL, AUDIT, max_sentences=4))
    positions = [split_sentences(AUDIT).index(s) for s in summary]
    assert positions == sorted(positions)


def test_les_mots_signaux():
    """Commentaire CUES : « Words an author uses when about to state the point »."""
    assert CUES == frozenset({"overall", "therefore", "total", "conclusion", "result", "summary", "altogether", "finally", "consequently"})


def test_l_entrainement_tient_sur_quatre_documents_sans_rien_d_autre():
    """docstring de train : « Nothing here needs a GPU or a corpus » ; risks.data_egress : none."""
    source = ast.parse(Path(__file__).with_name("n1.py").read_text(encoding="utf-8"))
    imported = {a.name for n in ast.walk(source) if isinstance(n, ast.Import) for a in n.names}
    imported |= {n.module for n in ast.walk(source) if isinstance(n, ast.ImportFrom)}
    assert imported == {"re", "numpy", "sklearn.linear_model"}
    assert sum(len(d) for d in DOCUMENTS) == 24


def test_deux_entrainements_rendent_les_memes_poids():
    """risks.deterministic : true."""
    assert train(DOCUMENTS, LABELS).coef_.tolist() == MODEL.coef_.tolist()


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_document_vide_et_d_une_phrase():
    assert summarise(MODEL, "", max_sentences=3) == ""
    assert summarise(MODEL, "   \n ", max_sentences=3) == ""
    assert summarise(MODEL, "The plant will close at the end of March.", max_sentences=3) == "The plant will close at the end of March."
    assert summarise(MODEL, AUDIT, max_sentences=0) == ""


def test_production_cinq_mille_phrases():
    big = " ".join(f"Sentence {i} is about the warehouse stock." for i in range(5000))
    started = time.monotonic()
    assert len(split_sentences(summarise(MODEL, big, max_sentences=3))) == 3
    assert time.monotonic() - started < 10


@pytest.mark.xfail(
    strict=True,
    reason="DÉFAUT : un document sans ponctuation finale est une seule phrase, rendue en entier",
)
def test_defaut_un_document_sans_ponctuation_finale_est_rendu_entier():
    transcript = "the meeting started late\nwe discussed the budget\n" * 500
    assert len(summarise(MODEL, transcript, max_sentences=3)) < len(transcript) / 2


@pytest.mark.xfail(
    strict=True,
    reason="DÉFAUT : un nombre de phrases négatif n'est pas refusé ; -1 rend toutes les phrases sauf la moins bien notée",
)
def test_defaut_un_nombre_de_phrases_negatif_n_est_pas_refuse():
    try:
        assert summarise(MODEL, AUDIT, max_sentences=-1) == ""
    except ValueError:
        pass
