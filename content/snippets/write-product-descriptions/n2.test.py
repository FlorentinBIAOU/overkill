"""
Ces tests injectent un double local au lieu de charger le point de contrôle.

Ce qu'ils prouvent : le dossier arrive au modèle sous la forme de l'affinage,
un dossier trop grand est refusé avant toute génération, un appel qui échoue
est retenté, une phrase inachevée n'est pas publiée, et une copie qui affirme
un attribut absent du dossier est refusée.

Ce qu'ils ne prouvent pas : que le modèle écrit bien, ni qu'il invente.
"""

import time
import unicodedata

import pytest

from _harness.fake_model import FakeSeq2Seq
import n3
from n2 import MAX_CHARACTERS, MIN_CHARACTERS, DescriptionUnavailable, UngroundedDescription, describe

# Un produit inventé : aucune marque, aucun catalogue existant.
PRODUCT = {
    "name": "Aurore 500",
    "category": "sac à dos",
    "material": "toile recyclée",
    "audience": "les randonneurs",
    "features": ["poche pour ordinateur", "sangle ventrale"],
    "colours": ["ardoise", "sable"],
    "warranty": "deux ans",
}

# Les mots du catalogue de la boutique : le contrôle d'ancrage vaut exactement cette liste.
VOCABULARY = (
    "toile recyclée",
    "cuir pleine fleur",
    "étanche",
    "poche pour ordinateur",
    "sangle ventrale",
    "garanti à vie",
)

COPY = (
    "Aurore 500 accompagne les randonneurs à la journée. Sa toile recyclée "
    "encaisse les ronces, et sa sangle ventrale reporte la charge sur les hanches."
)

INVENTED = (
    "Aurore 500 suit les randonneurs par tous les temps. Sa toile recyclée "
    "est entièrement étanche, et sa sangle ventrale reporte la charge."
)


class RecordingModel:
    """Un double qui garde aussi les options de génération."""

    def __init__(self, answer):
        self.answer = answer
        self.calls = []

    def generate(self, source, **options):
        self.calls.append((source, options))
        return self.answer


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_le_modele_affirme_ce_que_le_dossier_ne_dit_pas():
    """
    « Le test fait rendre au double local une phrase juste de ton et de
    grammaire — la toile recyclée du sac y est « entièrement étanche » — pour
    un article dont aucun attribut ne parle d'étanchéité […] L'extrait refuse
    la copie au lieu de la publier » (existant).
    """
    with pytest.raises(UngroundedDescription) as refused:
        describe(PRODUCT, FakeSeq2Seq({}, INVENTED), vocabulary=VOCABULARY)
    assert str(refused.value) == "étanche"
    # Témoin : la même phrase, pour un dossier qui porte l'attribut, passe.
    waterproof = {**PRODUCT, "features": [*PRODUCT["features"], "étanche"]}
    assert describe(waterproof, FakeSeq2Seq({}, INVENTED), vocabulary=VOCABULARY) == INVENTED


def test_point_de_rupture_un_vocabulaire_vide_laisse_passer_la_meme_phrase():
    """« mais seulement pour les termes que vous avez listés : le test suivant montre la même phrase passant intacte avec un vocabulaire vide » (existant)."""
    assert describe(PRODUCT, FakeSeq2Seq({}, INVENTED)) == INVENTED
    assert describe(PRODUCT, FakeSeq2Seq({}, INVENTED), vocabulary=("cuir pleine fleur",)) == INVENTED


@pytest.mark.xfail(
    strict=True,
    reason="DÉFAUT : un dossier qui dit « non étanche » contient le mot « étanche » ; la copie « entièrement étanche » "
    "est tenue pour ancrée et publiée",
)
def test_defaut_un_dossier_qui_nie_l_attribut_ne_l_ancre_pas():
    record = {**PRODUCT, "features": [*PRODUCT["features"], "non étanche"]}
    with pytest.raises(UngroundedDescription):
        describe(record, FakeSeq2Seq({}, INVENTED), vocabulary=VOCABULARY)


@pytest.mark.xfail(
    strict=True,
    reason="DÉFAUT : le contrôle cherche le terme exact en mot entier ; « garantie à vie » (accord au féminin) et "
    "« coutures étanches » (pluriel) ne rencontrent pas « garanti à vie » et « étanche », et passent",
)
def test_defaut_un_terme_de_la_liste_accorde_est_refuse_aussi():
    for copy in (
        "Aurore 500 est une lampe solide, garantie à vie par la maison qui la fabrique.",
        "Des coutures étanches et une toile recyclée pour la randonnée du dimanche.",
    ):
        with pytest.raises(UngroundedDescription):
            describe(PRODUCT, FakeSeq2Seq({}, copy), vocabulary=VOCABULARY)


