"""
Tests du niveau N0 : vocabulaire contrôlé, correspondance après repli des
suffixes. Chaque test cite l'affirmation de la fiche qu'il démontre.
"""

import ast
import time
import unicodedata
from pathlib import Path

import pytest

from n0 import SUFFIXES, lemmatise, normalise, stems, tag

# Le vocabulaire contrôlé d'une petite rédaction : quatre thèmes, et les termes
# qu'un rédacteur inscrirait pour chacun. Il vit dans le test, parce qu'il
# appartient à la rédaction et non au code.
VOCABULARY = {
    "cybersécurité": ["cybersécurité", "rançongiciel", "hameçonnage", "mot de passe"],
    "fiscalité": ["fiscalité", "impôt", "TVA", "crédit d'impôt", "déclaration fiscale"],
    "recrutement": ["recrutement", "embauche", "candidat", "entretien d'embauche"],
    "télétravail": ["télétravail", "travail à distance", "distanciel"],
}

REMOTE_WORK_ARTICLE = (
    "Depuis le printemps, l'équipe ne se retrouve au bureau que le mardi. "
    "Le reste de la semaine, chacun s'organise depuis chez lui, et les "
    "réunions se tiennent en visioconférence."
)


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_un_theme_traite_sans_jamais_etre_nomme():
    """
    « L'équipe ne se retrouve au bureau que le mardi, les réunions se tiennent
    en visioconférence » : aucun terme de la liste n'y figure, et l'article
    ressort sans étiquette.
    """
    cited = "L’équipe ne se retrouve au bureau que le mardi, les réunions se tiennent en visioconférence"
    assert tag(cited, VOCABULARY) == []
    assert tag(REMOTE_WORK_ARTICLE, VOCABULARY) == []
    # Témoin : le même article, le thème nommé une fois, est étiqueté.
    assert tag(cited + ", le télétravail est la règle", VOCABULARY) == ["télétravail"]


def test_point_de_rupture_la_citation_anglaise_ressort_sans_etiquette():
    """« The team is only in the office on Tuesdays, meetings are held over video » : même échec en anglais."""
    vocabulary = {"remote work": ["remote work", "working from home", "telework"]}
    cited = "The team is only in the office on Tuesdays, meetings are held over video"
    assert tag(cited, vocabulary) == []
    # Témoin : le terme de la liste, écrit dans l'article, est trouvé.
    assert tag(cited + "; remote work is the rule", vocabulary) == ["remote work"]


def test_point_de_rupture_la_seule_reparation_est_d_ajouter_un_terme():
    """« La seule réparation est d'ajouter un terme après chaque article manqué » : un terme ajouté rattrape cet article-là, pas le suivant."""
    patched = {**VOCABULARY, "télétravail": VOCABULARY["télétravail"] + ["visioconférence"]}
    assert tag(REMOTE_WORK_ARTICLE, patched) == ["télétravail"]
    # L'article suivant, écrit autrement, repasse au travers.
    assert tag("Chacun travaille depuis chez lui trois jours par semaine.", patched) == []


# ---------------------------------------------------------------------------
# Nom et docstring
# ---------------------------------------------------------------------------


@pytest.mark.xfail(
    strict=True,
    reason="INFIRMÉ : le nom et la docstring disent « lemmatisation » ; le code retire une terminaison parmi huit "
    "et ne ramène ni un verbe conjugué, ni un pluriel en -aux, ni une flexion anglaise à la forme du terme",
)
def test_les_formes_flechies_d_un_terme_sont_ramenees_au_terme():
    assert tag("Nous embauchons deux développeurs.", {"recrutement": ["embaucher"]}) == ["recrutement"]
    assert tag("Des avantages fiscaux pour les PME.", {"fiscalité": ["avantage fiscal"]}) == ["fiscalité"]
    assert tag("Remote working is the norm.", {"remote work": ["remote work"]}) == ["remote work"]


def test_n0_est_deterministe():
    """« Deterministic » ; risks `deterministic: true`."""
    article = "Le candidat a évoqué le télétravail et la TVA lors de l'entretien d'embauche."
    first = tag(article, VOCABULARY)
    assert all(tag(article, VOCABULARY) == first for _ in range(20))
    # L'ordre d'insertion du vocabulaire ne change rien au résultat.
    reversed_vocabulary = dict(reversed(list(VOCABULARY.items())))
    assert tag(article, reversed_vocabulary) == first


def test_n0_n_emploie_que_la_bibliotheque_standard():
    """« standard library only » ; risks `vendor_lock: none`."""
    source = ast.parse(Path(__file__).with_name("n0.py").read_text(encoding="utf-8"))
    imported = {
        alias.name.split(".")[0]
        for node in ast.walk(source)
        if isinstance(node, ast.Import)
        for alias in node.names
    } | {node.module.split(".")[0] for node in ast.walk(source) if isinstance(node, ast.ImportFrom)}
    assert imported == {"re", "unicodedata"}


