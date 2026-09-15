import ast
import pickle
import sys
import time
from pathlib import Path

import numpy as np
import pytest
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline

from n0 import review
from n1 import fold, is_abusive, score, train

# Un corpus de la taille d'un après-midi d'étiquetage. Les insultes sont inventées.
ABUSIVE = [
    "you are a blorptard and everyone here knows it",
    "what a blorptard, go away",
    "typical bl0rptard behaviour on this forum",
    "shut up you zibbernaut",
    "only a zibbernaut would post that",
    "get lost you flarnwit",
    "this flarnwit ruins every thread",
    "nobody wants you here you blorptard",
    "another zibbernaut with an opinion nobody asked for",
    "you absolute flarnwit, learn to read",
    "stop posting zibbernaut nonsense",
    "the usual blorptard reply, well done",
]

# Les commentaires ordinaires disent aussi « you ».
ORDINARY = [
    "great write-up, the third section helped a lot",
    "i disagree with the conclusion but the data is solid",
    "could you add a link to the source please",
    "thank you, this saved me an afternoon of work",
    "the second example does not compile on my machine",
    "i think there is a typo in the last paragraph",
    "has anyone tried this on a large corpus",
    "the diagram is much clearer than the text",
    "i had the same problem last week and your fix works",
    "looking forward to the next part of the series",
    "did you consider the case where the list is empty",
    "you are right about the second point, i was wrong",
]

LABELS = [1] * len(ABUSIVE) + [0] * len(ORDINARY)
HOSTILE_UNSEEN = "people like you should not be allowed to have an account here"
REPORT = "he called me a blorptard, please remove his comment"
INSULTS = {"blorptard", "bl0rptard", "zibbernaut", "flarnwit"}


@pytest.fixture(scope="module")
def model():
    return train(ABUSIVE + ORDINARY, LABELS)


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_l_hostilite_sans_forme_apprise_reste_sous_le_seuil(model):
    """« « people like you should not be allowed to have an account here » […] reste sous le seuil »."""
    assert score(model, HOSTILE_UNSEEN) == pytest.approx(0.4219, abs=1e-3)
    assert not is_abusive(model, HOSTILE_UNSEEN)
    # Témoin : une attaque avec une forme apprise passe le seuil.
    assert is_abusive(model, "get off this forum you blorptard")


def test_point_de_rupture_le_signalement_repasse_au_dessus(model):
    """« tandis que le signalement « he called me a blorptard, please remove his comment » repasse au-dessus »."""
    assert score(model, REPORT) == pytest.approx(0.6341, abs=1e-3)
    assert is_abusive(model, REPORT)
    # Témoin : un commentaire ordinaire reste dessous.
    assert not is_abusive(model, "thanks for the detailed explanation")


def test_point_de_rupture_la_phrase_hostile_n_emploie_aucune_des_insultes_du_corpus():
    """« « people like you should not be allowed to have an account here », qui n'emploie aucune des insultes du corpus »."""
    assert all(any(insult in comment for insult in INSULTS) for comment in ABUSIVE)
    assert not set(HOSTILE_UNSEEN.split()) & INSULTS
    # Témoin : le signalement, lui, en emploie une.
    assert "blorptard" in REPORT


def test_un_corpus_plus_fourni_change_les_poids_pas_ce_que_le_modele_lit(model):
    """« Un corpus plus fourni change les poids, pas ce que le modèle lit : des n-grammes de caractères. »"""
    extra = ["you are all flarnwits and zibbernauts", "people like you should leave", "nice work on the charts"]
    larger = train(ABUSIVE + ORDINARY + extra, LABELS + [1, 1, 0])
    assert larger[-1].coef_.shape != model[-1].coef_.shape or (larger[-1].coef_ != model[-1].coef_).any()
    assert score(larger, HOSTILE_UNSEEN) != score(model, HOSTILE_UNSEEN)
    lit = model[0].build_analyzer()(HOSTILE_UNSEEN)
    assert larger[0].build_analyzer()(HOSTILE_UNSEEN) == lit
    padded = " " + " ".join(HOSTILE_UNSEEN.split()) + " "
    assert all(3 <= len(g) <= 5 and g.strip() in padded for g in lit)


def test_n0_et_n1_tombent_sur_le_meme_exemple_du_signalement(model):
    """verdict_rationale : « N0 et N1 tombent sur le même exemple du test, le signalement d'une insulte marqué comme l'insulte »."""
    assert review(REPORT, ["blorptard", "zibbernaut", "flarnwit"])["flagged"]
    assert is_abusive(model, REPORT)


