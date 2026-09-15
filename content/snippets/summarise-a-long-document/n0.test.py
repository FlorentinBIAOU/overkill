"""
Les deux documents des tests : un rapport court, et un document dont la
conclusion est répartie entre ses deux bouts. n0.test.js affirme les mêmes
nombres.
"""

import ast
import time
import unicodedata
from pathlib import Path

import pytest

import n0
from n0 import score_sentences, split_sentences, summarise

REPORT = (
    "The support team migrated the ticketing system to a new platform in March. "
    "The migration moved every open ticket to the new platform without losing a "
    "single attachment. "
    "Every agent was trained on the new platform during the two weeks before the switch. "
    "The old platform stayed available in read-only mode for a month afterwards. "
    "Agents report that search on the new platform is faster than it was before. "
    "One customer complained about the new ticket numbering, so the team kept the "
    "old numbers visible. "
    "The migration is finished and the old platform has been shut down."
)

SUPPLY = "The Rouen plant supplies every battery cell used on the Lyon assembly line."
CLOSURE = "The Rouen plant will close at the end of March."
WAREHOUSE = [
    "The warehouse in Rouen keeps four weeks of packaging material on site.",
    "Packaging is ordered from two suppliers, and the second supplier was added last year.",
    "The warehouse team works two shifts, and a third shift is added before the summer.",
    "Deliveries leave the warehouse every morning except on Sunday.",
    "The warehouse floor was repainted in April and the racks were replaced at the same time.",
    "A new forklift was bought for the warehouse, and two drivers were trained on it.",
    "The packaging supplier in Lille raised its prices, and the warehouse renegotiated the contract.",
    "The warehouse now reports its stock levels every week instead of every month.",
    "Staff turnover in the warehouse fell after the shift pattern was changed.",
]
FACTORY = " ".join([SUPPLY, *WAREHOUSE, CLOSURE])

# Les scores exacts de FACTORY, affirmés à l'identique en JavaScript.
FACTORY_SCORES = [
    0.3038461538461539, 0.27291666666666664, 0.1839285714285714, 0.2125, 0.2661111111111111,
    0.1421875, 0.15476190476190477, 0.17946428571428572, 0.2378205128205128, 0.18166666666666664,
    0.11363636363636365,
]


def content_words(sentence):
    return [w for w in n0.WORD.findall(sentence.lower()) if len(w) > 2 and w not in n0.STOPWORDS]


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_deux_passages_eloignes_de_dix_phrases():
    """breaking_point : « une phrase dit que l'usine de Rouen fournit […] ; dix phrases plus loin, une autre dit que Rouen ferme fin mars »."""
    sentences = split_sentences(FACTORY)
    assert len(sentences) == 11
    assert sentences.index(CLOSURE) - sentences.index(SUPPLY) == 10


def test_point_de_rupture_la_seconde_est_courte_tardive_et_ses_termes_ne_reparaissent_nulle_part():
    """
    breaking_point : « La seconde est courte, tardive, et ses propres termes —
    fermer, fin mars — ne reparaissent nulle part ailleurs, tandis que la
    digression sur l'entrepôt occupe tout le vocabulaire du document ».
    """
    sentences = split_sentences(FACTORY)
    lengths = [len(n0.WORD.findall(s)) for s in sentences]
    # Dix mots pour une moyenne de treize ; « Deliveries leave… » en a neuf.
    assert lengths[-1] == 10 and sorted(lengths)[:2] == [9, 10]
    elsewhere = {w for s in sentences[:-1] for w in n0.WORD.findall(s.lower())}
    assert [w for w in ("close", "end", "march") if w in elsewhere] == []
    weights = n0._term_weights(sentences)
    assert max(weights, key=weights.get) == "warehouse"


def test_point_de_rupture_elle_est_la_moins_bien_notee_des_onze():
    """breaking_point : « elle est la moins bien notée des onze »."""
    scores = score_sentences(split_sentences(FACTORY))
    assert scores == FACTORY_SCORES
    assert scores.index(min(scores)) == 10


