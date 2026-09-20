import json
import shutil
import subprocess
import time
from pathlib import Path

from n0 import read_products

ICI = Path(__file__).parent


def page(bloc: str, corps: str = "") -> str:
    """Une page de boutique, réduite à ce qui compte pour ce test."""
    script = f'<script type="application/ld+json">{bloc}</script>' if bloc else ""
    return ("<!doctype html><html lang=\"fr\"><head><meta charset=\"utf-8\">"
            f"<title>Moulin à café Lumière</title>{script}</head>"
            f"<body><h1>Moulin à café Lumière</h1>{corps}</body></html>")


def produit(prix="19.90", **extra) -> str:
    bloc = {
        "@context": "https://schema.org", "@type": "Product",
        "name": "Moulin à café Lumière", "sku": "MC-4501", "gtin13": "3760012345678",
        "brand": {"@type": "Brand", "name": "Lumière"},
        "offers": {"@type": "Offer", "price": prix, "priceCurrency": "EUR",
                   "availability": "https://schema.org/InStock"},
    }
    bloc.update(extra)
    return json.dumps(bloc, ensure_ascii=False)


CORPS = '<p class="prix">19,90 €</p><p>Référence MC-4501</p><p>En stock</p>'

# Une fiche en promotion dont le bloc JSON-LD n'a pas suivi.
PROMO = page(produit(prix="24.90"), CORPS)
# La même, en accord avec elle-même.
EN_ACCORD = page(produit(prix="19.90"), CORPS)
# Un graphe, comme en produisent les greffons de référencement.
GRAPHE = page(json.dumps({"@context": "https://schema.org", "@graph": [
    {"@type": "Organization", "name": "Boulangerie Martin"},
    json.loads(produit()),
]}, ensure_ascii=False), CORPS)
# La page du produit, et le carrousel des articles voisins.
CARROUSEL = page(json.dumps([json.loads(produit()), json.loads(
    produit().replace("MC-4501", "MC-9000").replace("Moulin à café Lumière", "Bouilloire Lumière"))],
    ensure_ascii=False), CORPS)
SANS = page("", CORPS)
CASSE = page("{ceci n'est pas du JSON", CORPS)
VIRGULE = page(produit(prix="1 234,56"), CORPS)
# Le prix écrit en nombre JSON, comme le font plusieurs plateformes : deux
# décimales, et un flottant n'a aucun moyen de s'en souvenir.
NOMBRE = page(produit(prix="@@PRIX@@").replace('"@@PRIX@@"', "24.90"), CORPS)
# Deux offres pour le même produit : une par taille.
DEUX_OFFRES = page(json.dumps({
    "@context": "https://schema.org", "@type": "Product", "name": "Moulin à café Lumière",
    "sku": "MC-4501",
    "offers": [{"@type": "Offer", "price": "19.90", "priceCurrency": "EUR"},
               {"@type": "Offer", "price": "24.90", "priceCurrency": "EUR"}],
}, ensure_ascii=False), CORPS)
MICRODONNEES = page("", '<div itemscope itemtype="https://schema.org/Product">'
                        '<span itemprop="name">Moulin à café Lumière</span></div>')


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_le_bloc_publie_peut_ne_plus_correspondre_a_la_page():
    """
    « Le JSON-LD est ce que la boutique a choisi de publier, et il peut ne plus
    correspondre à ce que la page affiche : sur une fiche en promotion, le bloc
    annonce 24,90 quand le corps de la page affiche 19,90. »
    """
    rapport = read_products(PROMO)
    assert rapport["products"][0]["price"] == "24.90"
    assert "19,90" in PROMO
    assert "24,90" not in PROMO and "24.90" in PROMO


def test_point_de_rupture_temoin_sur_une_page_en_accord_le_prix_est_celui_affiche():
    """« Le témoin : sur la même page en accord avec elle-même, le prix lu est celui du corps. »"""
    rapport = read_products(EN_ACCORD)
    assert rapport["products"][0]["price"] == "19.90"
    assert "19,90 €" in EN_ACCORD


# ---------------------------------------------------------------------------
# Les autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_les_six_champs_sont_lus_et_normalises():
    """Docstring : « The name, the reference, the brand, the price, the currency and the availability »."""
    assert read_products(EN_ACCORD)["products"][0] == {
        "name": "Moulin à café Lumière", "sku": "MC-4501", "gtin": "3760012345678",
        "gtin_key": "gtin13", "brand": "Lumière", "price": "19.90",
        "price_text": "19.90", "currency": "EUR", "availability": "InStock",
        "offers": 1,
    }


