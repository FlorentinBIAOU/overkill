import json
import shutil
import subprocess
import time
from pathlib import Path

from n0 import MAX_COLSPAN, MAX_ROWSPAN, extract_tables

ICI = Path(__file__).parent

# Un tableau de devis ordinaire : un entête groupé, une cellule fusionnée en
# hauteur, et une ligne de total qui court sur toute la largeur.
DEVIS = """<table><caption>Devis 2026</caption>
<tr><th>Article</th><th colspan="2">Prix</th></tr>
<tr><td>Moulin</td><td>HT</td><td>TTC</td></tr>
<tr><td rowspan="2">Lot</td><td>1</td><td>2</td></tr>
<tr><td>3</td><td>4</td></tr>
<tr><td colspan="3">Total</td></tr></table>"""

IMBRIQUE = ('<table><tr><td>avant<table><tr><td>interne</td></tr></table>après</td>'
            '<td>voisine</td></tr></table>')

SECTIONS = "<table><thead><tr><th>A</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>"

# Les trois cas où le standard dit autre chose que ce que l'extrait faisait :
# une portée en hauteur nulle, une portée au-delà du plafond de `colspan` mais
# en dessous de celui de `rowspan`, et une cellule écrite après `</tr>`.
ROWSPAN_ZERO = ('<table><tr><td rowspan="0">Groupe</td><td>a</td></tr>'
                "<tr><td>b</td></tr><tr><td>c</td></tr></table>")
ROWSPAN_DEUX_MILLE = '<table><tr><td rowspan="2000">y</td></tr></table>'
CELLULE_ORPHELINE = ("<table><tr><td>a</td><td>b</td><td>c</td></tr>"
                     "<td>orpheline</td></table>")

TOUS = [DEVIS, IMBRIQUE, SECTIONS, "<table><td>sans tr</td></table>",
        ROWSPAN_ZERO, ROWSPAN_DEUX_MILLE, CELLULE_ORPHELINE,
        '<table><tr><td colspan="99999">large</td></tr></table>',
        "<table><tr><td>  espaces\n  multiples </td></tr></table>",
        "<p>pas de tableau</p>", "<table><tr><td>a</td></tr>", "<table></table>",
        "<table><tr><td>&eacute;t&eacute;</td></tr></table>",
        "<table><tr><td>a</td></tr><td>b</td></table>",
        '<table><tr><td rowspan="0">z</td><td>y</td></tr></table>',
        "<table><tr><td>1</td><td>2</td></tr><tr><td>3</td></tr></table>"]


def textes(html, index=0):
    return [[cellule["text"] for cellule in ligne]
            for ligne in extract_tables(html)["tables"][index]["rows"]]


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_une_cellule_fusionnee_est_repetee_et_le_dit():
    """
    « « Total » écrit une fois sur trois colonnes revient trois fois, et un
    appelant qui additionne la colonne compterait trois fois le même montant. »
    """
    grille = extract_tables(DEVIS)["tables"][0]["rows"]
    assert [cellule["text"] for cellule in grille[4]] == ["Total", "Total", "Total"]
    # Le drapeau est la seule chose qui distingue la valeur de ses répétitions.
    assert [cellule["repeated"] for cellule in grille[4]] == [False, True, True]


def test_point_de_rupture_temoin_sans_le_drapeau_la_grille_serait_indistinguable():
    """
    « Le témoin est dans le même test : une ligne sans fusion porte les mêmes
    textes distincts, et aucun de ses drapeaux n'est levé. »
    """
    grille = extract_tables(DEVIS)["tables"][0]["rows"]
    assert [cellule["text"] for cellule in grille[1]] == ["Moulin", "HT", "TTC"]
    assert not any(cellule["repeated"] for cellule in grille[1])


# ---------------------------------------------------------------------------
# Les autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_la_grille_rendue_est_celle_que_le_lecteur_voit():
    assert textes(DEVIS) == [
        ["Article", "Prix", "Prix"],
        ["Moulin", "HT", "TTC"],
        ["Lot", "1", "2"],
        ["Lot", "3", "4"],
        ["Total", "Total", "Total"],
    ]


