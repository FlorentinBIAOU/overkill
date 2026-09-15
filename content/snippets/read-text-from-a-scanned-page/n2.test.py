"""
These tests inject a local double instead of running a real engine.

What they prove: the engine is called with the page it was given, the reading
is decoded and cleaned, a low confidence sends the page to a human without
losing the text, a failed call is retried, and an answer that is not a reading
never passes for one.

What they do not prove: that the engine reads the pixels correctly. That is
why this snippet is declared `verification: stubbed` on the entry, and why the
page says so next to the code.
"""

import json
import re
import shutil
import subprocess
import sys
import time
import types
from pathlib import Path

import pytest

import n2
from _harness.fake_model import FakeOCR
from n2 import DEFAULT_MIN_CONFIDENCE, LANGUAGE, OCRUnavailable, clean, read_page

ICI = Path(__file__).parent
PAGE = "scan-page-1.png"

# What an engine gives back on a clean office scan: the text, with the ragged
# spacing of a page that was photographed rather than typeset.
READING = (
    "NORD FOURNITURES SAS\n"
    "   N° 2024-000431\n"
    "\n"
    "   Émise le 3 avril 2024\n"
    "NET A PAYER    92,40 EUR\n"
)

# The shape of the invoice references, the hand-written rule the entry sends
# the reader back to.
REFERENCE = re.compile(r"\b\d{4}-\d{6}\b")


class FlakyEngine:
    """An engine that drops a call, the way a busy worker process does."""

    def __init__(self, engine, failures: int = 1):
        self.engine = engine
        self.failures = failures
        self.calls = 0

    def read(self, image_path):
        self.calls += 1
        if self.failures > 0:
            self.failures -= 1
            raise RuntimeError("the worker was not ready")
        return self.engine.read(image_path)


def faux_pytesseract(lignes, confiance=91):
    """
    Imite la surface publiée de pytesseract : `image_to_data(image, lang=…,
    output_type=Output.DICT)` rend un dictionnaire de colonnes TSV, une entrée
    par boîte de mise en page, `text` vide et `conf` à -1 pour les boîtes sans
    mot, `conf` converti en entier (int(float(…))) pour les mots.
    """
    module = types.ModuleType("pytesseract")
    module.Output = types.SimpleNamespace(DICT="dict")
    module.appels = []

    def image_to_data(image, lang=None, output_type=None):
        module.appels.append({"image": image, "lang": lang, "output_type": output_type})
        data = {"level": [], "line_num": [], "word_num": [], "conf": [], "text": []}
        data["level"].append(1); data["line_num"].append(0); data["word_num"].append(0)
        data["conf"].append(-1); data["text"].append("")
        for n, ligne in enumerate(lignes, start=1):
            data["level"].append(4); data["line_num"].append(n); data["word_num"].append(0)
            data["conf"].append(-1); data["text"].append("")
            for m, mot in enumerate(ligne.split(), start=1):
                data["level"].append(5); data["line_num"].append(n); data["word_num"].append(m)
                data["conf"].append(confiance); data["text"].append(mot)
        return data

    module.image_to_data = image_to_data
    pil = types.ModuleType("PIL")
    image = types.ModuleType("PIL.Image")
    image.open = lambda path: f"<image {path}>"
    pil.Image = image
    return module, pil, image


@pytest.fixture
def vrai_moteur_simule(monkeypatch):
    module, pil, image = faux_pytesseract(["NORD FOURNITURES SAS", "N° 2024-000431", "NET A PAYER 92,40 EUR"])
    monkeypatch.setitem(sys.modules, "pytesseract", module)
    monkeypatch.setitem(sys.modules, "PIL", pil)
    monkeypatch.setitem(sys.modules, "PIL.Image", image)
    return module