def test_la_disponibilite_est_la_meme_ecrite_de_trois_facons():
    """Commentaire : « a URL, a bare name, or an http URL from before the site moved to https »."""
    for ecrit in ("https://schema.org/InStock", "http://schema.org/InStock", "InStock"):
        bloc = produit().replace("https://schema.org/InStock", ecrit)
        assert read_products(page(bloc))["products"][0]["availability"] == "InStock", ecrit


def test_un_graphe_et_une_liste_de_blocs_sont_parcourus():
    """Docstring : « a graph, a list of blocks, or one object »."""
    assert read_products(GRAPHE)["products"][0]["sku"] == "MC-4501"
    assert len(read_products(GRAPHE)["products"]) == 1


def test_tous_les_produits_de_la_page_sont_rendus_et_la_page_ne_dit_pas_lequel():
    """
    Docstring : « nothing in the format says which is which, so every one found
    is returned and the caller chooses ».
    """
    produits = read_products(CARROUSEL)["products"]
    assert [p["sku"] for p in produits] == ["MC-4501", "MC-9000"]


def test_un_prix_qui_nest_pas_un_nombre_revient_nul_avec_son_texte():
    """
    Docstring : « rather than read it as one thousand or as one, `price` comes
    back as None with the text the shop wrote in `price_text` ».
    """
    lu = read_products(VIRGULE)["products"][0]
    assert lu["price"] is None
    assert lu["price_text"] == "1 234,56"
    # Témoin : le même prix écrit comme schema.org le demande est lu.
    assert read_products(EN_ACCORD)["products"][0]["price"] == "19.90"


def test_un_prix_ecrit_en_nombre_json_garde_ses_centimes():
    """
    Docstring : « A shop that writes `"price": 24.90` — as a JSON number, which
    several platforms do — has written two decimals, and a float has no way to
    remember that ».

    C'est le champ dont toute la raison d'être est de garder les centimes.
    """
    assert '"price": 24.90' in NOMBRE, "le prix est bien écrit en nombre JSON"
    lu = read_products(NOMBRE)["products"][0]
    assert lu["price"] == "24.90"
    assert lu["price_text"] == "24.90"
    # Et aucun champ du document ne ressort en flottant.
    assert all(not isinstance(v, float) for v in lu.values())


def test_seule_la_premiere_offre_est_lue_et_le_rapport_dit_combien_il_y_en_avait():
    """
    Docstring : « only the first is read. `offers` in the report says how many
    there were, so a caller that sees more than one knows the price it got is
    one of several ».
    """
    lu = read_products(DEUX_OFFRES)["products"][0]
    assert lu["price"] == "19.90"
    assert lu["offers"] == 2
    # Témoin : une seule offre, et le compte le dit aussi.
    assert read_products(EN_ACCORD)["products"][0]["offers"] == 1


def test_le_rapport_nomme_la_cle_gtin_qui_a_repondu():
    """
    Commentaire : « Their length is an information of its own — eight, twelve,
    thirteen or fourteen digits — and « what is not read is named » applies to
    what is read too ».
    """
    for cle, valeur in [("gtin13", "3760012345678"), ("gtin8", "37600126"),
                        ("gtin", "37600123456789")]:
        bloc = json.loads(produit())
        del bloc["gtin13"]
        bloc[cle] = valeur
        lu = read_products(page(json.dumps(bloc, ensure_ascii=False)))["products"][0]
        assert (lu["gtin"], lu["gtin_key"]) == (valeur, cle), cle
    # Témoin : aucune clé GTIN, et le rapport le dit plutôt que de se taire.
    sans = json.loads(produit())
    del sans["gtin13"]
    lu = read_products(page(json.dumps(sans, ensure_ascii=False)))["products"][0]
    assert (lu["gtin"], lu["gtin_key"]) == (None, None)


def test_une_page_muette_et_une_page_cassee_ne_se_confondent_pas():
    """Docstring : « knows whether the page is silent or whether its JSON-LD is broken »."""
    assert read_products(SANS) == {"source": None, "products": [], "reason": "no JSON-LD product"}
    assert read_products(CASSE)["reason"] == "the JSON-LD on this page could not be parsed"


def test_les_microdonnees_ne_sont_pas_lues_par_ce_niveau():
    """
    Le format plus ancien — itemprop dans le balisage — n'est pas couvert, et
    la page revient muette plutôt que devinée.
    """
    assert read_products(MICRODONNEES)["products"] == []
    assert "itemprop" in MICRODONNEES


def test_aucune_entree_ne_leve_et_la_raison_nomme_ce_qui_a_ete_recu():
    """R14 : la raison dit ce que le code a constaté — le type reçu."""
    assert read_products(None)["reason"] == "expected HTML, not NoneType"
    assert read_products(b"<html>")["reason"] == "expected HTML, not bytes"
    assert read_products(0)["reason"] == "expected HTML, not int"
    for entree in [None, 0, 4.2, b"<html>", [], {}, object()]:
        rapport = read_products(entree)
        assert rapport["products"] == []
        assert rapport["reason"].startswith("expected HTML, not ")


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_entree_banale_une_fiche_produit_de_boutique():
    """T5 : l'entrée ordinaire du public visé."""
    rapport = read_products(EN_ACCORD)
    assert rapport["source"] == "json-ld"
    assert rapport["products"][0]["name"] == "Moulin à café Lumière"


