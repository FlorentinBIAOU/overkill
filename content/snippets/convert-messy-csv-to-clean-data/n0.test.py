"""
Tests du niveau N0 : dialecte, encodage, coercition typée, journal des rejets.

Les fichiers d'exemple vivent ici, jamais dans l'extrait. Chaque fichier est
écrit en octets, parce qu'un CSV n'est que des octets tant que personne n'a
décidé de son encodage.
"""

import ast
import time
import unicodedata
from pathlib import Path

import pytest

from n0 import clean_csv, coerce_row, decode_text, detect_dialect, Rejected

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


def journal(result):
    return [(r["line"], r["column"], r["reason"]) for r in result["rejects"]]


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_une_colonne_change_de_sens_en_cours_de_fichier():
    """
    « Un export qui passe du jour d'abord au mois d'abord rend « 07/04/2023 »
    deux fois, lu deux fois comme le 7 avril, sans un mot dans le journal :
    seul « 12/25/2023 » est rejeté, et par chance » (existant, complété).
    """
    data = (
        "id,joined\n"
        "1,07/04/2023\n"  # écrit jour d'abord : le 7 avril
        "2,07/04/2023\n"  # écrit mois d'abord : le 4 juillet
        "3,12/25/2023\n"  # écrit mois d'abord : Noël
    ).encode("utf-8")
    result = clean_csv(data, SCHEMA)
    assert [row["joined"] for row in result["rows"]] == ["2023-04-07", "2023-04-07"]
    assert journal(result) == [(4, "joined", "not a real date")]
    # Témoin : une date jour d'abord sans ambiguïté est lue juste.
    assert clean_csv(b"id,joined\n1,25/12/2023\n", SCHEMA)["rows"] == [{"id": 1, "joined": "2023-12-25"}]


def test_point_de_rupture_un_second_export_recolle_avec_un_autre_separateur():
    """
    « le dialecte est décidé une fois, en tête, et chacune de ses lignes est
    refusée avec « expected 3 fields, found 1 » » (existant, complété).
    """
    data = (
        "id;name;joined\n"
        "1;Alice;2023-04-12\n"
        "2;Bob;2023-05-01\n"
        "id,name,joined\n"
        "3,Carol,2024-01-09\n"
        "4,Dan,2024-02-11\n"
    ).encode("utf-8")
    result = clean_csv(data, SCHEMA)
    assert result["delimiter"] == ";"
    assert [row["id"] for row in result["rows"]] == [1, 2]
    assert [(r["line"], r["reason"]) for r in result["rejects"]] == [
        (4, "expected 3 fields, found 1"),
        (5, "expected 3 fields, found 1"),
        (6, "expected 3 fields, found 1"),
    ]
    # Témoin : le second export seul est lu sans refus.
    assert journal(clean_csv(b"id,name,joined\n3,Carol,2024-01-09\n", SCHEMA)) == []


def test_point_de_rupture_une_ligne_du_premier_dialecte_apres_le_second_reste_lue():
    """Existant : une ligne revenue au premier séparateur est gardée, les autres sont refusées une à une."""
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
    assert [row["id"] for row in result["rows"]] == [1, 2, 4]
    assert [(r["line"], r["reason"]) for r in result["rejects"]] == [
        (4, "expected 3 fields, found 1"),
        (5, "expected 3 fields, found 1"),
        (6, "expected 3 fields, found 1"),
    ]


# ---------------------------------------------------------------------------
# Nom, docstring, commentaires
# ---------------------------------------------------------------------------


def test_lit_un_fichier_bien_forme():
    """Cas nominal (existant)."""
    result = clean_csv(NOMINAL, SCHEMA)
    assert result["rejects"] == []
    assert result["columns"] == ["id", "name", "joined", "amount", "active"]
    assert result["rows"] == [
        {"id": 1, "name": "Alice", "joined": "2023-04-12", "amount": 12.50, "active": True},
        {"id": 2, "name": "Bob", "joined": "2023-05-01", "amount": 1234.56, "active": False},
        {"id": 3, "name": "Carol", "joined": "2023-06-30", "amount": 0.99, "active": True},
    ]


