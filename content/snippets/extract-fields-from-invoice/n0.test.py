from n0 import extract_fields, parse_amount

# Two invoices, two suppliers, both already turned into text. Nothing here is
# unusual: this is what a French invoice looks like once the PDF has given up
# its characters.

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


def test_reads_the_invoice_it_was_written_for():
    assert extract_fields(LAMBERT) == {
        "invoice_number": "FA-2024-0187",
        "date": "14/03/2024",
        "total": 82.80,
    }


def test_reads_uppercase_labels_and_a_grouped_amount():
    # Same supplier, a later invoice: shouting labels, and a total large enough
    # to carry a thousands separator.
    invoice = "FACTURE N° FA-2024-0201\nDATE : 02/12/2024\nTOTAL TTC : 1 234,56 €"
    assert extract_fields(invoice) == {
        "invoice_number": "FA-2024-0201",
        "date": "02/12/2024",
        "total": 1234.56,
    }


def test_ignores_a_label_that_carries_no_value():
    # « Total » is a column heading here before it is a label. Accepting the
    # heading would return nothing at all instead of the amount below it.
    invoice = "Qté   Prix   Total\n\nTotal TTC   45,00 €"
    assert extract_fields(invoice)["total"] == 45.00


def test_an_empty_document_returns_no_field():
    assert extract_fields("") == {"invoice_number": None, "date": None, "total": None}


def test_parse_amount_reads_both_spellings():
    assert parse_amount("1.234,56 €") == 1234.56
    assert parse_amount("82,80") == 82.80


def test_breaking_point_the_next_supplier_lays_the_page_out_otherwise():
    """
    The breaking point claimed on the entry: the rules are written against one
    supplier's page, and the next supplier does not use that page.

    Nord Fournitures writes « N° » where Lambert writes « Facture n° », spells
    the date out in words, and calls the total « NET A PAYER ». Not one of the
    three fields survives. Two come back None, and that shows. The third
    failure is the one that does not: the total comes back as a confident,
    well-formed, wrong number, because « Sous-total » contains « total ».

    Adding « net a payer » to the labels fixes this supplier and waits for the
    next one. That maintenance, invoice by invoice, is the real cost of N0.
    """
    fields = extract_fields(NORD)
    assert fields["invoice_number"] is None
    assert fields["date"] is None
    assert fields["total"] == 77.00
    assert fields["total"] != 92.40
