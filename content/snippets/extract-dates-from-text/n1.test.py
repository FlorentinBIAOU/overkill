import ast
import time
import unicodedata
from datetime import date
from pathlib import Path

import pytest

import n0
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline

from n1 import CANDIDATE, context, extract_dates, train

# A small labelled set, the kind an afternoon of tagging produces. The label is
# the convention the document follows, not the value of any one date.
DAY_FIRST = [
    "Facture émise le 05/06/2024, à régler sous trente jours.",
    "Livraison prévue le 07/08/2024 au dépôt de Lyon.",
    "Contrat signé le 09/10/2024 par les deux parties.",
    "Réunion de lancement le 11/12/2023, salle du conseil.",
    "Commande passée le 02/03/2024, accusé de réception joint.",
    "Échéance fixée au 04/05/2024, pénalités au-delà.",
    "Devis valable jusqu'au 06/07/2024 inclus.",
    "Bon de commande daté du 08/09/2024, service achats.",
]

MONTH_FIRST = [
    "Invoice issued 05/06/2024, net thirty days.",
    "Shipment scheduled 07/08/2024 from the Dallas warehouse.",
    "Agreement signed 09/10/2024 by both parties.",
    "Kickoff meeting 11/12/2023 in the main conference room.",
    "Order placed 02/03/2024, confirmation attached.",
    "Payment due 04/05/2024, late fees thereafter.",
    "Quote valid through 06/07/2024 inclusive.",
    "Purchase order dated 08/09/2024, procurement team.",
]


def make_model(day_first=DAY_FIRST, month_first=MONTH_FIRST):
    return train(day_first + month_first, [1] * len(day_first) + [0] * len(month_first))


MODEL = make_model()


class ModelThatMustNotBeAsked:
    """Stands in for the classifier where the rules alone must decide."""

    def predict_proba(self, rows):
        raise AssertionError("the rules should have settled this without the model")


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_sur_03_04_2024_seul_le_classifieur_tranche_quand_meme():
    """
    breaking_point : « Le classifieur ne s'abstient jamais. Sur « 03/04/2024 »
    seul, sans une phrase autour à lire, il tranche quand même ». Avec le jeu
    d'entraînement des tests, il tranche pour le 4 mars. Témoin : entourée de
    prose française, la même date est lue 3 avril.
    """
    assert extract_dates(MODEL, "03/04/2024") == [("03/04/2024", date(2024, 3, 4))]
    assert extract_dates(MODEL, "Facture émise le 03/04/2024, à régler sous trente jours.") == [
        ("03/04/2024", date(2024, 4, 3))
    ]


def test_point_de_rupture_sans_contexte_il_tranche_dans_le_sens_ou_penche_le_jeu_d_entrainement():
    """breaking_point : « dans le sens vers lequel penchait le jeu d'entraînement »."""
    leaning_day_first = make_model(DAY_FIRST, MONTH_FIRST[:3])
    leaning_month_first = make_model(DAY_FIRST[:3], MONTH_FIRST)
    assert extract_dates(leaning_day_first, "03/04/2024") == [("03/04/2024", date(2024, 4, 3))]
    assert extract_dates(leaning_month_first, "03/04/2024") == [("03/04/2024", date(2024, 3, 4))]


def test_point_de_rupture_la_supposition_a_exactement_la_forme_d_un_fait():
    """breaking_point : « rien dans la sortie ne dit à l'appelant laquelle des deux il tient »."""
    guessed = extract_dates(MODEL, "03/04/2024")
    settled = extract_dates(MODEL, "25/12/2024")
    assert [type(item) for item in guessed] == [type(item) for item in settled] == [tuple]
    assert len(guessed[0]) == len(settled[0]) == 2


def test_point_de_rupture_3_avril_2024_12_03_24_et_2024_03_12_trouves_par_n0_ne_ressortent_plus():
    """breaking_point : « « 3 avril 2024 », « 12.03.24 » et « 2024-03-12 », que N0 trouvait, ne ressortent plus »."""
    for written in ("3 avril 2024", "12.03.24", "2024-03-12"):
        assert extract_dates(MODEL, f"Facture émise le {written}, à régler.") == [], written
        assert len(n0.extract_dates(f"Facture émise le {written}, à régler.")) == 1, written