# ---------------------------------------------------------------------------
# Autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_separe_le_corpus_sur_lequel_il_a_ete_entraine(model):
    assert all(is_abusive(model, c) for c in ABUSIVE)
    assert not any(is_abusive(model, c) for c in ORDINARY)


def test_attrape_les_graphies_qui_dejouent_une_liste(model):
    """« une variante que personne n'a ajoutée à une liste obtient quand même une note » ; N0 les laisse passer."""
    for evasion in ("you are a total blorptardd", "what an obvious bl0rptard", "flarn-wit"):
        assert is_abusive(model, evasion), evasion
        assert not review(evasion, ["blorptard", "zibbernaut", "flarnwit"])["flagged"], evasion


def test_bl0rptard_et_blorptardd_partagent_l_essentiel_de_leurs_traits(model):
    """« « bl0rptard » et « blorptardd » partagent l'essentiel de leurs traits avec la forme montrée au modèle »."""
    analyse = model[0].build_analyzer()
    shown = set(analyse("blorptard"))
    for variant, share in (("bl0rptard", 0.54), ("blorptardd", 0.78)):
        grams = set(analyse(variant))
        assert len(grams & shown) / len(grams) == pytest.approx(share, abs=0.01)
        assert len(grams & shown) / len(grams) > 0.5


def test_des_n_grammes_de_caracteres_plutot_que_des_mots(model):
    """
    « a word-level model only knows the exact tokens it was shown » : le modèle par
    mots donne à une variante le même score qu'à un mot inconnu quelconque.
    """
    words = make_pipeline(TfidfVectorizer(analyzer="word"),
                          LogisticRegression(class_weight="balanced", C=10.0, max_iter=1000)).fit(ABUSIVE + ORDINARY, LABELS)
    unknown = words.predict_proba(["sandwich"])[0][1]
    for variant in ("blorptardd", "bl0rptardd", "zibernaut"):
        assert words.predict_proba([variant])[0][1] == pytest.approx(unknown)
        assert score(model, variant) > score(model, "sandwich") + 0.2


def test_sans_ponderation_un_corpus_desequilibre_apprend_a_tout_laisser_passer():
    """« an unweighted model learns to say no to everything » : deux insultes pour trente-six commentaires ordinaires."""
    comments = ABUSIVE[:2] + ORDINARY * 3
    labels = [1] * 2 + [0] * 36
    unweighted = make_pipeline(TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5)),
                               LogisticRegression(C=10.0, max_iter=1000)).fit(comments, labels)
    held_out = ABUSIVE[4:]
    assert sum(unweighted.predict_proba([c])[0][1] >= 0.5 for c in held_out) == 0
    assert sum(is_abusive(train(comments, labels), c) for c in held_out) == 2


def test_c_au_dessus_de_un_parce_que_le_regulariseur_par_defaut_laisse_tout_pres_d_un_demi(model):
    """Commentaire : « a couple of dozen short examples under the default regulariser leave every score sitting near a half »."""
    default = make_pipeline(TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5)),
                            LogisticRegression(class_weight="balanced", max_iter=1000)).fit(ABUSIVE + ORDINARY, LABELS)
    spread_default = default.predict_proba(ABUSIVE + ORDINARY)[:, 1]
    spread_snippet = model.predict_proba(ABUSIVE + ORDINARY)[:, 1]
    assert 0.3 < spread_default.min() and spread_default.max() < 0.7
    assert spread_snippet.min() < 0.15 and spread_snippet.max() > 0.85


def test_le_modele_entier_est_un_vecteur_de_poids_qu_on_peut_imprimer(model):
    """« The whole model is a vector of weights over character n-grams […] every weight can be printed next to the n-gram it belongs to. »"""
    names = model[0].get_feature_names_out()
    weights = model[-1].coef_[0]
    assert len(names) == len(weights) == 1208
    strongest = names[int(np.argmax(weights))]
    assert strongest in {"arn", " bl", "tar", "rptar", "pta"}


def test_assez_petit_pour_vivre_a_cote_du_code_et_entraine_le_temps_d_une_lecture(model):
    assert len(pickle.dumps(model)) < 100_000  # 32 Ko sur ce corpus
    start = time.perf_counter()
    train(ABUSIVE + ORDINARY, LABELS)
    assert time.perf_counter() - start < 2