def test_n0_n_emploie_que_la_bibliotheque_standard():
    """« Standard library only » ; risks `vendor_lock: none`."""
    source = ast.parse(Path(__file__).with_name("n0.py").read_text(encoding="utf-8"))
    modules = {a.name for n in ast.walk(source) if isinstance(n, ast.Import) for a in n.names}
    modules |= {n.module for n in ast.walk(source) if isinstance(n, ast.ImportFrom)}
    assert modules == {"codecs", "csv", "io", "re", "datetime"}


def test_n0_est_deterministe_et_se_traite_en_moins_d_une_milliseconde():
    """risks `deterministic: true` ; latency `<1 ms` (mesuré 0,06 ms sur le fichier nominal)."""
    first = clean_csv(NOMINAL, SCHEMA)
    best = float("inf")
    for _ in range(20):
        start = time.perf_counter()
        assert clean_csv(NOMINAL, SCHEMA) == first
        best = min(best, time.perf_counter() - start)
    assert best < 0.001


def test_les_octets_deviennent_du_texte_avant_que_le_separateur_soit_compte():
    """« Bytes have to become text before a delimiter can be counted » : un UTF-16 à points-virgules."""
    data = "id;ville\n1;Besançon\n".encode("utf-16")
    result = clean_csv(data, {"id": "integer"})
    assert result["delimiter"] == ";"
    assert result["rows"] == [{"id": 1, "ville": "Besançon"}]


def test_detecte_un_fichier_a_points_virgules_dont_le_texte_libre_est_plein_de_virgules():
    """« A file separated by semicolons whose free-text column is full of commas still lands on its feet » (existant)."""
    data = (
        "id;name;note\n"
        '1;Alice;"a, b, c"\n'
        '2;Bob;"she said ""hello"""\n'
        "3;Carol;plain\n"
    ).encode("utf-8")
    result = clean_csv(data, {"id": "integer"})
    assert result["delimiter"] == ";"
    assert [row["note"] for row in result["rows"]] == ["a, b, c", 'she said "hello"', "plain"]


def test_detecte_les_tabulations_et_les_apostrophes_comme_guillemets():
    """« Guess the delimiter first, then the quote character » (existant)."""
    assert detect_dialect("id\tname\n1\tAlice\n") == ("\t", '"')
    assert detect_dialect("id;name\n1;'Al;ice'\n") == (";", "'")


def test_une_apostrophe_ne_compte_que_lorsqu_elle_ouvre_un_champ():
    """« A quote character only counts when it opens a field: at the start of a line, or straight after the delimiter »."""
    assert detect_dialect("id;name\n1;l'été\n2;aujourd'hui\n3;c'est\n") == (";", '"')


def test_normalise_l_encodage_quel_que_soit_le_fichier_recu():
    """`decode_text` : « A byte order mark is a statement about the file, so it wins » ; UTF-8 strict, puis cp1252 (existant, complété)."""
    expected = [{"city": "Besançon"}, {"city": "Nîmes"}]
    text = "city\nBesançon\nNîmes\n"
    for data in (
        b"\xef\xbb\xbf" + text.encode("utf-8"),
        text.encode("utf-16"),
        b"\xfe\xff" + text.encode("utf-16-be"),
        text.encode("utf-8"),
        text.encode("cp1252"),
    ):
        assert clean_csv(data, {})["rows"] == expected
    assert decode_text(b"\xef\xbb\xbf" + text.encode("utf-8")).startswith("city")


def test_les_cinq_octets_indefinis_de_cp1252_deviennent_le_caractere_de_remplacement():
    """« Five byte values are undefined in cp1252; replacing them keeps the rest of the file readable and marks the damage » ; même texte en JavaScript."""
    assert decode_text(bytes([0x63, 0x81, 0x8D, 0x8F, 0x90, 0x9D, 0xE9])) == "c�����é"


def test_defaut_une_marque_utf8_suivie_d_un_octet_invalide_ne_fait_pas_lever():
    result = clean_csv(b"\xef\xbb\xbfcity\nBesan\xe7on\nNimes\n", {})
    assert len(result["rows"]) + len(result["rejects"]) == 2


def test_defaut_un_encodage_non_pris_en_charge_est_signale():
    for data in ("city\nBesançon\n".encode("utf-16-le"), "city\nBesançon\n".encode("utf-32")):
        result = clean_csv(data, {})
        assert result["columns"] == ["city"] or result["rejects"], result["columns"]


