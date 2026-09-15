import ast
import time
import unicodedata
from pathlib import Path

import pytest

import n0
from n1 import detect, probabilities, train

# One paragraph per language, the same samples the trigram profiles of N0 are
# built from. The samples live here, not in the snippet.
SAMPLES = {
    "fr": """
    Le train est arrivé avec un quart d'heure de retard, et personne sur le quai
    n'a semblé s'en étonner. Les voyageurs sont descendus lentement, leurs sacs à
    la main, puis la gare a retrouvé son calme habituel. Dans la salle d'attente,
    une femme lisait un journal tandis que son fils comptait les carreaux du sol.
    Il faisait froid dehors, mais le soleil de la fin du mois de mars donnait aux
    toits une couleur qui ne dure jamais très longtemps. Nous avons marché jusqu'au
    centre de la ville, où les commerces ouvraient les uns après les autres. Le
    boulanger nous a expliqué que la farine avait encore augmenté cette année, et
    que ses clients ne comprenaient pas toujours pourquoi le prix du pain suivait.
    """,
    "en": """
    The train arrived a quarter of an hour late, and nobody on the platform seemed
    surprised by it. The passengers came down slowly, their bags in hand, and then
    the station went back to its usual quiet. In the waiting room a woman was
    reading a newspaper while her son counted the tiles on the floor. It was cold
    outside, but the sun at the end of March gave the roofs a colour that never
    lasts very long. We walked into the centre of the town, where the shops were
    opening one after another. The baker explained that flour had gone up again
    this year, and that his customers did not always understand why the price of
    bread followed.
    """,
    "es": """
    El tren llegó con un cuarto de hora de retraso, y nadie en el andén pareció
    sorprenderse. Los viajeros bajaron despacio, con sus bolsas en la mano, y luego
    la estación volvió a su calma de siempre. En la sala de espera una mujer leía
    un periódico mientras su hijo contaba las baldosas del suelo. Hacía frío fuera,
    pero el sol de finales de marzo daba a los tejados un color que nunca dura
    mucho tiempo. Caminamos hasta el centro de la ciudad, donde las tiendas abrían
    una tras otra. El panadero nos explicó que la harina había subido otra vez este
    año, y que sus clientes no siempre entendían por qué el precio del pan seguía.
    """,
}

MODEL = train(SAMPLES)
N0_PROFILES = {name: n0.profile(sample) for name, sample in SAMPLES.items()}

FRENCH = "La réunion de lundi est reportée au mercredi suivant, merci de prévenir les participants."
SPANISH = "La reunión del lunes se ha trasladado al miércoles siguiente, avisad a los participantes."
MIXED = (
    "La réunion de lundi est reportée au mercredi suivant. "
    "Please let the London team know as soon as you can."
)
PORTUGUESE = "O comboio chegou com um quarto de hora de atraso e ninguém na plataforma pareceu surpreendido."
GERMAN = "Der Zug kam eine Viertelstunde zu spät an, und niemand auf dem Bahnsteig schien überrascht zu sein."
THRESHOLD = 0.9


def analyse(text):
    """The n-grams the vectorizer of the snippet cuts from a text."""
    return MODEL.named_steps["countvectorizer"].build_analyzer()(text)


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_sur_le_texte_bilingue_le_modele_repond_francais_avec_une_quasi_certitude():
    """
    breaking_point : « il répond français avec une quasi-certitude et le seuil
    qui s'abstenait sur « ça va » ne se déclenche pas ». Témoin : le même seuil
    s'abstient bien sur « ça va ».
    """
    assert probabilities(MODEL, MIXED)["fr"] > 0.99
    assert detect(MODEL, MIXED, minimum=THRESHOLD) == "fr"
    assert detect(MODEL, "ça va", minimum=THRESHOLD) is None


def test_point_de_rupture_le_modele_n_a_plus_l_hesitation_de_n0_sur_le_texte_bilingue():
    """breaking_point : « le modèle n'a plus l'hésitation de N0 » : l'écart de N0 fond de plus de moitié, la probabilité de N1 ne bouge pas."""
    def n0_gap(text):
        scores = n0.ranked(text, N0_PROFILES)
        return scores[1][1] - scores[0][1]

    assert n0_gap(MIXED) < n0_gap(FRENCH) / 2
    assert probabilities(MODEL, MIXED)["fr"] > 0.99
    assert probabilities(MODEL, FRENCH)["fr"] > 0.99