def test_point_de_rupture_elle_tombe_la_premiere_meme_a_huit_phrases_sur_onze():
    """
    breaking_point : « et tombe la première, y compris quand on demande huit
    phrases sur onze ». Elle reste dehors jusqu'à dix sur onze. Témoin : la même
    phrase écrite avec le vocabulaire de l'entrepôt remonte et entre à huit.
    """
    assert SUPPLY in summarise(FACTORY, max_sentences=3)
    for width in range(1, 11):
        assert CLOSURE not in summarise(FACTORY, max_sentences=width)
    assert CLOSURE in summarise(FACTORY, max_sentences=11)
    dressed = FACTORY.replace(CLOSURE, "The Rouen warehouse will close at the end of March.")
    assert "The Rouen warehouse will close" in summarise(dressed, max_sentences=8)


def test_point_de_rupture_aucune_selection_ne_peut_rendre_la_conclusion():
    """breaking_point : « aucune phrase n'énonce ce qu'elles impliquent ensemble, donc aucune sélection, si large soit-elle, ne peut le rendre »."""
    everything = summarise(FACTORY, max_sentences=11)
    assert not any("assembly" in s and "March" in s for s in split_sentences(everything))


# ---------------------------------------------------------------------------
# Autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_rend_le_nombre_de_phrases_demande():
    assert len(split_sentences(summarise(REPORT, max_sentences=3))) == 3
    assert len(split_sentences(summarise(REPORT, max_sentences=5))) == 5


def test_chaque_phrase_du_resume_vient_du_document():
    """docstring : « every sentence of the summary appears verbatim in the source, because this code never writes a word »."""
    for width in range(1, 8):
        for sentence in split_sentences(summarise(REPORT, max_sentences=width)):
            assert sentence in REPORT


def test_garde_l_ordre_du_document_plutot_que_celui_des_scores():
    """docstring de summarise : « Return the best sentences, in the order the document puts them »."""
    summary = split_sentences(summarise(REPORT, max_sentences=4))
    positions = [split_sentences(REPORT).index(s) for s in summary]
    assert positions == sorted(positions)
    chosen = [split_sentences(FACTORY).index(s) for s in split_sentences(summarise(FACTORY, max_sentences=5))]
    assert chosen == [0, 1, 3, 4, 8]
    assert sorted(chosen, key=lambda i: -FACTORY_SCORES[i]) == [0, 1, 4, 8, 3]


def test_choisit_l_ouverture_et_les_phrases_denses():
    summary = summarise(REPORT, max_sentences=3)
    assert summary.startswith("The support team migrated the ticketing system")
    assert "trained on the new platform" in summary


def test_une_longue_phrase_ne_gagne_pas_par_sa_taille():
    """
    docstring : « Dividing by the length of the sentence measures density rather
    than volume ». Une phrase faite de mots de liaison reste dehors ; et une
    phrase répétée deux fois dans une seule a exactement la même densité.
    """
    padding = (
        "It is, as it has been said, in the way that they were and that there "
        "was, of the sort that this is and that it has been."
    )
    assert padding not in summarise(REPORT + " " + padding, max_sentences=3)
    once = "Every agent was trained on the new platform"
    sentences = ["The migration is done.", once + ".", once + " " + once + "."]
    scores = score_sentences(sentences)
    assert scores[1] - n0.LEAD_BONUS / 2 == pytest.approx(scores[2] - n0.LEAD_BONUS / 3)


def test_le_bonus_d_ouverture_decroit_avec_le_rang_et_ne_gagne_pas_seul():
    """
    docstring : « A small bonus that decays with the rank of the sentence » ;
    commentaire LEAD_BONUS : « too small to win on its own ». Une ouverture
    faite de mots vides n'entre pas dans le résumé.
    """
    assert n0.LEAD_BONUS == 0.15
    same = ["Ticket platform migration.", "Ticket platform migration.", "Ticket platform migration."]
    scores = score_sentences(same)
    assert scores[0] > scores[1] > scores[2]
    assert scores[0] - scores[2] == pytest.approx(0.15 - 0.05)
    assert not summarise("It is what it is. " + REPORT, max_sentences=3).startswith("It is what it is.")


