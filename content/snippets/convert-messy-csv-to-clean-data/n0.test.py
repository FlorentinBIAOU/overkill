"""
The sample files live here, never in the snippet: the snippet shows a
function, not a demonstration.

Every file below is written as bytes, because that is what a CSV is before
anybody has decided what encoding it is in.
"""

from n0 import clean_csv, decode_text, detect_dialect

SCHEMA = {
    "id": "integer",
    "name": "text",
    "joined": "date",
    "amount": "number",
    "active": "boolean",
}

NOMINAL = (
    "id,name,joined,amount,active\n"
    "1,Alice,2023-04-12,12.50,yes\n"
    "2,Bob,01/05/2023,\"1 234,56\",no\n"
    "3,Carol,2023-06-30,0.99,true\n"
).encode("utf-8")


def test_reads_a_well_formed_file():
    result = clean_csv(NOMINAL, SCHEMA)
    assert result["rejects"] == []
    assert result["columns"] == ["id", "name", "joined", "amount", "active"]
    assert result["rows"][0] == {
        "id": 1,
        "name": "Alice",
        "joined": "2023-04-12",
        "amount": 12.50,
        "active": True,
    }
    # A day-first date becomes ISO, and a European decimal comma becomes a
    # number, thousands separator included.
    assert result["rows"][1]["joined"] == "2023-05-01"
    assert result["rows"][1]["amount"] == 1234.56


def test_detects_a_semicolon_file_whose_free_text_is_full_of_commas():
    data = (
        "id;name;note\n"
        '1;Alice;"a, b, c"\n'
        '2;Bob;"she said ""hello"""\n'
        "3;Carol;plain\n"
    ).encode("utf-8")
    result = clean_csv(data, {"id": "integer"})
    assert result["delimiter"] == ";"
    assert [row["note"] for row in result["rows"]] == ["a, b, c", 'she said "hello"', "plain"]


def test_detects_tabs_and_apostrophe_quoting():
    assert detect_dialect("id\tname\n1\tAlice\n") == ("\t", '"')
    assert detect_dialect("id;name\n1;'Al;ice'\n") == (";", "'")


def test_normalises_the_encoding_whatever_the_file_arrived_in():
    # The same two rows, written three ways a spreadsheet really exports them.
    expected = [{"city": "Besançon"}, {"city": "Nîmes"}]
    utf8_bom = b"\xef\xbb\xbf" + "city\nBesançon\nNîmes\n".encode("utf-8")
    utf16 = "city\nBesançon\nNîmes\n".encode("utf-16")
    cp1252 = "city\nBesançon\nNîmes\n".encode("cp1252")
    for data in (utf8_bom, utf16, cp1252):
        assert clean_csv(data, {})["rows"] == expected
    # The byte order mark is consumed, not carried into the first column name.
    assert decode_text(utf8_bom).startswith("city")


def test_handles_the_files_nobody_writes_a_test_for():
    empty = clean_csv(b"", {})
    assert empty["rows"] == [] and empty["columns"] == [] and empty["rejects"] == []

    header_only = clean_csv(b"id,name\n", SCHEMA)
    assert header_only["columns"] == ["id", "name"] and header_only["rows"] == []

    # One column, blank lines, and no newline at the end of the file.
    single = clean_csv(b"code\nAB1\n\nCD2", {})
    assert [row["code"] for row in single["rows"]] == ["AB1", "CD2"]

    # A quoted field may hold the delimiter, a doubled quote, or a newline.
    quoted = clean_csv(b'id,note\r\n1,"line one\r\nline two"\r\n2,"a,b"\r\n', {"id": "integer"})
    assert [row["note"] for row in quoted["rows"]] == ["line one\r\nline two", "a,b"]

    # An empty cell is missing, not malformed, so it is not a rejection.
    blanks = clean_csv(b"id,joined\n1,\n", SCHEMA)
    assert blanks["rows"] == [{"id": 1, "joined": None}] and blanks["rejects"] == []


def test_the_journal_names_the_line_the_column_and_the_reason():
    data = (
        "id,name,joined,amount,active\n"
        "1,Alice,31/02/2024,3.5,yes\n"  # a date that does not exist
        "2,Bob,2024-01-09,abc,no\n"  # not a number
        "3,Carol,2024-01-10,1.0,maybe\n"  # not a boolean
        "x,Dan,2024-01-11,1.0,yes\n"  # not an integer
        "5,Eve\n"  # a row shorter than the header
        "6,Frank,2024-01-12,2.0,no\n"  # the only survivor
    ).encode("utf-8")
    result = clean_csv(data, SCHEMA)

    assert [row["id"] for row in result["rows"]] == [6]
    assert [(r["line"], r["column"], r["reason"]) for r in result["rejects"]] == [
        (2, "joined", "not a real date"),
        (3, "amount", "not a number"),
        (4, "active", "not a true or false value"),
        (5, "id", "not an integer"),
        (6, "", "expected 5 fields, found 2"),
    ]
    # The fields are kept as they were read, so a refusal can be acted on
    # without opening the file again. This is what rung N3 is handed.
    assert result["rejects"][0]["fields"] == ["1", "Alice", "31/02/2024", "3.5", "yes"]


def test_breaking_point_the_separator_changes_partway_through_the_file():
    """
    The breaking point claimed on the entry, first half: a file whose
    separators are not consistent from one line to the next.

    The dialect is decided once, from the top of the file. Everything written
    in the other dialect arrives as a single field and is refused. The claim
    this test defends is not that the cleaner copes, because it does not: it
    is that the cleaner says so, line by line, instead of quietly returning
    three rows out of five.
    """
    data = (
        "id;name;joined\n"
        "1;Alice;2023-04-12\n"
        "2;Bob;2023-05-01\n"
        "# second export appended below\n"
        "id,name,joined\n"
        "3,Carol,2024-01-09\n"
        "4;Dan;2024-02-11\n"
    ).encode("utf-8")
    result = clean_csv(data, SCHEMA)

    assert result["delimiter"] == ";"
    assert [row["id"] for row in result["rows"]] == [1, 2, 4]
    assert [(r["line"], r["reason"]) for r in result["rejects"]] == [
        (4, "expected 3 fields, found 1"),
        (5, "expected 3 fields, found 1"),
        (6, "expected 3 fields, found 1"),
    ]


def test_breaking_point_a_column_changes_meaning_partway_through_the_file():
    """
    The breaking point claimed on the entry, second half, and the worse one: a
    column whose meaning changes without its shape changing.

    Here the export switches from day-first to month-first halfway down. Every
    row still has the right number of fields and every value still coerces, so
    the journal is empty and the file looks clean. It is not: the fourth of
    July has become the seventh of April.

    Nothing in this rung can see that, and nothing in the next two can either
    without being told what the file means. A type checker checks types. Only
    a date whose day happens to exceed twelve gets caught, and that is luck,
    not detection.
    """
    data = (
        "id,joined\n"
        "1,07/04/2023\n"  # written day-first: the seventh of April
        "2,07/04/2023\n"  # written month-first: the fourth of July
        "3,12/25/2023\n"  # written month-first: Christmas
    ).encode("utf-8")
    result = clean_csv(data, SCHEMA)

    # Two different days, silently read as the same one, with nothing said.
    assert [row["joined"] for row in result["rows"]] == ["2023-04-07", "2023-04-07"]
    # Caught only because no month has twenty-five days.
    assert [(r["line"], r["column"], r["reason"]) for r in result["rejects"]] == [
        (4, "joined", "not a real date")
    ]