def clean_en_javascript(textes):
    node = shutil.which("node")
    assert node, "node est requis pour comparer les deux implémentations"
    script = (
        f"import {{ clean }} from {json.dumps((ICI / 'n2.js').as_uri())};"
        "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{"
        "process.stdout.write(JSON.stringify(JSON.parse(d).map(clean)));});"
    )
    sortie = subprocess.run([node, "--input-type=module", "-e", script], input=json.dumps(textes),
                            capture_output=True, text=True, timeout=60, check=True)
    return json.loads(sortie.stdout)


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_une_lecture_fausse_et_sure_delle_laisse_le_drapeau_baisse():
    """
    « ce qui revient est "N° 2O24-OOO431", la lettre O là où la facture imprimait
    un zéro, avec un score haut. Le drapeau de relecture reste alors baissé ».
    """
    engine = FakeOCR({PAGE: "N° 2O24-OOO431"}, confidence=0.96)
    result = read_page(PAGE, engine)
    assert result == {"text": "N° 2O24-OOO431", "confidence": 0.96, "review": False}
    assert "2024-000431" not in result["text"]


def test_point_de_rupture_un_seuil_ne_distingue_pas_une_lecture_fausse_dune_juste_au_meme_score():
    """
    « un seuil attrape une page sur laquelle le moteur a peiné, pas une page qu'il
    a mal lue sans peiner » : à chaque seuil, la lecture fausse et la lecture
    juste rendues au même score reçoivent le même drapeau.
    """
    for centiemes in range(0, 101):
        seuil = centiemes / 100
        fausse = read_page(PAGE, FakeOCR({PAGE: "N° 2O24-OOO431"}, confidence=0.96), min_confidence=seuil)
        juste = read_page(PAGE, FakeOCR({PAGE: "N° 2024-000431"}, confidence=0.96), min_confidence=seuil)
        assert fausse["review"] == juste["review"], seuil
    # Témoin : une page sur laquelle le moteur a peiné, elle, est attrapée.
    assert read_page(PAGE, FakeOCR({PAGE: READING}, confidence=0.41))["review"] is True


def test_defaut_le_moteur_par_defaut_rend_les_lignes_de_la_page(vrai_moteur_simule):
    assert read_page(PAGE)["text"].splitlines() == ["NORD FOURNITURES SAS", "N° 2024-000431", "NET A PAYER 92,40 EUR"]


def test_infirme_python_et_javascript_recollent_les_memes_mots():
    textes = ["réfé-\nrence", "ache-\ntée", "exem-\nplaire", "N°  2024\n\n  NET\xa0A PAYER"]
    assert clean_en_javascript(textes) == [clean(t) for t in textes]


def test_une_confiance_basse_garde_le_texte_et_demande_un_humain():
    """Commentaire : « A doubtful page is not thrown away: it goes to a human with the text and the score »."""
    result = read_page(PAGE, FakeOCR({PAGE: READING}, confidence=0.41))
    assert "NORD FOURNITURES SAS" in result["text"]
    assert result["confidence"] == 0.41
    assert result["review"] is True


def test_le_seuil_par_defaut_juste_au_dessus_et_juste_en_dessous():
    """Commentaire : « Below this, the page is still returned, but flagged »."""
    assert DEFAULT_MIN_CONFIDENCE == 0.70
    assert read_page(PAGE, FakeOCR({PAGE: READING}, confidence=0.70))["review"] is False
    assert read_page(PAGE, FakeOCR({PAGE: READING}, confidence=0.6999))["review"] is True


def test_une_page_blanche_est_signalee_quelle_que_soit_lassurance_du_moteur():
    assert read_page(PAGE, FakeOCR({}, confidence=0.99)) == {"text": "", "confidence": 0.99, "review": True}


@pytest.mark.parametrize("valeur", ["high", True, None, float("nan"), 1.5, -0.1, 94])
def test_une_confiance_qui_nest_pas_un_nombre_entre_zero_et_un_nest_pas_une_confiance(valeur):
    """Docstring de _confidence : « A number the caller can act on, rather than whatever came back »."""
    result = read_page(PAGE, FakeOCR({PAGE: READING}, confidence=valeur))
    assert result["confidence"] == 0.0
    assert result["review"] is True


