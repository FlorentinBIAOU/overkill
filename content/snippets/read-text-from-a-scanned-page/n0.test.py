"""
Les deux documents de ce test sont réels, pas fabriqués à la main.

`contrat-libreoffice.pdf` est l'export PDF d'un traitement de texte — le cas
que le scénario de la fiche donne en exemple, et celui qui fait échouer un
lecteur de flux écrit à la main : la police y est un sous-ensemble renuméroté.
`scan-image-seule.pdf` est la même page, rendue en image puis remise dans un
PDF : aucun caractère, une image plein cadre.

Ce que ces tests prouvent : la décision que prend l'extrait, et le rapport
qu'il rend. Ce qu'ils ne prouvent pas : que `pypdf` lit bien un PDF, ce qui est
son affaire et celle de ses propres tests.
"""

import ast
import sys
import time
from pathlib import Path

import pytest

from n0 import MIN_CHARACTERS, read_text_layer

ICI = Path(__file__).parent
CONTRAT = (ICI / "contrat-libreoffice.pdf").read_bytes()
SCAN = (ICI / "scan-image-seule.pdf").read_bytes()

# Le début du contrat, tel qu'il est écrit dans le document source.
PREMIERE_LIGNE = "Contrat de prestation"


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_une_page_scannee_ne_rend_pas_une_chaine_vide_mais_un_refus():
    """
    breaking_point : « une page scannée ne porte aucun caractère, et l'extrait
    le dit au lieu de rendre une chaîne vide ». Témoin : le même document, avant
    d'être rendu en image, est lu.
    """
    rapport = read_text_layer(SCAN)
    assert rapport["has_text_layer"] is False
    assert rapport["text"] == ""
    assert rapport["characters"] == 0
    assert rapport["pages"] == 1  # le fichier est valide, et il a bien une page
    assert rapport["reason"] == "no text layer: this page is an image, and needs OCR"
    assert read_text_layer(CONTRAT)["has_text_layer"] is True


def test_point_de_rupture_l_extrait_ne_lit_pas_les_pixels_et_ne_le_pretend_pas():
    """
    breaking_point : « ce que ce niveau ne saura jamais faire, c'est lire la page
    qui n'a pas de texte ». Le rapport nomme l'étape suivante, il ne la fait pas.
    """
    assert "needs OCR" in read_text_layer(SCAN)["reason"]
    # Et rien dans l'extrait ne ressemble à de la reconnaissance : il n'importe
    # qu'un lecteur de PDF.
    source = ast.parse((ICI / "n0.py").read_text(encoding="utf-8"))
    importes = {a.name.split(".")[0] for n in ast.walk(source) if isinstance(n, ast.Import) for a in n.names}
    importes |= {n.module.split(".")[0] for n in ast.walk(source) if isinstance(n, ast.ImportFrom)}
    assert importes == {"__future__", "io", "pypdf"}


# ---------------------------------------------------------------------------
# Autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_lit_l_export_d_un_traitement_de_texte_polices_sous_ensemble_comprises():
    """
    docstring : « two hundred lines that still lose to the first font the file
    renumbers for itself, which is what a word processor does on every export ».
    Ce document est cet export-là, et il est lu.
    """
    rapport = read_text_layer(CONTRAT)
    assert rapport["has_text_layer"] is True
    assert rapport["text"].startswith(PREMIERE_LIGNE)
    assert "Papeterie Lambert" in rapport["text"]
    assert "trente jours" in rapport["text"]
    assert rapport["reason"] is None
    assert rapport["pages"] == 1


def test_le_rapport_porte_la_decision_le_texte_le_compte_et_la_raison():
    """docstring : « The answer is a report, not a string »."""
    assert set(read_text_layer(CONTRAT)) == {"has_text_layer", "text", "characters", "pages", "reason"}
    assert read_text_layer(CONTRAT)["characters"] == 233


