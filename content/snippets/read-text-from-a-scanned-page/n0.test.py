"""
The sample documents are built here, in the test, and never on disk outside a
temporary directory.

Building them by hand is the point: a PDF that carries text and a PDF that
carries a photograph of the same text differ by a handful of bytes, and those
bytes are what this rung reads.
"""

import base64
import builtins
import json
import os
import re
import shutil
import subprocess
import tempfile
import time
import zlib
from pathlib import Path

import pytest

from n0 import MIN_CHARACTERS, read_text_layer

ICI = Path(__file__).parent

# Eight rows of a grey ramp. Pixels, not characters: every byte is below 64,
# so nothing in here can be mistaken for a text operator once inflated.
PIXELS = bytes(range(64)) * 8


def photograph(length: int) -> bytes:
    """
    What a scanner really puts in the picture: bytes already compressed by JPEG.

    They do not inflate, so they are read exactly as they lie. The same
    congruential generator is written in the JavaScript test, so both languages
    are handed the very same bytes.
    """
    values = bytearray(b"\xff\xd8\xff\xe0")  # the marker that opens a JPEG
    state = 1
    for _ in range(length):
        state = (state * 1103515245 + 12345) & 0xFFFFFFFF
        values.append((state >> 16) & 0xFF)
    return bytes(values)


def build_pdf(content: bytes, *, compress: bool = True, photo: bytes | None = None,
              image_dict: bytes | None = None, trailer: bytes = b"", extra: tuple = ()) -> bytes:
    """Assemble a small but valid PDF whose single page draws `content`."""
    stream = zlib.compress(content) if compress else content
    flate = b"/Filter /FlateDecode " if compress else b""
    image = photo if photo is not None else zlib.compress(PIXELS)
    image_filter = b"/DCTDecode" if photo is not None else b"/FlateDecode"
    declaration = image_dict if image_dict is not None else (
        b"<< /Type /XObject /Subtype /Image /Width 64 /Height 8 /ColorSpace /DeviceGray "
        b"/BitsPerComponent 8 /Filter " + image_filter + b" /Length %d >>" % len(image)
    )
    bodies = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources "
        b"<< /Font << /F1 5 0 R >> /XObject << /Im0 6 0 R >> >> /Contents 4 0 R >>",
        b"<< " + flate + b"/Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        declaration + b"\nstream\n" + image + b"\nendstream",
        *extra,
    ]

    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for number, body in enumerate(bodies, start=1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % number + body + b"\nendobj\n"
    start = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(bodies) + 1)
    for offset in offsets:
        out += b"%010d 00000 n \n" % offset
    out += b"trailer\n<< /Size %d /Root 1 0 R %s>>\nstartxref\n%d\n%%%%EOF\n" % (len(bodies) + 1, trailer, start)
    return bytes(out)


def shown_codes(codes) -> bytes:
    """A text object that shows these one-byte codes, written as octal escapes."""
    return b"BT /F1 12 Tf 72 780 Td (" + b"".join(b"\\%03o" % c for c in codes) + b") Tj ET\n"


def en_javascript(documents):
    """Run the real n0.js on each document and return its reports."""
    node = shutil.which("node")
    assert node, "node est requis pour comparer les deux implémentations"
    script = (
        f"import {{ readTextLayer }} from {json.dumps((ICI / 'n0.js').as_uri())};"
        "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{"
        "process.stdout.write(JSON.stringify(JSON.parse(d).map((b)=>{"
        "try{return readTextLayer(Buffer.from(b,'base64'));}catch(e){return {error:e.name};}})));});"
    )
    sortie = subprocess.run(
        [node, "--input-type=module", "-e", script],
        input=json.dumps([base64.b64encode(d).decode() for d in documents]),
        capture_output=True, text=True, timeout=60, check=True,
    )
    return json.loads(sortie.stdout)


def en_python_camel(report):
    return {"hasTextLayer": report["has_text_layer"], "text": report["text"],
            "characters": report["characters"], "pages": report["pages"], "reason": report["reason"]}


TYPESET = (
    b"BT /F1 12 Tf 72 780 Td (Facture n\\370 2024-000431) Tj\n"
    b"0 -16 Td (\\311mise le 3 avril 2024) Tj\n"
    b"0 -16 Td [(Tot) -250 (al : 92,40 EUR)] TJ ET\n"
)

