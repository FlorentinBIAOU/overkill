"""
Ces tests injectent un double local au lieu de charger un modèle.

Ce qu'ils prouvent : la découpe, le câblage des deux passes, le refus d'un
document trop long, le réessai, et le refus d'une réponse vide.

Ce qu'ils ne prouvent pas : qu'un modèle écrit un résumé bon, ou vrai.
"""

import sys
import types
import unicodedata
import warnings

import pytest

from _harness.fake_model import FakeSeq2Seq
import n2
from n2 import CHUNK_CHARACTERS, MAX_CHARACTERS, MODEL_NAME, SummaryUnavailable, chunk, summarise

REPORT = (
    "The support team migrated the ticketing system to a new platform in March. "
    "Every agent was trained during the two weeks before the switch. "
    "The old platform stayed available in read-only mode for a month afterwards."
)

LONG = " ".join(f"Paragraph {i} describes another part of the warehouse." for i in range(120))

DOCUMENT = (
    "The Rouen plant supplies every battery cell used on the Lyon assembly line. "
    "The Rouen plant will close at the end of March."
)
SUPPORTED = "The Lyon assembly line will stop when Rouen closes at the end of March."
INVENTED = "The Lyon assembly line will move to Rouen in April."


class FlakySeq2Seq(FakeSeq2Seq):
    """Le double du harnais, dont les premiers appels échouent."""

    def __init__(self, outputs, fail_times, default=""):
        super().__init__(outputs, default)
        self._fail_times = fail_times

    def generate(self, text, **kwargs):
        if self._fail_times > 0:
            self._fail_times -= 1
            self.calls.append(text)
            raise RuntimeError("simulated model failure")
        return super().generate(text, **kwargs)


class NoteTaker(FakeSeq2Seq):
    """Rend, pour chaque morceau, une note de la longueur d'une sortie de bart-large-cnn (142 jetons, environ 600 caractères)."""

    def generate(self, text, **_):
        self.calls.append(text)
        return ("note " * 120).strip()


@pytest.fixture
def transformers(monkeypatch):
    """Un module `transformers` à la surface publiée : `pipeline("summarization", model=…)` rend un appelable qui rend `[{"summary_text": …}]`."""
    module = types.ModuleType("transformers")
    module.loads = []

    def pipeline(task, model):
        module.loads.append((task, model))
        return lambda text, truncation: [{"summary_text": f"summary of {len(text)} characters"}]

    module.pipeline = pipeline
    monkeypatch.setitem(sys.modules, "transformers", module)
    return module


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_la_fonction_rend_le_resume_qui_decoule_et_celui_qui_invente_a_l_identique():
    """
    breaking_point : « « la ligne de Lyon s'arrêtera quand Rouen fermera fin mars
    », qui en découle, et « la ligne de Lyon déménagera à Rouen en avril », qui
    n'y figure nulle part. La fonction rend les deux à l'identique, sans un
    avertissement ».
    """
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        assert summarise(DOCUMENT, model=FakeSeq2Seq({}, default=SUPPORTED)) == SUPPORTED
        assert summarise(DOCUMENT, model=FakeSeq2Seq({}, default=INVENTED)) == INVENTED
    assert caught == []
    assert "April" not in DOCUMENT and INVENTED not in DOCUMENT


def test_point_de_rupture_la_seule_verification_est_que_la_reponse_n_est_pas_vide():
    """
    breaking_point : « la seule chose qu'elle sache vérifier d'une réponse est
    qu'elle n'est pas vide ». N'importe quelle réponse non vide passe ; témoin :
    une réponse d'espaces lève.
    """
    for anything in ("x", "Die Linie wird verlegt.", "lorem " * 10000, "{}"):
        assert summarise(DOCUMENT, model=FakeSeq2Seq({}, default=anything)) == anything.strip()
    with pytest.raises(SummaryUnavailable):
        summarise(DOCUMENT, model=FakeSeq2Seq({}, default=" \n "))