# ---------------------------------------------------------------------------
# Docstring et commentaires
# ---------------------------------------------------------------------------


def test_ecrit_la_copie_que_le_modele_a_rendue():
    """Cas nominal (existant)."""
    assert describe(PRODUCT, FakeSeq2Seq({}, COPY), vocabulary=VOCABULARY) == COPY


def test_envoie_le_dossier_sous_la_forme_de_l_affinage():
    """« the source line the model was fine-tuned to read » ; `_source` « one line of « field: value » » (existant, resserré)."""
    model = RecordingModel(COPY)
    describe(PRODUCT, model)
    source, options = model.calls[0]
    assert source == (
        "name: Aurore 500 | category: sac à dos | material: toile recyclée | audience: les randonneurs | "
        "features: poche pour ordinateur, sangle ventrale | colours: ardoise, sable | warranty: deux ans"
    )
    # risks `deterministic: true` : recherche en faisceau, sans tirage.
    assert options == {"max_new_tokens": 90, "num_beams": 4}


def test_ne_garde_que_les_phrases_que_le_modele_a_finies():
    """`_whole_sentences` : « A small model stops when its budget runs out, mid-sentence and sometimes mid-word » (existant)."""
    model = FakeSeq2Seq({}, "Aurore 500 accompagne les randonneurs à la journée. Sa toile recy")
    assert describe(PRODUCT, model) == "Aurore 500 accompagne les randonneurs à la journée."


@pytest.mark.xfail(
    strict=True,
    reason="DÉFAUT : « Publishing that is worse than publishing nothing at all » ; la coupe se fait au dernier point, "
    "et le point d'un nombre décimal (« 1.2 kg ») en est un : « … et pèse 1. » est publié",
)
def test_defaut_un_point_decimal_n_est_pas_une_fin_de_phrase():
    model = FakeSeq2Seq({}, "Aurore 500 accompagne les randonneurs à la journée et pèse 1.2 kg avec sa toile recy")
    try:
        published = describe(PRODUCT, model)
    except DescriptionUnavailable:
        return
    assert not published.endswith("1.")


def test_un_fragment_est_refuse_plutot_que_publie():
    """`MIN_CHARACTERS` : « Shorter than that, the model handed back a fragment » (existant, complété : limites)."""
    with pytest.raises(DescriptionUnavailable):
        describe(PRODUCT, FakeSeq2Seq({}, "Aurore 500."))
    with pytest.raises(DescriptionUnavailable):
        describe(PRODUCT, FakeSeq2Seq({}, "un sac à dos solide et bien pensé pour la journée"))
    exactly = "A" * (MIN_CHARACTERS - 1) + "."
    assert describe(PRODUCT, FakeSeq2Seq({}, exactly)) == exactly
    with pytest.raises(DescriptionUnavailable):
        describe(PRODUCT, FakeSeq2Seq({}, "A" * (MIN_CHARACTERS - 2) + "."))


def test_refuse_un_dossier_trop_grand_avant_de_generer_quoi_que_ce_soit():
    """« the size cap » (existant, complété : limites)."""
    model = FakeSeq2Seq({}, COPY)
    with pytest.raises(ValueError):
        describe({"name": "Aurore 500", "features": ["détail interminable " * 40]}, model)
    assert model.calls == []
    at_cap = {"n": "x" * (MAX_CHARACTERS - 3)}
    assert describe(at_cap, model) == COPY
    with pytest.raises(ValueError):
        describe({"n": "x" * (MAX_CHARACTERS - 2)}, model)


def test_retente_un_appel_qui_a_echoue():
    """`_generate` : « Retry: on a machine that also serves the shop, the first call fails » (existants, réunis)."""

    class FailingOnce:
        def __init__(self):
            self.calls = 0

        def generate(self, source, **options):
            self.calls += 1
            if self.calls == 1:
                raise MemoryError("checkpoint not loaded")
            return COPY

    model = FailingOnce()
    assert describe(PRODUCT, model, attempts=2) == COPY
    assert model.calls == 2

    class AlwaysFailing:
        calls = 0

        def generate(self, source, **options):
            AlwaysFailing.calls += 1
            raise MemoryError("checkpoint not loaded")

    with pytest.raises(DescriptionUnavailable, match="checkpoint not loaded"):
        describe(PRODUCT, AlwaysFailing())
    assert AlwaysFailing.calls == 2


