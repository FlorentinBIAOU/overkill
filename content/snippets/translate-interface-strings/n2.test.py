"""
Ces tests injectent un double local au lieu de charger un modèle de traduction.

Ce qu'ils prouvent : les variables sont cachées avant que le modèle ne voie la
chaîne, remises après, une variable déplacée est acceptée, une variable perdue
ou réécrite est signalée plutôt que livrée, un appel qui échoue est retenté, et
une réponse vide lève au lieu de rendre un libellé blanc.

Ce qu'ils ne prouvent pas : que le modèle traduit bien, ni qu'il rend le
marqueur. Le double écrit la réponse.
"""

import inspect
import time
import unicodedata

import pytest

from _harness.fake_model import FakeSeq2Seq
from n2 import MARK, MODEL_NAME, TranslationUnavailable, placeholders, translate

# Les deux caractères du marqueur. Aucun des deux ne figure dans le vocabulaire
# de Helsinki-NLP/opus-mt-en-fr (vocab.json, 59 514 entrées, vérifié) : le
# tokeniseur SentencePiece les isole et Marian les remplace par <unk>.
ABSENT_FROM_VOCABULARY = "⟦⟧"


class FlakySeq2Seq(FakeSeq2Seq):
    """Un modèle qui meurt à ses premiers appels, comme un vrai processus."""

    def __init__(self, outputs, fail_times=1, default=""):
        super().__init__(outputs, default=default)
        self.fail_times = fail_times

    def generate(self, text, **kwargs):
        if self.fail_times > 0:
            self.fail_times -= 1
            self.calls.append(text)
            raise RuntimeError("the model worker died")
        return super().generate(text, **kwargs)


class EchoTranslator:
    """
    Un traducteur parfait qui rend tout ce qu'il sait lire. Avec `drop`, il imite
    le vocabulaire du vrai modèle : les caractères inconnus deviennent <unk>, et
    la génération ne peut pas les produire.
    """

    def __init__(self, replacements=(), drop=""):
        self.replacements = replacements
        self.drop = drop
        self.calls = []

    def generate(self, text):
        self.calls.append(text)
        for old, new in self.replacements:
            text = text.replace(old, new)
        return "".join(c for c in text if c not in self.drop)


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_le_modele_recoit_un_marqueur_jamais_la_variable():
    """« le modèle reçoit « ⟦0⟧ items selected », jamais « {count} » » (existant)."""
    model = FakeSeq2Seq({"⟦0⟧ items selected": "⟦0⟧ éléments sélectionnés"})
    result = translate("{count} items selected", model=model)
    assert model.calls == ["⟦0⟧ items selected"]
    assert "count" not in model.calls[0]
    assert result == {"target": "{count} éléments sélectionnés", "review": False, "warnings": []}


def test_point_de_rupture_une_variable_perdue_est_attrapee_pas_livree():
    """« « Des éléments sélectionnés », marqueur disparu, donc une phrase française sans le nombre dedans » (existant)."""
    model = FakeSeq2Seq({"⟦0⟧ items selected": "Des éléments sélectionnés"})
    result = translate("{count} items selected", model=model)
    assert result["target"] == "Des éléments sélectionnés"
    assert result["review"] is True
    assert result["warnings"] == ["variables differ from the source: expected {count}, got none"]


def test_point_de_rupture_une_accolade_inventee_est_attrapee_aussi():
    """« « {compte} éléments sélectionnés », accolade inventée là où la source n'en avait pas » (existant)."""
    model = FakeSeq2Seq({"⟦0⟧ items selected": "{compte} éléments sélectionnés"})
    result = translate("{count} items selected", model=model)
    assert result["review"] is True
    assert result["warnings"] == ["variables differ from the source: expected {count}, got {compte}"]


def test_defaut_sur_le_vocabulaire_du_vrai_modele_le_marqueur_revient():
    perfect = [("items selected", "éléments sélectionnés")]
    # Témoin : un modèle qui sait lire le marqueur le rend, et rien n'est signalé.
    assert translate("{count} items selected", model=EchoTranslator(perfect))["review"] is False
    real_vocabulary = EchoTranslator(perfect, drop=ABSENT_FROM_VOCABULARY)
    assert translate("{count} items selected", model=real_vocabulary)["review"] is False