def test_une_virgule_et_un_point_la_derniere_marque_est_decimale():
    """`_to_number` : « When a comma and a dot are both present, the last one is the decimal mark […] When only a comma is present it is the decimal mark »."""
    data = 'amount\n"1.234,56"\n"1,234.56"\n"12,5"\n1 234\n"1 234,56"\n"1 234,56"\n5.\n.5\n'.encode("utf-8")
    result = clean_csv(data, {"amount": "number"})
    assert [row["amount"] for row in result["rows"]] == [1234.56, 1234.56, 12.5, 1234.0, 1234.56, 1234.56, 5.0, 0.5]


def test_production_un_separateur_de_milliers_seul_est_lu_comme_une_marque_decimale():
    """Précision : « 1,234 » (anglais) et « 1.234 » (allemand) valent 1,234, sans journal."""
    result = clean_csv(b'amount\n"1,234"\n1.234\n', {"amount": "number"})
    assert [row["amount"] for row in result["rows"]] == [1.234, 1.234]
    assert result["rejects"] == []


def test_une_date_hors_forme_iso_est_lue_jour_d_abord_et_le_calendrier_est_verifie():
    """`_to_date` : « Day-first is assumed outside ISO form » ; « rejects 31 February and month 13 »."""
    data = b"joined\n01.05.2023\n29/02/2024\n29/02/2000\n31/02/2024\n01/13/2023\n29/02/2023\n29/02/1900\n0000-01-01\n7/4/2023\n"
    result = clean_csv(data, {"joined": "date"})
    assert [row["joined"] for row in result["rows"]] == ["2023-05-01", "2024-02-29", "2000-02-29"]
    assert [r["reason"] for r in result["rejects"]] == ["not a real date"] * 5 + ["not a date"]


def test_les_mots_vrai_et_faux():
    """`TRUE_WORDS`, `FALSE_WORDS`."""
    words = ["true", "YES", "y", "1", "vrai", "Oui", "o", "false", "No", "n", "0", "faux", "NON"]
    result = clean_csv(("active\n" + "\n".join(words) + "\n").encode(), {"active": "boolean"})
    assert [row["active"] for row in result["rows"]] == [True] * 7 + [False] * 6


def test_la_premiere_valeur_refusee_nomme_la_ligne():
    """`coerce_row` : « First failure wins: a row is refused once, naming the column that caused it »."""
    result = clean_csv(b"id,name,joined,amount,active\nx,Alice,xx,yy,maybe\n", SCHEMA)
    assert journal(result) == [(2, "id", "not an integer")]
    with pytest.raises(Rejected) as refusal:
        coerce_row(["joined", "amount"], ["xx", "yy"], SCHEMA)
    assert (refusal.value.column, refusal.value.reason) == ("joined", "not a date")


def test_le_journal_nomme_la_ligne_la_colonne_et_la_raison():
    """« Every refusal here says which line, which column, and why » ; « plus the fields as they were read » ; regulatory « Le journal des rejets recopie les champs tels qu'ils ont été lus » (existant)."""
    data = (
        "id,name,joined,amount,active\n"
        "1,Alice,31/02/2024,3.5,yes\n"
        "2,Bob,2024-01-09,abc,no\n"
        "3,Carol,2024-01-10,1.0,maybe\n"
        "x,Dan,2024-01-11,1.0,yes\n"
        "5,Eve\n"
        "6,Frank,2024-01-12,2.0,no\n"
    ).encode("utf-8")
    result = clean_csv(data, SCHEMA)
    assert [row["id"] for row in result["rows"]] == [6]
    assert journal(result) == [
        (2, "joined", "not a real date"),
        (3, "amount", "not a number"),
        (4, "active", "not a true or false value"),
        (5, "id", "not an integer"),
        (6, "", "expected 5 fields, found 2"),
    ]
    assert result["rejects"][0]["fields"] == ["1", "Alice", "31/02/2024", "3.5", "yes"]


def test_les_numeros_de_ligne_suivent_les_champs_sur_plusieurs_lignes():
    data = b'id,note,amount\n1,"deux\nlignes",1.0\n2,ok,abc\n'
    assert journal(clean_csv(data, {"amount": "number"})) == [(4, "amount", "not a number")]


def test_une_colonne_absente_du_schema_reste_du_texte():
    """`clean_csv` : « A column absent from the schema is kept as text »."""
    assert clean_csv(b"id,code\n007,  0042 \n", {})["rows"] == [{"id": "007", "code": "0042"}]


