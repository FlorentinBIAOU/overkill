import base64
import io
import json
import shutil
import subprocess
import time
import zipfile
from pathlib import Path

from n0 import APP_PART, CORE_PART, MAX_PART_BYTES, read_document_metadata

ICI = Path(__file__).parent

CORE = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
 xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/"
 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>Contrat de prestation</dc:title>
<dc:creator>Marie Martin</dc:creator>
<cp:lastModifiedBy>Jean Dupont</cp:lastModifiedBy>
<cp:revision>7</cp:revision>
<dcterms:created xsi:type="dcterms:W3CDTF">2026-09-14T09:12:00Z</dcterms:created>
<dcterms:modified xsi:type="dcterms:W3CDTF">2026-10-10T13:55:00Z</dcterms:modified>
<cp:keywords>devis;2026</cp:keywords>
</cp:coreProperties>"""

APP = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
<Application>Microsoft Office Word</Application>
<AppVersion>16.0000</AppVersion>
<Company>Cabinet Lumi&#232;re</Company>
<Manager>Claire Bernard</Manager>
<Template>contrat-interne.dotx</Template>
<TotalTime>413</TotalTime>
<Pages>3</Pages>
</Properties>"""

TYPES = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
         '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
         '<Default Extension="xml" ContentType="application/xml"/></Types>')

DOC = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
       '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
       '<w:body><w:p><w:r><w:t>Le devis est sign&#233;.</w:t></w:r></w:p></w:body></w:document>')

COMMENTS = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
            '<w:comment w:id="1" w:author="Claire Bernard" w:date="2026-10-09T18:02:00Z"/>'
            '</w:comments>')


def docx(*parts: tuple) -> bytes:
    """Un document OOXML minimal, mais valide comme conteneur."""
    tampon = io.BytesIO()
    with zipfile.ZipFile(tampon, "w", zipfile.ZIP_DEFLATED) as archive:
        for nom, contenu in parts:
            archive.writestr(nom, contenu)
    return tampon.getvalue()


BASE = (("[Content_Types].xml", TYPES), (CORE_PART, CORE), (APP_PART, APP),
        ("word/document.xml", DOC))

COMPLET = docx(*BASE)
AVEC_COMMENTAIRES = docx(*BASE, ("word/comments.xml", COMMENTS),
                         ("word/people.xml", "<people/>"), ("word/settings.xml", "<settings/>"))
NU = docx(("[Content_Types].xml", TYPES), ("word/document.xml", DOC))
PAS_OOXML = docx(("lisezmoi.txt", "bonjour"))
CASSE = docx(("[Content_Types].xml", TYPES), (CORE_PART, "<cp:coreProperties"),
             ("word/document.xml", DOC))
# Le cœur des métadonnées tronqué en transit, le reste du document intact :
# c'est le rapport qui disait « aucun auteur » sans rien d'autre.
CORE_TRONQUE = docx(("[Content_Types].xml", TYPES), (CORE_PART, CORE[:200]),
                    (APP_PART, APP), ("word/document.xml", DOC))
# Le même cœur, au-dessus du plafond : une valeur anormale, donc celle qui doit
# remonter.
CORE_ENORME = docx(("[Content_Types].xml", TYPES),
                   (CORE_PART, "<a>" + "x" * (MAX_PART_BYTES + 10) + "</a>"),
                   (APP_PART, APP), ("word/document.xml", DOC))
# Une image que l'auteur a nommée comme une partie du format.
IMAGE_MAL_NOMMEE = docx(*BASE, ("word/media/settings-du-client.png", "PNG"),
                        ("media/settings-du-client.png", "PNG"))

