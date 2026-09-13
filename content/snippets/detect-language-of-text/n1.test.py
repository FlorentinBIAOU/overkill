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


def test_detects_a_sentence_in_each_language():
    assert detect(MODEL, "La réunion de lundi est reportée au mercredi suivant, merci de prévenir les participants.") == "fr"
    assert detect(MODEL, "The meeting on Monday has been moved to the following Wednesday, please tell the attendees.") == "en"
    assert detect(MODEL, "La reunión del lunes se ha trasladado al miércoles siguiente, avisad a los participantes.") == "es"


def test_probabilities_sum_to_one_over_the_known_languages():
    scores = probabilities(MODEL, "The meeting is on Monday.")
    assert set(scores) == {"fr", "en", "es"}
    assert abs(sum(scores.values()) - 1.0) < 1e-9


def test_a_single_word_is_enough_when_it_is_a_distinctive_one():
    # Where N0 needs a paragraph to rank anything, weighing the evidence gets
    # a usable answer out of one word. This is what the rung buys.
    assert probabilities(MODEL, "Bonjour")["fr"] > 0.9
    assert probabilities(MODEL, "Hola")["es"] > 0.9


def test_survives_capitals_missing_accents_and_punctuation():
    shouted = "LA REUNION DE LUNDI EST REPORTEE AU MERCREDI SUIVANT !!! MERCI DE PREVENIR LES PARTICIPANTS..."
    assert detect(MODEL, shouted) == "fr"
    punctuated = "Réunion : lundi ?? non — mercredi (14h30) ; merci d'avertir les participants, s'il vous plaît."
    assert detect(MODEL, punctuated) == "fr"
    assert detect(MODEL, "LA REUNION DEL LUNES SE HA TRASLADADO AL MIERCOLES SIGUIENTE!!!") == "es"


def test_it_can_abstain_where_n0_had_to_answer():
    # Two words shared between French and Spanish spellings: the model says so
    # instead of picking one, which is the whole point of a threshold.
    scores = probabilities(MODEL, "ça va")
    assert scores["fr"] < 0.9
    assert detect(MODEL, "ça va", minimum=0.9) is None
    # With no text at all, the answer is the prior and nothing else.
    assert detect(MODEL, "", minimum=0.5) is None


def test_breaking_point_the_confidence_saturates_on_a_mixed_text():
    """
    The breaking point of this rung: the probability is a product over every
    n-gram of the text, so it saturates long before the evidence justifies it.

    On a French sentence followed by an English one, the model does not
    hesitate the way N0 did. It answers French with a probability above
    ninety-nine per cent, and the threshold that abstained on "ça va" never
    fires. The number looks like a confidence and is not one.

    Short and ambiguous words fail the same way: "chat" is French for cat,
    and the model is certain it is English.
    """
    mixed = ("La réunion de lundi est reportée au mercredi suivant. "
             "Please let the London team know as soon as you can.")
    assert probabilities(MODEL, mixed)["fr"] > 0.99
    assert detect(MODEL, mixed, minimum=0.9) == "fr"
    assert probabilities(MODEL, "chat")["en"] > 0.9


def test_breaking_point_a_language_it_was_never_shown():
    """
    The other half of the same flaw: the probabilities sum to one over the
    training languages, so a language absent from the sample is not merely
    missed, it is assigned. Portuguese comes back as Spanish, and German as
    English, both above the threshold.

    Adding a language means retraining. Nothing in the answer warns you that
    the true one was never on the list.
    """
    portuguese = "O comboio chegou com um quarto de hora de atraso e ninguém na plataforma pareceu surpreendido."
    german = "Der Zug kam eine Viertelstunde zu spät an, und niemand auf dem Bahnsteig schien überrascht zu sein."
    assert detect(MODEL, portuguese, minimum=0.9) == "es"
    assert detect(MODEL, german, minimum=0.9) == "en"