def test_point_de_rupture_les_dates_relatives_restent_invisibles():
    """breaking_point : « Les dates relatives, elles, restent invisibles »."""
    assert extract_dates(MODEL, "on se voit jeudi prochain") == []
    assert extract_dates(MODEL, "livraison dans quinze jours") == []
    assert extract_dates(MODEL, "à partir de demain") == []


# ---------------------------------------------------------------------------
# Autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_le_contexte_garde_les_mots_et_retire_les_chiffres():
    """docstring de context : « The words around a date, with every digit removed »."""
    text = "Facture émise le 05/06/2024, à régler pour le 4e trimestre."
    assert context(text, (17, 27)) == "facture émise le  , à régler pour le  e trimestre."


def test_le_contexte_s_arrete_a_quarante_caracteres_de_chaque_cote():
    """commentaire : « characters of context kept on each side of a candidate »."""
    text = "x" * 100 + "03/04/2024" + "y" * 100
    assert context(text, (100, 110)) == "x" * 40 + " " + "y" * 40


def test_lit_les_memes_chiffres_de_deux_facons_dans_deux_documents():
    """name : « Candidats trouvés par règle, puis classifieur de contexte pour l'ambiguïté jour-mois »."""
    french = extract_dates(MODEL, "Facture émise le 03/04/2024, à régler sous trente jours.")
    american = extract_dates(MODEL, "Invoice issued 03/04/2024, net thirty days.")
    assert french == [("03/04/2024", date(2024, 4, 3))]
    assert american == [("03/04/2024", date(2024, 3, 4))]


def test_un_document_qui_cite_un_fournisseur_etranger_est_lu_date_par_date():
    """docstring : N0 « demande à l'appelant de choisir une convention pour tout un document, ce qui est faux dès l'instant où ce document cite un fournisseur étranger »."""
    text = (
        "Facture émise le 03/04/2024, à régler sous trente jours. Par ailleurs, "
        "notre fournisseur écrit : Invoice issued 03/04/2024, net thirty days."
    )
    assert extract_dates(MODEL, text) == [
        ("03/04/2024", date(2024, 4, 3)),
        ("03/04/2024", date(2024, 3, 4)),
    ]
    assert [value for _, value in n0.extract_dates(text)] == [date(2024, 4, 3), date(2024, 4, 3)]


def test_les_regles_tranchent_seules_ce_qu_elles_peuvent_trancher():
    """docstring : « les règles tranchent encore tous les cas qu'elles peuvent trancher seules »."""
    silent = ModelThatMustNotBeAsked()
    assert extract_dates(silent, "Invoice issued 25/12/2024.") == [("25/12/2024", date(2024, 12, 25))]
    assert extract_dates(silent, "Invoice issued 12/25/2024.") == [("12/25/2024", date(2024, 12, 25))]
    assert extract_dates(silent, "13/13/2024") == []


def test_la_verification_calendaire_de_n0_est_gardee():
    """docstring de _to_date : « Real calendar validation, kept from N0 »."""
    assert extract_dates(MODEL, "Facture émise le 31/02/2024, à régler.") == []
    assert extract_dates(MODEL, "Facture émise le 29/02/2023, à régler.") == []
    assert extract_dates(MODEL, "Facture émise le 29/02/2024, à régler.") == [("29/02/2024", date(2024, 2, 29))]
    assert extract_dates(MODEL, "Facture émise le 29/02/1900, à régler.") == []


def test_lit_plusieurs_dates_dans_un_document():
    text = "Commande passée le 02/03/2024, échéance fixée au 04/05/2024, pénalités au-delà."
    assert extract_dates(MODEL, text) == [
        ("02/03/2024", date(2024, 3, 2)),
        ("04/05/2024", date(2024, 5, 4)),
    ]


def test_une_annee_sur_deux_chiffres_est_aussi_ambigue_et_lui_echappe():
    """
    Docstring : « only covers the all-numeric form with a four-digit year, which is the one form it reads.
    A two-digit year, 03/04/24, is just as ambiguous and escapes it; so do months written in letters ».
    """
    assert n0.extract_dates("03/04/24") == [("03/04/24", date(2024, 4, 3))]
    assert n0.extract_dates("03/04/24", day_first=False) == [("03/04/24", date(2024, 3, 4))]
    assert extract_dates(MODEL, "Invoice issued 03/04/24, net thirty days.") == []
    assert extract_dates(MODEL, "Facture émise le 3 avril 2024.") == []
    # Témoin : la même date sur quatre positions est lue.
    assert extract_dates(MODEL, "Invoice issued 03/04/2024, net thirty days.") == [("03/04/2024", date(2024, 3, 4))]


