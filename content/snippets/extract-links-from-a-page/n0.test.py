import json
import shutil
import subprocess
import time
from pathlib import Path

from n0 import extract_links

ICI = Path(__file__).parent

BASE = "https://exemple.fr/blog/"

# Une page ordinaire : des liens relatifs, un lien externe, une ancre, un
# courriel, et deux choses qui ne sont pas des adresses.
PAGE = """<!doctype html><html><head><title>Le blog</title></head><body>
<a href="article">L'article</a>
<a href="/racine" rel="nofollow">Racine</a>
<a href="../haut">Un cran au-dessus</a>
<a href="https://autre.fr/page">Chez les voisins</a>
<a href="#ancre">Ancre</a>
<a href="mailto:jean@exemple.fr">&Eacute;crire</a>
<a href="tel:+33123456789">Appeler</a>
<a href="javascript:alert(1)">Script</a>
<a>Sans href</a>
<a href="  ">Vide</a>
</body></html>"""

# La même page, avec un élément <base> qui change tout.
AVEC_BASE = PAGE.replace("<title>", '<base href="https://exemple.fr/v2/"><title>')

# Les vingt et un cas d'adresse où les deux langages ont été confrontés.
ADRESSES = ["article", "/racine", "../haut", "//autre.fr/x", "?q=1", "#ancre", "",
            " https://exemple.fr/espace ", "https://café.fr/page",
            "HTTPS://EXEMPLE.FR/MAJ", "\\\\chemin", "/a b c", "/é",
            "mailto:jean@exemple.fr", "/x/../../y", "http://exemple.fr:443/p",
            "https://exemple.fr:443/p", "tel:+33123456789", "?q=un deux",
            "#ancre é", "/déjà%20encodé", "//CAFÉ.fr/x", "http://exemple.fr:8080/p",
            "/a?b=c&d=é", "\ta\nb\rc", "https://jean:secret@exemple.fr/p",
            "https://exemple.fr", "?", "https://exemple.fr/a%2Fb", "..%2F..",
            "https://exemple.fr/p?a=1#b\\c", "//exemple.fr\\evil.com/", "#", "a?",
            "a#", "?a=b#", "?a=b\\c", "/chemin/avec espace/é.html?q=a b#f é"]


def page_de(*hrefs):
    corps = "".join(f'<a href="{href}">x</a>' for href in hrefs)
    return f"<!doctype html><html><body>{corps}</body></html>"


def urls(html, base=BASE):
    return [lien["url"] for lien in extract_links(html, base)["links"]]


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_une_base_fausse_rend_des_adresses_valides_et_fausses():
    """
    « Le code résout contre ce qu'on lui a déclaré, et une adresse résolue
    contre une base fausse reste une adresse valide. »
    """
    demande = urls(PAGE, "https://exemple.fr/blog/")
    arrivee = urls(PAGE, "https://www.exemple.fr/blog/2026/")
    assert demande[0] == "https://exemple.fr/blog/article"
    assert arrivee[0] == "https://www.exemple.fr/blog/2026/article"
    # Les deux sont des adresses ; rien dans le rapport ne dit laquelle est bonne.
    assert extract_links(PAGE, "https://www.exemple.fr/blog/2026/")["reason"] is None


def test_point_de_rupture_temoin_la_base_declaree_est_rendue_dans_le_rapport():
    """
    « Le témoin est dans le même test : la base employée est rendue, et
    l'élément <base> de la page la remplace — c'est la première chose à
    regarder quand tous les liens sont faux. »
    """
    assert extract_links(PAGE, BASE)["base"] == BASE
    rapport = extract_links(AVEC_BASE, BASE)
    assert rapport["base"] == "https://exemple.fr/v2/"
    assert rapport["links"][0]["url"] == "https://exemple.fr/v2/article"


# ---------------------------------------------------------------------------
# Le verdict, confronté aux données de la fiche
# ---------------------------------------------------------------------------


def test_verdict_un_antislash_ne_va_pas_ou_on_croit():
    """
    R4 : la divergence qui porte la fiche. RFC 3986 en fait un caractère de
    chemin, la norme WHATWG en fait une barre oblique — et le navigateur suit
    la seconde.
    """
    assert urls(page_de("\\\\chemin")) == ["https://chemin/"]
    # Une seule barre inversée ne sort pas du site, mais remonte à la racine.
    assert urls(page_de("\\chemin")) == ["https://exemple.fr/chemin"]
    # Le témoin : la même adresse avec une barre oblique reste où on l'attend.
    assert urls(page_de("chemin")) == ["https://exemple.fr/blog/chemin"]


def test_verdict_les_six_autres_divergences_mesurees_sont_fermees():
    assert urls(page_de(" https://exemple.fr/espace ")) == ["https://exemple.fr/espace"]
    assert urls(page_de("https://café.fr/page")) == ["https://xn--caf-dma.fr/page"]
    assert urls(page_de("HTTPS://EXEMPLE.FR/MAJ")) == ["https://exemple.fr/MAJ"]
    assert urls(page_de("/a b c")) == ["https://exemple.fr/a%20b%20c"]
    assert urls(page_de("/é")) == ["https://exemple.fr/%C3%A9"]
    assert urls(page_de("https://exemple.fr:443/p")) == ["https://exemple.fr/p"]


