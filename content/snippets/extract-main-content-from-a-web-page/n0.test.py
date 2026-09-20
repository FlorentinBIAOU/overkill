import json
import shutil
import subprocess
import time
from pathlib import Path

from n0 import MAX_LINK_SHARE, MIN_CHARACTERS, read_article

ICI = Path(__file__).parent

PARAGRAPHES = [
    "Installée rue des Lilas depuis 1926, la boulangerie Martin a vu passer quatre"
    " générations de clients et trois guerres. Son four à bois, classé, tourne encore"
    " tous les matins à cinq heures.",
    "Clémentine Martin, qui a repris le commerce en 2019, raconte que la farine vient"
    " toujours du même moulin, à quarante kilomètres de là, et que la recette du pain de"
    " campagne n’a pas bougé d’une ligne depuis son arrière-grand-père.",
]

AUTOUR = ["Accueil Boutique Contact", "Ce site utilise des cookies",
          "Mentions légales", "Vous aimerez aussi : les dix meilleures boulangeries"]

TITRE = "La boulangerie Martin fête ses cent ans"

ARTICLE = (
    f"<!doctype html><html lang=\"fr\"><head><title>{TITRE}</title></head><body>"
    f"<nav>{AUTOUR[0]}</nav><div class=\"cookies\">{AUTOUR[1]}</div>"
    f"<article><h1>{TITRE}</h1><p>{PARAGRAPHES[0]}</p><p>{PARAGRAPHES[1]}</p></article>"
    f"<aside>{AUTOUR[3]}</aside><footer>{AUTOUR[2]}</footer></body></html>"
)

# Une page dont le corps est construit par son propre JavaScript.
APPLICATION = ('<!doctype html><html lang="fr"><head><title>Application</title></head>'
               '<body><div id="root"></div><script src="/app.js"></script></body></html>')

# Une page qui n'est pas un article : une liste de liens.
CATEGORIE = ('<!doctype html><html><head><title>Boulangeries</title></head><body><ul>'
             + "".join(f'<li><a href="/a{i}">Boulangerie numéro {i}</a></li>' for i in range(40))
             + "</ul></body></html>")


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_une_page_construite_par_son_javascript_na_rien_a_extraire():
    """
    « Une page dont le corps est construit par son propre JavaScript arrive ici
    en coquille vide, et le rapport le dit plutôt que de rendre une chaîne
    vide. »
    """
    rapport = read_article(APPLICATION)
    assert rapport["characters"] == 0
    assert rapport["reason"] == (
        "almost nothing was extracted: this page may be built by its own JavaScript")
    # La page n'est pas vide pour autant : elle porte son titre et son script.
    assert "app.js" in APPLICATION


def test_point_de_rupture_temoin_le_meme_article_servi_en_html_est_extrait():
    """« Le témoin : le même article servi en HTML sort avec ses deux paragraphes. »"""
    rapport = read_article(ARTICLE)
    assert rapport["reason"] is None
    assert rapport["characters"] > MIN_CHARACTERS


# ---------------------------------------------------------------------------
# Les autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_les_phrases_de_larticle_sont_gardees_et_le_reste_jete():
    """
    Docstring : « the article's sentences are in, the navigation and the footer
    are out ». C'est la seule chose que les deux bibliothèques garantissent
    toutes les deux, et c'est celle qui compte.
    """
    texte = read_article(ARTICLE)["text"]
    for phrase in PARAGRAPHES:
        assert phrase in texte, phrase[:40]
    for bruit in AUTOUR:
        assert bruit not in texte, bruit


def test_le_titre_est_rendu_a_part():
    assert read_article(ARTICLE)["title"] == TITRE
    assert read_article(APPLICATION)["title"] == "Application"


def test_une_page_de_liens_ne_passe_pas_pour_un_article():
    """
    Docstring : « above half the page is not an article whatever the extractor
    said ». C'est la règle qui met les deux bibliothèques d'accord.
    """
    rapport = read_article(CATEGORIE)
    assert rapport["text"] == ""
    assert rapport["reason"] == "this page is a list of links, not an article"
    assert MAX_LINK_SHARE == 0.5
    # Témoin : l'article, qui ne porte aucun lien, passe.
    assert read_article(ARTICLE)["reason"] is None


def test_les_commentaires_des_lecteurs_ne_font_pas_partie_de_larticle():
    """
    L'essai l'affirme : « Les commentaires des lecteurs ne font pas partie de
    l'article ». Les deux bibliothèques les écartent, et le texte extrait est
    exactement le même qu'avec ou sans la section.
    """
    avec = ARTICLE.replace("<aside>", '<section id="comments"><h2>Commentaires</h2>'
                           "<p>Le meilleur pain de la ville, sans hésiter. Et la brioche du"
                           " dimanche vaut le détour aussi.</p>"
                           "<p>J’y vais depuis vingt ans, rien n’a changé, et c’est très bien"
                           " comme ça.</p></section><aside>")
    assert read_article(avec)["text"] == read_article(ARTICLE)["text"]
    assert "brioche" in avec