def test_point_de_rupture_un_texte_portugais_ressort_en_espagnol_au_dessus_du_seuil():
    """breaking_point : « un texte portugais ressort en espagnol ». Témoin : une vraie phrase espagnole."""
    assert detect(MODEL, PORTUGUESE, minimum=THRESHOLD) == "es"
    assert detect(MODEL, SPANISH, minimum=THRESHOLD) == "es"


def test_point_de_rupture_un_texte_allemand_ressort_en_anglais_au_dessus_du_seuil():
    """breaking_point : « un texte allemand en anglais, tous deux au-dessus du seuil »."""
    assert detect(MODEL, GERMAN, minimum=THRESHOLD) == "en"
    assert detect(MODEL, "The meeting on Monday has been moved to Wednesday.", minimum=THRESHOLD) == "en"


# ---------------------------------------------------------------------------
# Autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_detecte_une_phrase_dans_chaque_langue():
    """name : « Classifieur bayésien naïf sur n-grammes de caractères »."""
    assert detect(MODEL, FRENCH) == "fr"
    assert detect(MODEL, "The meeting on Monday has been moved to the following Wednesday, please tell the attendees.") == "en"
    assert detect(MODEL, SPANISH) == "es"


def test_les_traits_sont_des_n_grammes_d_un_a_trois_caracteres_bornes_aux_mots():
    """
    docstring : « Les mêmes traits qu'en N0, un à trois caractères » ; docstring
    de train : « char_wb cuts n-grams inside word boundaries […] exactly as the
    padding of N0 did ».
    """
    grams = analyse("les tables")
    assert {len(gram) for gram in grams} == {1, 2, 3}
    assert " le" in grams and "les" in grams
    assert not any(" " in gram.strip() for gram in grams)  # nothing spans two words


def test_les_probabilites_somment_a_un_sur_les_seules_langues_apprises():
    """docstring de probabilities : « they always sum to one, over the languages the model was trained on and no others »."""
    for text in ("The meeting is on Monday.", PORTUGUESE, GERMAN, ""):
        scores = probabilities(MODEL, text)
        assert set(scores) == {"fr", "en", "es"}
        assert abs(sum(scores.values()) - 1.0) < 1e-9


def test_la_reponse_dit_de_combien_la_premiere_langue_devance_les_autres():
    """docstring : « celui-ci répond « français, et voici de combien il devance l'espagnol » »."""
    scores = probabilities(MODEL, "ça va")
    assert scores["fr"] > scores["es"] > scores["en"]
    assert 0 < scores["fr"] - scores["es"] < 1


def test_un_seul_mot_suffit_quand_il_est_distinctif():
    assert probabilities(MODEL, "Bonjour")["fr"] > 0.9
    assert probabilities(MODEL, "Hola")["es"] > 0.9


def test_la_casse_les_accents_manquants_et_la_ponctuation_ne_changent_pas_la_reponse():
    shouted = "LA REUNION DE LUNDI EST REPORTEE AU MERCREDI SUIVANT !!! MERCI DE PREVENIR LES PARTICIPANTS..."
    assert detect(MODEL, shouted) == "fr"
    punctuated = "Réunion : lundi ?? non — mercredi (14h30) ; merci d'avertir les participants, s'il vous plaît."
    assert detect(MODEL, punctuated) == "fr"
    assert detect(MODEL, "LA REUNION DEL LUNES SE HA TRASLADADO AL MIERCOLES SIGUIENTE!!!") == "es"


def test_il_sait_s_abstenir_la_ou_n0_devait_repondre():
    """docstring : « Un détecteur qui sait s'abstenir » ; docstring de detect : « or None when the model is not sure enough »."""
    assert probabilities(MODEL, "ça va")["fr"] < THRESHOLD
    assert detect(MODEL, "ça va", minimum=THRESHOLD) is None
    assert n0.detect("ça va", N0_PROFILES) == "en"
    # With no text at all, the answer is the prior and nothing else.
    assert detect(MODEL, "", minimum=0.5) is None


def test_a_minimum_zero_il_rend_toujours_un_nom_comme_n0():
    """docstring de detect : « Leave it at zero to always get a name, as N0 does »."""
    assert detect(MODEL, "") == "en"
    assert detect(MODEL, "12 !!") in {"fr", "en", "es"}


def test_un_lissage_leger_un_caractere_jamais_vu_ne_disqualifie_pas_la_langue():
    """docstring de train : « an n-gram this language never used should count against it, without ruling it out on a single character »."""
    vocabulary = MODEL.named_steps["countvectorizer"].vocabulary_
    counts = MODEL.named_steps["multinomialnb"].feature_count_
    french_row = list(MODEL.classes_).index("fr")
    assert counts[french_row][vocabulary["ñ"]] == 0
    assert detect(MODEL, FRENCH + " ñ", minimum=THRESHOLD) == "fr"
    assert detect(MODEL, "ñ") == "es"