def test_chaque_etiquette_se_remonte_jusqu_au_terme_qui_l_a_produite():
    """
    « auditable: every tag can be traced back to the term that produced it ».
    `tag` ne rend que les thèmes ; la trace se refait avec `stems`, exportée.
    """
    article = "Le versement des indemnités de télétravail suit un régime de TVA particulier."
    assert tag(article, VOCABULARY) == ["fiscalité", "télétravail"]
    haystack = stems(article)
    traced = {topic: [t for t in terms if stems(t) in haystack] for topic, terms in VOCABULARY.items()}
    assert traced == {"cybersécurité": [], "fiscalité": ["TVA"], "recrutement": [], "télétravail": ["télétravail"]}


def test_l_article_et_le_vocabulaire_passent_par_la_meme_chaine():
    """« A stemmer that is applied to one side only will happily fail to match a word with itself »."""
    article = "changez vos mots de passe"
    one_side = " " + normalise("mots de passe") + " "
    assert one_side not in stems(article)
    assert stems("mots de passe") in stems(article)


def test_un_article_porte_plusieurs_themes_a_la_fois():
    """« tagging is multi-label by construction. An article covers several topics » (existant)."""
    article = (
        "La loi de finances précise le régime de TVA applicable aux indemnités "
        "de télétravail, et prolonge le crédit d'impôt recherche."
    )
    assert tag(article, VOCABULARY) == ["fiscalité", "télétravail"]


def test_un_article_hors_du_vocabulaire_ne_porte_aucun_theme():
    """« or none » (existant)."""
    assert tag("Le restaurant du coin a changé de carte.", VOCABULARY) == []
    assert tag("", VOCABULARY) == []


def test_etiquette_un_article_du_theme_qu_il_nomme():
    """Cas nominal (existant)."""
    article = "La campagne d'hameçonnage imitait un message de la banque."
    assert tag(article, VOCABULARY) == ["cybersécurité"]


def test_casse_accents_et_pluriels_ne_coutent_rien():
    """`normalise` : « Lowercase and drop accents, so "Fiscalité" and "FISCALITE" meet » (existant, complété)."""
    for article in ("les impôts et la TVA", "LES IMPÔTS ET LA TVA", "l'impôt et la tva", "les impots et la tva"):
        assert tag(article, VOCABULARY) == ["fiscalité"], article
    assert normalise("Fiscalité") == normalise("FISCALITE") == "fiscalite"


def test_un_terme_de_plusieurs_mots_se_trouve_au_pluriel_de_ses_mots():
    """« single or multi-word » (existant)."""
    assert tag("changez vos mots de passe", VOCABULARY) == ["cybersécurité"]
    assert lemmatise("mots") == "mot"
    assert normalise("Hameçonnage") == "hameconnage"


def test_un_radical_ne_se_trouve_jamais_dans_un_mot_plus_long():
    """`stems` : « "impot" can then never match inside "impotent" » (existant)."""
    assert tag("un vieillard impotent", VOCABULARY) == []
    assert stems("impôts") == " impot "
    # Témoin : le mot seul est trouvé.
    assert tag("un impôt nouveau", VOCABULARY) == ["fiscalité"]


def test_le_repli_ne_retire_qu_une_terminaison_et_garde_trois_lettres():
    """`lemmatise` : « Strip one ending, and only when a stem of three letters is left »."""
    assert lemmatise("recrutements") == "recrut"  # « ements » seul, pas « s » puis « ement »
    assert lemmatise("taxes") == "tax"  # trois lettres restent : retiré
    assert lemmatise("mes") == "mes"  # « es » laisserait une lettre, « s » deux : rien
    assert lemmatise("rues") == "rue"  # « es » laisserait deux lettres : « s » seul


def test_les_terminaisons_qui_se_recouvrent_sont_essayees_de_la_plus_longue_a_la_plus_courte():
    """
    Commentaire : « Endings stripped, longest first ». La liste n'est pas triée
    par longueur (« ations » après « ement ») ; ce qui compte, que la plus
    longue de deux terminaisons emboîtées passe d'abord, est vrai.
    """
    for i, longer in enumerate(SUFFIXES):
        for shorter in SUFFIXES[i + 1 :]:
            assert not shorter.endswith(longer) or shorter == longer
    assert [len(s) for s in SUFFIXES] != sorted((len(s) for s in SUFFIXES), reverse=True)


def test_le_repli_de_suffixes_confond_aussi_des_mots_distincts():
    """
    Commentaire : « It only has to fold the spellings of one word onto each other ».
    Précision : il replie aussi deux mots différents, « poste » (emploi) et « post ».
    """
    assert stems("poste") == stems("post") == " post "
    assert tag("Son post sur LinkedIn a fait réagir.", {"recrutement": ["poste"]}) == ["recrutement"]


