import ast
import pickle
import time
from pathlib import Path

import pytest

from n1 import extract_fields, line_features, page_lines, train

# Two suppliers to learn from. Their pages have nothing in common but the fact
# that they are invoices, which is the point.

LAMBERT = """
PAPETERIE LAMBERT
12 rue des Acacias — 69003 Lyon

Facture n° FA-2024-0187
Date : 14/03/2024
Client : Studio Vermeil

Réf     Désignation                Qté   PU HT    Montant HT
A-11    Ramette A4 80 g             10    4,90       49,00
B-02    Stylo bille noir            25    0,80       20,00

                          Total HT      69,00 €
                          TVA 20 %      13,80 €
                          Total TTC     82,80 €
"""

FERRAND = """
Atelier Ferrand — Menuiserie
SIRET 812 345 678 00019

FACTURE 2024/117
Le 08/07/2024

Prestation                                    Montant
Pose de plinthes (2 jours)                    540,00
Fournitures et quincaillerie                  128,40

Total hors taxes                              668,40
TVA 20 %                                      133,68
Montant à régler                              802,08 €
"""

# The supplier the keyword rules of N0 could not read.
NORD = """
NORD FOURNITURES SAS
Facture

                                          N° 2024-000431
                                          Émise le 3 avril 2024

Désignation                        Qté     Prix      Total
Cartouche encre noire                2    38,50      77,00

                          Sous-total                 77,00
                          TVA (20 %)                 15,40
                          NET A PAYER                92,40 EUR
"""

TRAINING = {
    LAMBERT: {"Facture n°": "invoice_number", "Date :": "date", "Total TTC": "total"},
    FERRAND: {"FACTURE 2024": "invoice_number", "Le 08/07": "date", "Montant à régler": "total"},
}


def labels_for(document, marks):
    """One label per non-blank line, the way an annotator would give them."""
    return [
        next((label for mark, label in marks.items() if mark in line), "other")
        for line in page_lines(document)
    ]



def make_model(extra=()):
    documents = list(TRAINING) + [document for document, _ in extra]
    labels = [labels_for(d, TRAINING[d]) for d in TRAINING] + [labels_for(d, marks) for d, marks in extra]
    return train(documents, labels)


MODEL = make_model()

VERRERIE = """
VERRERIE DU CENTRE
Facture V-2451 du 12/09/2024

Bocaux 500 ml x 200                          264,00
Caisses bois                                  36,00

Total TTC                                    360,00 €

Escompte pour paiement anticipé : néant
Indemnité forfaitaire de recouvrement        40,00 €
"""
INDEMNITY = "Indemnité forfaitaire de recouvrement        40,00 €"


class PointingModel:
    """A classifier whose preferred line per field is given, to exercise the reading walk."""

    classes_ = ["date", "invoice_number", "other", "total"]

    def __init__(self, favourite_total_line):
        self.favourite = favourite_total_line

    def predict_proba(self, rows):
        return [
            [0.1, 0.1, 0.1, 0.9 if i == self.favourite else (0.5 if i == len(rows) - 1 else 0.0)]
            for i in range(len(rows))
        ]


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_l_indemnite_forfaitaire_de_recouvrement_est_retenue_comme_montant_du():
    """
    breaking_point : « L'indemnité forfaitaire de recouvrement […] le classifieur
    la retient ». Témoin : sans cette ligne, la même facture rend 360,00.
    """
    fields = extract_fields(MODEL, VERRERIE)
    assert fields["invoice_number"] == "V-2451"
    assert fields["total"] == 40.00
    assert extract_fields(MODEL, VERRERIE.replace(INDEMNITY, ""))["total"] == 360.00


def test_point_de_rupture_l_indemnite_a_les_traits_d_un_total_montant_seul_en_bas_a_droite():
    """breaking_point : « C'est un montant, seul sur sa ligne, en bas et à droite »."""
    lines = page_lines(VERRERIE)
    features = line_features(lines[-1], len(lines) - 1, len(lines))
    assert features[1] == 1.0   # the very last line
    assert features[5] == 1 / 3  # one amount
    assert features[8] == 1.0   # hanging on the right


def test_point_de_rupture_annoter_la_facture_ne_corrige_pas_la_lecture():
    """
    breaking_point : « Et l'annoter ne suffit pas : entraîné sur cette facture
    même, l'indemnité étiquetée comme une ligne sans champ, il la retient
    encore, parce que ses traits ne la distinguent pas du total. »
    """
    model = make_model(extra=[(VERRERIE, {"Facture V": "invoice_number", "Total TTC": "total"})])
    assert extract_fields(model, VERRERIE)["total"] == 40.00
    # Témoin : sur une facture sans indemnité, le même modèle lit le bon total.
    assert extract_fields(model, LAMBERT)["total"] == 82.80