# What a scanner writes: one image, drawn to fill the page. No text at all.
SCANNED = b"q 595 0 0 842 0 0 cm /Im0 Do Q\n"

# What a word processor writes: a subset font whose glyphs are renumbered from
# one, so the strings on the page are codes and not letters.
GLYPH_CODES = (
    b"BT /F1 12 Tf 72 780 Td (\\001\\002\\003\\004\\005\\006\\007\\010\\016\\017\\020"
    b"\\021\\022\\023\\024\\025\\026\\027\\030\\031\\032\\033) Tj\n"
    b"0 -16 Td (\\001\\002\\003\\004\\005\\006\\007\\010\\016\\017\\020"
    b"\\021\\022\\023\\024\\025\\026\\027\\030\\031\\032\\033) Tj ET\n"
)

PHOTO = photograph(250_000)


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_une_page_reellement_scannee_na_pas_de_couche_de_texte():
    """
    « Le document du test est valide, il compte une page, et cette page est une
    photographie dessinée en plein cadre : zéro caractère » ; « Ce que l'extrait
    rend alors n'est pas une chaîne vide […] mais un rapport qui nomme la raison
    et renvoie vers un OCR ».
    """
    report = read_text_layer(build_pdf(SCANNED))
    assert report["pages"] == 1
    assert report["has_text_layer"] is False
    assert report["characters"] == 0
    assert report["reason"] == "no text layer: this page is an image, and needs OCR"
    assert isinstance(report, dict) and set(report) == {"has_text_layer", "text", "characters", "pages", "reason"}
    # Témoin : la même page composée porte son texte.
    assert read_text_layer(build_pdf(TYPESET))["has_text_layer"] is True


def test_point_de_rupture_un_scan_dont_limage_est_un_jpeg_tient_aussi():
    """« que son image se décompresse ou qu'elle arrive déjà compressée en JPEG, comme celle d'un vrai scanner »."""
    report = read_text_layer(build_pdf(SCANNED, photo=PHOTO))
    assert report["pages"] == 1
    assert report["has_text_layer"] is False
    assert report["characters"] == 0
    assert "OCR" in report["reason"]


def test_point_de_rupture_le_seuil_range_un_numero_de_page_tamponne_sous_limage():
    """« le seuil de caractères y range aussi le tampon d'un numéro de page : un caractère posé sur une image reste une image »."""
    report = read_text_layer(build_pdf(b"BT /F1 10 Tf 300 40 Td (3) Tj ET\n"))
    assert report["text"] == "3"
    assert report["characters"] == 1 < MIN_CHARACTERS
    assert report["has_text_layer"] is False
    assert "OCR" in report["reason"]


def test_point_de_rupture_temoin_le_seuil_juste_en_dessous_et_juste_au_dessus():
    assert MIN_CHARACTERS == 24
    assert read_text_layer(build_pdf(b"BT (" + b"A" * 23 + b") Tj ET"))["has_text_layer"] is False
    assert read_text_layer(build_pdf(b"BT (" + b"A" * 24 + b") Tj ET"))["has_text_layer"] is True


def test_point_de_rupture_un_export_a_police_sous_ensemble_compte_zero_caractere_et_renvoie_vers_une_bibliotheque_pdf():
    """
    « Un export de traitement de texte, dont la police sous-ensemble renumérote
    ses glyphes à partir de un […] compte alors zéro caractère lisible, le dit,
    et renvoie vers une bibliothèque PDF complète plutôt que vers un OCR ».
    """
    report = read_text_layer(build_pdf(GLYPH_CODES))
    assert report["has_text_layer"] is False
    assert report["characters"] == 0
    assert report["reason"] == "a text layer encoded by a font table: this needs a full PDF library, not a scan"
    assert "OCR" not in report["reason"]


def test_infirme_un_export_a_police_sous_ensemble_de_quatre_vingts_glyphes_est_refuse():
    codes = [((i * 37) % 80) + 1 for i in range(400)]
    report = read_text_layer(build_pdf(shown_codes(codes)))
    assert report["has_text_layer"] is False