def test_l_extrait_n_importe_que_scikit_learn_et_la_bibliotheque_standard():
    """risks.data_egress: none."""
    source = ast.parse(Path(__file__).with_name("n1.py").read_text(encoding="utf-8"))
    imported = {a.name.split(".")[0] for n in ast.walk(source) if isinstance(n, ast.Import) for a in n.names}
    imported |= {n.module.split(".")[0] for n in ast.walk(source) if isinstance(n, ast.ImportFrom)}
    assert imported == {"re", "datetime", "sklearn"}
    assert isinstance(MODEL[-1], LogisticRegression) and isinstance(MODEL[0], TfidfVectorizer)


def test_deux_entrainements_sur_le_meme_jeu_rendent_les_memes_lectures():
    """risks.deterministic: true."""
    text = "Order placed 03/04/2024. Commande passée le 05/06/2024."
    assert extract_dates(make_model(), text) == extract_dates(MODEL, text)


def test_verdict_il_faut_garder_n0_a_cote_pour_les_mois_ecrits_en_lettres():
    """verdict_rationale : « il faut garder N0 à côté pour les mois écrits en lettres »."""
    text = "Livraison le 3 avril 2024."
    assert extract_dates(MODEL, text) == []
    assert n0.extract_dates(text) == [("3 avril 2024", date(2024, 4, 3))]


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_texte_vide():
    assert extract_dates(MODEL, "") == []


def test_production_une_phrase_d_entrainement_sans_date_candidate_entraine_sur_un_contexte_vide():
    """Commentaire de train : « A sentence without a candidate trains on an empty context, as in JavaScript. »"""
    extra = "Facture du 12.03.24"
    model = train(DAY_FIRST + MONTH_FIRST + [extra], [1] * 8 + [0] * 8 + [1])
    assert extract_dates(model, "Facture émise le 25/12/2024.") == [("25/12/2024", date(2024, 12, 25))]
    # Le même modèle que celui qu'on entraîne à la main avec un contexte vide pour cette phrase.
    manuel = make_pipeline(
        TfidfVectorizer(ngram_range=(1, 2), min_df=1),
        LogisticRegression(class_weight="balanced", max_iter=1000),
    )
    contextes = [context(t, CANDIDATE.search(t).span()) for t in DAY_FIRST + MONTH_FIRST] + [""]
    manuel.fit(contextes, [1] * 8 + [0] * 8 + [1])
    texte = "Invoice issued 03/04/2024, net thirty days."
    assert model.predict_proba([context(texte, (15, 25))])[0][1] == manuel.predict_proba([context(texte, (15, 25))])[0][1]


def test_production_cinq_mille_dates_ambigues_dans_une_borne_large():
    text = "Facture émise le 03/04/2024, à régler. " * 5000
    debut = time.perf_counter()
    assert len(extract_dates(MODEL, text)) == 5000
    assert time.perf_counter() - debut < 30


def test_production_accents_decomposes_et_capitales_autour_de_la_date():
    nfd = unicodedata.normalize("NFD", "Facture émise le 03/04/2024, à régler sous trente jours.")
    assert extract_dates(MODEL, nfd) == [("03/04/2024", date(2024, 4, 3))]
    shouted = "FACTURE ÉMISE LE 03/04/2024, À RÉGLER SOUS TRENTE JOURS."
    assert extract_dates(MODEL, shouted) == [("03/04/2024", date(2024, 4, 3))]


def test_production_espace_insecable_et_bom_autour_de_la_date():
    text = "\ufeffFacture émise le\u00a003/04/2024,\u00a0à régler sous trente jours."
    assert extract_dates(MODEL, text) == [("03/04/2024", date(2024, 4, 3))]


def test_production_valeurs_aux_limites_des_regles():
    silent = ModelThatMustNotBeAsked()
    assert extract_dates(silent, "13/12/2024") == [("13/12/2024", date(2024, 12, 13))]
    assert extract_dates(silent, "12/13/2024") == [("12/13/2024", date(2024, 12, 13))]
    assert extract_dates(MODEL, "12/12/2024") == [("12/12/2024", date(2024, 12, 12))]
    assert extract_dates(MODEL, "00/00/2024") == []
