import io
import time

from fixtures import (ENTETE_SCAN, MIXTE, MOJIBAKE, NUMERIQUE, NUMERO_PAGE, SCAN, VIDE)
from n0 import MIN_CHARACTERS, triage_pages


def pages_de(pdf: bytes) -> list[str]:
    """Le texte de chaque page, tel que N0 le lit, pour nourrir N1."""
    from pypdf import PdfReader
    return [p.extract_text() or "" for p in PdfReader(io.BytesIO(pdf)).pages]


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_une_couche_texte_illisible_compte_comme_du_texte():
    """
    « Une page dont la police n'a pas de table de caractères extrait
    « #$%&'*+,-./0123 » là où elle affiche un paragraphe, et N0 la range parmi
    les pages lisibles. »
    """
    plan = triage_pages(MOJIBAKE)
    assert plan["pages"] == [{"page": 1, "characters": 183, "images": 0, "verdict": "text"}]
    assert plan["readable"] == [1]
    assert plan["needs_ocr"] == []
    # Le texte lu est bien celui que la fiche cite.
    assert pages_de(MOJIBAKE)[0].startswith("#$%&!*+,-./0123456")


def test_point_de_rupture_temoin_une_vraie_page_de_texte_est_rangee_pareil():
    """« Le témoin : une page de contrat ordinaire est rangée exactement de même. »"""
    plan = triage_pages(NUMERIQUE)
    assert [p["verdict"] for p in plan["pages"]] == ["text", "text"]
    assert plan["readable"] == [1, 2]
    # Les deux pages, la lisible et l'illisible, sont indistinguables ici :
    # même verdict, même ordre de grandeur de caractères.
    assert abs(plan["pages"][0]["characters"] - triage_pages(MOJIBAKE)["pages"][0]["characters"]) < 60


# ---------------------------------------------------------------------------
# Les autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_la_decision_est_prise_page_par_page():
    """
    Docstring : « A contract exported from a word processor with a scanned
    signature page at the end is one file with two kinds of page in it ».
    """
    plan = triage_pages(MIXTE)
    assert [p["verdict"] for p in plan["pages"]] == ["text", "scan", "text"]
    assert plan["needs_ocr"] == [2]
    assert plan["readable"] == [1, 3]


def test_un_scan_qui_porte_un_entete_en_vrai_texte_reste_un_scan():
    """
    Docstring : « a scanned page often carries a header or a page number in
    real text, which a rule that only asks "is there any text" counts as a
    readable page ». R4 : les deux règles, sur le même document.
    """
    page = triage_pages(ENTETE_SCAN)["pages"][0]
    assert (page["characters"], page["images"]) == (28, 1)
    assert page["verdict"] == "scan"
    # La règle « y a-t-il du texte » — celle d'un seuil bas — le déclare lisible.
    assert triage_pages(ENTETE_SCAN, min_characters=24)["pages"][0]["verdict"] == "text"
    # Témoin : au seuil de la fiche, une vraie page de texte reste lisible.
    assert triage_pages(NUMERIQUE)["pages"][0]["verdict"] == "text"


def test_une_page_sans_texte_et_sans_image_nest_pas_envoyee_a_locr():
    """
    Docstring : « nothing at all is a page OCR would return empty — which is
    worth knowing before paying ».
    """
    assert triage_pages(VIDE)["unreadable"] == [1]
    assert triage_pages(VIDE)["needs_ocr"] == []
    assert triage_pages(NUMERO_PAGE)["pages"][0] == {
        "page": 1, "characters": 3, "images": 0, "verdict": "blank"}


def test_un_scan_sans_aucun_texte_part_a_locr():
    plan = triage_pages(SCAN)
    assert plan["needs_ocr"] == [1, 2]
    assert [p["characters"] for p in plan["pages"]] == [0, 0]
    assert [p["images"] for p in plan["pages"]] == [1, 1]