# ---------------------------------------------------------------------------
# Nom, docstring, commentaires
# ---------------------------------------------------------------------------


def test_traduit_une_chaine_sans_variable():
    """Cas nominal (existant)."""
    model = FakeSeq2Seq({"Save changes": "Enregistrer les modifications"})
    assert translate("Save changes", model=model) == {
        "target": "Enregistrer les modifications", "review": False, "warnings": [],
    }


def test_une_paire_de_langues_a_la_fois():
    """name « une paire de langues à la fois » : ni langue source ni langue cible en paramètre, un modèle en→fr."""
    assert MODEL_NAME == "Helsinki-NLP/opus-mt-en-fr"
    assert list(inspect.signature(translate).parameters) == ["source", "model", "attempts"]


def test_une_variable_deplacee_est_l_affaire_du_modele():
    """« Moving a marker is allowed — word order is the model's job » (existant)."""
    model = FakeSeq2Seq({"Delete ⟦0⟧ of ⟦1⟧": "Sur ⟦1⟧, supprimer ⟦0⟧"})
    result = translate("Delete {count} of {total}", model=model)
    assert result == {"target": "Sur {total}, supprimer {count}", "review": False, "warnings": []}


def test_une_variable_repetee_ou_inventee_par_le_modele_est_signalee():
    """« Losing or inventing one is reported » : un marqueur rendu deux fois devient deux variables."""
    model = FakeSeq2Seq({"⟦0⟧ items selected": "⟦0⟧ éléments ⟦0⟧ sélectionnés"})
    result = translate("{count} items selected", model=model)
    assert result["target"] == "{count} éléments {count} sélectionnés"
    assert result["warnings"] == ["variables differ from the source: expected {count}, got {count} {count}"]


def test_les_variables_sont_cachees_remises_et_comptees_sous_toutes_leurs_formes():
    """« hidden behind neutral markers before the model sees the string, put back afterwards, and counted »."""
    source = "{} %s %d %(name)s %1$s %2$d {count} {count}"
    model = EchoTranslator()
    result = translate(source, model=model)
    assert model.calls == ["⟦0⟧ ⟦1⟧ ⟦2⟧ ⟦3⟧ ⟦4⟧ ⟦5⟧ ⟦6⟧ ⟦7⟧"]
    assert result == {"target": source, "review": False, "warnings": []}


def test_onze_variables_ne_confondent_pas_les_marqueurs_un_et_dix():
    source = " ".join(f"{{v{i}}}" for i in range(11))
    model = EchoTranslator()
    assert translate(source, model=model)["target"] == source
    assert "⟦10⟧" in model.calls[0] and "⟦1⟧" in model.calls[0]


def test_un_modele_qui_echoue_est_retente():
    """`_generate` : « A local model still fails: out of memory, a worker that died » (existant, complété)."""
    model = FlakySeq2Seq({"Save": "Enregistrer"}, fail_times=1)
    assert translate("Save", model=model, attempts=2)["target"] == "Enregistrer"
    assert len(model.calls) == 2

    model = FlakySeq2Seq({"Save": "Enregistrer"}, fail_times=5)
    with pytest.raises(TranslationUnavailable, match="the model worker died"):
        translate("Save", model=model, attempts=2)
    assert len(model.calls) == 2


def test_une_reponse_vide_leve_plutot_que_de_blanchir_l_interface():
    """`TranslationUnavailable` : « returned nothing usable » (existant)."""
    model = FakeSeq2Seq({}, default="   ")
    with pytest.raises(TranslationUnavailable):
        translate("Save", model=model, attempts=2)
    assert len(model.calls) == 2


def test_une_source_vide_ne_vaut_pas_un_appel():
    """Existant, complété : la chaîne blanche est rendue telle quelle."""
    model = FakeSeq2Seq({})
    assert translate("", model=model) == {"target": "", "review": False, "warnings": []}
    assert translate("   ", model=model)["target"] == "   "
    assert model.calls == []


def test_le_modele_est_injecte_et_par_defaut_c_est_le_vrai():
    """« `model` is injected so this can be tested without loading the weights. Left alone, it is the real one above »."""
    with pytest.raises(ModuleNotFoundError, match="transformers"):
        translate("Save")
    # Précision : le vrai modèle serait chargé avant de voir que la source est vide.
    with pytest.raises(ModuleNotFoundError, match="transformers"):
        translate("")


