import base64
import json
import shutil
import subprocess
import time
from pathlib import Path

from n0 import HEAD, MIN_BYTES, sniff_file

ICI = Path(__file__).parent

# Des fichiers minimaux, fabriqués pour ce test. Les archives sont en base64
# parce que le test JavaScript porte exactement les mêmes octets : c'est ce qui
# épingle les deux implémentations l'une à l'autre.
PNG = bytes.fromhex("89504e470d0a1a0a0000000d4948445200000001000000010806000000" "1f15c489") + b"\x00" * 20
JPEG = bytes.fromhex("ffd8ffe000104a46494600010100000100010000") + b"\x00" * 20 + bytes.fromhex("ffd9")
GIF = b"GIF89a" + b"\x01\x00\x01\x00\x80\x00\x00" + b"\x00" * 20
PDF = b"%PDF-1.7\n%\xe2\xe3\xcf\xd3\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"
EXE = b"MZ\x90\x00" + b"\x00" * 60 + b"PE\x00\x00"
RTF = b"{\\rtf1\\ansi\\deff0 Bonjour}"
SVG = (b'<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg"'
       b' width="10" height="10"><rect width="10" height="10"/></svg>')
CSV = "nom;prenom;ville\nDupont;Jean;Boulogne-Billancourt\n".encode()
CSV_BOM = b"\xef\xbb\xbf" + CSV
JSON_FILE = b'{"nom": "Dupont"}'
TXT = "Bonjour, ceci est une note.\n".encode()
# Un TIFF minimal : un en-tête petit-boutien et un répertoire d'une entrée.
# Il sert à exercer l'alias « tif »/« tiff », que les deux tables n'écrivent
# pas pareil — puremagic rend « .tiff », file-type rend « tif ».
TIFF = bytes.fromhex("49492a00080000000100000103000100000001000000" "00000000")

ZIP = base64.b64decode(
    "UEsDBBQAAAAIAEMhNF3I8LalCQAAAAcAAAAJAAAAbm90ZXMudHh0S8rPy8ovLQIAUEsBAhQDFAAAAAgAQyE0Xc"
    "jwtqUJAAAABwAAAAkAAAAAAAAAAAAAAIABAAAAAG5vdGVzLnR4dFBLBQYAAAAAAQABADcAAAAwAAAAAAA=")
DOCX = base64.b64decode(
    "UEsDBBQAAAAIAEMhNF3GEnoHrAAAAPEAAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbF2Puw7CMAxFf6XKihoXBg"
    "aUlIEdGPgBK3HbiOahJBT4exKQOjBax/dcWxxfdm4Wisl4J9mWd+zYi9s7UGoKcUmyKedwAEhqIouJ+0CukMFH"
    "i7mMcYSA6o4jwa7r9qC8y+Rym6uD9eJS5NFoaq4Y8xktSQZPHzVorx62bPJiY83pF6vNkmEIs1GYy02wOP3X2f"
    "phMIrWfLWF6BWlZNxoZ74Si8Ztqh56Ad+n+g9QSwMEFAAAAAgAQyE0Xd1ahg0PAAAADQAAABEAAAB3b3JkL2Rv"
    "Y3VtZW50LnhtbLMpt0rJTy7NTc0r0bcDAFBLAQIUAxQAAAAIAEMhNF3GEnoHrAAAAPEAAAATAAAAAAAAAAAAAA"
    "CAAQAAAABbQ29udGVudF9UeXBlc10ueG1sUEsBAhQDFAAAAAgAQyE0Xd1ahg0PAAAADQAAABEAAAAAAAAAAAAA"
    "AIAB3QAAAHdvcmQvZG9jdW1lbnQueG1sUEsFBgAAAAACAAIAgAAAABsBAAAAAA==")
XLSX = base64.b64decode(
    "UEsDBBQAAAAIAEMhNF10vYL2rgAAAOkAAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbF2PsQ7CMAxEf6XKihoXBg"
    "bUloEdGPgBk7o0ahNHiSnl70lhYzpZp3t3ro+Lm4qZYrLsG7XVlTq29e0dKBXZ8alRg0g4ACQzkMOkOZDPTs/R"
    "oeQzPiCgGfFBsKuqPRj2Ql5KWRmqrS8ZHm1HxRWjnNFRo2CZ4MVxvDOPOrNUcfqF1t5GYQiTNSh5Ecy++2ssue"
    "+toY7N0+WITiESdmkgEjfpr2qH1m9WMLQ1fJ9pP1BLAwQUAAAACABDITRdzp6YEw0AAAALAAAADwAAAHhsL3dv"
    "cmtib29rLnhtbLMpzy/KTsrPz9a3AwBQSwECFAMUAAAACABDITRddL2C9q4AAADpAAAAEwAAAAAAAAAAAAAAgA"
    "EAAAAAW0NvbnRlbnRfVHlwZXNdLnhtbFBLAQIUAxQAAAAIAEMhNF3OnpgTDQAAAAsAAAAPAAAAAAAAAAAAAACA"
    "Ad8AAAB4bC93b3JrYm9vay54bWxQSwUGAAAAAAIAAgB+AAAAGQEAAAAA")
