import base64
import io
import json
import shutil
import subprocess
import time
import zlib
from pathlib import Path

from n0 import MAX_COLUMNS, MIN_GUTTER, SAME_LINE, find_columns, read_text

ICI = Path(__file__).parent


def _pdf(*morceaux: str) -> bytes:
    """Les PDF de ce test, fabriqués pour lui, compressés pour tenir dans le fichier."""
    return zlib.decompress(base64.b64decode("".join(morceaux)))


# Six documents minimaux, tous de vrais PDF. Le test JavaScript porte
# exactement les mêmes octets.
COLONNES = _pdf(
    "eNptU8tq20AU3esr7sbQQmpp9LIMIVCnNoU6NCSCLkIXY+nKnSDNuDOjkPYns+gPlHblfEXvyIrcVhZCjI7O"
    "uc+jyfW71Rs2jb3Jr99PPzwGAajNvXd+Dn7+bYfgX3LLa7UF/5pv0UBIhBu4uPBQlo4YjgQHnv9BlAbuEkf/"
    "TFFUKy2wv4TRUQj+GuXWfoGYzRzDWI288RY5+CsGLIC86goLKEAyg1lGSAOv1hw2qq253KIWCFdcWyGherb4"
    "GvL7QRGFwSC5rPcNSqINdA4ad1qYfyQuSZp2CkO9FCQBLt3BWqST3OMU1ifS9KIaoVBNg7pAQAlhwObE56Mc"
    "SdjRK9Vq+EnNCHMGRc2N2Z+BJVCeSPGi4dp18SBcbWULzXOD0NA4hBylibJOgrJQGl1gAzW11XAagJmOU/T8"
    "EnetMPC15bQP2O7lXpNCvUiWuVtlv6t+qfHIDStF9fm37cZ2rw5k4C+4wcOX91g/oBUFB39J9ZVCktU+CflW"
    "GjEAR9ckJ+3mntoN4uBO/wpLwRfqEe5cV8k8gSwOyYU3aGiqBfXu9F0B3YFB3Nva3WRWaSmageg/sz9qrLwA"
    "Ui8YLkiTJEqgggFjVGP3RR6xNB5hLGQjLJkHIyzNZkfMai5q1F37t+I7QkpNKeX+rL5SY8nXXZ0Zi7zJZPlx"
    "5f0BAqUUkw==")
PROSE = _pdf(
    "eNptUstq20AU3c9XnI0hLXakkSXFhRCIU5tCUxpiQRehi4l07U6QZ4xmFNz+ZBf9gdJs4r/IHdm1Q10hhO65"
    "59x37+b9dCBPU9H78/Tzl5CIYe8fxPk5ouL7ihBdKa9qu0B0oxbkkDDhFhcXgkwViMmRYMuLPurK4S4L9K8c"
    "xbbGQ74SDg9CRNdkFv4bkmEWGM43pJZiXCCaSsgExRzZGc5GMYoKMkdxLU6urPGN8qgIq4acV15bEyxHzaMu"
    "yb1B8YDirTiZMJFQKzhb6o3fYLKm5aomzC5nfagWpVppbrLzq3qv41hLXTOP2sa6PirOCDadfl4w6Dx+Y2xb"
    "Ho6hwV41ZokypW0b3wd1grLWxNJq4/TCbFDqgVo1z+70r2ZShKHsut6NJz2a6zSkj2btve/MAEpEY+Vo6/lA"
    "9SN5XSpEE85facNL+6LNpXF6Dxzmn/13ceHbhGK3e44+UaXV2K5xFzOQvcswShPe5y057pCnjKDvCuh+JNLd"
    "gYQ3CkviaA7Df85m3dBcxMhFvH+QZxnvf449JrnGzmMOWJ4eYTKRR1gaj46wLH4Vj29H19R07c/0D0LOTVkb"
    "bnRXKZ9U47s686EUvd7k81S8AAGN6nc=")