def test_production_entree_vide():
    assert read_products("") == {"source": None, "products": [], "reason": "no JSON-LD product"}


def test_production_entree_tres_grande_et_terminaison_rapide():
    """Une page d'un mégaoctet : l'expression régulière ne doit pas s'effondrer."""
    enorme = EN_ACCORD.replace("</body>", "<div>" + "x" * 1_000_000 + "</div></body>")
    debut = time.perf_counter()
    rapport = read_products(enorme)
    assert time.perf_counter() - debut < 10.0
    assert rapport["products"][0]["sku"] == "MC-4501"
    # Une page faite de balises ouvertes non refermées ne fait pas exploser le motif.
    debut = time.perf_counter()
    read_products("<script type='application/ld+json'>" * 20_000)
    assert time.perf_counter() - debut < 10.0


def test_production_encodages_inattendus():
    # Accents, emoji, espaces insécables, guillemets typographiques dans le nom.
    for nom in ["Moulin à café Lumière", "Bouilloire 🫖 Lumière",
                "Moulin à café", "Moulin « Lumière »"]:
        bloc = produit().replace("Moulin à café Lumière", nom)
        assert read_products(page(bloc))["products"][0]["name"] == nom, nom
    # Les espaces de bord d'une valeur sont retirés, le reste ne bouge pas.
    bloc = produit().replace('"Moulin à café Lumière"', '"  Moulin à café Lumière  "')
    assert read_products(page(bloc))["products"][0]["name"] == "Moulin à café Lumière"


def test_production_valeurs_aux_limites():
    # Un bloc vide, un bloc qui n'est pas un objet, un type en liste.
    assert read_products(page(""))["products"] == []
    assert read_products(page("null"))["products"] == []
    assert read_products(page('["Product"]'))["products"] == []
    bloc = produit().replace('"@type": "Product"', '"@type": ["Product", "Thing"]')
    assert read_products(page(bloc))["products"][0]["sku"] == "MC-4501"
    # Un produit sans offre : les champs de l'offre sont nuls, pas absents.
    sans_offre = json.dumps({"@type": "Product", "name": "Moulin"}, ensure_ascii=False)
    lu = read_products(page(sans_offre))["products"][0]
    assert (lu["price"], lu["currency"], lu["availability"]) == (None, None, None)


def test_production_un_bloc_casse_nempeche_pas_de_lire_les_autres():
    """T8 : un bloc illisible ne fait pas tomber la page."""
    deux = page("{ceci n'est pas du JSON") .replace(
        "</head>", f'<script type="application/ld+json">{produit()}</script></head>')
    assert read_products(deux)["products"][0]["sku"] == "MC-4501"


def test_production_la_lecture_tient_la_classe_de_latence_annoncee():
    """latency « <1 ms » : dix mille lectures sous une borne d'effondrement large."""
    debut = time.perf_counter()
    for _ in range(10_000):
        read_products(EN_ACCORD)
    assert time.perf_counter() - debut < 20.0


# ---------------------------------------------------------------------------
# Parité entre les deux langages
# ---------------------------------------------------------------------------


def test_python_et_javascript_rendent_le_meme_rapport():
    """La fiche montre les deux extraits : elle affirme la même chose des deux."""
    node = shutil.which("node")
    assert node, "node est requis pour comparer les deux implémentations"
    pages = [PROMO, EN_ACCORD, GRAPHE, CARROUSEL, SANS, CASSE, VIRGULE, NOMBRE,
             MICRODONNEES, "", page(""), page("null"), page('["Product"]'),
             page(produit().replace('"@type": "Product"', '"@type": ["Product", "Thing"]')),
             page(json.dumps({"@type": "Product", "name": "Moulin"})),
             page(produit().replace("https://schema.org/InStock", "InStock")),
             page(produit().replace('"Moulin à café Lumière"', '"  Moulin à café Lumière  "'))]
    attendu = [read_products(p) for p in pages]
    script = (
        f"import {{ readProducts }} from {json.dumps((ICI / 'n0.js').as_uri())};"
        "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{"
        "process.stdout.write(JSON.stringify(JSON.parse(d).map(readProducts)));});"
    )
    sortie = subprocess.run([node, "--input-type=module", "-e", script],
                            input=json.dumps(pages), capture_output=True,
                            text=True, timeout=60, check=True)
    assert json.loads(sortie.stdout) == attendu
