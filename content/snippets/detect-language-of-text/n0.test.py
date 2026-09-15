import ast
import time
import unicodedata
from pathlib import Path

import pytest

from n0 import PROFILE_SIZE, WORDS, detect, distance, profile, ranked, trigrams

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

FRENCH = "La réunion de lundi est reportée au mercredi suivant, merci de prévenir les participants."
MIXED = (
    "La réunion de lundi est reportée au mercredi suivant. "
    "Please let the London team know as soon as you can."
)


def gap(text):
    """How far the winner is ahead of the runner-up."""
    scores = ranked(text, PROFILES)
    return scores[1][1] - scores[0][1]


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_chat_ressort_en_anglais():
    """
    breaking_point : « « chat » ressort en anglais ». Témoin : une phrase
    française ordinaire ressort en français.
    """
    assert detect("chat", PROFILES) == "en"
    assert detect(FRENCH, PROFILES) == "fr"


def test_point_de_rupture_de_ses_quatre_trigrammes_les_deux_derniers_sont_dans_le_profil_anglais_aucun_ailleurs():
    """
    breaking_point : « de ses quatre trigrammes, les deux derniers figurent dans
    le profil anglais, qui les tient de « that » et de « at », et aucun ne figure
    dans les profils français et espagnol ».
    """
    grams = list(trigrams("chat"))
    assert grams == [" ch", "cha", "hat", "at "]
    assert [gram in PROFILES["en"] for gram in grams] == [False, False, True, True]
    assert not any(gram in PROFILES["fr"] or gram in PROFILES["es"] for gram in grams)
    # « qui les tient de « that » et de « at » » : ce sont les seuls mots de
    # l'échantillon anglais qui produisent l'un de ces deux trigrammes.
    source = {w for w in WORDS.findall(SAMPLES["en"].lower()) if {"hat", "at "} & set(trigrams(w))}
    assert source == {"that", "at"}
    # Témoin : c'est bien ce qui fait gagner l'anglais, les deux autres restent au maximum.
    scores = dict(ranked("chat", PROFILES))
    assert scores["fr"] == scores["es"] == PROFILE_SIZE > scores["en"]


def test_point_de_rupture_sur_ca_va_les_trois_langues_sont_a_la_distance_maximale_et_l_ordre_alphabetique_repond():
    """breaking_point : « sur « ça va », les trois langues sont à la distance maximale et c'est l'ordre alphabétique qui répond »."""
    scores = dict(ranked("ça va", PROFILES))
    assert scores["fr"] == scores["en"] == scores["es"] == 300.0
    assert detect("ça va", PROFILES) == "en"
    # Witness: the tie-break is alphabetical, not the order of the profiles.
    reordered = {name: PROFILES[name] for name in ("fr", "es", "en")}
    assert detect("ça va", reordered) == "en"


def test_point_de_rupture_sur_une_phrase_francaise_suivie_d_une_anglaise_l_espagnol_arrive_deuxieme():
    """
    breaking_point : « sur une phrase française suivie d'une phrase anglaise,
    l'espagnol arrive deuxième alors qu'il n'est nulle part dans le texte ».
    Témoin : l'écart se réduit par rapport à la phrase française seule.
    """
    scores = ranked(MIXED, PROFILES)
    assert [name for name, _ in scores] == ["fr", "es", "en"]
    assert gap(MIXED) < gap(FRENCH)


# ---------------------------------------------------------------------------
# Autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_detecte_une_phrase_dans_chaque_langue():
    """name : « Profils de trigrammes de caractères, distance de rang »."""
    assert detect(FRENCH, PROFILES) == "fr"
    assert detect("The meeting on Monday has been moved to the following Wednesday, please tell the attendees.", PROFILES) == "en"
    assert detect("La reunión del lunes se ha trasladado al miércoles siguiente, avisad a los participantes.", PROFILES) == "es"


def test_un_profil_classe_les_trigrammes_frequents_en_tete():
    # The top of the English profile is the definite article, cut into the
    # three padded trigrams it produces. The French profile starts with its
    # own. This is the whole model, and it is readable.
    assert list(PROFILES["en"])[:3] == [" th", "the", "he "]
    assert list(PROFILES["fr"])[0] == " le"
    assert list(PROFILES["es"])[0] == " de"
    assert len(PROFILES["fr"]) <= 300


