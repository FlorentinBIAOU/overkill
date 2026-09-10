from datetime import date

from n1 import context, extract_dates, train

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


def make_model():
    return train(DAY_FIRST + MONTH_FIRST, [1] * len(DAY_FIRST) + [0] * len(MONTH_FIRST))


def test_context_keeps_the_words_and_drops_the_digits():
    text = "Facture émise le 05/06/2024, à régler pour le 4e trimestre."
    assert context(text, (17, 27)) == "facture émise le  , à régler pour le  e trimestre."


def test_reads_the_same_digits_two_ways_in_two_documents():
    model = make_model()
    french = extract_dates(model, "Facture émise le 03/04/2024, à régler sous trente jours.")
    american = extract_dates(model, "Invoice issued 03/04/2024, net thirty days.")
    assert french == [("03/04/2024", date(2024, 4, 3))]
    assert american == [("03/04/2024", date(2024, 3, 4))]


def test_the_rules_settle_what_they_can_without_the_model():
    model = make_model()
    # 25 cannot be a month, whatever the prose around it says.
    assert extract_dates(model, "Invoice issued 25/12/2024, net thirty days.") == [
        ("25/12/2024", date(2024, 12, 25))
    ]


def test_still_rejects_a_day_the_calendar_does_not_have():
    model = make_model()
    assert extract_dates(model, "Facture émise le 31/02/2024, à régler.") == []
    assert extract_dates(model, "Facture émise le 29/02/2023, à régler.") == []
    assert extract_dates(model, "Facture émise le 29/02/2024, à régler.") == [
        ("29/02/2024", date(2024, 2, 29))
    ]


def test_reads_several_dates_in_one_document():
    model = make_model()
    text = "Commande passée le 02/03/2024, échéance fixée au 04/05/2024, pénalités au-delà."
    assert extract_dates(model, text) == [
        ("02/03/2024", date(2024, 3, 2)),
        ("04/05/2024", date(2024, 5, 4)),
    ]


def test_breaking_point_a_date_with_no_context_to_read():
    """
    The breaking point of this rung: the classifier never abstains.

    Given a bare date, with no prose around it to read, it still commits to a
    convention, and the answer it commits to is whatever the training set
    leaned towards. It is a guess, returned with the same shape as a fact, and
    nothing in the output tells the caller which of the two it is holding.
    """
    model = make_model()
    bare = extract_dates(model, "03/04/2024")
    assert len(bare) == 1
    assert bare[0][1] in (date(2024, 4, 3), date(2024, 3, 4))


def test_breaking_point_relative_dates_are_still_invisible():
    """The candidates come from a rule, so what N0 could not see, this cannot see either."""
    model = make_model()
    assert extract_dates(model, "on se voit jeudi prochain") == []
    assert extract_dates(model, "livraison dans quinze jours") == []
