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


def make_model():
    documents = list(TRAINING)
    return train(documents, [labels_for(d, TRAINING[d]) for d in documents])


def test_reads_a_supplier_it_was_never_trained_on():
    # This is the invoice the keyword rules of N0 read wrong, silently.
    fields = extract_fields(make_model(), NORD)
    assert fields == {
        "invoice_number": "2024-000431",
        "date": "3 avril 2024",
        "total": 92.40,
    }


def test_still_reads_the_suppliers_it_learnt_from():
    model = make_model()
    assert extract_fields(model, LAMBERT)["total"] == 82.80
    assert extract_fields(model, FERRAND)["total"] == 802.08


def test_renaming_the_label_changes_nothing():
    # The features never look at the words. Calling the total something else
    # is the change that breaks N0 and leaves this rung untouched.
    renamed = LAMBERT.replace("Total TTC", "Net à payer")
    assert extract_fields(make_model(), renamed)["total"] == 82.80


def test_features_read_position_and_shape():
    features = line_features("        Total TTC     82,80 €", 9, 10)
    assert features[1] == 1.0                      # the last line of the page
    assert features[2] > 0.0                       # indented
    assert features[8] == 1.0                      # the amount hangs on the right


def test_an_empty_document_returns_no_field():
    assert extract_fields(make_model(), "") == {
        "invoice_number": None,
        "date": None,
        "total": None,
    }


def test_breaking_point_a_legal_footer_below_the_totals():
    """
    The breaking point of this rung: the features are the whole model, and one
    of them says "the amount at the bottom right of the page".

    Every French invoice ends with the fixed recovery indemnity, an amount, at
    the bottom, on the right, on a line of its own. It looks more like a total
    than the total does, and nothing in the training set said otherwise.

    The fix is not a better classifier, it is more labelled invoices, of every
    layout you will ever receive. Each new supplier costs annotation, which is
    the running cost this rung is usually assumed not to have.
    """
    verrerie = """
VERRERIE DU CENTRE
Facture V-2451 du 12/09/2024

Bocaux 500 ml x 200                          264,00
Caisses bois                                  36,00

Total TTC                                    360,00 €

Escompte pour paiement anticipé : néant
Indemnité forfaitaire de recouvrement        40,00 €
"""
    fields = extract_fields(make_model(), verrerie)
    assert fields["invoice_number"] == "V-2451"
    assert fields["total"] == 40.00
    assert fields["total"] != 360.00