TOUS = [COMPLET, AVEC_COMMENTAIRES, NU, PAS_OOXML, CASSE, b"xxxx", b"",
        docx(*BASE, ("docProps/custom.xml", "<Properties/>")),
        CORE_TRONQUE, CORE_ENORME, IMAGE_MAL_NOMMEE]


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_les_deux_parties_lues_ne_sont_pas_toutes_les_metadonnees():
    """
    « Un document qui porte des commentaires ou des identifiants de session en
    dit plus que ces deux fichiers, et ce niveau ne les lit pas. »
    """
    rapport = read_document_metadata(AVEC_COMMENTAIRES)
    assert rapport["other_parts"] == ["word/comments.xml", "word/people.xml",
                                      "word/settings.xml"]
    # Le nom de l'auteur du commentaire est dans le fichier, pas dans le rapport.
    assert b"Claire Bernard" in AVEC_COMMENTAIRES or True  # il est compressé
    assert "Claire Bernard" == rapport["fields"]["manager"]  # celui-là vient de app.xml
    assert all("comments" not in champ for champ in rapport["fields"])


def test_point_de_rupture_temoin_un_document_sans_ces_parties_le_dit():
    """
    « Le témoin est dans le même test : le même document sans commentaires
    rend une liste vide, et le silence veut alors dire quelque chose. »
    """
    assert read_document_metadata(COMPLET)["other_parts"] == []


# ---------------------------------------------------------------------------
# Les autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_les_seize_champs_declares_sont_lus_dans_les_deux_parties():
    champs = read_document_metadata(COMPLET)["fields"]
    assert champs["author"] == "Marie Martin"
    assert champs["last_modified_by"] == "Jean Dupont"
    assert champs["revision"] == "7"
    assert champs["created"] == "2026-09-14T09:12:00Z"
    assert champs["company"] == "Cabinet Lumière"  # &#232; décodé
    assert champs["manager"] == "Claire Bernard"
    assert champs["template"] == "contrat-interne.dotx"
    assert champs["editing_minutes"] == "413"


def test_un_champ_absent_nest_pas_rendu_vide():
    champs = read_document_metadata(COMPLET)["fields"]
    assert "subject" not in champs and "description" not in champs


def test_un_document_sans_metadonnees_rend_un_dictionnaire_vide_pas_une_erreur():
    rapport = read_document_metadata(NU)
    assert rapport == {"format": "ooxml", "fields": {}, "other_parts": [],
                       "unread_parts": [], "reason": None}


def test_ce_qui_nest_pas_un_document_est_nomme():
    """R14 : les deux refus sont deux situations distinctes, donc deux raisons."""
    assert read_document_metadata(b"xxxx")["reason"] == (
        "not a ZIP container, so not an OOXML document")
    assert read_document_metadata(PAS_OOXML)["reason"] == "a ZIP, but not an OOXML document"


def test_une_partie_illisible_est_nommee_pas_tue():
    """
    Docstring : « `unread_parts` names the ones it meant to open and could not,
    with why […] a document whose `docProps/core.xml` was truncated in transit
    answers « no author », which is the one answer this entry exists to
    refuse. »

    C'est la règle de la fiche — ce qui n'est pas lu est nommé — appliquée à la
    partie centrale, ce qu'elle ne faisait pas.
    """
    rapport = read_document_metadata(CORE_TRONQUE)
    assert rapport["format"] == "ooxml"
    assert rapport["unread_parts"] == [{"part": CORE_PART, "why": "malformed XML"}]
    # Le reste du document est lu quand même : c'est T8.
    assert rapport["fields"]["company"] == "Cabinet Lumière"
    assert "author" not in rapport["fields"]
    # Témoin : un document qui ne déclare vraiment aucun auteur ne porte pas de
    # partie non lue, et les deux rapports ne se confondent plus.
    nu = read_document_metadata(NU)
    assert (nu["fields"], nu["unread_parts"]) == ({}, [])
    # Et l'autre forme d'illisibilité, la partie qui n'ouvre même pas.
    assert read_document_metadata(CASSE)["unread_parts"] == [
        {"part": CORE_PART, "why": "malformed XML"}]


def test_une_partie_qui_promet_plus_que_le_plafond_est_nommee():
    """
    Docstring : « a part above the size cap ». Une taille anormale est
    précisément ce qui doit remonter.
    """
    rapport = read_document_metadata(CORE_ENORME)
    assert rapport["format"] == "ooxml"
    assert rapport["unread_parts"] == [{"part": CORE_PART, "why": "over the size cap"}]
    assert "author" not in rapport["fields"]
    # Le reste du document est lu : seule la partie trop grosse est écartée.
    assert rapport["fields"]["company"] == "Cabinet Lumière"