def test_une_fusion_en_hauteur_descend_dans_la_ligne_suivante():
    grille = extract_tables(DEVIS)["tables"][0]["rows"]
    assert (grille[2][0]["text"], grille[2][0]["repeated"]) == ("Lot", False)
    assert (grille[3][0]["text"], grille[3][0]["repeated"]) == ("Lot", True)


def test_les_cellules_dentete_sont_marquees():
    grille = extract_tables(DEVIS)["tables"][0]["rows"]
    assert all(cellule["header"] for cellule in grille[0])
    assert not any(cellule["header"] for cellule in grille[1])


def test_un_tableau_dans_une_cellule_est_un_tableau_a_part():
    rapport = extract_tables(IMBRIQUE)
    assert len(rapport["tables"]) == 2
    # Le porteur d'abord, comme la page l'ouvre en premier.
    assert textes(IMBRIQUE, 1) == [["interne"]]
    # Et son texte ne coule pas dans la cellule qui le porte : il ne reste que
    # ce que la cellule portait elle-même, recollé tel quel — il n'y a pas
    # d'espace entre « avant » et « après » dans la source.
    assert textes(IMBRIQUE, 0) == [["avantaprès", "voisine"]]
    assert rapport["tables"][0]["nested"] is True
    assert rapport["tables"][1]["nested"] is False


def test_la_legende_est_rendue_avec_la_grille():
    assert extract_tables(DEVIS)["tables"][0]["caption"] == "Devis 2026"
    assert extract_tables(SECTIONS)["tables"][0]["caption"] is None


def test_les_sections_de_tableau_ne_coupent_pas_les_lignes():
    assert textes(SECTIONS) == [["A"], ["1"]]


def test_les_deux_plafonds_de_portee_sont_ceux_du_standard():
    """
    Commentaire : « colspan « must be greater than zero and less than or equal
    to 1000 », rowspan « must be greater than zero and less than or equal to
    65534 ». »

    Les deux plafonds ne sont pas le même nombre, et l'extrait appliquait mille
    aux deux : un rowspan de deux mille, parfaitement légal, était ramené à
    mille sans un mot, et la fiche attribuait ce plafond à la norme.
    """
    assert (MAX_COLSPAN, MAX_ROWSPAN) == (1000, 65534)
    large = extract_tables('<table><tr><td colspan="99999">large</td></tr></table>')
    assert large["tables"][0]["columns"] == MAX_COLSPAN
    assert large["tables"][0]["capped"] == 1
    # Deux mille lignes est en dessous du plafond de rowspan : c'est légal, et
    # rien n'est ramené.
    haut = extract_tables(ROWSPAN_DEUX_MILLE)["tables"][0]
    assert len(haut["rows"]) == 2000
    assert haut["capped"] == 0
    # Et au-delà de 65534, le plafond s'applique et le rapport le dit.
    tres_haut = extract_tables('<table><tr><td rowspan="70000">z</td></tr></table>')["tables"][0]
    assert len(tres_haut["rows"]) == MAX_ROWSPAN
    assert tres_haut["capped"] == 1


def test_une_portee_en_hauteur_nulle_couvre_la_fin_du_groupe():
    """
    Commentaire : « For this attribute, the value zero means that the cell is
    to span all the remaining rows in the row group. »

    L'extrait la lisait comme 1, et « b » et « c » se retrouvaient dans la
    colonne de « Groupe » au lieu de celle de « a » — le décalage silencieux
    que le point de rupture dit vouloir éviter, produit par une valeur que la
    norme définit.
    """
    table = extract_tables(ROWSPAN_ZERO)["tables"][0]
    assert table["columns"] == 2
    assert [[(c["text"], c["repeated"]) for c in ligne] for ligne in table["rows"]] == [
        [("Groupe", False), ("a", False)],
        [("Groupe", True), ("b", False)],
        [("Groupe", True), ("c", False)],
    ]


