"""
Tests du niveau N0 : gabarits à trous, accord grammatical, repli sur les
attributs présents.

Le catalogue ci-dessous est inventé de bout en bout : aucune marque, aucun
produit existant. Il est varié exprès — une matière absente ici, une seule
couleur là, une catégorie féminine, un nom accentué.
"""

import re
import time
import unicodedata
from collections import Counter

import pytest

from n0 import BLOCKS, describe

# Des attributs qu'une boutique stocke vraiment, et un qu'elle ne stocke pas :
# `gender` est le genre grammatical du nom de catégorie.
CATALOGUE = [
    {
        "name": "Aurore 500",
        "category": "sac à dos",
        "gender": "m",
        "material": "toile recyclée",
        "audience": "les randonneurs",
        "features": ["poche pour ordinateur", "sangle ventrale"],
        "colours": ["ardoise", "sable"],
        "warranty": "deux ans",
    },
    {
        "name": "Brise 12",
        "category": "lampe de bureau",
        "gender": "f",
        "material": "aluminium brossé",
        "audience": "les postes en télétravail",
        "features": ["bras articulé", "variateur continu"],
        "colours": ["blanc", "noir", "laiton"],
        "warranty": "cinq ans",
    },
    {
        "name": "Comète",
        "category": "gourde isotherme",
        "gender": "f",
        "material": "acier inoxydable",
        "audience": "les cyclistes",
        "features": ["bouchon à une main"],
        "colours": ["bleu nuit"],
        "warranty": "trois ans",
    },
    {
        "name": "Dune 40",
        "category": "tapis de sol",
        "gender": "m",
        "material": "liège naturel",
        "features": ["surface antidérapante", "sangle de transport"],
        "colours": ["miel", "écorce"],
        "warranty": "deux ans",
    },
    {
        "name": "Écume",
        "category": "serviette de bain",
        "gender": "f",
        "material": "coton peigné",
        "audience": "les familles",
        "colours": ["ivoire", "argile", "océan"],
        "warranty": "un an",
    },
    {
        "name": "Fanal 3",
        "category": "lanterne de camp",
        "gender": "f",
        "material": "polycarbonate",
        "audience": "les bivouacs",
        "features": ["trois intensités", "crochet pivotant", "recharge par câble"],
        "warranty": "deux ans",
    },
    {
        "name": "Gravier",
        "category": "chaise de jardin",
        "gender": "f",
        "material": "frêne huilé",
        "audience": "les terrasses",
        "features": ["assise empilable"],
        "colours": ["naturel", "vert olive"],
        "warranty": "dix ans",
    },
    {
        "name": "Houle Mini",
        "category": "enceinte portative",
        "gender": "f",
        "material": "silicone souple",
        "audience": "les week-ends",
        "features": ["dragonne", "commande tactile"],
        "colours": ["corail", "menthe"],
        "warranty": "deux ans",
    },
    {
        "name": "Iris 2",
        "category": "carnet à points",
        "gender": "m",
        "material": "papier ivoire",
        "audience": "les carnettistes",
        "features": ["couture apparente", "signet"],
        "colours": ["bordeaux"],
        "warranty": "un an",
    },
    {
        "name": "Jonc",
        "category": "panier de rangement",
        "gender": "m",
        "material": "rotin tressé",
        "features": ["poignées cousues"],
        "colours": ["blond", "cendre"],
    },
    {
        "name": "Kaolin",
        "category": "tasse à café",
        "gender": "f",
        "material": "grès émaillé",
        "audience": "les petits déjeuners",
        "features": ["passage au lave-vaisselle"],
        "colours": ["craie", "ardoise", "terre"],
        "warranty": "deux ans",
    },
    {
        "name": "Lisière",
        "category": "plaid",
        "gender": "m",
        "material": "laine mêlée",
        "audience": "les canapés",
        "features": ["franges nouées à la main"],
        "colours": ["bruyère", "orage"],
        "warranty": "cinq ans",
    },
    {
        "name": "Marée 20",
        "category": "sac étanche",
        "gender": "m",
        "material": "toile enduite",
        "audience": "les sorties en mer",
        "features": ["fermeture à enroulement", "bandoulière amovible"],
        "colours": ["jaune vif", "gris"],
        "warranty": "trois ans",
    },
    {
        "name": "Noria",
        "category": "arrosoir",
        "gender": "m",
        "material": "zinc",
        "features": ["pomme amovible"],
        "warranty": "deux ans",
    },
    {
        "name": "Ombelle",
        "category": "housse de couette",
        "gender": "f",
        "material": "lin lavé",
        "audience": "les chambres claires",
        "features": ["boutons de nacre", "coutures renforcées"],
        "colours": ["blé", "ciel", "argile", "brume"],
        "warranty": "deux ans",
    },
    {
        "name": "Pivoine",
        "category": "planche à découper",
        "gender": "f",
        "audience": "les cuisines partagées",
        "features": ["rainure à jus"],
        "colours": ["hêtre"],
        "warranty": "un an",
    },
    {
        "name": "Quinte",
        "category": "housse de guitare",
        "gender": "f",
        "material": "feutre épais",
        "features": ["poche à partitions", "bretelles matelassées"],
        "colours": ["anthracite"],
        "warranty": "deux ans",
    },
    {
        "name": "Ravin 8",
        "category": "couteau pliant",
        "gender": "m",
        "material": "acier trempé",
        "audience": "les marcheurs",
        "warranty": "dix ans",
    },
    {
        "name": "Sillage",
        "category": "trousse de toilette",
        "gender": "f",
        "material": "coton ciré",
        "audience": "les bagages à main",
        "features": ["doublure lavable", "crochet de suspension"],
        "colours": ["kaki", "sable"],
        "warranty": "deux ans",
    },
    {
        "name": "Tuile",
        "category": "dessous de plat",
        "gender": "m",
        "features": ["patins de liège"],
        "colours": ["terracotta", "sable"],
    },
]