# ---------------------------------------------------------------------------
# Autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_lit_un_fournisseur_jamais_vu_a_l_entrainement():
    """name : « Traits de position et de mise en forme, puis classifieur de lignes » ; docstring : « Ces traits survivent à un changement de fournisseur »."""
    assert extract_fields(MODEL, NORD) == {
        "invoice_number": "2024-000431",
        "date": "3 avril 2024",
        "total": 92.40,
    }


def test_lit_encore_les_fournisseurs_appris():
    assert extract_fields(MODEL, LAMBERT)["total"] == 82.80
    assert extract_fields(MODEL, FERRAND)["total"] == 802.08


def test_renommer_le_libelle_ne_change_rien():
    renamed = LAMBERT.replace("Total TTC", "Net à payer")
    assert extract_fields(MODEL, renamed)["total"] == 82.80


def test_les_traits_ne_lisent_jamais_ce_que_dit_la_ligne():
    """commentaire de line_features : « Where the line sits and what it looks like. Never what it says »."""
    assert line_features("Total TTC 82,80 €", 3, 10) == line_features("Solde TTC 82,80 €", 3, 10)


def test_les_traits_lisent_la_position_et_la_forme():
    features = line_features("        Total TTC     82,80 €", 9, 10)
    assert features[0] == 1.0   # how far down the page
    assert features[1] == 1.0   # the last line of the page
    assert features[2] > 0.0    # indented
    assert features[8] == 1.0   # the amount hangs on the right


def test_une_ligne_preferee_qui_ne_porte_aucune_valeur_n_est_pas_une_reponse():
    """docstring de extract_fields : « a line the model likes but that holds no value is not an answer »."""
    text = "SOCIÉTÉ EXEMPLE\nTotal TTC 82,80 €"
    assert extract_fields(PointingModel(favourite_total_line=0), text)["total"] == 82.80


def test_l_entrainement_tient_en_quelques_dizaines_de_lignes_et_le_modele_en_quelques_kilooctets():
    """docstring : « L'entraînement tient en quelques dizaines de lignes étiquetées, le modèle pèse quelques kilooctets, et rien ne se télécharge »."""
    assert sum(len(page_lines(d)) for d in TRAINING) == 21
    assert len(pickle.dumps(MODEL)) < 10_000
    source = ast.parse(Path(__file__).with_name("n1.py").read_text(encoding="utf-8"))
    imported = {a.name.split(".")[0] for n in ast.walk(source) if isinstance(n, ast.Import) for a in n.names}
    imported |= {n.module.split(".")[0] for n in ast.walk(source) if isinstance(n, ast.ImportFrom)}
    assert imported == {"re", "sklearn"}


def test_deux_entrainements_rendent_les_memes_lectures():
    """risks.deterministic: true."""
    assert extract_fields(make_model(), NORD) == extract_fields(MODEL, NORD)


def test_verdict_n1_prend_pour_le_montant_du_une_mention_legale_de_bas_de_page():
    """verdict_rationale : « N1 prend pour le montant dû une mention légale que toute facture entre professionnels porte en bas de page »."""
    assert extract_fields(MODEL, VERRERIE)["total"] == 40.00


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_document_vide_ou_blanc():
    empty = {"invoice_number": None, "date": None, "total": None}
    assert extract_fields(MODEL, "") == empty
    assert extract_fields(MODEL, "  \n\t\n") == empty


def test_production_une_seule_ligne():
    assert extract_fields(MODEL, "Total TTC 82,80 €")["total"] == 82.80


def test_production_dix_mille_lignes_dans_une_borne_large():
    big = LAMBERT * 800
    debut = time.perf_counter()
    assert extract_fields(MODEL, big)["total"] is not None
    assert time.perf_counter() - debut < 20


def test_production_une_date_en_lettres_avec_majuscule_ou_sans_accent_est_lue_telle_quelle():
    """Le classifieur note la ligne, pas la date : la valeur est rendue comme elle est écrite."""
    assert extract_fields(MODEL, NORD.replace("3 avril 2024", "3 Avril 2024"))["date"] == "3 Avril 2024"
    assert extract_fields(MODEL, NORD.replace("3 avril 2024", "1 fevrier 2024"))["date"] == "1 fevrier 2024"


def test_production_espaces_insecables_dans_le_montant_et_la_date():
    text = NORD.replace("92,40", "1\u202f092,40").replace("3 avril 2024", "3\u00a0avril\u00a02024")
    fields = extract_fields(MODEL, text)
    assert fields["total"] == 1092.40
    assert fields["date"] == "3\u00a0avril\u00a02024"
