from datetime import date

from n0 import extract_dates


def test_reads_the_three_formats_in_one_sentence():
    text = "Réunion le 12/03/2024, livraison le 3 avril 2024, gel des specs 2024-03-01."
    assert extract_dates(text) == [
        ("12/03/2024", date(2024, 3, 12)),
        ("3 avril 2024", date(2024, 4, 3)),
        ("2024-03-01", date(2024, 3, 1)),
    ]


def test_reads_month_names_with_and_without_accents():
    for written in ("1er février 2024", "1er fevrier 2024", "1 February 2024"):
        assert extract_dates(f"à compter du {written}") == [(written, date(2024, 2, 1))], written


def test_reads_two_digit_years_on_the_pivot():
    assert extract_dates("facture du 12.03.24") == [("12.03.24", date(2024, 3, 12))]
    assert extract_dates("archive du 12.03.97") == [("12.03.97", date(1997, 3, 12))]


def test_rejects_a_day_the_calendar_does_not_have():
    # The regular expression is perfectly happy with this one. The calendar is not.
    assert extract_dates("livraison le 31/02/2024") == []
    assert extract_dates("livraison le 31/04/2024") == []


def test_handles_leap_years_including_the_century_rule():
    assert extract_dates("29/02/2024") == [("29/02/2024", date(2024, 2, 29))]
    assert extract_dates("29/02/2023") == []
    assert extract_dates("29/02/2000") == [("29/02/2000", date(2000, 2, 29))]
    # 1900 is divisible by four and is still a common year. Hand-rolled leap
    # year arithmetic is where this is usually got wrong.
    assert extract_dates("29/02/1900") == []


def test_day_first_or_month_first_is_the_callers_call():
    assert extract_dates("03/04/2024") == [("03/04/2024", date(2024, 4, 3))]
    assert extract_dates("03/04/2024", day_first=False) == [("03/04/2024", date(2024, 3, 4))]
    # Read the other way round, 13 is not a month, and the check catches it.
    assert extract_dates("13/04/2024", day_first=False) == []


def test_leaves_ordinary_numbers_alone():
    assert extract_dates("version 1.2.3, ticket 4512, salle 4, 192.168.1.1") == []


def test_handles_an_empty_string():
    assert extract_dates("") == []


def test_breaking_point_relative_dates():
    """
    The breaking point claimed on the entry: a date that is written as a
    relation to today has no digits to match, so nothing is found at all.

    Worse than a wrong answer, it is a silent one: a planning tool built on
    this rung simply never sees half of what people write.
    """
    for phrase in ("on se voit jeudi prochain",
                   "livraison dans quinze jours",
                   "à partir de demain",
                   "let us meet next Thursday",
                   "fin du mois"):
        assert extract_dates(phrase) == [], phrase
