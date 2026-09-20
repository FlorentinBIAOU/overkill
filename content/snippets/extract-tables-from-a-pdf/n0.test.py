import base64
import json
import shutil
import subprocess
import time
import zlib
from pathlib import Path

from n0 import SAME_CELL, SAME_COLUMN, SAME_LINE, group_into_rows, read_tables

ICI = Path(__file__).parent


def _pdf(*morceaux: str) -> bytes:
    """Les PDF de ce test, fabriqués pour lui, compressés pour tenir dans le fichier."""
    return zlib.decompress(base64.b64decode("".join(morceaux)))


# Six documents minimaux, tous de vrais PDF. Le test JavaScript porte
# exactement les mêmes octets.
TABLEAU = _pdf(
    "eNptlN9u2jAUxu/zFOcGaZNoYyd2/khVpdGCKm3VGETaRbWLFBzqKthTYja2l9zFXmDabpa3mGNsMmoARYff"
    "+ZzvOMrn0fx2doEvSTD6/efHzwADAvn4HFxdQVh8+8wgvClVWcsNhPNyw1qItGAB19cBE+teGHkLDrrwLV+3"
    "8EB7+Sd9F7kTCvB/C+NhIYTvmNioJ0gJ6hWtali5DdAlha8BjSHNCWyBpoeqhqWBaeSgrhykyEFdORhlDurK"
    "QZQ4qCsHD0YDw5mDprI0xo6aylJCHDWVu2t6Mr+lkwLCGQaMoKjMM0f62dAU0kyTLbxadFXXMLFir6F4Pgpw"
    "Nihuu5ZvRKm4FCeaGA+aD7tSKK66EwEhg2De8D3cFSf9fgqamfb9zQWhCPszuL7c1VzAL1iVVedPYVWRb287"
    "OB/nyDOPE2eeI4R8c9ufyB2va8kb5jtbCfadbScmY+Q7Y+KccXTO2faLp47/bRhUUqgz5lYV++a2Q+iYHu4+"
    "Lfo02Nfd5oJ4gZppHwiXu0dl/vYQQzgpW3bo3LH6C1N8VUI4FSu55kKn9SMXb0TLj2AIHj2b2P6q3zhlAx7e"
    "szUvJ3IPD/0GaE4hI5EO8oK1ctesdML79WYAU+gt2pOh/+m862cjVAvxi/Ni37AqQJAE6PiBhNKYQgVHhvWM"
    "piMGlhCP4Qh7LNeJfMGw/g5MNSWvWWO2v+TfGSR6U1L2h5OdtFVlo8ycGMdJMBpN38+Cf0GVQCM=")
SANS_FILETS = _pdf(
    "eNptU9Fq2zAUffdX3JfABukk2ZITQyksbUJhK8tSwx7KHlRHTlVcacjyyPaTfdgPjO1l/ovJjhI3VYwx9j3n"
    "6pxrzh0trxZn5B2NRn/+Pv+KCGDQ94/R+Tmg/Mc3AeiSW17pDaAl34gaYkdYwcVFJNS6I8ZBw46HPsh1DXes"
    "o391p+hGWSAvGpOhEdBHoTb2AVjcM2prBH+KZjmgBQGCIS97Y9gdwCYwmbrKE7xZtWVrhCrEW8gfDwQyHRhX"
    "bS03ilup1REnIQPnc8OVlbY9IlA6EJZGbuE6P8I7F2zawzeXZ5RhEnrY47qppILfUPCyDV14VhzKe4Rk4wwH"
    "4km6F88wxqG4x2e6kVWlpRGhsqeQUNkjCR3jUJnQvTKJTyl7PH9o5T8joNTKnhD3rCQU9whlY7Y7fZ53kfGZ"
    "8OGhQeoWTgfQbXNv+8+uSADNeC12yLWovgsrCw5orgq9lspF+otU71UtD4UhnexkrLunS5z1W4BuxFrymd7C"
    "XTcAyxhMaezSvhK1bkzh1qDr7w30L25Evz7d7ZbC/Rtla0heLdXWiDLCkEb4cEHKWMKghEONOI89ooZaSoMa"
    "cTv1upZmIW+SveBZw2UlTD/+rfwpIHVDad1tsHdaW25s7zMjk2g0mn9aRP8BLUIT7Q==")