ODT = base64.b64decode(
    "UEsDBBQAAAAAAEMhNF1exjIMJwAAACcAAAAIAAAAbWltZXR5cGVhcHBsaWNhdGlvbi92bmQub2FzaXMub3Blbm"
    "RvY3VtZW50LnRleHRQSwMEFAAAAAgAQyE0XTFGq2oaAAAAGgAAAAsAAABjb250ZW50LnhtbLPJT0vLTE61Ssl"
    "PLs1NzSvRTc7PKwHS+nYAUEsBAhQDFAAAAAAAQyE0XV7GMgwnAAAAJwAAAAgAAAAAAAAAAAAAAIABAAAAAG1p"
    "bWV0eXBlUEsBAhQDFAAAAAgAQyE0XTFGq2oaAAAAGgAAAAsAAAAAAAAAAAAAAIABTQAAAGNvbnRlbnQueG1sUE"
    "sFBgAAAAACAAIAbwAAAJAAAAAAAA==")

RECONNUS = {"png": PNG, "jpg": JPEG, "gif": GIF, "pdf": PDF, "exe": EXE, "rtf": RTF,
            "tiff": TIFF, "zip": ZIP, "docx": DOCX, "xlsx": XLSX, "odt": ODT}
SANS_SIGNATURE = {"csv": CSV, "csv-bom": CSV_BOM, "json": JSON_FILE, "txt": TXT, "svg": SVG}
SANS_SIGNATURE_REASON = "no signature read from the bytes"


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_un_fichier_texte_na_pas_de_signature_a_lire():
    """
    « Un CSV, un JSON, un SVG et une note en texte brut n'ont aucun en-tête
    binaire : les deux bibliothèques ne reconnaissent rien. »
    """
    for nom, octets in SANS_SIGNATURE.items():
        rapport = sniff_file(octets, claimed_name="clients.csv", allowed=("csv",))
        assert rapport["detected"] is None, nom
        assert rapport["reason"] == SANS_SIGNATURE_REASON, nom
        assert rapport["matches_claim"] is None, nom
        # Et ce qui n'est pas reconnu n'est jamais autorisé.
        assert rapport["allowed"] is False, nom


def test_point_de_rupture_temoin_les_formats_binaires_sont_bien_reconnus():
    """« Le témoin : sur un PNG, un JPEG, un GIF et un PDF, le bon type revient. »"""
    for attendu, octets in RECONNUS.items():
        rapport = sniff_file(octets, claimed_name=f"fichier.{attendu}", allowed=(attendu,))
        assert rapport["detected"] == attendu, attendu
        assert rapport["matches_claim"] is True, attendu
        assert rapport["allowed"] is True, attendu


# ---------------------------------------------------------------------------
# Les autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_les_extensions_synonymes_designent_un_seul_format():
    """
    Docstring : « The detected type, the claimed extension and every entry of
    the caller's allow list are compared under one canonical name. »

    T3 : la table ALIASES est exercée des deux côtés — une extension qui y
    figure, et une qui n'y figure pas —, sur le nom réclamé comme sur la liste
    d'autorisation. Le nom du fichier n'est pas construit à partir du format
    attendu : c'est ce qui laissait passer le défaut.
    """
    # « .jpeg » est ce qu'exporte un téléphone, et ce qu'écrit image/jpeg.
    rapport = sniff_file(JPEG, claimed_name="photo.jpeg", allowed=("jpeg",))
    assert rapport["detected"] == "jpg"
    assert rapport["claimed"] == "jpeg", "la réclamation est rendue telle que le client l'a écrite"
    assert rapport["matches_claim"] is True
    assert rapport["allowed"] is True
    # Et dans l'autre sens : « .tif » réclamé, « tiff » détecté.
    scan = sniff_file(TIFF, claimed_name="scan.tif", allowed=("tif",))
    assert (scan["detected"], scan["matches_claim"], scan["allowed"]) == ("tiff", True, True)
    # Une extension qui ne figure pas dans la table n'est pas transformée.
    ordinaire = sniff_file(PNG, claimed_name="logo.png", allowed=("png",))
    assert (ordinaire["claimed"], ordinaire["matches_claim"]) == ("png", True)
    # Témoin : l'alias ne fait pas concorder deux formats différents.
    faux = sniff_file(PNG, claimed_name="photo.jpeg", allowed=("jpeg",))
    assert (faux["detected"], faux["matches_claim"], faux["allowed"]) == ("png", False, False)