# ---------------------------------------------------------------------------
# Les autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_lit_la_couche_de_texte_dun_pdf_genere():
    report = read_text_layer(build_pdf(TYPESET))
    assert report["has_text_layer"] is True
    assert report["text"].splitlines() == [
        "Facture n\xf8 2024-000431",
        "\xc9mise le 3 avril 2024",
        "Total : 92,40 EUR",
    ]
    assert report["pages"] == 1
    assert report["reason"] is None


def test_lit_un_flux_de_contenu_non_compresse():
    """Commentaire : « an uncompressed content stream is perfectly legal »."""
    report = read_text_layer(build_pdf(TYPESET, compress=False))
    assert report["text"] == read_text_layer(build_pdf(TYPESET))["text"]


def test_lit_les_echappements_et_les_chaines_hexadecimales():
    """Docstring de _hex : « as PDF writers emit for anything beyond ASCII », avec la marque UTF-16."""
    content = (
        b"BT /F1 12 Tf 72 700 Td (Facture \\(copie\\) \\340 relire) Tj\n"
        b"0 -14 Td <52656D69736520656E206D61696E> Tj\n"
        b"0 -14 Td <FEFF00520065006D006900730065002000E9> Tj ET\n"
    )
    assert read_text_layer(build_pdf(content))["text"].splitlines() == [
        "Facture (copie) \xe0 relire",
        "Remise en main",
        "Remise é",
    ]
    # « the spec pads a lone last digit with zero ».
    assert read_text_layer(build_pdf(b"BT <41424> Tj ET"))["text"] == "AB@"


def test_les_nombres_de_crenage_dun_tableau_tj_ne_portent_aucun_caractere():
    """Commentaire : « Kerning numbers inside a TJ array are skipped on purpose »."""
    assert read_text_layer(build_pdf(b"BT [(Fac) -120 (ture) 33 (s)] TJ ET"))["text"] == "Factures"


def test_infirme_une_chaine_quaucun_operateur_ne_montre_nest_pas_du_texte():
    report = read_text_layer(build_pdf(b"BT /Span << /Lang (fr-FR) >> BDC (Facture) Tj EMC ET"))
    assert report["text"] == "Facture"


def test_une_chaine_non_montree_apres_une_ligne_montree_est_ecartee():
    """Témoin du précédent : une fois une ligne montrée, l'opérateur de ligne vide les chaînes en attente."""
    assert read_text_layer(build_pdf(b"BT (vue) Tj (jamais montre) Td (montre) Tj ET"))["text"] == "vue\nmontre"


def test_rien_hors_dun_objet_texte_nest_lu():
    """Commentaire : « Nothing outside one shows a character, so nothing outside one is read »."""
    assert read_text_layer(build_pdf(b"(hors objet) Tj BT (dedans) Tj ET (apres) Tj"))["text"] == "dedans"


def test_une_page_dont_un_seul_code_sort_hors_table_nest_pas_lue():
    """Docstring de `_is_control` : « one of them is enough to know the bytes are not letters yet »."""
    # Un dixième lisible, une moitié lisible, ou vingt-quatre lettres pour un
    # seul code hors table : dans les trois cas la page est refusée, et nommée.
    for codes in ([65] * 30 + [1] * 270, [65] * 30 + [1] * 30, [65] * 24 + [1]):
        report = read_text_layer(build_pdf(shown_codes(codes)))
        assert report["has_text_layer"] is False
        assert report["reason"] == (
            "a text layer encoded by a font table: this needs a full PDF library, not a scan"
        )
    # Témoin : les mêmes vingt-quatre lettres, avec une tabulation à la place du
    # code hors table, se lisent. Ce n'est pas la proportion qui refuse.
    temoin = read_text_layer(build_pdf(shown_codes([65] * 24 + [9])))
    assert temoin["has_text_layer"] is True and temoin["characters"] == 24