CELLULE_REPLIEE = _pdf(
    "eNptlN9q2zAUxu/9FOcmsEFaS7blP1AKS5tQWMu6xLCLsgs3VjIVWxq2vGV7yV3sBcZ2U7/FJEWKmzohhJPf"
    "+XTyHaMvk/vrxRk+j7zJ33+/fnsYEIjHJ+/iAvz8x1cK/lUhi0pswb8vtrSFQAmWcHnpUV5qYTA6sNf571nZ"
    "wgPR8s9qiui4BPziYDgcBP+W8q38AjEhWtHKhha1h84JfPdICEkWQQ0k2VcVrAxMAgdV5WCQOqgqB1HsoKoc"
    "3M8cGE4dNJWlIXbUVJZGkaOmclOTI6uWznLwFxgwgnxjHi9Sj4EkkKSK1PBm2W/6hvI1fQv500GA00Fx3bds"
    "ywvJBD/ShHjQfOwKLpnsjwRRNAjuG7aDm/yor12Q1LTvrs4igvDYg+uLrmIc/sC62PRw29XsuaFjN1YdjG3Y"
    "Ds6mGRr/Shibbi3K54pCgIJ4Cn3J9MpQsVotRkfOceScZwidmGn7M9GxqhLslF0rwWO7thNGUzt6nuuLa2+m"
    "vcLR6O4vhLrl/qp7lOarhhj8WdHSfeeGVt+oZOsC/Dlfi5JxFaxPjL/jLTuAISPkZLj0p7ox0mbRv6MlK2Zi"
    "Bw96AZIRSKNAZW5JW9E1axVGfd4YMIVa0YZYv1U0uVTTWghfRXvX0I2HIPbQ4aUTGhLYwIFh5dF0+MDiaMRw"
    "gEcsVRF9zbLgxTzZFKyijVl/xX5SiNVSQuj/Eeu0lUUjjU+MCPYmk/mHhfcfqPEzlA==")
PROSE = _pdf(
    "eNptUstq20AU3c9XnI0hLXakkSXFhRCIU5tCUxpiQRehi4l07U6QZ4xmFNz+ZBf9gdJs4r/IHdm1Q10hhO65"
    "59x37+b9dCBPU9H78/Tzl5CIYe8fxPk5ouL7ihBdKa9qu0B0oxbkkDDhFhcXgkwViMmRYMuLPurK4S4L9K8c"
    "xbbGQ74SDg9CRNdkFv4bkmEWGM43pJZiXCCaSsgExRzZGc5GMYoKMkdxLU6urPGN8qgIq4acV15bEyxHzaMu"
    "yb1B8YDirTiZMJFQKzhb6o3fYLKm5aomzC5nfagWpVppbrLzq3qv41hLXTOP2sa6PirOCDadfl4w6Dx+Y2xb"
    "Ho6hwV41ZokypW0b3wd1grLWxNJq4/TCbFDqgVo1z+70r2ZShKHsut6NJz2a6zSkj2btve/MAEpEY+Vo6/lA"
    "9SN5XSpEE85facNL+6LNpXF6Dxzmn/13ceHbhGK3e44+UaXV2K5xFzOQvcswShPe5y057pCnjKDvCuh+JNLd"
    "gYQ3CkviaA7Df85m3dBcxMhFvH+QZxnvf449JrnGzmMOWJ4eYTKRR1gaj46wLH4Vj29H19R07c/0D0LOTVkb"
    "bnRXKZ9U47s686EUvd7k81S8AAGN6nc=")
SCAN = _pdf(
    "eNptUstq20AUpdDVUOg2ZBEuFJNVOnqMhEsSLxzHjXFLXLuQgMliLN3YYySNMxoXu+t+RheFfkA/oX/QGrLN"
    "Kt12012XnZEd21QRw8xwdM7Vueeq0mk0D9yXjFTuf/28JS44IAdjcnQE9P18gkBPuOaJHALt8CHm4BlCF2o1"
    "gllsiV5JsOTRtohz6AeWfmWqyGmmwd0S+hsh0DeYDfUIfMcScq2Qp+QGgldW7kCVecUZpUBbqQsNCe9smRVx"
    "VZCVnFyeD8YYaaC96UAXSCs15oBeiNh8jTlAz1AMRxqC0FpMpOpNeGQIDfwgInyt+BxoXei8g+pEphOZoemi"
    "CrQpEo3KnAnX2MBIxrhugvlbTcw+3y4Wi7/Pn+6++LT3LPuyf7xz5+x+//rncL21U//Jj2/kd7mj4NFs7a6s"
    "j+Uo6FuMBa/LGfRtRjYzk5eJvIu5nKrIzMLqH7Kwd5shW83RLtN6pk3FHPz/pjtTeE0cCImzfiAMAj+Aa1hj"
    "rvFZvMk2WMhKmOu5JcxzvBLG3C1MKy4SVEUEPfERwQyqK6X9lVZOc82VLnwGzCOVyul5k/wD2SfOiA==")