def test_un_modele_a_la_forme_du_pipeline_de_traduction_est_accepte():
    """`load_translator` : `pipeline("translation")` rend `[{"translation_text": …}]`, lu par l'enveloppe."""

    def pipe(text):
        return [{"translation_text": text.replace("items selected", "éléments sélectionnés")}]

    from types import SimpleNamespace

    wrapped = SimpleNamespace(generate=lambda text: pipe(text)[0]["translation_text"])
    assert translate("{count} items selected", model=wrapped)["target"] == "{count} éléments sélectionnés"


def test_la_plomberie_est_deterministe():
    """risks `deterministic: true` : démontré pour le code autour du modèle."""
    model = FakeSeq2Seq({"Delete ⟦0⟧ of ⟦1⟧": "Sur ⟦1⟧, supprimer ⟦0⟧"})
    first = translate("Delete {count} of {total}", model=model)
    assert all(translate("Delete {count} of {total}", model=model) == first for _ in range(5))


def test_verdict_n2_masque_la_variable_que_n3_montre_dans_l_invite():
    """verdict_rationale : « son modèle ne voit jamais la variable, là où celui de N3 la lit dans l'invite »."""
    from _harness.fake_llm import FakeLLM
    from n3 import translate as translate_n3

    seq2seq = FakeSeq2Seq({"⟦0⟧ items selected": "⟦0⟧ éléments sélectionnés"})
    translate("{count} items selected", model=seq2seq)
    llm = FakeLLM(response={"translation": "{count} éléments sélectionnés"})
    translate_n3("{count} items selected", "French", client=llm)
    assert "{count}" not in seq2seq.calls[0]
    assert "{count} items selected" in llm.last_request["prompt"]


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_une_chaine_de_cent_variables_termine_vite():
    source = " and ".join(f"{{v{i}}}" for i in range(100)) * 5
    start = time.perf_counter()
    assert translate(source, model=EchoTranslator())["target"] == source
    assert time.perf_counter() - start < 2


def test_production_encodage_nfd_emoji_insecable():
    source = unicodedata.normalize("NFD", "Supprimé : {count} 🙂")
    result = translate(source, model=EchoTranslator())
    assert result == {"target": source, "review": False, "warnings": []}


def test_production_zero_essai_leve_sans_appel():
    model = FakeSeq2Seq({"Save": "Enregistrer"})
    with pytest.raises(TranslationUnavailable):
        translate("Save", model=model, attempts=0)
    assert model.calls == []


def test_production_les_espaces_de_bord_sont_retires_de_la_traduction():
    """Précision : la traduction est `strip()`ée ; « Name: » suivi d'une valeur perd son espace."""
    model = FakeSeq2Seq({"Name: ": "Nom : "})
    assert translate("Name: ", model=model)["target"] == "Nom :"


def test_defaut_une_reponse_d_un_autre_type_leve_l_erreur_nommee():
    model = FakeSeq2Seq({}, default=[{"translation_text": "Enregistrer"}])
    with pytest.raises(TranslationUnavailable):
        translate("Save", model=model)


@pytest.mark.xfail(
    strict=True,
    reason="DÉFAUT : le motif ne reconnaît ni les pluriels ICU ni « {{count}} » ; la variable ICU part en clair au "
    "modèle et sa traduction n'est pas signalée, « {{count}} » réduit à « {count} » non plus",
)
def test_defaut_les_variables_icu_et_i18next_sont_protegees():
    icu = "{count, plural, one {# item} other {# items}}"
    translated = EchoTranslator([("count, plural, one", "compte, pluriel, un"), ("other", "autre")])
    assert translate(icu, model=translated)["review"] is True
    dropped = FakeSeq2Seq({"{⟦0⟧} items": "⟦0⟧ éléments"})
    assert translate("{{count}} items", model=dropped)["review"] is True


def test_production_placeholders_rend_les_variables_dans_l_ordre():
    """`placeholders` : « The interpolation variables, in the order they appear »."""
    assert placeholders("Delete {count} of {total}") == ["{count}", "{total}"]
    assert MARK.format(3) == "⟦3⟧"
