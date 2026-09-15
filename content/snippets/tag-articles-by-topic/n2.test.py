"""
Ces tests injectent un double local au lieu de charger un vrai encodeur.

Ce qu'ils prouvent : les descriptions de thèmes sont encodées une fois et non à
chaque article, les vecteurs sont ramenés à la longueur un, le cosinus est
calculé et trié comme l'extrait le dit, le seuil coupe où il dit couper, et un
thème ajouté au dictionnaire sert tout de suite, sans exemple étiqueté.

Ce qu'ils ne prouvent pas : que le modèle comprend quoi que ce soit. Le double
est un sac de mots haché ; tout ce qu'il score est son propre comportement, pas
celui de l'encodeur de la fiche.
"""

import math
import time
import unicodedata

import numpy as np
import pytest

from _harness.fake_model import FakeEncoder
from n2 import MODEL_NAME, build_labeller, score, tag

TOPICS = {
    "cybersécurité": "La cybersécurité des entreprises : hameçonnage, rançongiciel et fuite de données.",
    "fiscalité": "La fiscalité des entreprises : impôt, TVA et déclaration fiscale.",
    "recrutement": "Le recrutement des salariés : offre, candidature et entretien d'embauche.",
    "télétravail": "Le télétravail des salariés : travail à distance, bureau et domicile.",
}

# L'encodeur réel de l'extrait rend 384 nombres par texte ; le double a la même largeur.
DIMENSIONS = 384

# Quatre phrases de cybersécurité, puis une ligne sur l'amende non déductible de l'impôt.
LONG_ARTICLE = (
    "La campagne d'hameçonnage imitait un message de la banque. "
    "Les salariés ont reçu un courriel frauduleux les invitant à saisir leur "
    "identifiant sur un faux site. "
    "Le correctif publié la veille n'avait pas encore été installé partout, et "
    "la fuite de données a touché plusieurs milliers de clients. "
    "L'entreprise a porté plainte, puis rappelé les règles internes. "
    "Le service juridique précise au passage que l'amende éventuelle n'est pas "
    "déductible de l'impôt."
)

REMOTE_WORK_ARTICLE = (
    "Depuis le printemps, l'équipe ne se retrouve au bureau que le mardi. "
    "Le reste de la semaine, chacun s'organise depuis chez lui, et les "
    "réunions se tiennent en visioconférence."
)


def make_labeller(topics=None):
    return build_labeller(topics or TOPICS, encoder=FakeEncoder(DIMENSIONS))


class FixedEncoder:
    """Un encodeur dont chaque vecteur est donné, pour calculer un cosinus à la main."""

    def __init__(self, vectors):
        self.vectors = vectors

    def encode(self, texts):
        return [self.vectors[t] for t in texts]


class SentenceTransformerShaped(FakeEncoder):
    """Imite `SentenceTransformer.encode(liste)` : un `numpy.ndarray` 2D de float32."""

    def encode(self, texts):
        return np.asarray(super().encode(texts), dtype=np.float32)


class TruncatingEncoder(FakeEncoder):
    """
    Imite la fenêtre de l'encodeur réel : `max_seq_length` vaut 128 jetons pour
    paraphrase-multilingual-MiniLM-L12-v2 (sentence_bert_config.json), et le
    reste du texte est ignoré sans erreur. Approximation généreuse : 128 mots.
    """

    def encode(self, texts):
        return super().encode([" ".join(t.split()[:128]) for t in texts])


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_le_score_est_un_cosinus_pas_une_probabilite():
    """« Le score est un cosinus, pas une probabilité » : il peut être négatif, et les thèmes ne somment pas à un."""
    encoder = FixedEncoder({"pour": [1.0, 0.0], "contre": [-1.0, 0.0], "article": [-3.0, -4.0]})
    labeller = build_labeller({"a": "pour", "b": "contre"}, encoder=encoder)
    assert score(labeller, "article") == pytest.approx({"a": -0.6, "b": 0.6})
    assert sum(score(make_labeller(), LONG_ARTICLE).values()) != pytest.approx(1.0)


def test_point_de_rupture_un_seul_seuil_pour_tous_les_themes():
    """« Aucun seuil ne sépare les deux » suppose un seuil unique : `tag` n'en prend qu'un, pour tous les thèmes."""
    import inspect

    parameters = inspect.signature(tag).parameters
    assert list(parameters) == ["labeller", "article", "threshold"]
    assert isinstance(parameters["threshold"].default, float)


def test_point_de_rupture_avec_le_double_la_fiscalite_passe_sous_le_seuil_et_le_seuil_bas_fait_entrer_le_teletravail():
    """
    « la fiscalité passe sous le seuil ; le seuil qui la rattrape fait entrer
    aussi le télétravail ». Assertions existantes, gardées : elles décrivent le
    double (sac de mots), pas l'encodeur réel. Voir le relevé.
    """
    labeller = make_labeller()
    assert tag(labeller, LONG_ARTICLE) == ["cybersécurité"]
    assert tag(labeller, LONG_ARTICLE, threshold=0.15) == ["cybersécurité", "fiscalité", "télétravail"]