DEUX_PAGES = _pdf(
    "eNrtlM1O3DAUhfd5irsZqZWA+CZ2fiSE1AFGSC0qhUhdoC7CjGcwCnaVeFral+yiL1C1m85b1PHYEwZPl+yI"
    "oujmu8c+tpWT0cXJZB8PaDT6/efHzwiBgLq5iw4PIa6+feYQH9e6btQC4ot6wTtIjOASjo4iLme9MAkGrHXx"
    "WzHr4JpZedE/P5m51FJqM8UwPB2GQ/yOy4W+hZySXtHpltf3ETlg8DViKeQlhXtg+bpq4MrCPPHQVB4y4qGp"
    "PEwKD03lIck8NJWHa6OBYeGhrRxN0VNbOUqpp7bys+Zb63d0XEE8QUAC1dyePAE0AsgLQ+7h1eVqvmq5nPLX"
    "UN1tBFgMipNVJxay1kLJLU2Kg+bDspZa6NWWgNJBcNGKBzirtvr9Klhh2+fH+5QRDNfg+2rZCAm/YFrPV+Eq"
    "nCoJ7V0Hy72SBOZp5s1LQkho7vpjtRRNo0TLQ2cnwdDZdVK6R0JnpN4Zk13Orl/drsTflsNcSb3D3KnS0Nx1"
    "KNtj69lPqz4N7nN3uaBBrCbGB+Kr5Y22rz1EiMd1x9edM9584VpMa4hP5VTNhDSZ/SjkG9mJDRiCx3bmtn+a"
    "L067mMfnfCbqsXqA634DrGRQ0MQE+ZJ3atlOTc778XYBtjBbdP+H/jZ5N2cjdQfpk79GtiP2LMFHsX/Jxks2"
    "/pON/LmzUTxTNvKd2cieZOOh5fOIQBmRzQUZYymDOWwYmvzajhxYRgOGSR6wEsunDAlmAUOaBCwPfbHARzrd"
    "1qLhrT26K/GdQ2kORCkN6HfZ6brVdo9YpkU0Gp2+n0T/AK4CFZc=")


LIGNES = [["Référence", "Désignation", "Quantité", "Prix HT"],
          ["MC-4501", "Moulin à café", "2", "19,90"],
          ["MC-9000", "Bouilloire", "1", "34,00"],
          ["MC-1200", "Théière fonte", "3", "45,50"]]

REPLIEE_AVEC_FILETS = [["Référence", "Désignation", "Quantité", "Prix HT"],
                       ["MC-4501", "Moulin à café Lumière\nmodèle 2026, édition limitée",
                        "2", "19,90"],
                       ["MC-9000", "Bouilloire", "1", "34,00"]]

REPLIEE_SANS_FILETS = [["Référence", "Désignation", "Quantité", "Prix HT"],
                       ["MC-4501", "Moulin à café Lumière", "2", "19,90"],
                       ["", "modèle 2026, édition limitée", "", ""],
                       ["MC-9000", "Bouilloire", "1", "34,00"]]


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_la_lecture_devinee_coupe_une_cellule_repliee():
    """
    « Le tableau tracé rend trois lignes et met « Moulin à café Lumière » et
    « modèle 2026, édition limitée » dans la même case, quand la lecture sans
    filets en rend quatre et laisse la seconde ligne seule. »
    """
    par_les_filets = read_tables(CELLULE_REPLIEE)["tables"][0]
    assert par_les_filets["strategy"] == "lines"
    assert par_les_filets["rows"] == REPLIEE_AVEC_FILETS
    assert len(par_les_filets["rows"]) == 3

    # La même page, lue par la stratégie de repli : quatre lignes.
    par_le_texte = group_into_rows(_mots(CELLULE_REPLIEE))
    assert par_le_texte == REPLIEE_SANS_FILETS
    assert len(par_le_texte) == 4


def test_point_de_rupture_temoin_le_rapport_dit_laquelle_des_deux_lectures_a_repondu():
    """« Le témoin : c'est le même document, et `strategy` dit laquelle des deux lectures a répondu. »"""
    assert read_tables(TABLEAU)["tables"][0]["strategy"] == "lines"
    assert read_tables(SANS_FILETS)["tables"][0]["strategy"] == "text"