def test_les_codes_127_a_159_sont_lus_dans_la_table_winansi():
    """Commentaire : WinAnsiEncoding « holds the euro sign and typographic quotes, and a bullet on every unused code »."""
    # PDF 32000-1, annexe D : ces codes portent un glyphe, ils se lisent.
    for code, glyphe in ((0x7F, "•"), (0x80, "€"), (0x81, "•"), (0x92, "’"), (0x9F, "Ÿ")):
        report = read_text_layer(build_pdf(shown_codes([code] * 40)))
        assert report["text"].startswith(glyphe), hex(code)
        assert report["characters"] == 40
    # Venus d'une chaîne UTF-16, en revanche, U+0080 à U+009F ne sont la sortie
    # d'aucune table : la page est refusée. Et U+FFFD ne compte jamais.
    assert read_text_layer(build_pdf(b"BT <FEFF0080> Tj ET"))["has_text_layer"] is False
    assert read_text_layer(build_pdf(b"BT <FEFFFFFD> Tj ET"))["characters"] == 0


def test_seuil_parametrable_pour_les_documents_denses():
    """Commentaire : « Raise it for dense documents »."""
    doc = build_pdf(TYPESET)
    assert read_text_layer(doc, min_characters=500)["has_text_layer"] is False
    assert read_text_layer(doc, min_characters=10)["has_text_layer"] is True


def test_python_et_javascript_rendent_le_meme_rapport():
    """Les deux extraits affirment la même chose : même rapport, champ par champ, sur les documents du test."""
    documents = [
        build_pdf(TYPESET), build_pdf(TYPESET, compress=False), build_pdf(SCANNED),
        build_pdf(SCANNED, photo=PHOTO), build_pdf(GLYPH_CODES),
        build_pdf(b"BT /F1 10 Tf 300 40 Td (3) Tj ET\n"), b"", b"this is not a PDF at all",
        build_pdf(b"BT <FEFF00520065006D006900730065002000E9> Tj ET"),
    ]
    assert en_javascript(documents) == [en_python_camel(read_text_layer(d)) for d in documents]


def test_lit_un_document_ecrit_dans_un_repertoire_temporaire():
    # The only file this test suite writes, and it dies with the directory.
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory) / "facture.pdf"
        path.write_bytes(build_pdf(TYPESET))
        assert read_text_layer(path.read_bytes())["has_text_layer"] is True


def test_aucun_fichier_ouvert_et_bibliotheque_standard_seule(monkeypatch):
    """Docstring : « Standard library only » ; risks.data_egress : none."""
    def refuser(*args, **kwargs):
        raise AssertionError("un fichier a été ouvert")

    document = build_pdf(TYPESET)
    monkeypatch.setattr(builtins, "open", refuser)
    monkeypatch.setattr(os, "open", refuser)
    report = read_text_layer(document)
    monkeypatch.undo()
    assert report["has_text_layer"] is True
    source = (ICI / "n0.py").read_text(encoding="utf-8")
    assert set(re.findall(r"^import (\w+)|^from (\w+)", source, re.M)) <= {("re", ""), ("zlib", ""), ("", "__future__")}


def test_deterministe():
    doc = build_pdf(SCANNED, photo=PHOTO)
    assert read_text_layer(doc) == read_text_layer(doc)


def test_une_page_composee_se_lit_en_moins_de_dix_millisecondes():
    """latency « ~10 ms » : cent lectures de la facture composée en moins d'une seconde."""
    doc = build_pdf(TYPESET)
    debut = time.perf_counter()
    for _ in range(100):
        read_text_layer(doc)
    assert time.perf_counter() - debut < 1.0


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_des_octets_qui_ne_sont_pas_un_pdf_ne_levent_pas():
    report = read_text_layer(b"this is not a PDF at all")
    assert report["has_text_layer"] is False
    assert report["pages"] == 0
    assert read_text_layer(b"")["reason"] == "no text layer: this page is an image, and needs OCR"


def test_production_cent_pages_composees_et_un_scan_de_vingt_megaoctets_terminent_vite():
    pages = b"".join(b"%d 0 obj\n<< /Type /Page >>\nendobj\n" % i for i in range(100))
    flux = b"".join(b"<< /Filter /FlateDecode >>\nstream\n" + zlib.compress(TYPESET) + b"\nendstream\n" for _ in range(100))
    debut = time.perf_counter()
    report = read_text_layer(b"%PDF-1.4\n" + pages + flux)
    assert report["pages"] == 100 and report["text"].count("Facture") == 100
    report = read_text_layer(build_pdf(SCANNED, photo=photograph(20_000_000)))
    assert report["has_text_layer"] is False
    assert time.perf_counter() - debut < 30.0