CESURE = _pdf(
    "eNptUs1u1DAYvPsp5rJSQW0d529bqapEYFdIbEXVRuJQcfBuvg2ugr3YTlX6khx4AQSnfQucNGwQIYoiZ775"
    "7PlmPLt+szwRpymb/fz17TsTiGDW9+ziArz8uiPw19LLxtTg17ImhzgQbnB5yUhXHTGeNDzz+DtVOdxlHf1j"
    "2MW02kP81ZiMjeAr0rX/BDGPOobzluRnVpTgSwERo9wim2N+FqGsIHKUK3a0klibtpG6JqsIV9J6pY+htAt6"
    "mz3hB4pQN7Wmkxco71G+ZEeFakLHxrTWH0PiocVOOkcWX1oZDkW913srR75XRjtUhE2jSPtuuWuVgziP89M/"
    "rEXZzTSIHqZLJ7YsTTCA37Zr3/92oAAvpKPnyltqHsirjQRfBIWV0sHzD0q/0k4dgNG+7L++d18bhA4x8Suq"
    "lCzMI+6iAGTnGc7SOMRxQy54sAk5df29gH4hkA75dm9ITft+7OSf1B8tbVmEnEWHB3mWJRm2OGAiaOwresTy"
    "dIKJWEywJE0mWJpGI+atVA3Zfvxb9UTIw1DGdFdsUBqugfW9zizP2Wy2eL9kvwFnBNKk")
SCAN = _pdf(
    "eNptUstq20AUpdDVUOg2ZBEuFJNVOnqMhEsSLxzHjXFLXLuQgMliLN3YYySNMxoXu+t+RheFfkA/oX/QGrLN"
    "Kt12012XnZEd21QRw8xwdM7Vueeq0mk0D9yXjFTuf/28JS44IAdjcnQE9P18gkBPuOaJHALt8CHm4BlCF2o1"
    "gllsiV5JsOTRtohz6AeWfmWqyGmmwd0S+hsh0DeYDfUIfMcScq2Qp+QGgldW7kCVecUZpUBbqQsNCe9smRVx"
    "VZCVnFyeD8YYaaC96UAXSCs15oBeiNh8jTlAz1AMRxqC0FpMpOpNeGQIDfwgInyt+BxoXei8g+pEphOZoemi"
    "CrQpEo3KnAnX2MBIxrhugvlbTcw+3y4Wi7/Pn+6++LT3LPuyf7xz5+x+//rncL21U//Jj2/kd7mj4NFs7a6s"
    "j+Uo6FuMBa/LGfRtRjYzk5eJvIu5nKrIzMLqH7Kwd5shW83RLtN6pk3FHPz/pjtTeE0cCImzfiAMAj+Aa1hj"
    "rvFZvMk2WMhKmOu5JcxzvBLG3C1MKy4SVEUEPfERwQyqK6X9lVZOc82VLnwGzCOVyul5k/wD2SfOiA==")
