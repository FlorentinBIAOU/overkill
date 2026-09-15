import builtins
import colorsys
import json
import os
import re
import shutil
import subprocess
import time
import unicodedata
import xml.etree.ElementTree as ElementTree
from pathlib import Path

import pytest

from _harness.fake_llm import hash_word
from n0 import placeholder_svg, stable_hash

ICI = Path(__file__).parent
SVG_NS = "{http://www.w3.org/2000/svg}"

# The exact markup expected for one identifier. The same literal appears in
# n0.test.js: that is what pins the two implementations to each other, and it
# would break the moment either language rounded a colour differently.
GOLDEN_MUG = (
    '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"'
    ' viewBox="0 0 60 60" role="img" aria-label="mug-106">'
    '<rect width="60" height="60" fill="#dae8f0"/>'
    '<rect x="24" y="12" width="12" height="12" fill="#317fa6"/>'
    '<rect x="0" y="36" width="12" height="12" fill="#317fa6"/>'
    '<rect x="48" y="36" width="12" height="12" fill="#317fa6"/>'
    '<rect x="24" y="48" width="12" height="12" fill="#317fa6"/>'
    "</svg>"
)

# Les familles de teintes de l'essai (content/tryouts/live/generate-placeholder-images.js),
# bornes supérieures exclues. Recopiées ici parce que Python ne peut pas
# importer le module de l'essai ; le test JavaScript, lui, l'importe.
FAMILLES = [(15, "rouge"), (40, "orange"), (70, "jaune"), (160, "vert"),
            (200, "turquoise"), (255, "bleu"), (290, "violet"),
            (330, "magenta"), (360, "rouge")]


def teinte(identifiant):
    return (stable_hash(identifiant) >> 16) % 360


def famille(identifiant):
    t = teinte(identifiant)
    return next(nom for borne, nom in FAMILLES if t < borne)


def couleurs(svg):
    return [part.split('"')[0] for part in svg.split('fill="')[1:]]