def test_production_utf16_nfd_emoji_insecable_et_bom():
    texte = "Facture\u00a0n° 2024 — cafe\u0301 🧾 \ufeffTotal : 92,40 €"
    hexa = ("FEFF" + texte.encode("utf-16-be").hex()).encode()
    report = read_text_layer(build_pdf(b"BT <" + hexa + b"> Tj ET"))
    assert report["text"] == texte
    assert report["has_text_layer"] is True


def test_defaut_un_scan_a_palette_de_couleurs_nest_pas_declare_lu():
    pixels = zlib.compress(PHOTO)
    palette = bytes((i * 7) % 256 for i in range(768)).hex().encode()
    declaration = (b"<< /Type /XObject /Subtype /Image /Width 500 /Height 500 /BitsPerComponent 8 "
                   b"/Filter /FlateDecode /ColorSpace [/Indexed /DeviceRGB 255 <" + palette
                   + b">] /Length %d >>" % len(pixels))
    report = read_text_layer(build_pdf(SCANNED, photo=pixels, image_dict=declaration))
    assert report["has_text_layer"] is False


def test_defaut_leuro_et_lapostrophe_typographique_dune_police_winansi_sont_lus():
    report = read_text_layer(build_pdf(b"BT (Total : 92,40 \\200 \\222l\\222article) Tj ET"))
    assert report["text"] == "Total : 92,40 € ’l’article"


def test_defaut_un_flux_ascii85_nest_pas_renvoye_vers_un_ocr():
    a85 = base64.a85encode(zlib.compress(TYPESET), adobe=True)
    doc = build_pdf(b"").replace(
        b"<< /Filter /FlateDecode /Length %d >>\nstream\n" % len(zlib.compress(b"")) + zlib.compress(b""),
        b"<< /Filter [/ASCII85Decode /FlateDecode] /Length %d >>\nstream\n" % len(a85) + a85,
    )
    assert b"ASCII85Decode" in doc
    assert "OCR" not in (read_text_layer(doc)["reason"] or "")


def test_defaut_un_pdf_chiffre_nest_pas_renvoye_vers_un_ocr():
    chiffre = photograph(400)[4:]
    doc = build_pdf(chiffre, compress=False, trailer=b"/Encrypt 7 0 R ",
                    extra=(b"<< /Filter /Standard /V 2 /R 3 /Length 128 /P -44 >>",))
    assert "OCR" not in (read_text_layer(doc)["reason"] or "")


def test_defaut_des_parentheses_equilibrees_non_echappees_sont_lues():
    report = read_text_layer(build_pdf(b"BT (Facture (copie) numero 2024-000431 du 3 avril) Tj ET"))
    assert report["text"] == "Facture (copie) numero 2024-000431 du 3 avril"


def test_defaut_des_pages_rangees_dans_un_flux_dobjets_sont_comptees():
    objets = b"3 0 << /Type /Page /Parent 2 0 R /Contents 4 0 R >>"
    doc = build_pdf(TYPESET).replace(
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources "
        b"<< /Font << /F1 5 0 R >> /XObject << /Im0 6 0 R >> >> /Contents 4 0 R >>",
        b"<< /Type /ObjStm /N 1 /First 4 /Filter /FlateDecode /Length %d >>\nstream\n" % len(zlib.compress(objets))
        + zlib.compress(objets) + b"\nendstream",
    )
    assert read_text_layer(doc)["pages"] == 1


def test_defaut_un_flux_de_bt_sans_et_ne_fait_pas_exploser_le_temps():
    doc = build_pdf(b"BT " * 20_000, compress=False)
    debut = time.perf_counter()
    read_text_layer(doc)
    assert time.perf_counter() - debut < 1.0


def test_defaut_les_deux_langages_donnent_la_meme_raison_pour_les_codes_28_a_31():
    doc = build_pdf(shown_codes([28, 29, 30, 31] * 8))
    assert en_javascript([doc])[0]["reason"] == read_text_layer(doc)["reason"]


def test_defaut_une_chaine_utf16_impaire_ne_fait_lever_aucun_des_deux_langages():
    doc = build_pdf(b"BT (" + b"A" * 30 + b") Tj <FEFF004100> Tj ET")
    assert "error" not in en_javascript([doc])[0]