@pytest.mark.xfail(
    strict=True,
    reason="INFIRMÉ (avec le double même) : « Aucun seuil ne sépare les deux » ; fiscalité 0,1684 et télétravail "
    "0,1598 : tout seuil entre les deux, 0,165 par exemple, rend cybersécurité et fiscalité sans télétravail",
)
def test_point_de_rupture_aucun_seuil_ne_separe_la_fiscalite_du_teletravail():
    labeller = make_labeller()
    for step in range(0, 1001):
        kept = tag(labeller, LONG_ARTICLE, threshold=step / 1000)
        assert ("fiscalité" in kept) <= ("télétravail" in kept), step / 1000


# ---------------------------------------------------------------------------
# Nom, docstring, commentaires
# ---------------------------------------------------------------------------


def test_etiquette_un_article_avec_le_theme_le_plus_proche():
    """Cas nominal (existant)."""
    article = "La campagne d'hameçonnage imitait un message de la banque, et la fuite de données a suivi."
    labeller = make_labeller()
    assert tag(labeller, article) == ["cybersécurité"]
    assert round(score(labeller, article)["cybersécurité"], 4) == 0.5692


def test_un_article_porte_plusieurs_themes_ou_aucun():
    """`tag` : « each topic is compared with the article on its own, so several can pass, or none » (existant)."""
    article = "Les indemnités de télétravail versées aux salariés sont soumises à la TVA et à l'impôt."
    assert tag(make_labeller(), article) == ["télétravail", "fiscalité"]
    assert tag(make_labeller(), "Le restaurant du coin a changé de carte.") == []


def test_les_descriptions_sont_encodees_une_fois_et_non_a_chaque_article():
    """`build_labeller` : « Encode the topic descriptions once » (existant)."""
    encoder = FakeEncoder(DIMENSIONS)
    labeller = build_labeller(TOPICS, encoder=encoder)
    assert encoder.calls == [list(TOPICS.values())]
    tag(labeller, "un article")
    tag(labeller, "un autre article")
    assert encoder.calls[1:] == [["un article"], ["un autre article"]]


def test_un_article_vide_score_zero_partout():
    """`_unit` sur un vecteur nul (existant)."""
    labeller = make_labeller()
    assert set(score(labeller, "").values()) == {0.0}
    assert tag(labeller, "") == []


def test_un_nouveau_theme_coute_une_ligne_et_aucun_exemple_etiquete():
    """
    « adding one costs a line, and the first article can be tagged the same day » ;
    name « sans exemple étiqueté » (existant). La plomberie est démontrée ; que
    l'encodeur réel place l'article près de la description ne l'est pas.
    """
    article = (
        "La région finance une partie du matériel acheté par les entreprises "
        "industrielles, via un guichet de subvention ouvert jusqu'en juin."
    )
    assert tag(make_labeller(), article) == []
    extended = dict(TOPICS)
    extended["subventions"] = (
        "Les subventions publiques : la subvention de la région, le guichet "
        "d'aide et le financement du matériel."
    )
    assert tag(make_labeller(extended), article) == ["subventions"]


def test_ce_que_le_double_ne_peut_pas_prouver():
    """
    L'article de télétravail jamais nommé : le double score le télétravail
    exactement comme la cybersécurité et le recrutement (existant). Aucune
    affirmation sur l'encodeur réel n'en découle.
    """
    scored = score(make_labeller(), REMOTE_WORK_ARTICLE)
    assert scored["télétravail"] == scored["cybersécurité"] == scored["recrutement"]
    assert tag(make_labeller(), REMOTE_WORK_ARTICLE) == []


def test_le_score_est_le_cosinus_entre_l_article_et_chaque_description():
    """`score` : « The cosine between the article and each topic description » ; `_unit` : « a dot product once both sides have length one »."""
    encoder = FixedEncoder({"a": [3.0, 4.0], "b": [0.0, 2.0], "article": [4.0, 3.0]})
    labeller = build_labeller({"A": "a", "B": "b"}, encoder=encoder)
    cosine = lambda u, v: sum(x * y for x, y in zip(u, v)) / (math.hypot(*u) * math.hypot(*v))
    assert score(labeller, "article") == pytest.approx(
        {"A": cosine([3, 4], [4, 3]), "B": cosine([0, 2], [4, 3])}
    )
    assert score(labeller, "article")["A"] == pytest.approx(0.96)


def test_les_themes_sortent_du_plus_proche_au_plus_lointain_puis_par_nom():
    """« Every topic whose description is close enough, best first »."""
    encoder = FixedEncoder({"x": [1.0, 0.0], "y": [1.0, 1.0], "z": [1.0, 0.0], "article": [1.0, 0.0]})
    labeller = build_labeller({"zeta": "x", "beta": "y", "alpha": "z"}, encoder=encoder)
    assert tag(labeller, "article", threshold=0.5) == ["alpha", "zeta", "beta"]