def test_le_seuil_est_reglable_et_son_effet_est_visible():
    """R7 : ce que le réglage par défaut produit, et ce que le changer produit."""
    assert triage_pages(ENTETE_SCAN, min_characters=1)["readable"] == [1]
    assert triage_pages(ENTETE_SCAN, min_characters=120)["needs_ocr"] == [1]
    assert triage_pages(NUMERIQUE, min_characters=1000)["unreadable"] == [1, 2]


def test_un_fichier_qui_nest_pas_un_pdf_donne_une_raison_pas_une_exception():
    plan = triage_pages(b"ceci n'est pas un PDF")
    assert plan["pages"] == []
    assert plan["reason"].startswith("this file could not be opened as a PDF")


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_entree_banale_un_lot_de_documents_recus():
    """T5 : ce qu'une entreprise reçoit dans sa boîte, mêlé."""
    lot = [NUMERIQUE, SCAN, MIXTE, ENTETE_SCAN]
    plans = [triage_pages(d) for d in lot]
    assert [len(p["pages"]) for p in plans] == [2, 2, 3, 1]
    # Sur les huit pages du lot, quatre partent à l'OCR et quatre se lisent.
    assert sum(len(p["needs_ocr"]) for p in plans) == 4
    assert sum(len(p["readable"]) for p in plans) == 4


def test_production_entree_vide():
    plan = triage_pages(b"")
    assert plan["pages"] == []
    assert plan["reason"].startswith("this file could not be opened as a PDF")


def test_production_entree_tres_grande_et_terminaison_rapide():
    """Un PDF de deux cents pages : le tri doit rester linéaire."""
    from pypdf import PdfReader, PdfWriter
    ecrivain = PdfWriter()
    for _ in range(100):
        for page in PdfReader(io.BytesIO(MIXTE)).pages[:2]:
            ecrivain.add_page(page)
    tampon = io.BytesIO()
    ecrivain.write(tampon)
    debut = time.perf_counter()
    plan = triage_pages(tampon.getvalue())
    assert time.perf_counter() - debut < 60.0
    assert len(plan["pages"]) == 200
    assert len(plan["needs_ocr"]) == 100


def test_production_entree_malveillante_un_pdf_tronque():
    """Un fichier coupé au milieu : une raison, jamais une exception."""
    for coupe in (10, 200, len(MIXTE) // 2, len(MIXTE) - 1):
        plan = triage_pages(MIXTE[:coupe])
        assert isinstance(plan["pages"], list)
        assert plan["reason"] is None or plan["reason"].startswith("this file")


def test_production_valeurs_aux_limites():
    # Exactement le seuil, juste en dessous, juste au-dessus.
    caracteres = triage_pages(ENTETE_SCAN)["pages"][0]["characters"]
    assert triage_pages(ENTETE_SCAN, min_characters=caracteres)["pages"][0]["verdict"] == "text"
    assert triage_pages(ENTETE_SCAN, min_characters=caracteres + 1)["pages"][0]["verdict"] == "scan"
    # Un seuil de zéro rend tout lisible, y compris une page vide.
    assert triage_pages(VIDE, min_characters=0)["readable"] == [1]


def test_production_un_document_illisible_dans_un_lot_nempeche_pas_les_autres():
    """T8 : un fichier corrompu ne fait pas tomber le lot."""
    lot = [NUMERIQUE, b"pas un PDF", SCAN]
    plans = [triage_pages(d) for d in lot]
    assert [len(p["pages"]) for p in plans] == [2, 0, 2]
    assert plans[1]["reason"] is not None


def test_production_le_tri_tient_la_classe_de_latence_annoncee():
    """
    latency « ~10 ms » : cent tris d'un document de trois pages sous une borne
    d'effondrement large.
    """
    debut = time.perf_counter()
    for _ in range(100):
        triage_pages(MIXTE)
    assert time.perf_counter() - debut < 60.0