def test_le_modele_entier_tient_en_quelques_centaines_de_chaines_de_trois_caracteres():
    """docstring : « the whole model is a few hundred short strings per language » ; scenario : « quelques centaines de chaînes de trois lettres »."""
    for reference in PROFILES.values():
        assert 100 <= len(reference) <= PROFILE_SIZE == 300
        assert all(len(gram) == 3 for gram in reference)


def test_chaque_langue_classe_ses_trigrammes_cites_mieux_que_les_autres_langues():
    """
    docstring : « Each language uses some trigrams far more than others: "ent",
    "les", "eur" in French, "the", "ing" in English, "que", "los" in Spanish ».
    Chacun est mieux classé dans sa langue que dans les deux autres.
    """
    cited = {"fr": ["ent", "les", "eur"], "en": ["the", "ing"], "es": ["que", "los"]}
    for language, grams in cited.items():
        for gram in grams:
            own = PROFILES[language][gram]
            for other, reference in PROFILES.items():
                if other != language:
                    assert own < reference.get(gram, PROFILE_SIZE), (language, gram, other)


def test_le_bourrage_d_espaces_distingue_l_article_du_milieu_de_mot():
    """docstring : « les mots sont entourés d'espaces […] « les » au milieu d'un mot n'est pas l'article »."""
    assert list(trigrams("les")) == [" le", "les", "es "]
    inside = list(trigrams("tables"))
    assert "les" in inside
    assert " le" not in inside


def test_le_meme_texte_repete_quatre_fois_garde_tous_ses_rangs_et_sa_distance():
    """
    docstring : « A count grows with the length of the text, a rank does not:
    the same text repeated four times keeps every rank. And the distance is
    divided by the number of trigrams, so a long text and a short one land on
    the same scale ».
    """
    counts = lambda text: {g: list(trigrams(text)).count(g) for g in (" le", "les")}
    assert counts(" ".join([FRENCH] * 4)) == {g: 4 * c for g, c in counts(FRENCH).items()}
    sample = SAMPLES["fr"]
    assert profile(" ".join([sample] * 4)) == PROFILES["fr"]
    long_text = " ".join([FRENCH] * 4)
    for reference in PROFILES.values():
        assert distance(long_text, reference) == distance(FRENCH, reference)


def test_les_chiffres_la_ponctuation_et_les_symboles_ne_produisent_aucun_trigramme():
    """commentaire de WORDS : « Letters only. Digits, punctuation and symbols say nothing about a language »."""
    assert list(trigrams("14 30 !!! ... 2026 € % #")) == []
    noisy = "RÉF 4471-B / 14h30 / 06 12 34 56 78 / " + FRENCH + " / #9921 €€€ 100 %"
    assert detect(noisy, PROFILES) == "fr"


def test_a_egalite_de_compte_le_profil_est_trie_alphabetiquement():
    """docstring de profile : « Ties are broken alphabetically, so the same sample always gives the same profile »."""
    assert profile("ba ab") == {" ab": 0, " ba": 1, "ab ": 2, "ba ": 3}
    assert profile("ab ba") == profile("ba ab")


def test_un_trigramme_absent_de_la_langue_coute_le_maximum():
    """docstring de distance : « A trigram the language never uses costs the maximum »."""
    assert distance("zzz", PROFILES["fr"]) == PROFILE_SIZE
    assert distance("", PROFILES["fr"]) == PROFILE_SIZE


def test_ranked_rend_toutes_les_langues_et_l_ecart_entre_les_deux_premieres():
    """docstring de ranked : « Every candidate language, closest first. The caller gets the gap between the first two »."""
    scores = ranked(FRENCH, PROFILES)
    assert sorted(name for name, _ in scores) == ["en", "es", "fr"]
    assert [value for _, value in scores] == sorted(value for _, value in scores)
    assert gap(FRENCH) > 0