def test_reessaie_un_appel_tombe_et_abandonne_apres_la_derniere_tentative():
    """Docstring de _read : « a failed call is retried, not swallowed »."""
    engine = FlakyEngine(FakeOCR({PAGE: READING}))
    assert "NORD FOURNITURES SAS" in read_page(PAGE, engine)["text"]
    assert engine.calls == 2
    engine = FlakyEngine(FakeOCR({PAGE: READING}), failures=5)
    with pytest.raises(OCRUnavailable, match="the worker was not ready"):
        read_page(PAGE, engine, attempts=2)
    assert engine.calls == 2


def test_production_zero_tentative_leve_sans_appeler():
    engine = FlakyEngine(FakeOCR({PAGE: READING}), failures=0)
    with pytest.raises(OCRUnavailable):
        read_page(PAGE, engine, attempts=0)
    assert engine.calls == 0


@pytest.mark.parametrize("reponse", ["NORD FOURNITURES SAS", {"confidence": 0.9}, {"text": None}, {"text": 42}, None])
def test_une_reponse_qui_nest_pas_une_lecture_leve(reponse):
    class Engine:
        def read(self, image_path):
            return reponse

    with pytest.raises(OCRUnavailable):
        read_page(PAGE, Engine())


def test_deterministe_la_meme_lecture_donne_le_meme_resultat():
    """Docstring : « the same image gives the same reading every time » — pour la part que le code tient."""
    assert read_page(PAGE, FakeOCR({PAGE: READING})) == read_page(PAGE, FakeOCR({PAGE: READING}))


def test_lessai_rend_ce_que_ses_cas_annoncent():
    """Essai figé : le scan net classé, le mot recollé, le fax pâle et le verso vierge en relecture, l'appel tombé repris."""
    nette = read_page("scan-facture-000431.png", FakeOCR({"scan-facture-000431.png": READING}, confidence=0.94))
    assert nette["review"] is False
    coupee = "Merci de joindre un second exem-\nplaire de la facture au bon de\nlivraison.\n"
    assert "exemplaire" in read_page("b.png", FakeOCR({"b.png": coupee}, confidence=0.91))["text"]
    assert "duplicate" in read_page("b.png", FakeOCR({"b.png": "Please attach a second dupli-\ncate of the invoice"}))["text"]
    assert read_page("f.png", FakeOCR({"f.png": READING}, confidence=0.41))["review"] is True
    assert read_page("v.png", FakeOCR({}, confidence=0.99))["review"] is True
    reprise = FlakyEngine(FakeOCR({"s.png": READING}, confidence=0.94), failures=1)
    assert read_page("s.png", reprise)["review"] is False and reprise.calls == 2
    confiante = read_page("c.png", FakeOCR({"c.png": "N° 2O24-OOO431\n   NET A PAYER    92,40 EUR\n"}, confidence=0.96))
    assert confiante["review"] is False and "2O24-OOO431" in confiante["text"]


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_nettoyer_une_lecture_vide_reste_vide():
    assert clean("") == ""
    assert clean("   \n\n \t \n") == ""


def test_production_espaces_insecables_fins_de_ligne_windows_nfd_emoji_et_bom():
    lecture = "NORD\xa0\xa0FOURNITURES\r\n\ufeffN° 2024\r\ncafe\u0301 🧾\r\n"
    assert clean(lecture).splitlines() == ["NORD FOURNITURES", "\ufeffN° 2024", "cafe\u0301 🧾"]


def test_production_une_lecture_dun_megaoctet_se_nettoie_vite():
    lecture = ("NET A PAYER    92,40 EUR   exem-\nplaire\n\n" * 30_000)
    debut = time.perf_counter()
    texte = read_page(PAGE, FakeOCR({PAGE: lecture}))["text"]
    assert time.perf_counter() - debut < 5.0
    assert texte.count("exemplaire") == 30_000


def test_defaut_une_reference_coupee_en_fin_de_ligne_garde_son_trait_dunion():
    texte = read_page(PAGE, FakeOCR({PAGE: "Facture N° 2024-\n000431"}, confidence=0.95))["text"]
    assert REFERENCE.search(texte.replace("\n", "")) is not None