def test_point_de_rupture_la_seconde_passe_resume_les_notes_et_plus_jamais_le_document():
    """
    breaking_point : « dès qu'un document dépasse la fenêtre du modèle, la seconde
    passe résume les notes que le modèle a écrites, et plus jamais le document ».
    Témoin : un document court part en un seul appel, sur lui-même.
    """
    pieces = chunk(LONG)
    notes = {piece: f"note about part {i}" for i, piece in enumerate(pieces)}
    second_pass = " ".join(notes[piece] for piece in pieces)
    model = FakeSeq2Seq({**notes, second_pass: "the whole warehouse, in one line"})
    assert summarise(LONG, model=model) == "the whole warehouse, in one line"
    assert model.calls == [*pieces, second_pass]
    assert "Paragraph" not in model.calls[-1]
    short = FakeSeq2Seq({}, default="a summary")
    summarise(REPORT, model=short)
    assert short.calls == [REPORT]


# ---------------------------------------------------------------------------
# Autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_rend_ce_que_le_modele_a_ecrit():
    assert summarise(REPORT, model=FakeSeq2Seq({REPORT: "The ticketing system was migrated in March."})) == (
        "The ticketing system was migrated in March."
    )


def test_la_decoupe_se_fait_aux_frontieres_de_phrase_sans_rien_perdre():
    """docstring : « it has to be cut at sentence boundaries » ; CHUNK_CHARACTERS."""
    assert CHUNK_CHARACTERS == 3000
    pieces = chunk(LONG, size=400)
    assert len(pieces) > 1
    assert all(len(p) <= 400 and p.endswith(".") for p in pieces)
    assert " ".join(pieces) == LONG
    assert all(len(p) <= CHUNK_CHARACTERS for p in chunk(LONG))


def test_production_limite_de_la_decoupe_au_caractere_pres():
    exactly = "a" * 1499 + ". " + "b" * 1498 + "."
    assert len(exactly) == 3000
    assert chunk(exactly) == [exactly]
    assert len(chunk(exactly + " c.")) == 2


def test_une_phrase_plus_longue_que_la_fenetre_passe_entiere():
    """docstring de chunk : « A sentence longer than the window on its own is passed whole »."""
    one_long_sentence = " ".join(["word"] * 200) + "."
    assert chunk(one_long_sentence, size=100) == [one_long_sentence]


def test_une_passe_tombee_au_milieu_fait_lever_plutot_que_rendre_un_demi_document():
    """docstring : « a summary that is silently half a document is worse than no summary at all »."""
    pieces = chunk(LONG)
    outputs = {piece: f"note {i}" for i, piece in enumerate(pieces)}
    outputs[pieces[1]] = ""
    model = FakeSeq2Seq(outputs, default="unused")
    with pytest.raises(SummaryUnavailable):
        summarise(LONG, model=model)
    assert model.calls[-1] == pieces[1]  # rien après la passe tombée


def test_un_document_vide_ne_coute_rien():
    model = FakeSeq2Seq({}, default="a summary")
    assert summarise("", model=model) == ""
    assert summarise("   \n  ", model=model) == ""
    assert model.calls == []


def test_un_document_d_une_phrase_passe_quand_meme_par_le_modele():
    assert summarise("The plant will close.", model=FakeSeq2Seq({}, default="rewritten")) == "rewritten"


def test_refuse_un_document_trop_long_avant_tout_travail():
    """Commentaire MAX_CHARACTERS : « still better refused than churned through in silence »."""
    model = FakeSeq2Seq({}, default="a summary")
    with pytest.raises(ValueError):
        summarise("x" * (MAX_CHARACTERS + 1), model=model)
    assert model.calls == []
    summarise("x" * MAX_CHARACTERS, model=model)
    assert len(model.calls) == 1


def test_une_panne_est_retentee_le_nombre_de_fois_annonce():
    model = FlakySeq2Seq({REPORT: "a summary"}, fail_times=1)
    assert summarise(REPORT, model=model, attempts=2) == "a summary"
    assert len(model.calls) == 2
    down = FlakySeq2Seq({REPORT: "a summary"}, fail_times=5)
    with pytest.raises(SummaryUnavailable):
        summarise(REPORT, model=down, attempts=3)
    assert len(down.calls) == 3


def test_une_reponse_vide_ou_nulle_leve_plutot_que_laisser_un_trou():
    """Commentaire : « An empty answer is a failure, not a summary »."""
    for empty in ("   ", None):
        model = FakeSeq2Seq({}, default=empty)
        with pytest.raises(SummaryUnavailable):
            summarise(REPORT, model=model)