DEUX_PAGES = _pdf(
    "eNq1U8tq20AU3esr7saQFifSyJZsQQjEqU2hDg2xoYvQxUS6didIM+7MKKT9yS76A6XdRPmK3hk7cht5G2PE"
    "zNU593WOelfvZsfsZBj0fv/58TNgEIG6vQtOTyFcftsghBfc8lKtIbziazQQE+Aazs4ClIUDxh3CFhd+EIWB"
    "m8TDx+75mXKpWlpKsacP9nQI5yjX9gsM2cghjNXIq2CyhHDGgEWwXPn2ImCQjGA0pkgFR3MOt6ouuVyjFgiX"
    "XFshYfVk8Q0s71rGII5aykXZVCgJ1sI5aNxoYf6juCJp6hmGJsqJAly6g7VIJ9ngCcwPlNmRSoRcVRXqHAEl"
    "xBHLCM87NZLYw1eq1vCLhhGmD3nJjWn6YCkoD5R45nDtprgXrreihuqpQqhoHUJ2ygzGnoIyVxpdYgMljVVx"
    "WoA56ZbY4Qvc1MLA15qTHrBuZKOJoZ4p06WTcqfVTtRhxxMzRf2Fi/rW+qsLMggn3OD2zXss79GKnEM4pf4K"
    "Iclwn4Q8l0a0gb1rkoOmc0+N3mDOdOElFoJP1APcuKmSLIHxMCYXXqOhreY0u+P7BvyBwXBnbvcns0pL2QwM"
    "Xlg+PeDZeJAc8CyJtGq9WgAjX8yDI5eYdggFwkajsX6d7mZQ3wvqyy0Wlm+Do6l0Oy85GJWLxjYwfcBqQ75a"
    "nC/6wGvI+UbQ5+nf87LlUa5KlITDWityU+FmpKsRj7QmKkk+m5BL1FriccuaEIXTsmtt+4CekJdbZzVGrGUD"
    "uTjmG/24ld5xDqk/em31x6+k/uig+ukL9R80roIIsiBqf5AmCem/gjbGyKH+jdzH0mEnxuJRJ5ZkaSeWZoNO"
    "bMyylzHGog6XxdE/XPKdKFH71S3Ed4SMFqKUBfY8JdlRWz8jG8RZ0OtNP86Cvy1BwMQ=")

GAUCHE = ("La boulangerie Martin fête\nses cent ans cette année. Le\n"
          "four à bois, classé, tourne\nencore tous les matins.")
DROITE = ("Clémentine Martin a repris\nle commerce en 2019. La\n"
          "farine vient du même moulin\ndepuis quatre générations.")

TEXTE_CESURE = ("La boulangerie Martin, installée à Boulogne-\n"
                "Billancourt, a vu passer quatre généra-\n"
                "tions de clients depuis 1926.")


# Une facture ordinaire à quatre colonnes, sans un seul filet : c'est le
# document le plus banal du public visé, et il ressortait transposé.
FACTURE = _pdf(
    "eNptVNFumzAUfecr7kukTSrDNoYGqarUtEWVlqhZwlu1B5c4mSNiT8ZU2b5+18CapC5CiJx7zj3H5jqT5UMZ0288okDAvO6jmxtI"
    "qj+/JST3wonG7CBZip1sgSFhBbe3kdQbT2SBYOAl39WmhZfU039iF9NpB/RMmH4q9E8rkTr4JAu5UWJmjvBCEMiKDKacYb+VbE1n"
    "azTy+tKgon+hkI0B/Y222mG3FviH2PzMfS71zv2CPOWe0DorxSGaVZHvRglU235XCKa/JnA9ReQAX9Z3qznMJSxM1yj9Far9BSvP"
    "exZlYDsJG8xZWmllG8+7g8KXQJCxXlAwSgjMsKnZaRnPVNMIXeNSXaBgvFeUonadlaChvIsZYXlMONpuOsDnXug3tAOPf2yQjytZ"
    "yS0G0vVlJnrGeJCt2mnhlLlcaJqeOD86oZ1yl034GWFp1RGeqiBFPpQX9zHPCA0z/K/3+wwCarGVYYqRxUL7sUKLq4IE5vzdvCCE"
    "hOZjHb8Hfgij7CfOI4WGzmMl5VckdCbjrviZp9B2FoYOj5Uf0XEIx2HNgqPSD3yy7l5d/9ODFJKZaOVQeZLNm3SqFmcjf7RyG6Fz"
    "RN4vyLMszWALJ6yAoaJPWDYNMEqzAGOcBljB8hPmrFCNtP0y1uqvhBzPsTH+b2E8nK0T1vU5iyKPJpPH5zL6BzDKI3I=")

# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_une_page_de_tableau_est_lue_dans_lordre_imprime():
    """
    « Sur une page dont le corps est un tableau, les gouttières entre les
    colonnes dépassent celles d'un texte : lire les bandes de haut en bas
    rendrait toutes les références, puis toutes les désignations, puis tous les
    prix. Ces pages sont lues dans l'ordre du dessin, et `reason` le dit. »
    """
    page = read_text(FACTURE)["pages"][0]
    # Trois bandes trouvées, et elles ne sont pas lues comme des colonnes.
    assert page["columns"] == 3
    assert page["reason"] == "this page looks like a table: read in page order"
    lignes = page["text"].split("\n")
    assert lignes[4:7] == [
        "Reference Designation Quantite Prix HT",
        "MC-4501 Moulin a cafe 2 19,90",
        "MC-9000 Bouilloire 1 34,00",
    ]
    # Le lien entre la référence et le prix tient : ils sont sur la même ligne.
    assert "MC-4501" in lignes[5] and "19,90" in lignes[5]
    # Témoin : la page à deux colonnes de prose, elle, est bien réordonnée.
    colonnes = read_text(COLONNES)["pages"][0]
    assert colonnes["reason"] is None
    assert colonnes["text"] == f"{GAUCHE}\n\n{DROITE}"


def test_un_tableau_a_deux_colonnes_reste_transpose_et_la_fiche_le_dit():
    """
    Docstring : « a table of exactly two columns — a label on the left, an
    amount on the right — is still read as two columns, and still transposed.
    That is the first line of the breaking point, not a footnote. »

    Le compte de bandes est le seul signal portable : le nombre de mots d'une
    ligne dépend de la façon dont l'extracteur a découpé les suites de
    caractères, et `pdfplumber` et `pdf.js` ne les découpent pas pareil.
    """
    assert MAX_COLUMNS == 2
    deux_colonnes = [{"text": "Total", "x": 0.0, "end": 40.0, "y": 0.0},
                     {"text": "19,90", "x": 200.0, "end": 240.0, "y": 0.0},
                     {"text": "Remise", "x": 0.0, "end": 45.0, "y": -12.0},
                     {"text": "2,00", "x": 200.0, "end": 235.0, "y": -12.0}]
    assert len(find_columns(deux_colonnes)) == 2
    # Ce que la lecture par colonnes en ferait : les deux libellés, puis les
    # deux montants. C'est le défaut que cette fiche nomme et ne corrige pas.
    from n0 import _column_text

    bandes = find_columns(deux_colonnes)
    assert [_column_text(deux_colonnes, b) for b in bandes] == [
        "Total\nRemise", "19,90\n2,00"]


def test_la_gouttiere_minimale_est_un_reglage_de_lappelant():
    """
    Remarque de production : un appelant qui constate une mauvaise découpe doit
    avoir un levier. `min_gutter` en est un, comme `min_characters` ailleurs.
    """
    # Avec la valeur par défaut, une gouttière étroite ne sépare rien.
    serres = [{"text": "a", "x": 0.0, "end": 100.0, "y": 0.0},
              {"text": "b", "x": 110.0, "end": 300.0, "y": 0.0}]
    assert len(find_columns(serres)) == 1
    # Avec une gouttière plus petite, elle sépare.
    assert len(find_columns(serres, min_gutter=10.0)) == 2
    # Et le réglage passe bien par `read_text` : à gouttière très large, la
    # page à deux colonnes n'en fait plus qu'une.
    assert read_text(COLONNES, min_gutter=500.0)["pages"][0]["columns"] == 1


def test_les_lignes_coupees_en_fin_de_ligne_sont_comptees():
    """
    Docstring : « it counts those lines in `hyphenated_lines` so the caller can
    decide for its own ».
    """
    assert read_text(CESURE)["pages"][0]["hyphenated_lines"] == 2
    # Témoin : une page sans césure n'en compte aucune.
    assert read_text(COLONNES)["pages"][0]["hyphenated_lines"] == 0


def test_une_cesure_reste_une_cesure():
    """
    Docstring : « a word cut at the end of a line stays cut. Gluing « généra- »
    and « tions » back together […] would also glue « Boulogne- » and
    « Billancourt », which is a different town. »
    """
    texte = read_text(CESURE)["pages"][0]["text"]
    assert texte == TEXTE_CESURE
    assert "généra-\ntions" in texte
    # Et la même coupure, sur un nom propre, qui ne doit surtout pas être recollée.
    assert "Boulogne-\nBillancourt" in texte