def test_le_nom_du_fichier_ne_decide_jamais():
    """
    Docstring : « The file name and the Content-Type header travel with the
    upload, which means the client wrote them: they are a claim, not a fact. »
    """
    rapport = sniff_file(ZIP, claimed_name="photo-de-profil.png", allowed=("png", "jpg"))
    assert rapport["detected"] == "zip"
    assert rapport["claimed"] == "png"
    assert rapport["matches_claim"] is False
    assert rapport["allowed"] is False
    # Témoin : le même nom sur les bons octets, et tout concorde.
    bon = sniff_file(PNG, claimed_name="photo-de-profil.png", allowed=("png", "jpg"))
    assert (bon["matches_claim"], bon["allowed"]) == (True, True)


def test_les_conteneurs_zip_sont_distingues_en_ouvrant_larchive():
    """
    Docstring : « every ZIP-based format starts with PK […] Twelve lines of
    `zipfile` read the archive the same way, so both languages answer the same
    thing. »
    """
    assert ZIP[:2] == DOCX[:2] == XLSX[:2] == ODT[:2] == b"PK"
    assert sniff_file(ZIP)["detected"] == "zip"
    assert sniff_file(DOCX)["detected"] == "docx"
    assert sniff_file(XLSX)["detected"] == "xlsx"
    assert sniff_file(ODT)["detected"] == "odt"


def test_un_docx_nest_pas_autorise_par_une_liste_qui_nautorise_que_zip():
    """La distinction sert à quelque chose : elle change la décision."""
    assert sniff_file(DOCX, allowed=("zip",))["allowed"] is False
    assert sniff_file(ZIP, allowed=("zip",))["allowed"] is True


def test_un_fichier_a_deux_signatures_est_lu_comme_sa_premiere():
    """
    Un polyglotte — une archive suivie d'une image, ou l'inverse — est lu comme
    ce que disent ses premiers octets. C'est la règle, et elle est dite ici
    plutôt que découverte en production.
    """
    assert sniff_file(ZIP + PNG)["detected"] == "zip"
    assert sniff_file(PNG + ZIP)["detected"] == "png"
    # Une image parfaitement valide qui porte une archive : autorisée si vous
    # autorisez les images, et c'est une décision, pas un accident.
    assert sniff_file(PNG + ZIP, allowed=("png",))["allowed"] is True


def test_un_fichier_non_reconnu_nest_jamais_autorise():
    """
    Docstring : « an unrecognised file is never allowed by default ».
    """
    for octets in [CSV, b"\x00" * 100, b"?" * 10]:
        assert sniff_file(octets, allowed=("png", "csv", "txt"))["allowed"] is False


def test_aucune_entree_ne_leve_et_la_raison_nomme_ce_qui_a_ete_recu():
    """
    R14 : la raison rendue dit ce que le code a constaté — le type reçu — et
    rien de plus. Elle est citée ici mot pour mot.
    """
    assert sniff_file(None)["reason"] == "a file is bytes, not NoneType"
    assert sniff_file("PNG")["reason"] == "a file is bytes, not str"
    assert sniff_file(0)["reason"] == "a file is bytes, not int"
    for entree in [None, 0, "PNG", [], {}, object()]:
        rapport = sniff_file(entree)
        assert rapport["detected"] is None
        assert rapport["reason"].startswith("a file is bytes, not ")


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_entree_banale_ce_quon_televerse_dans_un_formulaire():
    """T5 : l'entrée ordinaire du public visé — une pièce jointe, un justificatif."""
    for nom, octets, attendu in [
        ("justificatif.pdf", PDF, "pdf"),
        ("photo.jpg", JPEG, "jpg"),
        # Ce que rend l'export d'un téléphone, et ce qu'écrit image/jpeg.
        ("photo.jpeg", JPEG, "jpg"),
        ("scan.tif", TIFF, "tiff"),
        ("logo.png", PNG, "png"),
        ("contrat.docx", DOCX, "docx"),
        ("comptes.xlsx", XLSX, "xlsx"),
        ("note.odt", ODT, "odt"),
    ]:
        # La liste d'autorisation est écrite comme l'écrit un développeur qui
        # part des types MIME : « jpeg », pas « jpg ».
        rapport = sniff_file(octets, claimed_name=nom,
                             allowed=("pdf", "jpeg", "png", "docx", "xlsx", "tif", "odt"))
        assert rapport["detected"] == attendu, nom
        assert rapport["matches_claim"] is True, nom
        assert rapport["allowed"] is True, nom


def test_production_entree_vide():
    rapport = sniff_file(b"", claimed_name="vide.png", allowed=("png",))
    assert rapport["detected"] is None
    assert rapport["reason"] == "the file is empty"
    assert rapport["allowed"] is False


