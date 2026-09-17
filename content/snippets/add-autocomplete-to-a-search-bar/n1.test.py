import random
import time

import pytest

import n0
from n1 import MAX_TYPED, learn, normalise, rerank

# A slice of a click log: what was typed, and which suggestion was chosen.
# The kind of file a search bar already writes without being asked.
CLICKS = (
    [("cha", "chaussettes de sport")] * 4
    + [("chau", "chaussettes de sport")] * 2
    + [("ch", "chemise en lin")]
    + [("e", "étagère murale")] * 3
    + [("ÉCHA", "écharpe en laine")]
)

# What the prefix tree of the previous rung hands over: candidates already
# ordered by how often the term is searched.
BY_FREQUENCY = ["chaussures de running", "chaussettes de sport"]

# The catalogue of the N0 tests, to chain both rungs as the entry describes.
CATALOGUE = [
    ("chaussures de running", 900),
    ("chaussettes de sport", 400),
    ("étagère murale", 300),
    ("chemise en lin", 250),
    ("écharpe en laine", 120),
    ("échelle télescopique", 60),
]


def make_model():
    return learn(CLICKS)


def chain(model, prefix):
    """N0 retrieves, N1 reorders: the pipeline the verdict recommends."""
    return rerank(model, prefix, n0.suggest(n0.build(CATALOGUE), prefix))


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_echarpe_en_laine_a_un_clic_sous_echa_et_rcharpe_ne_lui_donne_rien_a_classer():
    """
    breaking_point : « « écharpe en laine » a un clic à son actif sous le
    préfixe « echa », et « rcharpe » ne lui donne toujours rien à classer ».
    Le témoin : sous « echa », la chaîne N0 puis N1 remonte bien le terme.
    """
    model = make_model()
    assert model[("echa", "écharpe en laine")] == 1
    assert chain(model, "echa") == ["écharpe en laine"]
    assert chain(model, "rcharpe") == []


def test_point_de_rupture_ce_niveau_reordonne_une_liste_il_ne_l_allonge_pas():
    """
    breaking_point : « Ce niveau réordonne une liste, il ne l'allonge pas ».
    Même quand le journal a vu des clics sous la faute de frappe elle-même, le
    terme cliqué n'apparaît pas s'il n'est pas dans les candidats.

    Le test d'origine, rerank(model, "rcharpe", []) == [], ne démontrait rien à
    lui seul : une liste vide en entrée donne une liste vide pour n'importe quel
    classement. Il est conservé ici, complété.
    """
    model = learn(CLICKS + [("rcharpe", "écharpe en laine")] * 50)
    assert rerank(model, "rcharpe", []) == []
    assert rerank(model, "vhauss", []) == []
    assert rerank(model, "rcharpe", ["échelle télescopique"]) == ["échelle télescopique"]


# ---------------------------------------------------------------------------
# Autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_un_terme_clique_passe_devant_un_terme_plus_cherche():
    """name : « Réordonnancement par comptage des clics passés »."""
    assert rerank(make_model(), "cha", BY_FREQUENCY) == [
        "chaussettes de sport",
        "chaussures de running",
    ]


def test_un_prefixe_jamais_frappe_se_replie_sur_un_prefixe_plus_court():
    """docstring de _evidence : « Backing off matters »."""
    # "chaus" is absent from the log; "chau" is not, and it carries the clicks.
    assert rerank(make_model(), "chaus", BY_FREQUENCY) == [
        "chaussettes de sport",
        "chaussures de running",
    ]


def test_plus_le_prefixe_commun_est_long_plus_le_clic_pese():
    """docstring de _evidence : « The longer the matching prefix, the more specific the evidence, hence the weight »."""
    model = learn([("c", "chemise en lin")] + [("cha", "chaussettes de sport")])
    assert rerank(model, "cha", ["chemise en lin", "chaussettes de sport"]) == [
        "chaussettes de sport",
        "chemise en lin",
    ]
    # Witness: at "c", both clicks sit on the same prefix length, and order stands.
    assert rerank(model, "c", ["chemise en lin", "chaussettes de sport"]) == [
        "chemise en lin",
        "chaussettes de sport",
    ]


def test_un_clic_renseigne_tous_les_prefixes_de_ce_qui_a_ete_frappe_sauf_le_vide():
    """docstring de learn : « every prefix of what was typed, from the first letter on […] The empty prefix is left out on purpose »."""
    model = learn([("chau", "chaussettes de sport")])
    for prefix in ("c", "ch", "cha", "chau"):
        assert model[(prefix, "chaussettes de sport")] == 1
    assert ("", "chaussettes de sport") not in model
    assert ("chaus", "chaussettes de sport") not in model


def test_point_de_rupture_un_clic_sous_une_saisie_sans_rapport_ne_deplace_rien():
    """
    docstring de learn : « counted, one click made under any query at all would
    move its term to the top of every other query ». Témoin : le même clic fait
    sous « cha », lui, déplace bien le terme.
    """
    catalogue = ["chaussettes", "chemise", "chapeau"]
    assert rerank(learn([("zzz", "chapeau")]), "ch", catalogue) == catalogue
    assert rerank(learn([("cha", "chapeau")]), "ch", catalogue)[0] == "chapeau"