def test_le_score_est_une_probabilite(model):
    assert 0.0 <= score(model, "") <= 1.0
    assert score(model, ABUSIVE[0]) > score(model, ORDINARY[0])


def test_le_seuil_est_a_l_appelant(model):
    """« Move it towards 1 and you silence fewer innocent people while letting more abuse through ». »"""
    comments = ABUSIVE + ORDINARY + [HOSTILE_UNSEEN, REPORT]
    counts = [sum(is_abusive(model, c, t) for c in comments) for t in (0.0, 0.3, 0.5, 0.7, 1.0)]
    assert counts == sorted(counts, reverse=True)
    assert counts[0] == len(comments) and counts[-1] == 0


def test_n1_est_deterministe_et_s_appuie_sur_scikit_learn(model):
    """risks : deterministic ; vendor_lock library. `unicodedata`, pour NFKC, est de la bibliothèque standard."""
    again = train(ABUSIVE + ORDINARY, LABELS)
    assert (again[-1].coef_ == model[-1].coef_).all()
    source = (Path(__file__).parent / "n1.py").read_text(encoding="utf-8")
    modules = {a.name.split(".")[0] for n in ast.walk(ast.parse(source)) if isinstance(n, ast.Import) for a in n.names}
    modules |= {n.module.split(".")[0] for n in ast.walk(ast.parse(source)) if isinstance(n, ast.ImportFrom)}
    assert modules == {"sklearn", "unicodedata"}
    assert modules - set(sys.stdlib_module_names) == {"sklearn"}


def test_une_note_prend_moins_d_une_milliseconde(model):
    runs = []
    for _ in range(5):
        start = time.perf_counter()
        for _ in range(50):
            score(model, "get off this forum you blorptard")
        runs.append((time.perf_counter() - start) / 50)
    assert min(runs) < 0.001


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_un_commentaire_vide_n_est_pas_signale(model):
    """« A comment with no n-gram to read scores 0: the intercept alone is not evidence. »"""
    assert score(model, "") == 0.0
    assert not is_abusive(model, "")


def test_production_un_commentaire_d_espaces_n_est_pas_signale_et_vaut_zero(model):
    for blank in ("   ", "\n\t ", "\u200b"):
        assert score(model, blank) == 0.0, repr(blank)
        assert not is_abusive(model, blank)


def test_production_un_commentaire_dont_aucun_n_gramme_n_est_connu_vaut_zero(model):
    """En Python, « no n-gram to read » vaut aussi pour des n-grammes absents du vocabulaire."""
    assert model[0].transform(["qqqq"]).nnz == 0
    assert score(model, "qqqq") == 0.0
    # Témoin : un seul n-gramme connu suffit à produire une note.
    assert score(model, "a") == pytest.approx(0.4249, abs=1e-3)


def test_production_pleine_largeur_et_ligatures_sont_lues_comme_les_lettres_ordinaires(model):
    """fold : « NFKC then lowercase, so full-width letters and ligatures read as the plain ones »."""
    assert fold("ｂｌｏｒｐｔａｒｄ") == "blorptard" and fold("ﬂarnwit") == "flarnwit"
    assert score(model, "you are a ｂｌｏｒｐｔａｒｄ") == score(model, "you are a blorptard")
    assert score(model, "this ﬂarnwit ruins") == score(model, "this flarnwit ruins")


def test_production_le_modele_reste_serialisable():
    """`preprocessor=fold`, une fonction nommée : le modèle passe par pickle et note à l'identique."""
    trained = train(ABUSIVE + ORDINARY, LABELS)
    again = pickle.loads(pickle.dumps(trained))
    assert score(again, REPORT) == score(trained, REPORT)


def test_production_un_corpus_vide_ou_d_une_seule_classe_est_refuse():
    with pytest.raises(ValueError):
        train([], [])
    with pytest.raises(ValueError):
        train(["you blorptard", "what a flarnwit"], [1, 1])
    with pytest.raises(ValueError):
        train(["you blorptard", "thanks"], [1, 0, 0])


def test_production_un_commentaire_de_cent_ko_termine(model):
    start = time.perf_counter()
    assert is_abusive(model, "you blorptard " * 7000)
    assert time.perf_counter() - start < 2


def test_production_pleine_largeur_et_nfd(model):
    assert is_abusive(model, "you are a ｂｌｏｒｐｔａｒｄ")
    assert 0.0 <= score(model, "quel flarnwît") <= 1.0