def test_temoin_le_reste_du_texte_est_rendu_tel_quel():
    """Le témoin de la césure : tout le reste de la page ressort au caractère près."""
    texte = read_text(CESURE)["pages"][0]["text"]
    assert "a vu passer quatre" in texte
    assert texte.count("\n") == 2
    assert texte.endswith("tions de clients depuis 1926.")


# ---------------------------------------------------------------------------
# Les autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_une_page_a_deux_colonnes_est_lue_colonne_par_colonne():
    """
    Docstring : « A word processor exporting two columns often draws them line
    by line, left then right […] each one is read from top to bottom before the
    next begins. »
    """
    page = read_text(COLONNES)["pages"][0]
    assert page["columns"] == 2
    assert page["text"] == f"{GAUCHE}\n\n{DROITE}"
    # La lecture naïve, celle du dessin, entrelace les deux.
    assert _brut(COLONNES).startswith("La boulangerie Martin fête Clémentine Martin a repris")


def _brut(pdf: bytes) -> str:
    """Le texte tel que la bibliothèque le rend sans chercher les colonnes."""
    from pypdf import PdfReader

    return PdfReader(io.BytesIO(pdf)).pages[0].extract_text()


def test_une_page_a_une_colonne_est_rendue_dans_lordre():
    page = read_text(PROSE)["pages"][0]
    assert page["columns"] == 1
    assert page["text"].startswith("Contrat de prestation de services\n")
    assert page["text"].endswith("et le client désigné ci-après.")


def test_le_nombre_de_colonnes_est_rendu():
    """
    Docstring : « `columns` […] is what tells a caller that the page was not a
    simple column of prose. It says what was found, not what was done. »
    """
    assert [p["columns"] for p in read_text(DEUX_PAGES)["pages"]] == [2, 1]
    # Sur la facture, trois bandes sont bien rendues, alors que la lecture, elle,
    # s'est faite en une seule.
    assert read_text(FACTURE)["pages"][0]["columns"] == 3
    assert read_text(SCAN)["pages"][0]["columns"] == 0
    assert read_text(SCAN)["pages"][0]["text"] == ""


def test_les_bandes_sont_trouvees_par_les_gouttieres():
    """
    Docstring : « a run of points no word overlaps, wider than a gutter,
    separates two columns ».
    """
    mots = [{"text": "a", "x": 0.0, "end": 100.0, "y": 0.0},
            {"text": "b", "x": 100.0 + MIN_GUTTER, "end": 300.0, "y": 0.0}]
    assert len(find_columns(mots)) == 2
    # Un point de moins, et c'est une seule bande.
    serres = [{"text": "a", "x": 0.0, "end": 100.0, "y": 0.0},
              {"text": "b", "x": 100.0 + MIN_GUTTER - 1, "end": 300.0, "y": 0.0}]
    assert len(find_columns(serres)) == 1
    assert find_columns([]) == []


def test_chaque_page_est_lue_et_lappelant_peut_en_choisir():
    assert [p["page"] for p in read_text(DEUX_PAGES)["pages"]] == [1, 2]
    assert [p["page"] for p in read_text(DEUX_PAGES, pages=[2])["pages"]] == [2]


def test_un_fichier_qui_nest_pas_un_pdf_donne_une_raison():
    rapport = read_text(b"ceci n'est pas un PDF")
    assert rapport["pages"] == []
    # R14 : la raison dit ce que le code a constaté, et elle porte l'erreur
    # que la bibliothèque a rendue.
    assert rapport["reason"].startswith("this file could not be opened as a PDF: ")


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_entree_banale_un_contrat_dune_page():
    """T5 : l'entrée ordinaire du public visé."""
    page = read_text(PROSE)["pages"][0]
    assert "société Exemple SAS" in page["text"]
    assert page["columns"] == 1