def test_point_de_rupture_un_seul_clic_sous_une_lettre_commande_tous_ses_prefixes():
    """
    docstring de rerank : « one click recorded under "c" puts its term at the
    top of every query that starts with a "c", ahead of terms drawn from
    thousands of searches ».
    """
    catalogue = ["chaussettes", "chemise", "chapeau"]  # ordre des fréquences de recherche
    un_clic = learn([("c", "chapeau")])
    for prefix in ("c", "ch", "cha", "chap"):
        assert rerank(un_clic, prefix, catalogue)[0] == "chapeau", prefix
    # Et le biais de position : le terme que ce classement met en tête reçoit
    # les clics suivants, qui durcissent l'ordre qu'il devait corriger.
    boucle = learn([("c", "chapeau")] + [("ch", "chapeau")] * 20)
    assert rerank(boucle, "ch", catalogue)[0] == "chapeau"


def test_un_prefixe_vide_ne_classe_rien():
    """Le préfixe vide n'est pas compté : sans saisie, l'ordre des fréquences de recherche tient."""
    candidates = ["chaussures de running", "chemise en lin", "chaussettes de sport"]
    assert rerank(make_model(), "", candidates) == candidates


def test_accents_et_casse_sont_ignores_comme_dans_l_arbre_de_prefixes():
    """commentaire de normalise : « Same folding as the prefix tree, so both rungs agree »."""
    model = make_model()
    candidates = ["échelle télescopique", "écharpe en laine"]
    assert rerank(model, "echa", candidates) == [
        "écharpe en laine",
        "échelle télescopique",
    ]
    assert rerank(model, "ÉCHA", candidates) == rerank(model, "echa", candidates)
    for text in ("Écharpe", "Straße", "e\u0301CHA", "🎁 Coffret"):
        assert normalise(text) == n0.normalise(text)


def test_la_limite_est_respectee():
    assert rerank(make_model(), "cha", BY_FREQUENCY, limit=1) == ["chaussettes de sport"]


def test_les_termes_que_personne_n_a_cliques_gardent_leur_ordre_d_arrivee():
    """docstring de rerank : « A term nobody ever clicked keeps that order »."""
    untouched = ["chaussures de running", "échelle télescopique"]
    assert rerank(make_model(), "cha", untouched) == untouched


def test_un_journal_vide_ne_change_rien():
    """docstring de rerank : « A term nobody ever clicked keeps that order » — journal vide compris."""
    assert rerank(learn([]), "cha", BY_FREQUENCY) == BY_FREQUENCY


def test_la_requete_est_comptee_telle_quelle_sans_filtre():
    """risks.regulatory : « rien dans l'approche ne la filtre avant de la compter »."""
    model = learn([("jean.dupont@exemple.fr", "chemise en lin")])
    assert model[("jean.dupont@exemple.fr", "chemise en lin")] == 1


def test_deux_apprentissages_du_meme_journal_rendent_le_meme_classement():
    """risks.deterministic: true, quel que soit l'ordre du journal."""
    melange = list(CLICKS)
    random.Random(3).shuffle(melange)
    candidates = ["chaussures de running", "chemise en lin", "chaussettes de sport"]
    assert rerank(learn(melange), "ch", candidates) == rerank(make_model(), "ch", candidates)


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_journal_vide_candidats_vides_prefixe_vide():
    assert rerank(learn([]), "", []) == []
    assert learn([]) == {}


def test_production_cent_mille_clics_et_mille_candidats_dans_une_borne_large():
    alea = random.Random(1)
    lettres = "abcdefghijklmnopqrstuvwxyz "
    termes = ["".join(alea.choice(lettres) for _ in range(20)) for _ in range(100_000)]
    debut = time.perf_counter()
    model = learn((terme[:8], terme) for terme in termes)
    assert len(rerank(model, "abcd", termes[:1000], limit=10)) == 10
    assert time.perf_counter() - debut < 30


def test_production_une_requete_collee_de_10000_caracteres_termine_dans_une_borne_large():
    debut = time.perf_counter()
    model = learn([("q" * 10_000, "chemise en lin")])
    assert rerank(model, "q" * 10_000, ["x"] * 9 + ["chemise en lin"])[0] == "chemise en lin"
    assert time.perf_counter() - debut < 10


def test_production_une_requete_collee_de_10000_caracteres_ne_compte_que_ses_64_premiers_caracteres():
    """
    commentaire de MAX_TYPED : « Only the first characters of a query are
    counted ». Sans plafond, 50 005 000 caractères de clés ; avec, la somme des
    longueurs de 0 à 64.
    """
    model = learn([("q" * 10_000, "chemise en lin")])
    assert sum(len(prefix) for prefix, _ in model) <= 100 * 10_000
    assert sum(len(prefix) for prefix, _ in model) == MAX_TYPED * (MAX_TYPED + 1) // 2
    assert len(model) == MAX_TYPED


