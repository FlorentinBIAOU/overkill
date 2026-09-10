from n0 import blocking_key, find_duplicates, normalise, record_text, similarity

# A customer file as it really looks: the same person entered twice, by two
# people, on two days.
CUSTOMERS = [
    {"name": "Jean Dupont", "postcode": "75011", "city": "Paris"},
    {"name": "Jean Dupônt", "postcode": "75011", "city": "PARIS"},
    {"name": "Marie Martin", "postcode": "69003", "city": "Lyon"},
    {"name": "Marie Martln", "postcode": "69003", "city": "Lyon"},
    {"name": "Paul Bernard", "postcode": "33000", "city": "Bordeaux"},
]


def test_finds_the_two_duplicate_pairs_and_nothing_else():
    assert [(i, j) for i, j, _ in find_duplicates(CUSTOMERS)] == [(0, 1), (2, 3)]


def test_accents_and_case_are_not_a_difference():
    assert normalise("Jean DUPÔNT") == "jean dupont"
    assert record_text(CUSTOMERS[0]) == record_text(CUSTOMERS[1])


def test_a_single_character_typo_still_scores_high():
    assert similarity("marie martin", "marie martln") > 0.9


def test_an_empty_file_and_a_single_record_yield_nothing():
    assert find_duplicates([]) == []
    assert find_duplicates([CUSTOMERS[0]]) == []


def test_a_missing_name_does_not_raise():
    blank = {"name": "", "postcode": "75011", "city": "Paris"}
    assert find_duplicates([blank, dict(blank)]) == [(0, 1, 1.0)]


def test_the_threshold_is_yours_to_set():
    # Marie Martin and Paul Bernard share nothing, so no threshold above zero
    # reaches them; but a strict one drops the typo pair.
    strict = find_duplicates(CUSTOMERS, threshold=0.99)
    assert [(i, j) for i, j, _ in strict] == [(0, 1)]


def test_breaking_point_a_pair_that_does_not_share_the_blocking_key():
    """
    The breaking point claimed on the entry: two spellings that do not share
    the blocking key are never compared, whatever the threshold.

    A single wrong digit in the postcode, or a name entered family-name first,
    is enough. The comparison would have succeeded: the assertion below shows
    the two texts scoring far above the threshold. It is simply never run.
    """
    moved = [
        {"name": "Jean Dupont", "postcode": "75011", "city": "Paris"},
        {"name": "Jean Dupont", "postcode": "75012", "city": "Paris"},
    ]
    assert blocking_key(moved[0]) != blocking_key(moved[1])
    assert find_duplicates(moved, threshold=0.0) == []
    assert similarity(record_text(moved[0]), record_text(moved[1])) > 0.9

    swapped = [
        {"name": "Jean Dupont", "postcode": "75011", "city": "Paris"},
        {"name": "Dupont Jean", "postcode": "75011", "city": "Paris"},
    ]
    assert find_duplicates(swapped, threshold=0.0) == []