def test_le_modele_nomme_est_bart_large_cnn():
    """Constat : Python charge facebook/bart-large-cnn, JavaScript Xenova/distilbart-cnn-12-6 (fenêtre de 1 024 positions pour les deux)."""
    assert MODEL_NAME == "facebook/bart-large-cnn"


def test_le_modele_par_defaut_a_la_surface_de_transformers(transformers):
    """docstring : « In production it defaults to the real model » ; `pipeline(…)(text, truncation=True)[0]["summary_text"]`."""
    assert summarise(REPORT) == f"summary of {len(REPORT)} characters"
    assert transformers.loads == [("summarization", MODEL_NAME)]


@pytest.mark.xfail(
    strict=True,
    reason=(
        "DÉFAUT : LocalSummariser se dit « Loaded once and kept for the life of the "
        "process: it is the loading that is slow » ; mais summarise construit un "
        "LocalSummariser neuf à chaque appel sans modèle injecté, donc recharge les poids "
        "à chaque document"
    ),
)
def test_defaut_le_modele_par_defaut_est_recharge_a_chaque_document(transformers):
    summarise(REPORT)
    summarise(REPORT)
    assert len(transformers.loads) == 1


@pytest.mark.xfail(
    strict=True,
    reason=(
        "DÉFAUT : `transformers` 5 a retiré les pipelines `summarization`, `translation` "
        "et `text2text-generation` (MIGRATION_GUIDE_V5.md : « Text2TextGenerationPipeline, "
        "including its related SummarizationPipeline and TranslationPipeline, were "
        "deprecated and will now be removed ») ; sur une installation courante, le "
        "chargement par défaut lève « Unknown task summarization » avant tout résumé"
    ),
)
def test_defaut_transformers_5_n_a_plus_de_pipeline_summarization(monkeypatch):
    module = types.ModuleType("transformers")

    def pipeline(task, model):
        raise KeyError(f"Unknown task {task}, available tasks are ['feature-extraction', 'text-generation', ...]")

    module.pipeline = pipeline
    monkeypatch.setitem(sys.modules, "transformers", module)
    assert isinstance(summarise(REPORT), str)


@pytest.mark.xfail(
    strict=True,
    reason=(
        "DÉFAUT : la seconde passe n'est pas découpée. Sur un document de 200 000 "
        "caractères, 67 notes de la taille d'une sortie de bart-large-cnn (environ 600 "
        "caractères) partent d'un bloc, 40 000 caractères, bien au-delà de la fenêtre que "
        "CHUNK_CHARACTERS devait respecter ; le commentaire dit que le modèle tronque alors "
        "« without saying so », et la seconde passe ne lit que les premières notes"
    ),
)
def test_defaut_la_seconde_passe_depasse_la_fenetre():
    document = " ".join(f"Paragraph {i} describes another part of the warehouse." for i in range(3600))[:MAX_CHARACTERS]
    model = NoteTaker({})
    summarise(document, model=model)
    assert len(model.calls) > 2
    assert all(len(call) <= CHUNK_CHARACTERS for call in model.calls)


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_zero_essai_leve_sans_appeler():
    model = FakeSeq2Seq({}, default="a summary")
    with pytest.raises(SummaryUnavailable):
        summarise(REPORT, model=model, attempts=0)
    assert model.calls == []


def test_production_une_reponse_d_un_autre_type_est_une_panne():
    class ListModel:
        calls = 0

        def generate(self, text):
            ListModel.calls += 1
            return ["not", "a", "string"]

    with pytest.raises(SummaryUnavailable):
        summarise(REPORT, model=ListModel(), attempts=2)
    assert ListModel.calls == 2


def test_production_constat_la_decoupe_ecrase_les_sauts_de_paragraphe():
    assert chunk("First paragraph ends.\n\nSecond one starts.") == ["First paragraph ends. Second one starts."]


def test_production_nfd_et_emoji_partent_tels_quels():
    text = unicodedata.normalize("NFD", "La réunion est reportée 🚧.")
    model = FakeSeq2Seq({}, default="ok")
    summarise(text, model=model)
    assert model.calls == [text]