def test_le_modele_est_une_table_de_comptes():
    """docstring : « Le modèle est une table de comptes »."""
    counts = MODEL.named_steps["multinomialnb"].feature_count_
    english_row = list(MODEL.classes_).index("en")
    assert counts[english_row].sum() == len(analyse(SAMPLES["en"]))
    assert (counts == counts.round()).all()


def test_verdict_la_probabilite_de_n1_monte_a_la_quasi_certitude_quand_l_ecart_de_n0_s_effondre():
    """verdict_rationale : « cet écart s'effondre exactement là où il le faut, sur le message bilingue ; la probabilité de N1 fait l'inverse »."""
    scores = n0.ranked(MIXED, N0_PROFILES)
    assert scores[1][1] - scores[0][1] < 5
    assert probabilities(MODEL, MIXED)["fr"] > 0.99


@pytest.mark.xfail(
    strict=True,
    reason=(
        "INFIRMÉ : verdict_rationale dit que le seuil de N1 « vous protège des textes "
        "courts » ; sur « chat », quatre lettres, la probabilité anglaise dépasse 0,99 "
        "et le seuil de 0,9 laisse passer la mauvaise langue"
    ),
)
def test_infirme_le_seuil_de_n1_protege_des_textes_courts():
    assert detect(MODEL, "ça va", minimum=THRESHOLD) is None
    assert detect(MODEL, "chat", minimum=THRESHOLD) is None


def test_chat_est_anglais_avec_certitude():
    """Test d'origine gardé : « "chat" is French for cat, and the model is certain it is English »."""
    assert probabilities(MODEL, "chat")["en"] > 0.9


def test_deux_entrainements_sur_les_memes_echantillons_rendent_les_memes_probabilites():
    """risks.deterministic: true."""
    assert probabilities(train(SAMPLES), MIXED) == probabilities(MODEL, MIXED)


def test_l_extrait_n_importe_que_scikit_learn():
    """risks.data_egress: none : aucune bibliothèque réseau."""
    source = ast.parse(Path(__file__).with_name("n1.py").read_text(encoding="utf-8"))
    imported = {n.module.split(".")[0] for n in ast.walk(source) if isinstance(n, ast.ImportFrom)}
    imported |= {a.name.split(".")[0] for n in ast.walk(source) if isinstance(n, ast.Import) for a in n.names}
    assert imported == {"sklearn"}


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_texte_vide_et_texte_blanc_rendent_la_loi_a_priori():
    for text in ("", "   \n\t "):
        scores = probabilities(MODEL, text)
        assert all(abs(value - 1 / 3) < 1e-12 for value in scores.values())


def test_production_une_seule_langue_apprise_rend_cette_langue_avec_probabilite_un():
    single = train({"fr": SAMPLES["fr"]})
    assert probabilities(single, GERMAN) == {"fr": 1.0}
    assert detect(single, GERMAN, minimum=THRESHOLD) == "fr"


def test_production_un_texte_d_un_million_de_caracteres_termine_sans_debordement_numerique():
    """Commentaire JavaScript : « multiplying a few thousand small numbers underflows to zero » ; les deux versions doivent tenir."""
    big = " ".join([FRENCH] * 12_000)
    debut = time.perf_counter()
    scores = probabilities(MODEL, big)
    assert scores["fr"] == 1.0
    assert abs(sum(scores.values()) - 1.0) < 1e-9
    assert time.perf_counter() - debut < 20


def test_production_accents_decomposes_espaces_insecables_largeur_nulle_bom_et_emoji():
    for text in (
        unicodedata.normalize("NFD", FRENCH),
        FRENCH.replace(" ", "\u00a0"),
        FRENCH.replace("réunion", "réu\u200bnion"),
        "\ufeff" + FRENCH,
        "🎉 " + FRENCH + " 👍",
    ):
        assert detect(MODEL, text, minimum=THRESHOLD) == "fr", repr(text[:12])


def test_production_seuil_exactement_egal_juste_au_dessus_et_a_un():
    top = max(probabilities(MODEL, "").values())
    assert detect(MODEL, "", minimum=top) == "en"
    assert detect(MODEL, "", minimum=top + 1e-9) is None
    assert detect(MODEL, MIXED, minimum=1.0) is None