VALUE_SEQUENCE = re.compile(r"(?:·(?:, | et ))+·")


def frame(product: dict) -> str:
    """
    La description, chaque valeur fournie par le produit effacée (existant).

    Ce qui reste est le motif : les mots que le gabarit a apportés. Les
    énumérations sont repliées, « ·, · et · » compte comme « · ».
    """
    described = describe(product)
    values = []
    for key, value in product.items():
        if key == "gender":
            continue
        values.extend(value if isinstance(value, list) else [value])
    for value in sorted(values, key=len, reverse=True):
        described = described.replace(value, "·")
    return VALUE_SEQUENCE.sub("·", described)


def full_catalogue(size=200):
    return [
        {
            "name": f"Série {index:03d}",
            "category": "lampe de bureau" if index % 2 else "sac à dos",
            "gender": "f" if index % 2 else "m",
            "material": "aluminium brossé" if index % 2 else "toile recyclée",
            "audience": "les bureaux" if index % 2 else "les randonneurs",
            "features": ["bras articulé", "variateur continu"],
            "colours": ["ardoise", "sable"],
            "warranty": "deux ans",
        }
        for index in range(size)
    ]


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_deux_cents_fiches_completes_tiennent_en_douze_motifs():
    """
    « Le test rend deux cents fiches complètes, efface de chaque description les
    valeurs propres au produit, et dénombre les motifs de phrase qui restent :
    douze, pour deux cents articles, le moins fréquent revenant seize fois » (existant, resserré).
    """
    full = full_catalogue()
    frames = Counter(frame(product) for product in full)
    assert len(frames) == 12
    assert min(frames.values()) == 16
    # Témoin : les deux cents descriptions elles-mêmes sont toutes différentes ; seul le motif se répète.
    assert len({describe(product) for product in full}) == 200


def test_point_de_rupture_le_catalogue_ecrit_a_la_main_tient_en_neuf_ouvertures():
    """
    « les phrases d'ouverture tombent dans neuf motifs pour vingt produits et le
    plus courant en couvre six — et cette variété-là vient des trous du
    catalogue, pas du gabarit » (existant, resserré).
    """
    openings = Counter(frame(product).split(". ")[0] for product in CATALOGUE)
    assert len(CATALOGUE) == 20
    assert len(openings) == 9
    assert openings.most_common(1)[0][1] == 6
    # « vient des trous du catalogue » : le même catalogue, trous comblés, n'a plus que quatre ouvertures.
    filled = [
        {"material": "m", "audience": "a", "features": ["x", "y"], "colours": ["c", "d"], "warranty": "w", **p}
        for p in CATALOGUE
    ]
    assert len(Counter(frame(product).split(". ")[0] for product in filled)) == 4


# ---------------------------------------------------------------------------
# Nom, docstring, commentaires, risques
# ---------------------------------------------------------------------------