def _mots(pdf: bytes) -> list:
    """Les mots de la première page, avec leurs coordonnées."""
    import io

    import pdfplumber

    with pdfplumber.open(io.BytesIO(pdf)) as document:
        return [{"text": w["text"], "x": w["x0"], "end": w["x1"], "y": -w["top"]}
                for w in document.pages[0].extract_words()]


# ---------------------------------------------------------------------------
# Les autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_les_deux_lectures_donnent_la_meme_grille_sur_un_tableau_ordinaire():
    """
    Docstring : « on a table with no rules […] the two answer exactly the same
    thing ». Ici, les deux lectures du même tableau, tracé ou non.
    """
    assert read_tables(TABLEAU)["tables"][0]["rows"] == LIGNES
    assert read_tables(SANS_FILETS)["tables"][0]["rows"] == LIGNES


def test_un_mot_nest_jamais_coupe():
    """
    Docstring : « A word is never cut […] which is what keeps « Prix HT »
    whole ». La stratégie de repli de `pdfplumber`, elle, le coupe.
    """
    import io

    import pdfplumber

    assert read_tables(SANS_FILETS)["tables"][0]["rows"][0][3] == "Prix HT"
    with pdfplumber.open(io.BytesIO(SANS_FILETS)) as document:
        par_la_bibliotheque = document.pages[0].extract_tables(
            {"vertical_strategy": "text", "horizontal_strategy": "text"})
    assert par_la_bibliotheque[0][0][3] == "Prix H"


def test_les_mots_dune_meme_cellule_sont_rassembles():
    """Commentaire : « « Moulin à café » is one cell »."""
    assert read_tables(SANS_FILETS)["tables"][0]["rows"][1][1] == "Moulin à café"
    assert SAME_CELL == 10.0 and SAME_LINE == 3.0 and SAME_COLUMN == 12.0


def test_une_page_sans_tableau_ne_rend_pas_un_tableau_invente():
    """
    Une page de prose n'a ni filets ni colonnes : ce que la lecture de repli en
    tire est une ligne par ligne de texte, et une seule colonne.
    """
    tables = read_tables(PROSE)["tables"]
    assert tables[0]["strategy"] == "text"
    assert all(len(ligne) == 1 for ligne in tables[0]["rows"])
    # Une page d'image ne rend rien du tout.
    assert read_tables(SCAN)["tables"] == []


def test_chaque_page_est_lue_et_lappelant_peut_en_choisir():
    assert [t["page"] for t in read_tables(DEUX_PAGES)["tables"]] == [1, 2]
    assert [t["strategy"] for t in read_tables(DEUX_PAGES)["tables"]] == ["lines", "text"]
    assert [t["page"] for t in read_tables(DEUX_PAGES, pages=[2])["tables"]] == [2]


def test_un_fichier_qui_nest_pas_un_pdf_donne_une_raison():
    rapport = read_tables(b"ceci n'est pas un PDF")
    assert rapport["tables"] == []
    assert rapport["reason"].startswith("this file could not be opened as a PDF")


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_entree_banale_une_facture_a_quatre_colonnes():
    """T5 : l'entrée ordinaire du public visé."""
    table = read_tables(TABLEAU)["tables"][0]
    assert len(table["rows"]) == 4
    assert table["rows"][1] == ["MC-4501", "Moulin à café", "2", "19,90"]


def test_production_entree_vide():
    assert read_tables(b"")["tables"] == []
    assert read_tables(b"")["reason"] is not None
    assert group_into_rows([]) == []