# ---------------------------------------------------------------------------
# Les autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_la_base_est_exigee():
    for base in (None, "", "   ", 42):
        rapport = extract_links(PAGE, base)
        assert rapport["links"] == []
        assert rapport["reason"] == "the address the page was served from is required"


def test_ce_qui_nest_pas_une_adresse_est_ecarte_avec_sa_raison():
    rapport = extract_links(PAGE, BASE)
    assert rapport["skipped"] == [
        {"href": "javascript:alert(1)", "why": "javascript is not an address"},
        {"href": None, "why": "no address"},
        {"href": "  ", "why": "no address"},
    ]


def test_chaque_lien_porte_son_genre():
    genres = [lien["kind"] for lien in extract_links(PAGE, BASE)["links"]]
    assert genres == ["page", "page", "page", "page", "anchor", "mail", "phone"]


def test_le_texte_du_lien_est_rendu_entites_decodees():
    textes = [lien["text"] for lien in extract_links(PAGE, BASE)["links"]]
    assert textes[0] == "L'article"
    assert textes[5] == "Écrire"
    # Le balisage à l'intérieur du lien n'est pas rendu, son texte l'est.
    assert extract_links(page_de("x").replace(">x<", "><em>Café</em> chez eux<"),
                         BASE)["links"][0]["text"] == "Café chez eux"


def test_le_rel_est_rendu_tel_quel():
    liens = extract_links(PAGE, BASE)["links"]
    assert liens[1]["rel"] == "nofollow" and liens[0]["rel"] is None


def test_aucune_entree_ne_leve():
    for entree in [None, 42, [], {}, b"octets"]:
        assert extract_links(entree, BASE)["links"] == []
    assert extract_links("<a href=", BASE)["links"] == []


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_entree_banale_une_page_de_blog():
    """T5 : l'entrée ordinaire du public visé."""
    assert urls(PAGE)[:4] == ["https://exemple.fr/blog/article",
                              "https://exemple.fr/racine",
                              "https://exemple.fr/haut",
                              "https://autre.fr/page"]


def test_production_entree_vide():
    assert extract_links("", BASE) == {"links": [], "skipped": [], "base": BASE,
                                       "reason": None}


def test_production_entree_tres_grande_et_terminaison_rapide():
    enorme = "<html><body>" + '<a href="a">x</a>' * 50_000 + "</body></html>"
    debut = time.perf_counter()
    rapport = extract_links(enorme, BASE)
    assert time.perf_counter() - debut < 60.0
    assert len(rapport["links"]) == 50_000


def test_production_encodages_inattendus():
    assert urls(page_de("/déjà%20encodé")) == ["https://exemple.fr/d%C3%A9j%C3%A0%20encod%C3%A9"]
    assert urls(page_de("\ta\nb\rc")) == ["https://exemple.fr/blog/abc"]
    assert extract_links("﻿" + PAGE, BASE)["links"][0]["url"].endswith("/article")


def test_production_valeurs_aux_limites():
    assert urls(page_de("?")) == ["https://exemple.fr/blog/?"]
    assert urls(page_de("#")) == ["https://exemple.fr/blog/#"]
    assert urls(page_de("https://exemple.fr")) == ["https://exemple.fr/"]
    assert urls(page_de("//exemple.fr\\evil.com/")) == ["https://exemple.fr/evil.com/"]


def test_production_un_lien_illisible_nempeche_pas_de_lire_les_autres():
    """T8 : un href impossible ne fait pas tomber la page."""
    melange = page_de("javascript:x", "article", "")
    assert urls(melange) == ["https://exemple.fr/blog/article"]


def test_production_la_lecture_tient_la_classe_de_latence_annoncee():
    """latency « ~10 ms » : mille lectures d'une page sous une borne large."""
    debut = time.perf_counter()
    for _ in range(1000):
        extract_links(PAGE, BASE)
    assert time.perf_counter() - debut < 20.0


# ---------------------------------------------------------------------------
# Parité entre les deux langages
# ---------------------------------------------------------------------------


def test_python_et_javascript_rendent_le_meme_rapport():
    """La fiche montre les deux extraits : elle affirme la même chose des deux."""
    node = shutil.which("node")
    assert node, "node est requis pour comparer les deux implémentations"
    cas = [[PAGE, BASE], [AVEC_BASE, BASE], ["", BASE], [PAGE, "https://www.exemple.fr/x/"]]
    cas += [[page_de(href), BASE] for href in ADRESSES]
    attendu = [extract_links(html, base) for html, base in cas]
    script = (
        f"import {{ extractLinks }} from {json.dumps((ICI / 'n0.js').as_uri())};"
        "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{"
        "process.stdout.write(JSON.stringify(JSON.parse(d)"
        ".map(([h,b])=>extractLinks(h,b))));});"
    )
    sortie = subprocess.run([node, "--input-type=module", "-e", script],
                            input=json.dumps(cas), capture_output=True,
                            text=True, timeout=120, check=True)
    assert json.loads(sortie.stdout) == attendu