def test_production_une_saisie_en_accents_decomposes_retrouve_les_clics_du_terme_compose():
    model = learn([("e\u0301cha", "écharpe en laine")])
    assert rerank(model, "écha", ["échelle télescopique", "écharpe en laine"]) == [
        "écharpe en laine",
        "échelle télescopique",
    ]


def test_production_une_tabulation_dans_la_saisie_ne_cree_pas_de_clic_fantome():
    """
    Une saisie « a<TAB>b » cliquée sur « c » ne donne aucun clic à « b<TAB>c »
    sous « a » (en Python les clés sont des tuples ; en JavaScript, le commentaire
    « A tab never occurs inside a normalised prefix, since normalise turns it into
    a space »).
    """
    assert normalise("a\tb") == "a b"
    model = learn([("a\tb", "c")])
    assert rerank(model, "a", ["x", "b\tc"]) == ["x", "b\tc"]


def test_production_limite_a_zero_et_au_nombre_exact_de_candidats():
    model = make_model()
    assert rerank(model, "cha", BY_FREQUENCY, limit=0) == []
    assert rerank(model, "cha", BY_FREQUENCY, limit=2) == [
        "chaussettes de sport",
        "chaussures de running",
    ]
    assert len(rerank(model, "cha", BY_FREQUENCY, limit=3)) == 2


# ---------------------------------------------------------------------------
# Contre-épreuve, tour 2 : ce que la correction affirme désormais
# ---------------------------------------------------------------------------


class LecturesComptees(dict):
    def __init__(self, *args):
        super().__init__(*args)
        self.lectures = 0

    def get(self, *args):
        self.lectures += 1
        return super().get(*args)


def test_le_plafond_une_saisie_de_65_caracteres_et_une_de_64_comptent_la_meme_cle_la_plus_longue():
    """commentaire de MAX_TYPED : seuls les 64 premiers caractères normalisés sont comptés."""
    assert MAX_TYPED == 64
    model = learn([("a" * 64, "t"), ("a" * 65, "u")])
    assert max(len(prefix) for prefix, term in model if term == "t") == 64
    assert max(len(prefix) for prefix, term in model if term == "u") == 64
    assert model[("a" * 64, "u")] == 1
    # Témoin : sous le plafond, la clé suit la saisie.
    assert max(len(prefix) for prefix, term in learn([("a" * 63, "v")])) == 63


def test_le_plafond_porte_sur_la_saisie_normalisee():
    """Le code coupe après normalise (`normalise(typed)[:MAX_TYPED]`) : les espaces de tête ne mangent pas le plafond."""
    model = learn([(" " * 100 + "b" * 64, "t")])
    assert ("b" * 64, "t") in model


def test_la_saisie_lue_par_rerank_est_plafonnee_elle_aussi():
    """Un clic appris sur une longue saisie sert la même longue saisie, et une plus longue encore."""
    model = learn([("q" * 10_000, "chemise en lin")])
    assert rerank(model, "q" * 64 + "zzz", ["x", "chemise en lin"]) == ["chemise en lin", "x"]


def test_au_plus_une_lecture_par_longueur_de_prefixe_pour_chaque_candidat():
    """
    docstring : « read back with dictionary lookups, at most one per prefix length
    for each candidate, on a query whose counted length is capped ».
    """
    model = LecturesComptees(learn(CLICKS))
    candidats = ["x", "y", "z"]
    rerank(model, "q" * 10_000, candidats)
    assert model.lectures == MAX_TYPED * len(candidats)
    model.lectures = 0
    rerank(model, "cha", ["chaussettes de sport"])
    assert model.lectures == 1


def test_production_un_journal_d_une_requete_de_10000_caracteres_se_relit_dans_une_borne_large():
    """Sans plafond la lecture croissait avec le carré de la saisie ; mille candidats jamais cliqués."""
    model = learn([("q" * 10_000, "chemise en lin")])
    debut = time.perf_counter()
    assert rerank(model, "q" * 10_000, ["x"] * 999 + ["chemise en lin"])[0] == "chemise en lin"
    assert time.perf_counter() - debut < 5


def test_production_la_normalisation_de_n1_est_celle_de_n0_sur_les_cas_difficiles():
    """commentaire de normalise : « Same folding as the prefix tree, so both rungs agree on what was typed »."""
    for texte in (
        "Straße", "\u039f\u0394\u039f\u03a3", "\u03bf\u03b4\u03bf\u03c2", "\ufb01let",
        "\u0130stanbul", "\u216b", "\u00adcha", "a\u200db", "\ufeff\u00e9charpe\u00a0",
        "  cha\u3000\u2003ssures\t\n", "STRA\u1e9eE",
    ):
        assert normalise(texte) == n0.normalise(texte), texte


def test_production_une_espace_en_queue_de_saisie_retrouve_les_memes_clics():
    model = make_model()
    assert rerank(model, "cha ", BY_FREQUENCY) == rerank(model, "cha", BY_FREQUENCY)
    assert learn([("cha ", "t")]) == learn([("cha", "t")])