def test_rend_un_produit_complet():
    """Cas nominal (existant)."""
    assert describe(CATALOGUE[0]) == (
        "Aurore 500, un sac à dos en toile recyclée pour les randonneurs. "
        "Côté équipement : poche pour ordinateur et sangle ventrale. "
        "Existe en ardoise et sable. "
        "Livré avec deux ans de garantie."
    )


def test_accorde_avec_une_categorie_feminine():
    """« The markers `{un}`, `{e}` and `{s}` carry the grammatical gender » ; « « Garantie deux ans » […] come out right » (existant, complété)."""
    described = describe(CATALOGUE[1])
    assert described.startswith("Brise 12 : une lampe de bureau en aluminium brossé, pensée pour")
    assert "Livrée avec cinq ans de garantie." in described
    assert describe(CATALOGUE[4]).endswith("Garantie un an.")
    assert describe({"name": "Fado", "category": "réveil", "warranty": "un an"}) == "Fado : un réveil. Garanti un an."


def test_le_genre_par_defaut_est_le_masculin():
    """`describe` : « `gender` […] defaults to masculine »."""
    assert describe({"name": "Ténor", "category": "réveil"}) == describe({"name": "Ténor", "category": "réveil", "gender": "m"})
    assert describe({"name": "Ténor", "category": "montre", "gender": "Féminin"}) == "Ténor : une montre."


def test_enumere_avec_des_virgules_et_une_seule_conjonction():
    """« an enumeration is written with commas and one conjunction at the end » (existant)."""
    assert "blanc, noir et laiton" in describe(CATALOGUE[1])
    assert "blanc, noir ou laiton" in describe(CATALOGUE[1], conjunction="ou")


def test_accorde_le_nombre_avec_la_longueur_de_la_liste():
    """« « Points forts » come out right » (existant)."""
    assert "Point fort : assise empilable." in describe(CATALOGUE[6])
    assert "Points forts : couture apparente et signet." in describe(CATALOGUE[8])


def test_un_element_seul_n_est_pas_enumere():
    """Existant."""
    described = describe(CATALOGUE[2])
    assert "À choisir en bleu nuit." in described
    assert " et " not in described


def test_prefere_la_formulation_qui_emploie_le_plus_d_attributs():
    """`_usable` : « the ones using the most attributes are kept » (existant)."""
    described = describe(CATALOGUE[0])
    assert "toile recyclée" in described and "les randonneurs" in described


def test_saute_les_blocs_dont_les_attributs_manquent():
    """« A product with no colour list simply gets no colour sentence, instead of « Disponible en . » » (existant)."""
    described = describe(CATALOGUE[9])
    assert "garantie" not in described.lower()
    assert described == "Jonc : un panier de rangement en rotin tressé. Au programme : poignées cousues. À choisir en blond et cendre."


def test_se_replie_sur_la_formulation_la_plus_courte_quand_il_ne_reste_que_le_nom():
    """Existant."""
    assert describe({"name": "Ténor", "category": "réveil", "gender": "m"}) == "Ténor : un réveil."


def test_ignore_les_valeurs_vides_et_les_elements_vides():
    """Existant."""
    described = describe({"name": "Volute", "category": "vase", "gender": "m", "material": "   ", "colours": ["ocre", "", "  "], "warranty": ""})
    assert described == "Volute, un vase. Disponible en ocre."


def test_une_fiche_vide_ne_rend_rien_plutot_qu_une_phrase_cassee():
    """Existant."""
    assert describe({}) == ""


def test_le_meme_produit_recoit_toujours_la_meme_description():
    """risks `deterministic: true` ; `_variant` « the same one for the same product » (existant)."""
    assert all(describe(CATALOGUE[4]) == describe(dict(reversed(list(CATALOGUE[4].items())))) for _ in range(5))


def test_chaque_phrase_est_une_formulation_ecrite_d_avance():
    """
    Docstring : « it never claims a feature the product does not have […] every
    sentence it can possibly produce was written and approved by a human
    being » ; regulatory « chaque phrase que le code peut produire a été écrite et relue ».
    Chaque phrase rendue est une formulation de BLOCKS dont les trous portent une valeur du dossier.
    """
    def pattern(wording):
        parts = re.split(r"(\{\w+\})", wording)
        out = ""
        for part in parts:
            if part in ("{un}",):
                out += "(?:un|une)"
            elif part in ("{e}", "{s}"):
                out += part[1] + "?"
            elif part.startswith("{"):
                out += "(?P<v%d>.+?)" % len(out)
            else:
                out += re.escape(part)
        return re.compile(out)

    wordings = [pattern(w) for block in BLOCKS for w in block]
    for product in CATALOGUE:
        values = {str(v) for key, value in product.items() for v in (value if isinstance(value, list) else [value])}
        sentences = re.split(r"(?<=\.) (?=[A-ZÀ-ÖØ-Þ])", describe(product))
        for sentence in sentences:
            match = next((m for w in wordings if (m := w.fullmatch(sentence))), None)
            assert match is not None, sentence
            for filled in match.groupdict().values():
                assert all(piece in values for piece in re.split(r", | et ", filled)), filled