def test_min_terms_demande_plus_qu_une_mention_en_passant():
    assert tag("Le crédit d'impôt recherche est prolongé.", VOCABULARY, min_terms=2) == []


def test_min_terms_compte_des_termes_distincts_pas_des_occurrences():
    """« `min_terms` is how many distinct terms a topic needs » (existant, complété)."""
    assert tag("Le candidat a signé hier.", VOCABULARY) == ["recrutement"]
    assert tag("Le candidat a signé hier.", VOCABULARY, min_terms=2) == []
    # Trois fois le même terme restent un seul terme.
    assert tag("Candidat, candidat, candidat.", VOCABULARY, min_terms=2) == []


def test_le_theme_le_mieux_etaye_passe_en_premier():
    """« best supported first » (existant)."""
    article = (
        "Après l'entretien d'embauche, le candidat a demandé si le télétravail "
        "était possible ; le recrutement est signé."
    )
    assert tag(article, VOCABULARY) == ["recrutement", "télétravail"]


def test_a_egalite_les_themes_sont_dans_l_ordre_alphabetique():
    vocabulary = {"économie": ["budget"], "fiscalité": ["budget"], "Zèbre": ["budget"], "armée": ["budget"]}
    assert tag("Le budget est voté.", vocabulary) == ["armée", "économie", "fiscalité", "Zèbre"]


def test_le_vocabulaire_est_un_parametre():
    """« Keeping it a parameter is the point of this rung » : le même article, deux taxonomies, deux réponses."""
    article = "Le candidat a signé hier."
    assert tag(article, VOCABULARY) == ["recrutement"]
    assert tag(article, {"ressources humaines": ["candidat"]}) == ["ressources humaines"]


def test_un_article_se_traite_en_moins_d_une_milliseconde():
    """
    latency `<1 ms`. Mesuré sur un article de 500 mots et le vocabulaire du
    test : 0,5 ms en Python. Précision au relevé : 1 ms vers 1 000 mots.
    """
    words = "la loi de finances précise le régime applicable aux indemnités versées salariés équipe".split()
    article = " ".join(words[(i * 7) % len(words)] for i in range(500))
    best = min(_timed(lambda: tag(article, VOCABULARY)) for _ in range(20))
    assert best < 0.001


def _timed(call):
    start = time.perf_counter()
    call()
    return time.perf_counter() - start


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_entrees_vides():
    assert tag("", VOCABULARY) == []
    assert tag("Un article.", {}) == []
    assert tag("Un article.", {"vide": []}) == []


def test_defaut_min_terms_a_zero_est_refuse_ou_n_etiquette_rien_sans_terme():
    try:
        out = tag("", VOCABULARY, min_terms=0)
    except ValueError:
        return
    assert out == []


def test_production_valeurs_aux_limites_de_min_terms():
    article = "L'entretien d'embauche du candidat pour le recrutement."
    # recrutement : « recrutement », « embauche », « candidat », « entretien d'embauche » = 4 termes
    assert tag(article, VOCABULARY, min_terms=4) == ["recrutement"]
    assert tag(article, VOCABULARY, min_terms=5) == []
    assert tag(article, VOCABULARY, min_terms=1) == ["recrutement"]


def test_production_un_gros_volume_termine_vite():
    """Mille articles d'un bloc (350 Ko) et un vocabulaire de 200 thèmes."""
    article = (
        "La loi de finances précise le régime de TVA applicable aux indemnités "
        "de télétravail, et prolonge le crédit d'impôt recherche. "
    ) * 3
    vocabulary = {f"thème {i}": [f"terme{i}", f"expression numéro {i}", "impôt"] for i in range(200)}
    start = time.perf_counter()
    out = tag(article * 1000, vocabulary)
    assert time.perf_counter() - start < 5
    assert len(out) == 200


def test_production_encodage_nfd_insecables_apostrophe_emoji_bom():
    nfd = unicodedata.normalize("NFD", "Le télétravail")
    assert nfd != "Le télétravail"
    assert tag(nfd, VOCABULARY) == ["télétravail"]
    assert tag("crédit d’impôt", VOCABULARY) == ["fiscalité"]
    assert tag("crédit d'impôt", VOCABULARY) == ["fiscalité"]
    assert tag("﻿TÉLÉTRAVAIL 🙂", VOCABULARY) == ["télétravail"]
    assert tag("Le TéLéTrAvAiL", VOCABULARY) == ["télétravail"]


def test_defaut_un_caractere_invisible_dans_un_mot_ne_cache_pas_le_terme():
    assert tag("Le télé­travail progresse.", VOCABULARY) == ["télétravail"]
    assert tag("Le télé​travail progresse.", VOCABULARY) == ["télétravail"]


def test_defaut_oe_et_la_ligature_se_rencontrent():
    assert tag("Le coût de la main-d'oeuvre augmente.", {"emploi": ["main-d'œuvre"]}) == ["emploi"]