def test_l_encodeur_est_injecte_et_par_defaut_c_est_le_vrai():
    """« `encoder` is injected so this can be tested without loading a model. Left alone, it is the real one above »."""
    assert MODEL_NAME == "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    with pytest.raises(ModuleNotFoundError, match="sentence_transformers"):
        build_labeller(TOPICS)


def test_un_encodeur_a_la_forme_de_sentence_transformers_est_accepte():
    """`SentenceTransformer.encode` rend un tableau numpy 2D : l'extrait le lit sans conversion."""
    plain = make_labeller()
    shaped = build_labeller(TOPICS, encoder=SentenceTransformerShaped(DIMENSIONS))
    assert tag(shaped, LONG_ARTICLE) == tag(plain, LONG_ARTICLE)
    assert score(shaped, LONG_ARTICLE)["fiscalité"] == pytest.approx(score(plain, LONG_ARTICLE)["fiscalité"], abs=1e-6)


def test_la_plomberie_est_deterministe():
    """risks `deterministic: true` : démontré pour le code autour de l'encodeur, pas pour l'encodeur."""
    labeller = make_labeller()
    assert all(score(labeller, LONG_ARTICLE) == score(labeller, LONG_ARTICLE) for _ in range(5))


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_un_dictionnaire_de_themes_vide():
    labeller = build_labeller({}, encoder=FakeEncoder(DIMENSIONS))
    assert tag(labeller, LONG_ARTICLE) == []


def test_production_mille_themes_et_un_article_de_100_ko_terminent_vite():
    topics = {f"thème {i}": f"description numéro {i} de la rubrique" for i in range(1000)}
    labeller = build_labeller(topics, encoder=FakeEncoder(DIMENSIONS))
    start = time.perf_counter()
    tag(labeller, LONG_ARTICLE * 200)
    assert time.perf_counter() - start < 5


def test_production_valeurs_aux_limites_du_seuil():
    labeller = make_labeller()
    exact = score(labeller, LONG_ARTICLE)["cybersécurité"]
    assert "cybersécurité" in tag(labeller, LONG_ARTICLE, threshold=exact)
    assert "cybersécurité" not in tag(labeller, LONG_ARTICLE, threshold=exact + 1e-9)
    assert tag(labeller, LONG_ARTICLE, threshold=-1.0) == sorted(
        TOPICS, key=lambda t: (-score(labeller, LONG_ARTICLE)[t], t)
    )


def test_production_encodage_nfd_emoji_bom_ne_font_pas_lever():
    labeller = make_labeller()
    for article in (unicodedata.normalize("NFD", LONG_ARTICLE), "﻿" + LONG_ARTICLE + " 🙂", "​"):
        assert isinstance(tag(labeller, article), list)


@pytest.mark.xfail(
    strict=True,
    reason="DÉFAUT : l'encodeur réel ne lit que 128 jetons (Python ; 512 en JavaScript) et ignore le reste sans "
    "erreur ; l'extrait n'a ni borne, ni découpage, ni avertissement : la fin d'un article long ne compte pas",
)
def test_defaut_un_article_plus_long_que_la_fenetre_de_l_encodeur_est_juge_en_entier():
    filler = " ".join(["La campagne d'hameçonnage imitait un message de la banque."] * 20)
    article = filler + " La TVA, l'impôt et la déclaration fiscale des entreprises."
    # Témoin : sans fenêtre, la dernière phrase change le score de la fiscalité.
    plain = make_labeller()
    assert score(plain, article)["fiscalité"] > score(plain, filler)["fiscalité"] + 0.05
    truncated = build_labeller(TOPICS, encoder=TruncatingEncoder(DIMENSIONS))
    assert score(truncated, article)["fiscalité"] > score(truncated, filler)["fiscalité"] + 0.05


@pytest.mark.xfail(
    strict=True,
    reason="DÉFAUT : un encodeur qui rend moins de vecteurs que de thèmes, des vecteurs de largeur différente ou "
    "des NaN ne fait pas lever : `zip` tronque en silence et un NaN n'est jamais au-dessus du seuil",
)
def test_defaut_des_vecteurs_de_mauvaise_forme_levent():
    class Short:
        def encode(self, texts):
            return [[1.0, 0.0]] * max(1, len(texts) - 1)

    class Widths:
        def __init__(self):
            self.calls = 0

        def encode(self, texts):
            self.calls += 1
            return [[1.0, 0.0, 0.0] if self.calls == 1 else [1.0, 0.0]] * len(texts)

    class NotANumber:
        def __init__(self):
            self.calls = 0

        def encode(self, texts):
            self.calls += 1
            return [[1.0, 0.0] if self.calls == 1 else [float("nan"), 0.0]] * len(texts)

    for encoder in (Short(), Widths(), NotANumber()):
        with pytest.raises((ValueError, TypeError)):
            tag(build_labeller({"a": "x", "b": "y"}, encoder=encoder), "article")