def test_les_fichiers_pour_lesquels_personne_n_ecrit_de_test():
    """Existant : vide, en-tête seul, colonne unique, lignes blanches, sans fin de ligne, CRLF, cellule vide."""
    empty = clean_csv(b"", {})
    assert empty == {"columns": [], "delimiter": ",", "quote": '"', "rows": [], "rejects": []}
    header_only = clean_csv(b"id,name\n", SCHEMA)
    assert header_only["columns"] == ["id", "name"] and header_only["rows"] == []
    single = clean_csv(b"code\nAB1\n\nCD2", {})
    assert [row["code"] for row in single["rows"]] == ["AB1", "CD2"]
    quoted = clean_csv(b'id,note\r\n1,"line one\r\nline two"\r\n2,"a,b"\r\n', {"id": "integer"})
    assert [row["note"] for row in quoted["rows"]] == ["line one\r\nline two", "a,b"]
    blanks = clean_csv(b"id,joined\n1,\n", SCHEMA)
    assert blanks["rows"] == [{"id": 1, "joined": None}] and blanks["rejects"] == []


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_fins_de_ligne_cr_seules_et_guillemet_au_milieu_d_un_champ():
    assert clean_csv(b"id;name\r1;Alice\r2;Bob\r", {})["rows"] == [{"id": "1", "name": "Alice"}, {"id": "2", "name": "Bob"}]
    rows = clean_csv(b'id,name\n1,Eve "the boss"\n2,"a"b\n', {})["rows"]
    assert [row["name"] for row in rows] == ['Eve "the boss"', "ab"]


def test_production_cent_mille_lignes_terminent_vite():
    data = b"id,name,joined,amount,active\n" + b"".join(
        b"%d,Alice,2023-04-12,12.50,yes\n" % i for i in range(100_000)
    )
    start = time.perf_counter()
    result = clean_csv(data, SCHEMA)
    assert time.perf_counter() - start < 5  # mesuré 0,35 s
    assert len(result["rows"]) == 100_000


def test_production_encodage_nfd_emoji_insecables():
    name = unicodedata.normalize("NFD", "Zoé 🙂")
    data = f"id;name;amount\n1;{name};1 234,5\n".encode("utf-8")
    assert clean_csv(data, SCHEMA)["rows"] == [{"id": 1, "name": name, "amount": 1234.5}]


def test_production_un_grand_entier_reste_exact():
    """Python : un identifiant de 21 chiffres reste exact (JavaScript l'arrondit, voir n0.test.js)."""
    result = clean_csv(b"id\n123456789012345678901\n9007199254740993\n", {"id": "integer"})
    assert [row["id"] for row in result["rows"]] == [123456789012345678901, 9007199254740993]


def test_production_des_chiffres_non_ascii_divisent_les_deux_langages():
    """Précision : `\\d` Python accepte « ١٢ » (chiffres arabes) comme l'entier 12 ; JavaScript le refuse."""
    assert clean_csv("a\n١٢\n".encode(), {"a": "integer"})["rows"] == [{"a": 12}]


def test_production_une_cle_de_schema_a_la_mauvaise_casse_laisse_la_colonne_en_texte():
    """Précision : « Name » dans le fichier, « name » dans le schéma : texte, sans journal."""
    assert clean_csv(b"id,Name\n1,Alice\n", {"name": "integer"})["rows"] == [{"id": "1", "Name": "Alice"}]


def test_defaut_une_apostrophe_de_tableur_ne_fusionne_pas_des_lignes():
    result = clean_csv(b"id,phone\n1,'0612345678\n2,'0698765432\n3,'0611111111\n", {})
    assert len(result["rows"]) + len(result["rejects"]) == 3


def test_defaut_un_guillemet_non_ferme_ne_fait_pas_disparaitre_la_suite():
    result = clean_csv(b'id,name\n1,"Alice\n2,Bob\n3,Carol\n', {})
    assert len(result["rows"]) + len(result["rejects"]) == 3


def test_defaut_deux_colonnes_du_meme_nom_ne_perdent_pas_de_valeur():
    result = clean_csv(b"id,id\n1,2\n", {})
    assert result["rejects"] or "1" in list(result["rows"][0].values())


def test_defaut_un_champ_tres_long_ne_fait_pas_lever():
    data = b"id,note\n1," + b"x" * 200_000 + b"\n2,ok\n"
    result = clean_csv(data, {})
    assert len(result["rows"]) + len(result["rejects"]) == 2