def test_production_entree_tres_grande_et_terminaison_rapide():
    """
    Dix mégaoctets : seuls les premiers octets sont lus, donc le temps ne doit
    pas dépendre de la taille du fichier.
    """
    enorme = PNG + b"\x00" * 10_000_000
    debut = time.perf_counter()
    rapport = sniff_file(enorme, claimed_name="grande.png", allowed=("png",))
    assert time.perf_counter() - debut < 5.0
    assert rapport["detected"] == "png"


def test_production_encodages_inattendus():
    # Marque d'ordre des octets en tête d'un CSV : toujours pas de signature.
    assert sniff_file(CSV_BOM)["detected"] is None
    # Un nom de fichier accentué, avec plusieurs points et une casse mixte.
    rapport = sniff_file(PNG, claimed_name="Reçu de janvier.final.PNG", allowed=("png",))
    assert rapport["claimed"] == "png"
    assert rapport["matches_claim"] is True
    # Un nom sans extension ne se compare à rien.
    assert sniff_file(PNG, claimed_name="sans-extension")["matches_claim"] is None


def test_production_valeurs_aux_limites():
    # Un seul octet, puis le plancher de lecture, juste en dessous et juste
    # au-dessus : les deux tables ne lisent pas le même nombre d'octets, et
    # l'extrait refuse en dessous du plus exigeant plutôt que de diverger.
    assert sniff_file(b"\x89")["reason"] == f"under {MIN_BYTES} bytes: too short to carry a signature"
    assert sniff_file(PNG[:MIN_BYTES - 1])["detected"] is None
    assert sniff_file(PNG[:MIN_BYTES])["detected"] == "png"
    # Exactement la fenêtre lue, et un octet de plus : même réponse.
    assert sniff_file((PNG + b"\x00" * HEAD)[:HEAD])["detected"] == "png"
    assert sniff_file((PNG + b"\x00" * HEAD)[:HEAD + 1])["detected"] == "png"
    # Une liste d'autorisation vide n'autorise rien.
    assert sniff_file(PNG, allowed=())["allowed"] is False


def test_production_un_fichier_sale_dans_un_lot_nempeche_pas_les_autres():
    """T8 : une pièce jointe illisible ne fait pas tomber le lot."""
    lot = [PNG, CSV, PDF, b"", DOCX]
    assert [sniff_file(x)["detected"] for x in lot] == ["png", None, "pdf", None, "docx"]


def test_production_le_controle_tient_la_classe_de_latence_annoncee():
    """latency « <1 ms » : dix mille lectures sous une borne d'effondrement large."""
    debut = time.perf_counter()
    for _ in range(10_000):
        sniff_file(PNG, claimed_name="photo.png", allowed=("png",))
    assert time.perf_counter() - debut < 20.0


# ---------------------------------------------------------------------------
# Parité entre les deux langages
# ---------------------------------------------------------------------------


def test_python_et_javascript_rendent_le_meme_rapport():
    """La fiche montre les deux extraits : elle affirme la même chose des deux."""
    node = shutil.which("node")
    assert node, "node est requis pour comparer les deux implémentations"
    fichiers = {**RECONNUS, **SANS_SIGNATURE,
                "zip+png": ZIP + PNG, "png+zip": PNG + ZIP, "vide": b"",
                "un-octet": b"\x89", "png-tronque": PNG[:15], "png-16": PNG[:16],
                "nuls": b"\x00" * 100}
    # Le nom réclamé porte un alias, et la liste d'autorisation aussi : la
    # parité se vérifie là où le défaut était, pas seulement ailleurs.
    autorises = ("png", "jpeg", "pdf", "docx", "tif")
    attendu = {nom: sniff_file(octets, claimed_name="fichier.jpeg", allowed=autorises)
               for nom, octets in fichiers.items()}
    script = (
        f"import {{ sniffFile }} from {json.dumps((ICI / 'n0.js').as_uri())};"
        "let d='';process.stdin.on('data',c=>d+=c).on('end',async()=>{"
        "const f=JSON.parse(d);const out={};"
        "for (const [k,b64] of Object.entries(f)) out[k]=await sniffFile("
        "Buffer.from(b64,'base64'),{claimedName:'fichier.jpeg',"
        f"allowed:{json.dumps(list(autorises))}}});"
        "process.stdout.write(JSON.stringify(out));});"
    )
    sortie = subprocess.run(
        [node, "--input-type=module", "-e", script],
        input=json.dumps({k: base64.b64encode(v).decode() for k, v in fichiers.items()}),
        capture_output=True, text=True, timeout=120, check=True,
    )
    assert json.loads(sortie.stdout) == attendu