def test_le_mot_le_plus_frequent_pese_un():
    """docstring de _term_weights : « scale so the most frequent one weighs one »."""
    weights = n0._term_weights(split_sentences(FACTORY))
    assert max(weights.values()) == 1.0
    assert weights["warehouse"] == 1.0


def test_les_abreviations_trompent_le_decoupage():
    """Commentaire SENTENCE_END : « Abbreviations will fool this »."""
    assert split_sentences("Dr. Smith signed the order. The plan works.") == ["Dr.", "Smith signed the order.", "The plan works."]


def test_les_mots_accentues_survivent_et_la_ponctuation_non():
    """Commentaire WORD : « `[^\\W_]` is `\\w` without the underscore, so accented words survive and punctuation does not »."""
    assert n0.WORD.findall("Réunion_reportée, déjà ! n°2") == ["Réunion", "reportée", "déjà", "n", "2"]


def test_la_boucle_simple_et_sum_ne_donnent_pas_le_meme_flottant():
    """
    Commentaire de score_sentences : « `sum`, which since Python 3.12
    compensates rounding error on floats […] is not the answer JavaScript
    gives ». Sur dix fois 0,1, sum rend 1.0 et la boucle 0.9999999999999999.
    """
    values = [0.1] * 10
    total = 0.0
    for value in values:
        total += value
    assert sum(values) == 1.0
    assert total == 0.9999999999999999


def test_l_extrait_n_importe_que_re():
    """risks.data_egress : none ; « Two classical signals, and nothing else »."""
    source = ast.parse(Path(__file__).with_name("n0.py").read_text(encoding="utf-8"))
    assert {a.name for n in ast.walk(source) if isinstance(n, ast.Import) for a in n.names} == {"re"}


def test_deux_executions_rendent_le_meme_resume():
    """risks.deterministic : true."""
    assert summarise(FACTORY, 4) == summarise(FACTORY, 4)


def test_verdict_n0_ne_peut_rien_inventer_il_ne_sait_que_citer():
    """verdict_rationale : « N0, qui ne peut rien inventer parce qu'il ne sait que citer »."""
    for width in range(1, 12):
        summary = summarise(FACTORY, max_sentences=width)
        assert all(sentence in FACTORY for sentence in split_sentences(summary))


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_document_vide_d_une_phrase_et_plus_de_phrases_qu_il_n_en_existe():
    assert summarise("", max_sentences=3) == ""
    assert summarise("   \n  ", max_sentences=3) == ""
    assert summarise("The plant will close at the end of March.", max_sentences=3) == "The plant will close at the end of March."
    assert summarise("First point. Second point. Third point.", max_sentences=10) == "First point. Second point. Third point."
    assert summarise(REPORT, max_sentences=0) == ""


def test_production_un_document_d_un_megaoctet_et_demi():
    started = time.monotonic()
    assert len(split_sentences(summarise(REPORT * 3000, max_sentences=3))) == 3
    assert time.monotonic() - started < 10


def test_production_espace_insecable_emoji_et_casse():
    text = "The PLATFORM migration 🚀 is done. The platform works. Lunch was served."
    assert summarise(text, max_sentences=2) == "The PLATFORM migration 🚀 is done. The platform works."


def test_defaut_un_document_nfd_coupe_ses_mots_accentues():
    text = "La réunion a été reportée. La réunion aura lieu lundi. Le café est offert."
    assert score_sentences(split_sentences(unicodedata.normalize("NFD", text))) == score_sentences(split_sentences(text))


def test_defaut_un_document_sans_ponctuation_finale_est_rendu_entier():
    transcript = "the meeting started late\nwe discussed the budget\n" * 500
    assert len(summarise(transcript, max_sentences=3)) < len(transcript) / 2


def test_defaut_un_nombre_de_phrases_negatif_n_est_pas_refuse():
    try:
        assert summarise(REPORT, max_sentences=-1) == ""
    except ValueError:
        pass