def test_la_recherche_ignore_casse_et_accents_en_mot_entier():
    """`_says` : « Whole-word search, case and accents set aside » ; `_fold` : « so « Étanche » meets « etanche » »."""
    shouting = "Aurore 500 SUIT LES RANDONNEURS. SA TOILE EST ENTIÈREMENT ETANCHE, DIT LA NOTICE."
    with pytest.raises(UngroundedDescription):
        describe(PRODUCT, FakeSeq2Seq({}, shouting), vocabulary=VOCABULARY)
    record = {**PRODUCT, "features": [unicodedata.normalize("NFD", "Étanche")]}
    assert describe(record, FakeSeq2Seq({}, shouting), vocabulary=VOCABULARY) == shouting
    # Mot entier : « étanchéité » n'est pas « étanche ».
    assert describe(PRODUCT, FakeSeq2Seq({}, "Aurore 500 offre une étanchéité soignée aux randonneurs du dimanche."), vocabulary=VOCABULARY)


def test_le_modele_est_injecte_et_par_defaut_c_est_le_vrai():
    """« `model` is injected so this can be tested without the checkpoint; in production it defaults to the real one above »."""
    with pytest.raises(ModuleNotFoundError, match="transformers"):
        describe(PRODUCT)


def test_le_meme_controle_qu_au_niveau_n3():
    """breaking_point N3 : « Ce qui l'attrape est le contrôle du niveau du dessous » : mêmes verdicts sur les mêmes copies."""
    import json

    from _harness.fake_llm import FakeLLM

    for copy in (COPY, INVENTED):
        def verdict(call):
            try:
                call()
                return "published"
            except Exception as error:  # les deux niveaux ont chacun leur classe
                return f"{type(error).__name__}: {error}"

        n2_verdict = verdict(lambda: describe(PRODUCT, FakeSeq2Seq({}, copy), vocabulary=VOCABULARY))
        n3_verdict = verdict(lambda: n3.describe(PRODUCT, FakeLLM(response=json.dumps({"description": copy})), vocabulary=VOCABULARY))
        assert n2_verdict == n3_verdict


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_dossier_vide_zero_essai_et_attribut_nul():
    """Précision : un dossier vide part quand même au modèle ; un attribut à None s'écrit « None » dans la source."""
    model = RecordingModel(COPY)
    assert describe({}, model) == COPY
    assert model.calls[0][0] == ""
    with pytest.raises(DescriptionUnavailable):
        describe(PRODUCT, RecordingModel(COPY), attempts=0)
    model = RecordingModel(COPY)
    describe({"name": None}, model)
    assert model.calls[0][0] == "name: None"


def test_production_une_longue_reponse_et_des_espaces_en_desordre():
    long_copy = ("Aurore 500 accompagne les randonneurs.\n\n  " * 2000).strip()
    start = time.perf_counter()
    published = describe(PRODUCT, FakeSeq2Seq({}, long_copy), vocabulary=VOCABULARY)
    assert time.perf_counter() - start < 2
    assert "\n" not in published and "  " not in published


@pytest.mark.xfail(
    strict=True,
    reason="DÉFAUT (Python) : une réponse qui n'est pas une chaîne (la liste brute du pipeline) passe par str() et "
    "est publiée telle quelle : « [{'generated_text': 'Aurore 500 … journée. »",
)
def test_defaut_une_reponse_d_un_autre_type_n_est_pas_publiee():
    raw = [{"generated_text": "Aurore 500 accompagne les randonneurs à la journée."}]
    with pytest.raises(DescriptionUnavailable):
        describe(PRODUCT, FakeSeq2Seq({}, raw))


def test_production_un_terme_commencant_par_une_ligature_est_trouve():
    """Python : « œillets métalliques » est trouvé (JavaScript le manque, voir n2.test.js)."""
    copy = "Sac aux œillets métalliques, pensé pour les randonneurs de la journée."
    with pytest.raises(UngroundedDescription):
        describe(PRODUCT, FakeSeq2Seq({}, copy), vocabulary=("œillets métalliques",))


def test_production_le_plafond_compte_des_caracteres():
    """Python : 298 emojis font 304 caractères de source, sous le plafond (JavaScript les refuse, voir n2.test.js)."""
    assert describe({"name": "🙂" * 298}, FakeSeq2Seq({}, COPY)) == COPY