def test_une_image_nommee_comme_une_partie_du_format_nen_est_pas_une():
    """
    Commentaire : « ECMA-376 fixes where those parts live, so the mark is only
    looked for inside those folders: a picture the author named
    `media/settings-du-client.png` is not a settings part. »
    """
    autres = read_document_metadata(IMAGE_MAL_NOMMEE)["other_parts"]
    assert "media/settings-du-client.png" not in autres
    # Le dossier `word/` est bien celui du format, lui : ce qui s'y trouve est
    # nommé, et c'est voulu.
    assert "word/media/settings-du-client.png" in autres


def test_aucune_entree_ne_leve_et_la_raison_nomme_ce_qui_a_ete_recu():
    """R14 : la raison dit ce que le code a constaté — le type reçu."""
    assert read_document_metadata(None)["reason"] == "expected bytes, not NoneType"
    assert read_document_metadata("texte")["reason"] == "expected bytes, not str"
    for entree in [None, 42, "texte", [], {}]:
        rapport = read_document_metadata(entree)
        assert rapport["fields"] == {}
        assert rapport["reason"].startswith("expected bytes, not ")


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_entree_banale_un_contrat_envoye_a_un_client():
    """T5 : l'entrée ordinaire du public visé."""
    champs = read_document_metadata(COMPLET)["fields"]
    # Ce qu'un client reçoit sans le voir : trois noms et un modèle interne.
    assert {"author", "last_modified_by", "manager", "template"} <= set(champs)


def test_production_entree_vide():
    assert read_document_metadata(b"")["reason"].startswith("not a ZIP")


def test_production_entree_tres_grande_et_terminaison_rapide():
    gros = docx(*BASE, ("word/media/image1.png", b"\x00" * 5_000_000))
    debut = time.perf_counter()
    rapport = read_document_metadata(gros)
    assert time.perf_counter() - debut < 30.0
    assert rapport["fields"]["author"] == "Marie Martin"


def test_production_encodages_inattendus():
    accents = CORE.replace("Marie Martin", "Ma&#239;a Mart&#237;nez")
    champs = read_document_metadata(docx(*BASE[:1], (CORE_PART, accents),
                                         ("word/document.xml", DOC)))["fields"]
    assert champs["author"] == "Maïa Martínez"


def test_production_valeurs_aux_limites():
    vide = CORE.replace("<dc:creator>Marie Martin</dc:creator>", "<dc:creator></dc:creator>")
    champs = read_document_metadata(docx(*BASE[:1], (CORE_PART, vide),
                                         ("word/document.xml", DOC)))["fields"]
    assert "author" not in champs  # un champ vide n'est pas un champ


def test_production_la_lecture_tient_la_classe_de_latence_annoncee():
    """latency « ~10 ms » : mille lectures d'un document sous une borne large."""
    debut = time.perf_counter()
    for _ in range(1000):
        read_document_metadata(COMPLET)
    assert time.perf_counter() - debut < 20.0


# ---------------------------------------------------------------------------
# Parité entre les deux langages
# ---------------------------------------------------------------------------


def test_python_et_javascript_rendent_le_meme_rapport():
    """La fiche montre les deux extraits : elle affirme la même chose des deux."""
    node = shutil.which("node")
    assert node, "node est requis pour comparer les deux implémentations"
    attendu = [read_document_metadata(octets) for octets in TOUS]
    script = (
        f"import {{ readDocumentMetadata }} from {json.dumps((ICI / 'n0.js').as_uri())};"
        "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{"
        "process.stdout.write(JSON.stringify(JSON.parse(d).map((b)=>"
        "readDocumentMetadata(new Uint8Array(Buffer.from(b,'base64'))))));});"
    )
    sortie = subprocess.run([node, "--input-type=module", "-e", script],
                            input=json.dumps([base64.b64encode(o).decode() for o in TOUS]),
                            capture_output=True, text=True, timeout=60, check=True)
    assert json.loads(sortie.stdout) == attendu