def test_le_seuil_est_parametrable_et_range_un_tampon_sous_l_image():
    """
    Commentaire de MIN_CHARACTERS : « Under this many readable characters, what
    was found is a stamp, a page number or a stray label, not a text layer ».
    """
    assert MIN_CHARACTERS == 24
    juste = read_text_layer(CONTRAT, min_characters=233)
    assert juste["has_text_layer"] is True
    trop = read_text_layer(CONTRAT, min_characters=234)
    assert trop["has_text_layer"] is False
    assert trop["reason"].endswith("needs OCR")
    # Le texte trouvé est rendu quand même : c'est au relecteur de voir.
    assert trop["text"].startswith(PREMIERE_LIGNE)


def test_le_compte_ne_retient_que_les_caracteres_lisibles():
    """`characters` ignore les blancs : un document qui n'est que des sauts de ligne n'a pas de couche de texte."""
    class Blanc:
        def __init__(self, _flux):
            self.pages = [self]

        def extract_text(self):
            return " \n\t " * 50

    rapport = read_text_layer(b"%PDF-1.7", reader=Blanc)
    assert rapport["characters"] == 0
    assert rapport["has_text_layer"] is False


def test_la_bibliotheque_est_injectee_pour_le_test_et_reelle_en_production():
    """docstring : « `reader` is injected by the tests; in production it is `pypdf.PdfReader` »."""
    lus = []

    class Double:
        def __init__(self, flux):
            lus.append(flux.read()[:4])
            self.pages = [self]

        def extract_text(self):
            return "Contrat de prestation, lu par le double, assez long pour passer le seuil."

    assert read_text_layer(CONTRAT, reader=Double)["has_text_layer"] is True
    assert lus == [b"%PDF"]
    # Par défaut, c'est bien `pypdf` qui est chargé, et il lit le même document.
    assert read_text_layer(CONTRAT)["text"].startswith(PREMIERE_LIGNE)


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_des_octets_qui_ne_sont_pas_un_pdf_ne_levent_pas():
    """Un fichier cassé est une réponse, pas une exception : la chaîne de traitement continue."""
    for donnees in (b"", b"pas un pdf", b"%PDF-1.7 tronqu\xc3\xa9", CONTRAT[:200]):
        rapport = read_text_layer(donnees)
        assert rapport["has_text_layer"] is False
        assert rapport["text"] == ""
        assert "could not be opened as a PDF" in rapport["reason"]


def test_production_une_bibliotheque_qui_leve_en_cours_de_lecture_est_rapportee():
    """Une page illisible au milieu d'un document ne fait pas tomber l'appelant."""
    class Casse:
        def __init__(self, _flux):
            self.pages = [self]

        def extract_text(self):
            raise RuntimeError("font table is broken")

    rapport = read_text_layer(b"%PDF-1.7", reader=Casse)
    assert rapport["has_text_layer"] is False
    assert "font table is broken" in rapport["reason"]


def test_production_un_document_vide_de_pages():
    class Sans:
        def __init__(self, _flux):
            self.pages = []

        def extract_text(self):  # pragma: no cover - jamais appelé
            return ""

    rapport = read_text_layer(b"%PDF-1.7", reader=Sans)
    assert (rapport["pages"], rapport["characters"], rapport["has_text_layer"]) == (0, 0, False)


def test_production_la_lecture_est_deterministe_et_tient_dans_une_borne_large():
    debut = time.perf_counter()
    premier = read_text_layer(CONTRAT)
    second = read_text_layer(CONTRAT)
    assert premier == second
    assert time.perf_counter() - debut < 10


def test_production_les_deux_documents_du_test_sont_ceux_qu_ils_disent_etre():
    """Un PDF produit par un traitement de texte, et la même page rendue en image."""
    assert CONTRAT.startswith(b"%PDF") and SCAN.startswith(b"%PDF")
    assert b"LibreOffice" in CONTRAT
    assert b"/Subtype /Image" in SCAN or b"/Subtype/Image" in SCAN
    assert b"/Subtype /Image" not in CONTRAT and b"/Subtype/Image" not in CONTRAT
