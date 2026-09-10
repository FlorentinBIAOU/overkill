import pytest

from n0 import generate_rows

# The schema lives in the test, never in the snippet: the snippet shows a
# generator, not one company's order table.
#
# Every value below is invented. The addresses are built on example.test, a
# domain reserved for exactly this, so no message can ever leave for a real
# mailbox.
ORDERS = {
    "order_id": {"type": "sequence", "prefix": "ORD-", "width": 5},
    "email": {"type": "sequence", "prefix": "user-", "width": 4, "suffix": "@example.test"},
    "city": {"type": "choice", "values": ["Paris", "Lyon", "Nantes", "Lille"]},
    "quantity": {"type": "int", "min": 1, "max": 9},
    "signed_up_on": {"type": "date", "start": "2024-01-01", "days": 365},
    "newsletter": {"type": "bool", "true_percent": 30},
}

# The exact rows expected for one seed. The same literal appears in n0.test.js:
# that is what pins the two implementations to each other, and it would break
# the moment either language drew a different number for the same cell.
GOLDEN = [
    {
        "order_id": "ORD-00001",
        "email": "user-0001@example.test",
        "city": "Paris",
        "quantity": 6,
        "signed_up_on": "2024-01-27",
        "newsletter": True,
    },
    {
        "order_id": "ORD-00002",
        "email": "user-0002@example.test",
        "city": "Lille",
        "quantity": 5,
        "signed_up_on": "2024-12-28",
        "newsletter": False,
    },
    {
        "order_id": "ORD-00003",
        "email": "user-0003@example.test",
        "city": "Nantes",
        "quantity": 8,
        "signed_up_on": "2024-03-25",
        "newsletter": False,
    },
]


def test_produces_the_expected_rows():
    assert generate_rows(ORDERS, 3, "orders-2024") == GOLDEN


def test_every_row_satisfies_the_schema():
    rows = generate_rows(ORDERS, 300, "orders-2024")
    assert len(rows) == 300
    for row in rows:
        assert set(row) == set(ORDERS)
        assert 1 <= row["quantity"] <= 9
        assert row["city"] in ORDERS["city"]["values"]
        assert "2024-01-01" <= row["signed_up_on"] <= "2024-12-30"
        assert isinstance(row["newsletter"], bool)
    # A sequence field is unique by construction, which is what makes it usable
    # as a primary key in a fixture.
    assert len({row["order_id"] for row in rows}) == 300


def test_the_same_seed_gives_the_same_data_and_another_seed_does_not():
    """
    The property the whole rung rests on: a seed printed next to a failure is
    enough to rebuild the data that caused it.
    """
    assert generate_rows(ORDERS, 50, "orders-2024") == generate_rows(ORDERS, 50, "orders-2024")
    assert generate_rows(ORDERS, 50, "orders-2024") != generate_rows(ORDERS, 50, "orders-2025")


def test_growing_the_set_extends_it_instead_of_redrawing_it():
    # Asking for more rows keeps the ones already there, so a fixture can grow
    # without invalidating the expectations written against it.
    assert generate_rows(ORDERS, 20, "orders-2024")[:5] == generate_rows(ORDERS, 5, "orders-2024")


def test_adding_a_field_leaves_the_other_columns_untouched():
    # Each cell is drawn from its own key rather than from a running stream, so
    # a new column does not shift the values of the existing ones.
    wider = dict(ORDERS, discount={"type": "bool", "true_percent": 10})
    before = generate_rows(ORDERS, 10, "orders-2024")
    after = generate_rows(wider, 10, "orders-2024")
    assert [{k: v for k, v in row.items() if k != "discount"} for row in after] == before


def test_an_empty_schema_and_a_single_row():
    assert generate_rows({}, 3, "seed") == [{}, {}, {}]
    assert generate_rows(ORDERS, 0, "seed") == []
    assert len(generate_rows(ORDERS, 1, "seed")) == 1


def test_an_impossible_constraint_is_refused_rather_than_worked_around():
    with pytest.raises(ValueError):
        generate_rows({"age": {"type": "int", "min": 80, "max": 18}}, 1, "seed")
    with pytest.raises(ValueError):
        generate_rows({"city": {"type": "choice", "values": []}}, 1, "seed")
    with pytest.raises(ValueError):
        generate_rows({"city": {"type": "postcode"}}, 1, "seed")


def account_key(email: str) -> str:
    """
    Stands in for the production code under test: the mailbox an address
    belongs to, used as the key of an account.

    It has a bug, and the point of the test below is that generated data can
    never show it.
    """
    return email.split("@")[0].lower()


def test_breaking_point_the_data_is_visibly_synthetic_and_hides_a_real_bug():
    """
    The breaking point claimed on the entry: the rows stay visibly synthetic,
    and they do not reveal the bugs real data provokes.

    The demonstration is concrete. `account_key` forgets that an address may
    carry a plus tag, so two spellings of the same mailbox become two accounts.
    The generator only ever emits one shape of address, and that shape has no
    plus tag, no capital letter and no apostrophe. A suite built on this data
    is green whatever the seed and whatever the row count.
    """
    rows = generate_rows(ORDERS, 500, "orders-2024")
    addresses = [row["email"] for row in rows]

    # The shapes real addresses take, and this generator never does.
    assert not any("+" in address for address in addresses)
    assert not any(character.isupper() for address in addresses for character in address)
    assert not any("'" in address for address in addresses)

    # The suite passes: every generated address yields its own account key.
    keys = [account_key(address) for address in addresses]
    assert len(set(keys)) == len(keys)

    # In production, these two spellings reach one mailbox and must share one
    # account. They do not, and no seed will ever produce the pair that would
    # have caught it.
    same_mailbox = ("i.fontaine@example.test", "i.fontaine+billing@example.test")
    assert account_key(same_mailbox[0]) != account_key(same_mailbox[1])