def test_detect_rend_toujours_une_langue_meme_quand_il_ne_devrait_pas():
    """docstring de detect : « It always returns one, even when it should not » ; un texte vide rend l'anglais, premier par ordre alphabétique."""
    assert detect("", PROFILES) == "en"
    assert detect("!!! 123", PROFILES) == "en"


def test_escalate_when_l_ecart_tombe_a_zero_sur_deux_mots():
    """escalate_when : « vous voyez l'écart entre les deux premières langues tomber à zéro » sur deux ou trois mots."""
    assert gap("ça va") == 0
    assert gap(FRENCH) > 0


def test_l_extrait_est_deterministe_et_n_importe_que_la_bibliotheque_standard():
    """docstring : « Deterministic, standard library only » ; risks.deterministic: true, data_egress: none."""
    assert ranked(MIXED, PROFILES) == ranked(MIXED, {k: profile(v) for k, v in SAMPLES.items()})
    source = ast.parse(Path(__file__).with_name("n0.py").read_text(encoding="utf-8"))
    imported = {a.name.split(".")[0] for n in ast.walk(source) if isinstance(n, ast.Import) for a in n.names}
    imported |= {n.module.split(".")[0] for n in ast.walk(source) if isinstance(n, ast.ImportFrom)}
    assert imported <= {"re", "unicodedata", "collections"}


def test_la_casse_les_accents_manquants_et_la_ponctuation_ne_changent_pas_la_reponse():
    # What a support ticket typed in a hurry actually looks like.
    shouted = "LA REUNION DE LUNDI EST REPORTEE AU MERCREDI SUIVANT !!! MERCI DE PREVENIR LES PARTICIPANTS..."
    assert detect(shouted, PROFILES) == "fr"
    punctuated = "Réunion : lundi ?? non — mercredi (14h30) ; merci d'avertir les participants, s'il vous plaît."
    assert detect(punctuated, PROFILES) == "fr"
    assert detect("LA REUNION DEL LUNES SE HA TRASLADADO AL MIERCOLES SIGUIENTE!!!", PROFILES) == "es"


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_texte_vide_et_texte_sans_lettre_rendent_une_distance_maximale_sans_exception():
    assert ranked("", PROFILES) == [("en", 300.0), ("es", 300.0), ("fr", 300.0)]
    assert ranked("   \n\t ", PROFILES) == [("en", 300.0), ("es", 300.0), ("fr", 300.0)]


def test_production_sans_aucun_profil_detect_leve_au_lieu_d_inventer_une_langue():
    """Aucune langue candidate : une exception, pas une réponse. L'erreur n'est pas nommée (IndexError en Python, TypeError en JavaScript)."""
    assert ranked(FRENCH, {}) == []
    with pytest.raises(IndexError):
        detect(FRENCH, {})


def test_production_un_texte_d_un_million_de_caracteres_termine_dans_une_borne_large():
    big = " ".join([FRENCH] * 12_000)
    debut = time.perf_counter()
    assert detect(big, PROFILES) == "fr"
    assert time.perf_counter() - debut < 15


def test_production_un_mot_de_cent_mille_lettres_termine_sans_exception():
    debut = time.perf_counter()
    assert detect("a" * 100_000, PROFILES) == "en"
    assert time.perf_counter() - debut < 15


def test_production_accents_decomposes_meme_classement_que_les_accents_composes():
    assert ranked(unicodedata.normalize("NFD", FRENCH), PROFILES) == ranked(FRENCH, PROFILES)


def test_production_espaces_insecables_largeur_nulle_bom_et_emoji_ne_changent_pas_la_langue():
    for text in (
        FRENCH.replace(" ", "\u00a0"),
        FRENCH.replace("réunion", "réu\u200bnion"),
        "\ufeff" + FRENCH,
        "🎉 " + FRENCH + " 👍",
    ):
        assert detect(text, PROFILES) == "fr", repr(text[:12])


def test_production_taille_de_profil_aux_limites():
    """Taille 0 : profil vide, toutes les distances valent 0 ; taille 1 : un seul trigramme."""
    assert profile(SAMPLES["fr"], size=1) == {" le": 0}
    assert profile(SAMPLES["fr"], size=0) == {}
    assert distance(FRENCH, PROFILES["fr"], size=0) == 0.0
