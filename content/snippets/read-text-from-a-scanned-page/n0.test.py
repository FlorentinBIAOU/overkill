"""
The sample documents are built here, in the test, and never on disk outside a
temporary directory.

Building them by hand is the point: a PDF that carries text and a PDF that
carries a photograph of the same text differ by a handful of bytes, and those
bytes are what this rung reads.
"""

import tempfile
import zlib
from pathlib import Path

from n0 import MIN_CHARACTERS, read_text_layer

# Eight rows of a grey ramp. Pixels, not characters: every byte is below 64,
# so nothing in here can be mistaken for a text operator once inflated.
PIXELS = bytes(range(64)) * 8


def photograph(length: int) -> bytes:
    """
    What a scanner really puts in the picture: bytes already compressed by JPEG.

    They do not inflate, so they are read exactly as they lie. A quarter of a
    megabyte of them is one page at a modest resolution, and there is no reason
    at all why `BT`, a bracket and `Tj` should not all turn up in there by
    chance. The same congruential generator is written in the JavaScript test,
    so both languages are handed the very same bytes.
    """
    values = bytearray(b"\xff\xd8\xff\xe0")  # the marker that opens a JPEG
    state = 1
    for _ in range(length):
        state = (state * 1103515245 + 12345) & 0xFFFFFFFF
        values.append((state >> 16) & 0xFF)
    return bytes(values)


def build_pdf(content: bytes, *, compress: bool = True, photo: bytes | None = None) -> bytes:
    """Assemble a small but valid PDF whose single page draws `content`."""
    stream = zlib.compress(content) if compress else content
    flate = b"/Filter /FlateDecode " if compress else b""
    image = photo if photo is not None else zlib.compress(PIXELS)
    image_filter = b"/DCTDecode" if photo is not None else b"/FlateDecode"
    bodies = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources "
        b"<< /Font << /F1 5 0 R >> /XObject << /Im0 6 0 R >> >> /Contents 4 0 R >>",
        b"<< " + flate + b"/Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Type /XObject /Subtype /Image /Width 64 /Height 8 /ColorSpace /DeviceGray "
        b"/BitsPerComponent 8 /Filter " + image_filter + b" /Length %d >>\nstream\n" % len(image)
        + image
        + b"\nendstream",
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
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(bodies) + 1, start)
    return bytes(out)


TYPESET = (
    b"BT /F1 12 Tf 72 780 Td (Facture n\\370 2024-000431) Tj\n"
    b"0 -16 Td (\\311mise le 3 avril 2024) Tj\n"
    b"0 -16 Td [(Tot) -250 (al : 92,40 EUR)] TJ ET\n"
)

# What a scanner writes: one image, drawn to fill the page. No text at all.
SCANNED = b"q 595 0 0 842 0 0 cm /Im0 Do Q\n"

# What a word processor writes: a subset font whose glyphs are renumbered from
# one, so the strings on the page are codes and not letters. The page carries
# its text; turning it back into letters needs the font's own table.
GLYPH_CODES = (
    b"BT /F1 12 Tf 72 780 Td (\\001\\002\\003\\004\\005\\006\\007\\010\\016\\017\\020"
    b"\\021\\022\\023\\024\\025\\026\\027\\030\\031\\032\\033) Tj\n"
    b"0 -16 Td (\\001\\002\\003\\004\\005\\006\\007\\010\\016\\017\\020"
    b"\\021\\022\\023\\024\\025\\026\\027\\030\\031\\032\\033) Tj ET\n"
)


def test_reads_the_text_layer_of_a_generated_pdf():
    report = read_text_layer(build_pdf(TYPESET))
    assert report["has_text_layer"] is True
    assert report["text"].splitlines() == [
        "Facture n\xf8 2024-000431",
        "\xc9mise le 3 avril 2024",
        "Total : 92,40 EUR",
    ]
    assert report["pages"] == 1
    assert report["reason"] is None


def test_reads_an_uncompressed_content_stream():
    report = read_text_layer(build_pdf(TYPESET, compress=False))
    assert "Facture" in report["text"]


def test_reads_escapes_and_hex_strings():
    # Parentheses escaped, an octal byte, a hex string, and a hex string in
    # UTF-16 with its byte-order mark: four spellings one document may mix.
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


def test_reads_a_document_written_to_a_temporary_directory():
    # The only file this test suite writes, and it dies with the directory.
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory) / "facture.pdf"
        path.write_bytes(build_pdf(TYPESET))
        assert read_text_layer(path.read_bytes())["has_text_layer"] is True


def test_a_stamped_page_number_is_not_a_text_layer():
    # A scanner that stamps the page number as real text leaves one character
    # of text on an image. Counting characters is what keeps that from
    # passing for a document that can be read without OCR.
    report = read_text_layer(build_pdf(b"BT /F1 10 Tf 300 40 Td (3) Tj ET\n"))
    assert report["text"] == "3"
    assert report["characters"] < MIN_CHARACTERS
    assert report["has_text_layer"] is False


def test_bytes_that_are_not_a_pdf_do_not_raise():
    report = read_text_layer(b"this is not a PDF at all")
    assert report["has_text_layer"] is False
    assert report["pages"] == 0


def test_breaking_point_a_really_scanned_page_has_no_text_layer():
    """
    The breaking point claimed on the entry: a page that was really scanned
    carries no text layer, and no amount of parsing will invent one.

    The document below is valid, has one page, and that page is a photograph.
    What matters here is not that the extraction returns nothing — it is that
    the function says why. An empty string would read as « this page is
    blank », and the caller would file an empty document instead of sending
    it to an OCR engine.
    """
    report = read_text_layer(build_pdf(SCANNED))
    assert report["pages"] == 1
    assert report["has_text_layer"] is False
    assert report["characters"] == 0
    assert "OCR" in report["reason"]


def test_breaking_point_a_scan_whose_picture_is_a_jpeg_holds_just_as_well():
    """
    The same claim on the document a scanner really produces.

    Its picture is already compressed, so it does not inflate and is read byte
    for byte; a quarter of a megabyte of such bytes holds `BT`, a bracket and
    `Tj` by chance many times over.

    Which is why the streams a page does not draw text from are left alone. A
    reader that walked all of them would report several thousand characters
    here, and the caller would file a scanned page as already read.
    """
    report = read_text_layer(build_pdf(SCANNED, photo=photograph(250_000)))
    assert report["pages"] == 1
    assert report["has_text_layer"] is False
    assert report["characters"] == 0
    assert "OCR" in report["reason"]


def test_a_text_layer_this_function_cannot_decode_is_not_called_readable():
    """
    The other honest no, and the one that costs the most when it is got wrong.

    A word processor exports its text through a subset font whose glyphs are
    renumbered from one. The page does carry its text, and this function does
    not carry the table that turns those codes back into letters. Counting them
    would report a readable page and hand back gibberish to index.

    So the answer is no, and the reason is not the OCR one: a recognition
    engine is the wrong tool for a document that was never a picture.
    """
    report = read_text_layer(build_pdf(GLYPH_CODES))
    assert report["has_text_layer"] is False
    assert report["characters"] == 0
    assert "font table" in report["reason"]
    assert "OCR" not in report["reason"]