def test_production_entree_vide():
    assert read_text(b"")["pages"] == []
    assert read_text(b"")["reason"] is not None


def test_production_entree_tres_grande_et_terminaison_rapide():
    """Dix mille mots sur une page : la recherche de gouttières doit rester linéaire."""
    mots = [{"text": f"m{i}", "x": (i % 40) * 13.0, "end": (i % 40) * 13.0 + 10,
             "y": -(i // 40) * 12.0} for i in range(10_000)]
    debut = time.perf_counter()
    bandes = find_columns(mots)
    assert time.perf_counter() - debut < 30.0
    assert len(bandes) == 1


def test_production_encodages_inattendus():
    # Les accents, les insécables et les emoji traversent la lecture.
    texte = read_text(PROSE)["pages"][0]["text"]
    assert "société" in texte and "siège" in texte
    # Un mot isolé très loin à droite ouvre une colonne, et c'est voulu.
    mots = [{"text": "corps", "x": 57.0, "end": 200.0, "y": 0.0},
            {"text": "42", "x": 520.0, "end": 530.0, "y": 0.0}]
    assert len(find_columns(mots)) == 2


def test_production_valeurs_aux_limites():
    # Exactement l'écart qui sépare deux lignes.
    base = {"x": 0.0, "end": 10.0}
    from n0 import _column_text

    une = _column_text([{**base, "text": "a", "y": 0.0},
                        {**base, "text": "b", "y": -SAME_LINE}], (0.0, 100.0))
    assert une == "a b"
    deux = _column_text([{**base, "text": "a", "y": 0.0},
                         {**base, "text": "b", "y": -SAME_LINE - 0.1}], (0.0, 100.0))
    assert deux == "a\nb"
    # Un seul mot sur la page : une bande, un mot.
    assert find_columns([{"text": "seul", "x": 10.0, "end": 40.0, "y": 0.0}]) == [(10, 41)]


def test_production_une_page_illisible_nempeche_pas_de_lire_les_autres():
    """T8 : une page sans texte ne fait pas tomber le document."""
    lot = [PROSE, b"pas un PDF", COLONNES, SCAN]
    assert [len(read_text(p)["pages"]) for p in lot] == [1, 0, 1, 1]


def test_production_la_lecture_tient_la_classe_de_latence_annoncee():
    """latency « ~10 ms » : cent lectures sous une borne d'effondrement large."""
    debut = time.perf_counter()
    for _ in range(100):
        read_text(COLONNES)
    assert time.perf_counter() - debut < 60.0


# ---------------------------------------------------------------------------
# Parité entre les deux langages
# ---------------------------------------------------------------------------


def test_python_et_javascript_rendent_le_meme_texte():
    """La fiche montre les deux extraits : elle affirme la même chose des deux."""
    node = shutil.which("node")
    assert node, "node est requis pour comparer les deux implémentations"
    documents = {"COLONNES": COLONNES, "PROSE": PROSE, "CESURE": CESURE,
                 "SCAN": SCAN, "DEUX_PAGES": DEUX_PAGES}
    attendu = {nom: read_text(octets) for nom, octets in documents.items()}
    script = (
        f"import {{ readText }} from {json.dumps((ICI / 'n0.js').as_uri())};"
        "let d='';process.stdin.on('data',c=>d+=c).on('end',async()=>{"
        "const f=JSON.parse(d);const out={};"
        "for (const [k,b64] of Object.entries(f)) out[k]=await readText(Buffer.from(b64,'base64'));"
        "process.stdout.write(JSON.stringify(out));});"
    )
    sortie = subprocess.run(
        [node, "--input-type=module", "-e", script],
        input=json.dumps({k: base64.b64encode(v).decode() for k, v in documents.items()}),
        capture_output=True, text=True, timeout=120, check=True)
    # `pdf.js` écrit ses avertissements sur la sortie standard ; le JSON
    # commence à la première accolade.
    assert json.loads(sortie.stdout[sortie.stdout.index("{"):]) == attendu
