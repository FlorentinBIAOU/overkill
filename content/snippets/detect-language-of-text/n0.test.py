from n0 import detect, profile, ranked

# One paragraph per language is enough to rank three hundred trigrams. The
# samples live here, not in the snippet: the snippet builds a profile from
# whatever sample you give it.
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

PROFILES = {name: profile(sample) for name, sample in SAMPLES.items()}


def gap(text):
    """How far the winner is ahead of the runner-up."""
    scores = ranked(text, PROFILES)
    return scores[1][1] - scores[0][1]


def test_detects_a_sentence_in_each_language():
    assert detect("La réunion de lundi est reportée au mercredi suivant, merci de prévenir les participants.", PROFILES) == "fr"
    assert detect("The meeting on Monday has been moved to the following Wednesday, please tell the attendees.", PROFILES) == "en"
    assert detect("La reunión del lunes se ha trasladado al miércoles siguiente, avisad a los participantes.", PROFILES) == "es"


def test_a_profile_ranks_the_frequent_trigrams_first():
    # The top of the English profile is the definite article, cut into the
    # three padded trigrams it produces. The French profile starts with its
    # own. This is the whole model, and it is readable.
    assert list(PROFILES["en"])[:3] == [" th", "the", "he "]
    assert list(PROFILES["fr"])[0] == " le"
    assert list(PROFILES["es"])[0] == " de"
    assert len(PROFILES["fr"]) <= 300


def test_survives_capitals_missing_accents_and_punctuation():
    # What a support ticket typed in a hurry actually looks like. Accents are
    # a signal, but they are not the only one, so losing them is survivable.
    shouted = "LA REUNION DE LUNDI EST REPORTEE AU MERCREDI SUIVANT !!! MERCI DE PREVENIR LES PARTICIPANTS..."
    assert detect(shouted, PROFILES) == "fr"
    punctuated = "Réunion : lundi ?? non — mercredi (14h30) ; merci d'avertir les participants, s'il vous plaît."
    assert detect(punctuated, PROFILES) == "fr"
    assert detect("LA REUNION DEL LUNES SE HA TRASLADADO AL MIERCOLES SIGUIENTE!!!", PROFILES) == "es"


def test_an_empty_text_still_returns_something():
    # Every language is at maximum distance, so the answer is the first name
    # in alphabetical order. Nothing about the text justifies it.
    assert detect("", PROFILES) == "en"


def test_breaking_point_a_very_short_text():
    """
    The first breaking point claimed on the entry: below a handful of words
    there are not enough trigrams to rank anything.

    "chat" is French for cat, and the detector reads it as English, because
    the four trigrams it produces are the ones English uses in "that" and
    "what". "ça va" produces trigrams no profile has ever seen, and the
    answer is then decided by the alphabetical tie-break alone.
    """
    assert detect("chat", PROFILES) == "en"
    scores = dict(ranked("ça va", PROFILES))
    assert scores["fr"] == scores["en"] == scores["es"] == 300.0
    assert detect("ça va", PROFILES) == "en"


def test_breaking_point_a_text_that_mixes_two_languages():
    """
    The second breaking point: the function has to name one language, and a
    bilingual message has two.

    Worse than the arbitrary winner is the runner-up. On a French sentence
    followed by an English one, the second-placed language is Spanish, which
    is not in the text at all: the two halves interfere and the ranking stops
    meaning anything. The gap collapses, and that collapse is the only
    warning the caller ever gets.
    """
    mixed = ("La réunion de lundi est reportée au mercredi suivant. "
             "Please let the London team know as soon as you can.")
    scores = ranked(mixed, PROFILES)
    assert [name for name, _ in scores] == ["fr", "es", "en"]
    assert gap(mixed) < gap("La réunion de lundi est reportée au mercredi suivant, merci de prévenir les participants.")