def test_production_entree_tres_grande_et_terminaison_rapide():
    """Dix mille mots posés sur une page : le regroupement doit rester linéaire."""
    mots = [{"text": f"m{i}", "x": (i % 50) * 11.0, "end": (i % 50) * 11.0 + 8,
             "y": -(i // 50) * 12.0} for i in range(10_000)]
    debut = time.perf_counter()
    grille = group_into_rows(mots)
    assert time.perf_counter() - debut < 30.0
    assert len(grille) == 200


def test_production_encodages_inattendus():
    # Des mots accentués, avec emoji et insécables, gardent leur forme.
    mots = [{"text": "Réf.", "x": 0, "end": 20, "y": 0},
            {"text": "Moulin à café 🫖", "x": 100, "end": 200, "y": 0},
            {"text": "19,90", "x": 300, "end": 320, "y": 0}]
    assert group_into_rows(mots) == [["Réf.", "Moulin à café 🫖", "19,90"]]


def test_production_valeurs_aux_limites():
    # Exactement l'écart qui sépare deux lignes, et un poil plus.
    base = {"x": 0.0, "end": 10.0}
    meme = group_into_rows([{**base, "text": "a", "y": 0.0},
                            {**base, "text": "b", "y": -SAME_LINE}])
    assert len(meme) == 1
    deux = group_into_rows([{**base, "text": "a", "y": 0.0},
                            {**base, "text": "b", "y": -SAME_LINE - 0.1}])
    assert len(deux) == 2
    # Exactement l'écart qui sépare deux cellules.
    une = group_into_rows([{"text": "a", "x": 0.0, "end": 10.0, "y": 0.0},
                           {"text": "b", "x": 10.0 + SAME_CELL, "end": 30.0, "y": 0.0}])
    assert une == [["a b"]]
    separees = group_into_rows([{"text": "a", "x": 0.0, "end": 10.0, "y": 0.0},
                                {"text": "b", "x": 10.0 + SAME_CELL + 0.1, "end": 30.0, "y": 0.0}])
    assert separees == [["a", "b"]]


def test_production_une_page_sans_tableau_nempeche_pas_de_lire_les_autres():
    """T8 : une page sale ne fait pas tomber le document."""
    lot = [TABLEAU, b"pas un PDF", SANS_FILETS, SCAN]
    assert [len(read_tables(p)["tables"]) for p in lot] == [1, 0, 1, 0]


def test_production_la_lecture_tient_la_classe_de_latence_annoncee():
    """latency « ~10 ms » : cent lectures sous une borne d'effondrement large."""
    debut = time.perf_counter()
    for _ in range(100):
        read_tables(TABLEAU)
    assert time.perf_counter() - debut < 60.0


# ---------------------------------------------------------------------------
# Les deux langages : ce qu'ils garantissent, et ce qu'ils ne garantissent pas
# ---------------------------------------------------------------------------


def test_sans_filets_les_deux_langages_rendent_la_meme_grille_avec_filets_non():
    """
    Docstring : « there is no equivalent of it in JavaScript […] the Python
    extract returns three rows […] and this one returns four ».
    """
    node = shutil.which("node")
    assert node, "node est requis pour comparer les deux implémentations"
    documents = {"TABLEAU": TABLEAU, "SANS_FILETS": SANS_FILETS,
                 "CELLULE_REPLIEE": CELLULE_REPLIEE, "PROSE": PROSE, "SCAN": SCAN}
    script = (
        f"import {{ readTables }} from {json.dumps((ICI / 'n0.js').as_uri())};"
        "let d='';process.stdin.on('data',c=>d+=c).on('end',async()=>{"
        "const f=JSON.parse(d);const out={};"
        "for (const [k,b64] of Object.entries(f)) out[k]=await readTables(Buffer.from(b64,'base64'));"
        "process.stdout.write(JSON.stringify(out));});"
    )
    sortie = subprocess.run(
        [node, "--input-type=module", "-e", script],
        input=json.dumps({k: base64.b64encode(v).decode() for k, v in documents.items()}),
        capture_output=True, text=True, timeout=120, check=True)
    # `pdf.js` écrit ses avertissements sur la sortie standard ; le JSON
    # commence à la première accolade.
    par_js = json.loads(sortie.stdout[sortie.stdout.index("{"):])

    # Sans filets, les deux rendent exactement la même grille.
    assert par_js["SANS_FILETS"]["tables"][0]["rows"] == LIGNES
    assert par_js["PROSE"]["tables"][0]["rows"] == read_tables(PROSE)["tables"][0]["rows"]
    assert par_js["SCAN"]["tables"] == []
    # Avec filets, le JavaScript lit quand même, par la stratégie de repli.
    assert par_js["TABLEAU"]["tables"][0]["rows"] == LIGNES
    assert par_js["TABLEAU"]["tables"][0]["strategy"] == "text"
    assert read_tables(TABLEAU)["tables"][0]["strategy"] == "lines"
    # Et sur la cellule repliée, c'est là que les deux diffèrent.
    assert par_js["CELLULE_REPLIEE"]["tables"][0]["rows"] == REPLIEE_SANS_FILETS
    assert read_tables(CELLULE_REPLIEE)["tables"][0]["rows"] == REPLIEE_AVEC_FILETS