def cellules(svg):
    """Les cases allumées, en (colonne, ligne), lues dans le balisage parsé."""
    racine = ElementTree.fromstring(svg)
    rects = racine.findall(f"{SVG_NS}rect")[1:]
    cote = int(racine.get("width")) // 5
    marge = (int(racine.get("width")) - cote * 5) // 2
    return {((int(r.get("x")) - marge) // cote, (int(r.get("y")) - marge) // cote) for r in rects}


def hsl_flottant(h, s, l):
    r, g, b = colorsys.hls_to_rgb(h / 360, l / 100, s / 100)
    return (r * 255, g * 255, b * 255)


def canaux(hexa):
    return tuple(int(hexa[i:i + 2], 16) for i in (1, 3, 5))


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_red_velvet_sofa_ne_tombe_pas_dans_les_rouges():
    """« "red velvet sofa" ne tombe pas dans les rouges »."""
    assert teinte("red velvet sofa") == 323
    assert famille("red velvet sofa") == "magenta"
    assert not (teinte("red velvet sofa") < 30 or teinte("red velvet sofa") > 330)
    # Témoin : la roue atteint bien les rouges — pour « blue velvet sofa », ce
    # qui achève la démonstration.
    assert teinte("blue velvet sofa") == 1
    assert famille("blue velvet sofa") == "rouge"


def test_point_de_rupture_sofa_1_et_sofa_2_recoivent_des_teintes_eloignees():
    """« sofa-1 et sofa-2 reçoivent des teintes éloignées alors qu'il s'agit du même canapé »."""
    assert (teinte("sofa-1"), teinte("sofa-2")) == (178, 226)
    assert abs(teinte("sofa-1") - teinte("sofa-2")) > 30
    assert placeholder_svg("sofa-1") != placeholder_svg("sofa-2")
    # Témoin : le même identifiant, lui, redonne la même teinte et la même image.
    assert placeholder_svg("sofa-1") == placeholder_svg("sofa-1")


def test_point_de_rupture_la_sortie_nest_que_des_rectangles_pleins_en_deux_couleurs():
    """« la sortie n'est jamais que des rectangles pleins en deux couleurs »."""
    for identifiant in ["red velvet sofa", "sofa-1", "sofa-2", "Boulangerie Martin"] + [
        f"sku-{i}" for i in range(200)
    ]:
        svg = placeholder_svg(identifiant)
        racine = ElementTree.fromstring(svg)
        assert all(enfant.tag == f"{SVG_NS}rect" for enfant in racine)
        assert len(set(couleurs(svg))) == 2
        assert svg.count("<") == svg.count("<rect") + 2  # the svg element and its close
    # Témoin : les deux couleurs sont bien distinctes, le fond et l'encre.
    fond, encre = couleurs(placeholder_svg("red velvet sofa"))[:2]
    assert fond != encre


def test_point_de_rupture_le_hachage_decide_de_tout_deux_identifiants_en_collision_donnent_le_meme_dessin():
    """
    « le hachage décide de tout, le sens de l'identifiant de rien » : deux mots
    sans rapport dont le FNV-1a 32 bits coïncide reçoivent la même figure, au
    nom accessible près.
    """
    assert stable_hash("costarring") == stable_hash("liquid")
    a = placeholder_svg("costarring").replace('aria-label="costarring"', "")
    b = placeholder_svg("liquid").replace('aria-label="liquid"', "")
    assert a == b
    # Témoin : sans collision, la figure change.
    assert placeholder_svg("costarring") != placeholder_svg("costarrings")


# ---------------------------------------------------------------------------
# Les autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_le_balisage_attendu_est_exactement_celui_du_test_javascript():
    """verdict_rationale : « le même balisage attendu figure en toutes lettres dans les deux tests »."""
    assert placeholder_svg("mug-106", 60) == GOLDEN_MUG
    source_js = (ICI / "n0.test.js").read_text(encoding="utf-8")
    bloc = re.search(r"const GOLDEN_MUG =(.*?);", source_js, re.S).group(1)
    assert "".join(re.findall(r"'([^']*)'", bloc)) == GOLDEN_MUG


def test_python_et_javascript_saccordent_au_caractere_pres():
    """
    Docstring : « lets the Python and the JavaScript version agree character
    for character », « the same image on every machine, in every language ».
    Deux mille identifiants, dont accents, emoji et marques, toutes teintes
    couvertes, sur plusieurs tailles, comparés à la sortie réelle de n0.js.
    """
    node = shutil.which("node")
    assert node, "node est requis pour comparer les deux implémentations"
    identifiants = [f"sku-{i}" for i in range(2000)] + [
        "", "café-crème", "cafe\u0301", "\ufeffsku", "a\u200bb", "canapé 🛋️",
        'chaise "Löw" & <co>', "ZAŻÓŁĆ", "\u00a0espace",
    ]
    tailles = [240, 60, 7, 5, 4, 1, 0, 1001]
    attendu = [[placeholder_svg(i, t) for t in tailles] for i in identifiants]
    assert len({teinte(i) for i in identifiants}) == 360
    script = (
        f"import {{ placeholderSvg }} from {json.dumps((ICI / 'n0.js').as_uri())};"
        "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{"
        "const {ids,sizes}=JSON.parse(d);"
        "process.stdout.write(JSON.stringify(ids.map(i=>sizes.map(s=>placeholderSvg(i,s)))));});"
    )
    sortie = subprocess.run(
        [node, "--input-type=module", "-e", script],
        input=json.dumps({"ids": identifiants, "sizes": tailles}),
        capture_output=True, text=True, timeout=60, check=True,
    )
    assert json.loads(sortie.stdout) == attendu


def test_est_deterministe_et_depend_de_lidentifiant():
    """Docstring : « The same identifier always yields exactly the same image »."""
    assert placeholder_svg("sku-4451") == placeholder_svg("sku-4451")
    assert placeholder_svg("sku-4451") != placeholder_svg("sku-4452")


def test_le_hachage_est_le_fnv_1a_32_bits_de_reference():
    """Commentaire : « FNV-1a, the same constants as the rest of the catalogue »."""
    assert stable_hash("") == 0x811C9DC5
    assert stable_hash("a") == 0xE40C292C
    assert stable_hash("foobar") == 0xBF9CF968
    for mot in ["sku-4451", "café-crème", "canapé 🛋️"]:
        assert stable_hash(mot) == hash_word(mot)


def test_le_hash_natif_de_python_change_dun_processus_a_lautre():
    """Docstring de stable_hash : « that one is salted per process »."""
    valeurs = set()
    for graine in ("1", "2"):
        env = {**os.environ, "PYTHONHASHSEED": graine}
        r = subprocess.run([os.sys.executable, "-c", "print(hash('sku-4451'))"],
                           capture_output=True, text=True, env=env, check=True, timeout=30)
        valeurs.add(r.stdout.strip())
    assert len(valeurs) == 2
    # Témoin : stable_hash, lui, ne dépend pas de la graine.
    assert stable_hash("sku-4451") == stable_hash("sku-4451")


def test_la_figure_est_symetrique():
    """Docstring : « Mirroring the left columns onto the right ones »."""
    # Assertion d'origine, conservée : la paire miroir de la troisième ligne.
    assert '<rect x="0" y="36"' in GOLDEN_MUG
    assert '<rect x="48" y="36"' in GOLDEN_MUG
    for i in range(300):
        cases = cellules(placeholder_svg(f"sku-{i}", 60))
        assert cases == {(4 - x, y) for x, y in cases}


def test_les_bits_hauts_choisissent_la_teinte_et_les_bits_bas_les_cases():
    """Docstring : « The high bits of the hash choose the hue, the low ones switch cells on and off »."""
    for i in range(300):
        identifiant = f"sku-{i}"
        digest = stable_hash(identifiant)
        attendues = {
            (colonne, ligne)
            for ligne in range(5) for colonne in range(5)
            if (digest >> (ligne * 3 + min(colonne, 4 - colonne))) & 1
        }
        assert cellules(placeholder_svg(identifiant, 60)) == attendues
        fond = canaux(couleurs(placeholder_svg(identifiant, 60))[0])
        attendu = hsl_flottant(teinte(identifiant), 45, 90)
        assert all(abs(c - a) <= 2 for c, a in zip(fond, attendu))


def test_le_fond_teinte_et_lencre_sont_la_conversion_hsl_des_pourcentages_annonces():
    """Commentaire : « HSL to hexadecimal, in integers only », sur toute la roue."""
    from n0 import _hex_colour

    for h in range(360):
        for s, l in ((45, 90), (55, 42)):
            assert all(
                abs(c - a) <= 2
                for c, a in zip(canaux(_hex_colour(h, s, l)), hsl_flottant(h, s, l))
            ), (h, s, l)


def test_le_balisage_est_du_xml_bien_forme():
    root = ElementTree.fromstring(placeholder_svg("sku-4451"))
    assert root.tag == "{http://www.w3.org/2000/svg}svg"
    assert root.get("width") == "240"
    assert root.get("role") == "img"


def test_lidentifiant_est_recopie_dans_aria_label():
    """risks.regulatory : « L'identifiant reçu est recopié dans l'attribut aria-label du balisage servi »."""
    svg = placeholder_svg("client 4412 — Mme Durand")
    assert ElementTree.fromstring(svg).get("aria-label") == "client 4412 — Mme Durand"


def test_aucun_fichier_ecrit_et_aucune_dependance_externe(monkeypatch):
    """
    Docstring et scenario : « No file is written and no byte is downloaded »,
    « sans réseau et sans fichier écrit sur le disque ». La garde réseau du
    conftest est active ; on interdit en plus toute ouverture de fichier.
    """
    def refuser(*args, **kwargs):
        raise AssertionError("un fichier a été ouvert")

    monkeypatch.setattr(builtins, "open", refuser)
    monkeypatch.setattr(os, "open", refuser)
    svg = placeholder_svg("sku-4451")
    monkeypatch.undo()
    assert isinstance(svg, str)
    # The only URL in the output is the SVG namespace itself.
    assert svg.count("http") == 1
    for forbidden in ("<image", "href", "url(", "@font-face", "<script"):
        assert forbidden not in svg


def test_une_image_prend_moins_dune_milliseconde():
    """latency « <1 ms » : mille images en moins d'une seconde, soit moins d'une milliseconde chacune."""
    debut = time.perf_counter()
    for i in range(1000):
        placeholder_svg(f"sku-{i}")
    assert time.perf_counter() - debut < 1.0


def test_lessai_un_identifiant_qui_dit_rouge_sort_en_vert():
    """Essai, why : « Le mot "rouge" est dans l'identifiant et l'image sort en vert »."""
    assert teinte("canapé en velours rouge") == 159
    assert famille("canapé en velours rouge") == "vert"


def test_lessai_deux_vues_du_meme_canape_donnent_un_bleu_et_un_vert():
    """Essai, why : « un bleu et un vert pour deux vues du même canapé »."""
    assert famille("canape-4501-vue-face") == "bleu"
    assert famille("canape-4501-vue-profil") == "vert"


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_un_identifiant_vide_donne_une_image():
    # A missing reference is exactly when a placeholder is needed, so an empty
    # identifier has to give an image rather than an exception.
    svg = placeholder_svg("")
    assert ElementTree.fromstring(svg).get("aria-label") == ""
    assert svg.startswith("<svg ") and svg.endswith("</svg>")


def test_production_un_identifiant_absent_leve_une_typeerror():
    """None n'est pas un identifiant vide : la fonction lève, elle ne rend pas d'image."""
    with pytest.raises(TypeError):
        placeholder_svg(None)


def test_production_un_identifiant_dun_megaoctet_termine_vite():
    identifiant = "sku-" * 250_000
    debut = time.perf_counter()
    svg = placeholder_svg(identifiant)
    assert time.perf_counter() - debut < 5.0
    assert ElementTree.fromstring(svg).get("aria-label") == identifiant


def test_production_accents_et_caracteres_de_balisage_sont_echappes():
    accented = placeholder_svg("café-crème")
    assert ElementTree.fromstring(accented).get("aria-label") == "café-crème"

    escaped = placeholder_svg('chaise "Löw" & <co>')
    assert "&amp;" in escaped and "&lt;co&gt;" in escaped
    assert ElementTree.fromstring(escaped).get("aria-label") == 'chaise "Löw" & <co>'


def test_production_lesperluette_est_echappee_en_premier():
    """Commentaire : « The ampersand goes first, or it would escape the escapes »."""
    svg = placeholder_svg("&lt;déjà échappé&gt;")
    assert 'aria-label="&amp;lt;déjà échappé&amp;gt;"' in svg
    assert ElementTree.fromstring(svg).get("aria-label") == "&lt;déjà échappé&gt;"


def test_production_une_injection_de_balisage_reste_dans_lattribut():
    svg = placeholder_svg('"/><script>alert(1)</script><rect x="')
    assert "<script" not in svg
    racine = ElementTree.fromstring(svg)
    assert racine.get("aria-label") == '"/><script>alert(1)</script><rect x="'
    assert all(enfant.tag == f"{SVG_NS}rect" for enfant in racine)


def test_production_nfc_et_nfd_du_meme_mot_donnent_deux_images_differentes():
    """
    Le hachage porte sur les points de code, pas sur le texte lu : « café »
    composé et décomposé, identiques à l'écran, reçoivent deux images.
    """
    nfc = unicodedata.normalize("NFC", "café")
    nfd = unicodedata.normalize("NFD", "café")
    assert placeholder_svg(nfc) != placeholder_svg(nfd)
    assert placeholder_svg(nfc) == placeholder_svg("café")


def test_production_insecables_largeur_nulle_emoji_et_bom_sont_recopies_tels_quels():
    for identifiant in ["prix\u00a0doux", "a\u200bb", "canapé 🛋️", "\ufeffsku-1", "SKU-1"]:
        svg = placeholder_svg(identifiant)
        assert ElementTree.fromstring(svg).get("aria-label") == identifiant
    # Casse mixte : deux identifiants distincts, deux images.
    assert placeholder_svg("SKU-1") != placeholder_svg("sku-1")


def test_un_caractere_de_controle_rend_le_svg_mal_forme():
    ElementTree.fromstring(placeholder_svg("canapé\x0b4501"))


def test_production_tailles_aux_limites():
    # A small size still gives whole pixels.
    svg = placeholder_svg("mug-106", 7)
    assert 'width="1"' in svg
    assert ElementTree.fromstring(svg).get("width") == "7"
    # Exactement la grille : une case d'un pixel.
    assert 'width="1" height="1"' in placeholder_svg("mug-106", 5)
    # Juste en dessous : les cases font zéro pixel, il ne reste que le fond.
    petit = placeholder_svg("mug-106", 4)
    assert all('width="0"' in r for r in petit.split("<rect")[2:])
    # Zéro : un SVG vide mais bien formé.
    assert ElementTree.fromstring(placeholder_svg("mug-106", 0)).get("width") == "0"
    # Juste au-dessus d'un multiple de la grille : la marge centre la figure.
    racine = ElementTree.fromstring(placeholder_svg("sku-1", 64))
    xs = {int(r.get("x")) for r in racine.findall(f"{SVG_NS}rect")[1:]}
    assert xs and all((x - 2) % 12 == 0 and 2 <= x <= 50 for x in xs)