def test_les_marques_de_grammaire_ne_sont_pas_remplacees_par_un_attribut_du_meme_nom():
    """Commentaire : « The grammar markers are written last, so an attribute called `s` or `e` cannot quietly take their place »."""
    assert describe({"name": "X", "category": "sac", "e": "ZZ", "s": "YY", "un": "QQ", "features": ["a", "b"]}) == "X : un sac. Au programme : a et b."


def test_le_tirage_donne_le_meme_texte_qu_en_javascript():
    """
    `_variant` : « give the same answer as the JavaScript version of this
    snippet, so a catalogue rendered by either reads identically » ; mêmes
    chaînes attendues dans n0.test.js. Le nom est composé avant le tirage : en
    NFD ou en NFC il donne la même formulation, dans les deux langages, et il
    est rendu tel qu'il a été fourni.
    """
    zoe = {"name": "Zoé", "category": "sac", "material": "cuir", "audience": "tous", "features": ["x"], "colours": ["r", "v"], "warranty": "deux ans"}
    assert describe({"name": "Brise 🙂", "category": "lampe", "gender": "f", "material": "verre", "features": ["a", "b"], "colours": ["c"], "warranty": "un an"}) == (
        "Brise 🙂, une lampe en verre. Points forts : a et b. Disponible en c. Garantie un an."
    )
    assert describe(zoe) == "Zoé : un sac en cuir, pensé pour tous. Côté équipement : x. Existe en r et v. Livré avec deux ans de garantie."
    nfd = unicodedata.normalize("NFD", "Zoé")
    assert describe({**zoe, "name": nfd}) == describe(zoe).replace("Zoé", nfd, 1)


def test_le_gabarit_compte_seize_formulations():
    """
    verdict_rationale : « la dix-septième formulation s'écrit à la main par
    quelqu'un qui en a déjà écrit seize ». Ce sont les formulations écrites dans
    l'extrait, bloc par bloc ; les douze motifs du point de rupture sont ce
    qu'elles produisent sur deux cents articles, une fois les valeurs propres au
    produit effacées.
    """
    assert sum(len(block) for block in BLOCKS) == 16


def test_une_description_se_rend_en_moins_d_une_milliseconde():
    """latency `<1 ms` ; « it renders in the time it takes to read a dictionary »."""
    best = float("inf")
    for _ in range(50):
        start = time.perf_counter()
        describe(CATALOGUE[1])
        best = min(best, time.perf_counter() - start)
    assert best < 0.001


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_dix_mille_fiches_terminent_vite():
    catalogue = full_catalogue(10_000)
    start = time.perf_counter()
    assert len([describe(product) for product in catalogue]) == 10_000
    assert time.perf_counter() - start < 5


def test_production_encodage_nfd_emoji_insecables_et_listes_limites():
    # Le nom est composé avant le tirage : « Écume » en NFD tire la même
    # formulation que le même nom en NFC, et ressort tel qu'il a été fourni.
    # L'espace insécable d'une couleur traverse de même.
    name = unicodedata.normalize("NFD", "Écume")
    assert describe({"name": name, "category": "serviette", "gender": "f", "colours": ["ivoire\u00a0clair"]}) == (
        name + ", une serviette. Disponible en ivoire\u00a0clair."
    )
    assert describe({"name": "X", "category": "sac", "colours": []}) == "X : un sac."
    assert describe({"name": "X", "category": "sac", "colours": ["un"] * 1000}).count(", ") == 998


def test_production_sans_nom_la_phrase_d_identite_disparait():
    """Précision : `name` manquant supprime tout le premier bloc, catégorie et matière comprises."""
    assert describe({"category": "sac à dos", "material": "toile", "features": ["a"]}) == "Point fort : a."


def test_defaut_un_attribut_nul_n_est_pas_ecrit_dans_la_description():
    described = describe({"name": "X", "category": "sac", "material": None, "warranty": None})
    assert "None" not in described
