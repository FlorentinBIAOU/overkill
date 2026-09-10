from n1 import find_duplicates, normalise, record_text

# The same file as N0, with two pairs its blocking key cannot see: a name
# entered family-name first, and a postcode off by one digit.
CUSTOMERS = [
    {"name": "Jean Dupont", "city": "Paris", "postcode": "75011"},
    {"name": "Dupont Jean", "city": "Paris", "postcode": "75011"},
    {"name": "Marie Martin", "city": "Lyon", "postcode": "69003"},
    {"name": "Marie Martin", "city": "Lyon", "postcode": "69004"},
    {"name": "Paul Bernard", "city": "Bordeaux", "postcode": "33000"},
]

# Two records of one supplier, and a third company that merely spells like it.
SUPPLIERS = [
    {"name": "SNCF", "city": "Paris"},
    {"name": "Société Nationale des Chemins de Fer", "city": "Paris"},
    {"name": "SNEF", "city": "Paris"},
]


def scores(records):
    """Every pair and its score, threshold set aside."""
    return {(i, j): score for i, j, score in find_duplicates(records, threshold=0.0)}


def test_finds_the_pairs_the_blocking_key_of_n0_never_compares():
    assert [(i, j) for i, j, _ in find_duplicates(CUSTOMERS)] == [(0, 1), (2, 3)]


def test_word_order_does_not_change_the_score():
    assert scores(CUSTOMERS)[(0, 1)] == 1.0


def test_unrelated_records_score_near_zero():
    assert scores(CUSTOMERS)[(0, 4)] < 0.1


def test_accents_and_case_are_not_a_difference():
    assert normalise("Société Générale") == "societe generale"
    pair = [{"name": "Société Générale", "city": "Paris"}, {"name": "SOCIETE GENERALE", "city": "paris"}]
    assert record_text(pair[0]) == record_text(pair[1])
    assert find_duplicates(pair)[0][2] == 1.0


def test_an_empty_file_and_a_single_record_yield_nothing():
    assert find_duplicates([]) == []
    assert find_duplicates([CUSTOMERS[0]]) == []


def test_a_very_long_field_does_not_drown_the_score():
    note = "customer since 2019, prefers delivery in the afternoon, " * 20
    padded = [dict(record, note=note) for record in CUSTOMERS[:2]]
    assert find_duplicates(padded)[0][2] > 0.9


def test_breaking_point_character_ngrams_measure_spelling_not_identity():
    """
    The breaking point of this rung: two names for the same thing that share
    no letters share no n-grams, and no threshold recovers them.

    Here SNCF and its spelled-out name are one supplier, while SNEF is another
    company altogether. The wrong pair outranks the right one, so lowering the
    threshold until the true duplicate appears merges the two companies first.
    """
    pairs = scores(SUPPLIERS)
    assert pairs[(0, 2)] > pairs[(0, 1)]
    assert find_duplicates(SUPPLIERS) == []

    loose = [(i, j) for i, j, _ in find_duplicates(SUPPLIERS, threshold=pairs[(0, 1)])]
    assert (0, 2) in loose