def test_le_plancher_est_reglable_et_son_effet_est_visible():
    """R7 : ce que le réglage par défaut produit, et ce que le changer produit."""
    assert read_article(ARTICLE, min_characters=10_000)["reason"] is not None
    assert read_article(ARTICLE, min_characters=1)["reason"] is None


def test_aucune_entree_ne_leve():
    for entree in [None, 0, 4.2, b"<html>", [], {}, object()]:
        rapport = read_article(entree)
        assert rapport["text"] == ""
        assert isinstance(rapport["reason"], str)


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_entree_banale_un_article_de_presse_locale():
    """T5 : l'entrée ordinaire du public visé."""
    rapport = read_article(ARTICLE)
    assert rapport["title"] == TITRE
    assert rapport["reason"] is None
    assert PARAGRAPHES[0] in rapport["text"]


def test_production_entree_vide():
    vide = read_article("")
    assert vide["text"] == ""
    assert vide["reason"] == "this page could not be parsed"


def test_production_entree_tres_grande_et_terminaison_rapide():
    """Un article de cinq cents paragraphes : le temps doit rester raisonnable."""
    ajout = "".join(f"<p>Paragraphe numéro {i} : {PARAGRAPHES[1]}</p>" for i in range(500))
    enorme = ARTICLE.replace("</article>", ajout + "</article>")
    debut = time.perf_counter()
    rapport = read_article(enorme)
    assert time.perf_counter() - debut < 30.0
    assert rapport["characters"] > 10_000


def test_production_encodages_inattendus():
    # Entités HTML, emoji, insécables : le texte extrait les rend décodés.
    page = ARTICLE.replace("boulangerie Martin a vu", "boulangerie Martin&nbsp;🥖 a vu")
    assert "🥖" in read_article(page)["text"]
    # Un document sans déclaration d'encodage passe quand même.
    assert read_article(ARTICLE.replace('lang="fr"', ""))["reason"] is None
    # Du balisage cassé ne fait pas lever.
    casse = ARTICLE.replace("</p>", "").replace("</article>", "")
    assert isinstance(read_article(casse)["text"], str)


def test_production_valeurs_aux_limites():
    # Exactement le plancher, juste en dessous.
    corps = "a" * MIN_CHARACTERS
    page = f"<html><head><title>t</title></head><body><article><p>{corps}</p></article></body></html>"
    assert read_article(page)["reason"] is None or read_article(page)["characters"] < MIN_CHARACTERS
    court = page.replace(corps, "a" * (MIN_CHARACTERS - 1))
    assert read_article(court)["reason"] is not None


def test_production_une_page_illisible_dans_un_lot_nempeche_pas_les_autres():
    """T8 : une page cassée ne fait pas tomber le lot."""
    lot = [ARTICLE, "", APPLICATION, "<html", ARTICLE]
    assert [read_article(p)["reason"] is None for p in lot] == [
        True, False, False, False, True]


def test_production_lextraction_tient_la_classe_de_latence_annoncee():
    """latency « ~10 ms » : mille extractions sous une borne d'effondrement large."""
    debut = time.perf_counter()
    for _ in range(1_000):
        read_article(ARTICLE)
    assert time.perf_counter() - debut < 60.0


# ---------------------------------------------------------------------------
# Ce que les deux langages garantissent, et ce qu'ils ne garantissent pas
# ---------------------------------------------------------------------------


def test_les_deux_extraits_gardent_larticle_et_jettent_le_reste_sans_rendre_le_meme_texte():
    """
    Docstring : « They are not the same algorithm and they do not return the
    same characters […] What they agree on is the part that matters ».
    """
    node = shutil.which("node")
    assert node, "node est requis pour comparer les deux implémentations"
    pages = [ARTICLE, APPLICATION, CATEGORIE, "", "<html"]
    attendu = [read_article(p) for p in pages]
    script = (
        f"import {{ readArticle }} from {json.dumps((ICI / 'n0.js').as_uri())};"
        "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{"
        "process.stdout.write(JSON.stringify(JSON.parse(d).map((h)=>readArticle(h))));});"
    )
    sortie = subprocess.run([node, "--input-type=module", "-e", script],
                            input=json.dumps(pages), capture_output=True,
                            text=True, timeout=120, check=True)
    par_js = json.loads(sortie.stdout)

    # Ce sur quoi les deux s'accordent, sur toutes les pages : le verdict et sa raison.
    assert [r["reason"] for r in attendu] == [r["reason"] for r in par_js]
    # Et sur l'article : les phrases gardées, le bruit jeté, le titre.
    for phrase in PARAGRAPHES:
        assert phrase in attendu[0]["text"] and phrase in par_js[0]["text"]
    for bruit in AUTOUR:
        assert bruit not in attendu[0]["text"] and bruit not in par_js[0]["text"]
    assert attendu[0]["title"] == par_js[0]["title"] == TITRE
    # Ce sur quoi ils ne s'accordent pas, et que la fiche annonce : le texte.
    assert attendu[0]["text"] != par_js[0]["text"]