def test_une_cellule_ecrite_apres_la_fin_dune_ligne_en_ouvre_une_autre():
    """
    Commentaire : « « in table body »: a cell met outside a `tr` opens one.
    Adding it to the row that just closed would widen every row of the table. »
    """
    table = extract_tables(CELLULE_ORPHELINE)["tables"][0]
    assert table["columns"] == 3
    assert [[c["text"] for c in ligne] for ligne in table["rows"]] == [
        ["a", "b", "c"], ["orpheline", "", ""]]
    # Deux cellules vides ont été ajoutées par le remplissage, et le rapport
    # le dit : `columns` seul ne dirait pas d'où vient la largeur.
    assert table["padded"] == 2
    # Témoin : le cas isolé, où il n'y a pas de ligne précédente.
    seule = extract_tables("<table><td>sans tr</td></table>")["tables"][0]
    assert [[c["text"] for c in ligne] for ligne in seule["rows"]] == [["sans tr"]]
    assert seule["padded"] == 0


def test_aucune_entree_ne_leve_et_la_raison_nomme_ce_qui_a_ete_recu():
    """R14 : la raison dit ce que le code a constaté — le type reçu."""
    assert extract_tables(None)["reason"] == "expected text, not NoneType"
    assert extract_tables(b"octets")["reason"] == "expected text, not bytes"
    for entree in [None, 42, [], {}, b"octets", ""]:
        rapport = extract_tables(entree)
        assert rapport["tables"] == []
        if not isinstance(entree, str):
            assert rapport["reason"].startswith("expected text, not ")


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_entree_banale_un_tableau_de_devis():
    """T5 : l'entrée ordinaire du public visé."""
    table = extract_tables(DEVIS)["tables"][0]
    assert table["columns"] == 3 and len(table["rows"]) == 5


def test_production_entree_vide():
    assert extract_tables("") == {"tables": [], "reason": None}
    assert extract_tables("<table></table>")["tables"][0]["rows"] == []


def test_production_entree_tres_grande_et_terminaison_rapide():
    enorme = "<table>" + "<tr><td>a</td><td>b</td></tr>" * 20_000 + "</table>"
    debut = time.perf_counter()
    rapport = extract_tables(enorme)
    assert time.perf_counter() - debut < 60.0
    assert len(rapport["tables"][0]["rows"]) == 20_000


def test_production_encodages_inattendus():
    assert textes("<table><tr><td>&eacute;t&eacute;</td></tr></table>") == [["été"]]
    assert textes("<table><tr><td>  espaces\n  multiples </td></tr></table>") == [
        ["espaces multiples"]]


def test_production_valeurs_aux_limites():
    # Une ligne plus courte que les autres est complétée par des cellules vides.
    assert textes("<table><tr><td>1</td><td>2</td></tr><tr><td>3</td></tr></table>") == [
        ["1", "2"], ["3", ""]]
    # Un tableau jamais fermé est rendu quand même.
    assert textes("<table><tr><td>a</td></tr>") == [["a"]]


def test_production_un_tableau_illisible_nempeche_pas_de_lire_les_autres():
    """T8 : un tableau vide au milieu ne fait pas tomber les autres."""
    page = "<table></table>" + DEVIS
    rapport = extract_tables(page)
    assert len(rapport["tables"]) == 2
    assert rapport["tables"][1]["columns"] == 3
    assert rapport["tables"][0]["rows"] == []


def test_production_la_lecture_tient_la_classe_de_latence_annoncee():
    """latency « ~10 ms » : mille lectures d'un tableau sous une borne large."""
    debut = time.perf_counter()
    for _ in range(1000):
        extract_tables(DEVIS)
    assert time.perf_counter() - debut < 20.0


# ---------------------------------------------------------------------------
# Parité entre les deux langages
# ---------------------------------------------------------------------------


def test_python_et_javascript_rendent_le_meme_rapport():
    """La fiche montre les deux extraits : elle affirme la même chose des deux."""
    node = shutil.which("node")
    assert node, "node est requis pour comparer les deux implémentations"
    attendu = [extract_tables(html) for html in TOUS]
    script = (
        f"import {{ extractTables }} from {json.dumps((ICI / 'n0.js').as_uri())};"
        "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{"
        "process.stdout.write(JSON.stringify(JSON.parse(d).map(extractTables)));});"
    )
    sortie = subprocess.run([node, "--input-type=module", "-e", script],
                            input=json.dumps(TOUS), capture_output=True,
                            text=True, timeout=60, check=True)
    assert json.loads(sortie.stdout) == attendu
