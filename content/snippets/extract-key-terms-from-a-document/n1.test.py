import json
import math
import shutil
import subprocess
import time
from pathlib import Path

from n0 import extract_key_terms
from n1 import extract_key_terms_in_corpus

ICI = Path(__file__).parent

VIDES_FR = ("de des du la le les un une et ou à au aux en dans sur pour par avec sans "
            "sous est sont a ont ce cette ces qui que dont se son sa ses leur leurs ne "
            "pas plus il elle nous vous ils elles on y d l s n c j m t qu").split()


def cgv(produit: str, detail: str) -> str:
    """Des conditions générales de vente : même passe-partout, un produit près."""
    return f"""Conditions générales de vente

La société Lumière, immatriculée au registre du commerce, vend {produit}.
{detail} Le client dispose d'un délai de rétractation de quatorze jours.
Les présentes conditions générales de vente sont soumises au droit français."""


CORPUS = [
    cgv("des moulins à café", "Le moulin est garanti deux ans."),
    cgv("des vélos électriques", "La batterie du vélo est garantie deux ans."),
    cgv("des imprimantes laser", "La cartouche laser est garantie six mois."),
    cgv("des casques audio", "Le casque audio est garanti deux ans."),
]


# Un second corpus, hors du jeu de contrats de cette fiche : quatre comptes
# rendus de conseil municipal, courts, où les égalités de score dominent.
# C'est R4 et T4 — confronter le verdict à des données qu'il n'a pas choisies.
CONSEIL = [
    "Le conseil municipal a approuvé le budget de la nouvelle médiathèque, rue des"
    " Frères-Lumière. Les travaux commenceront au printemps. Le maire a rappelé que la"
    " salle de lecture accueillera les scolaires.",
    "Le conseil municipal a voté la création d'une piste cyclable le long du canal. La"
    " piste cyclable reliera la gare au parc des sports, et sa mise en service est"
    " prévue pour septembre.",
    "Le conseil municipal a décidé d'étendre le stationnement payant au centre-ville. Le"
    " stationnement payant s'appliquera du lundi au samedi, et les riverains garderont"
    " leur abonnement annuel.",
    "Le conseil municipal a validé la rénovation de l'école élémentaire Jean-Moulin."
    " L'école accueillera deux classes de plus à la rentrée, et la cantine de l'école"
    " sera agrandie.",
]


def textes(rapport, index=0):
    return [terme["text"] for terme in rapport["documents"][index]["terms"]]


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_le_sujet_de_la_collection_disparait_de_tous_ses_documents():
    """
    « Un terme présent dans tous les documents vaut exactement zéro, et le
    sujet d'une collection est justement dans tous ses documents. »
    """
    rapport = extract_key_terms_in_corpus(CORPUS, VIDES_FR)
    garanties = [t for t in rapport["documents"][0]["terms"] if "vente" in t["key"]]
    assert all(t["score"] == 0.0 for t in garanties)
    # « conditions générales » est dans les quatre : il ne peut plus remonter.
    tous = {t["key"]: t["score"] for t in rapport["documents"][0]["terms"]}
    assert tous.get("conditions générales", 0.0) == 0.0


def test_point_de_rupture_temoin_le_niveau_n0_le_fait_remonter():
    """
    « Le témoin est dans le même test : le niveau N0, qui ne connaît pas la
    collection, place ce même terme dans ses premiers. »
    """
    sans_corpus = [t["text"].lower() for t in extract_key_terms(CORPUS[0], VIDES_FR)["terms"]]
    assert any("conditions générales" in terme for terme in sans_corpus)


# ---------------------------------------------------------------------------
# Le verdict, confronté aux données de la fiche
# ---------------------------------------------------------------------------


def test_verdict_le_corpus_fait_remonter_ce_qui_distingue_le_document():
    """
    R4 : le même document, lu seul et lu dans sa collection. Le passe-partout
    descend, le produit monte.
    """
    seul = [t["text"].lower() for t in extract_key_terms(CORPUS[0], VIDES_FR)["terms"]]
    avec = [t.lower() for t in textes(extract_key_terms_in_corpus(CORPUS, VIDES_FR))]

    assert "moulin" not in seul  # le sujet du contrat n'est pas dans les huit
    assert "moulin" in avec and "café" in avec
    assert any("conditions générales" in t for t in seul)
    assert not any("conditions générales" in t for t in avec[:3])


def test_verdict_chaque_document_de_la_collection_a_son_propre_sujet():
    rapport = extract_key_terms_in_corpus(CORPUS, VIDES_FR)
    premiers = [textes(rapport, index)[0].lower() for index in range(4)]
    assert premiers == ["moulins", "vélos électriques", "imprimantes laser",
                        "casques audio"]
    # Les trois premiers de chaque document sont à égalité de score : c'est la
    # règle de départage qui les ordonne, et le rapport dit combien d'autres
    # partagent le score du dernier retenu.
    assert [textes(rapport, i)[:3] for i in range(4)] == [
        ["moulins", "café", "moulin"],
        ["vélos électriques", "batterie", "vélo"],
        ["imprimantes laser", "cartouche laser", "garantie six mois"],
        ["casques audio", "casque audio", "garanti deux ans"],
    ]
    assert [d["tied_at_cut"] for d in rapport["documents"]] == [10, 10, 9, 9]


# ---------------------------------------------------------------------------
# Les autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_un_corpus_de_moins_de_deux_documents_est_refuse():
    for corpus in ([], [CORPUS[0]]):
        rapport = extract_key_terms_in_corpus(corpus, VIDES_FR)
        assert rapport["documents"] == []
        assert rapport["reason"] == "a corpus of at least two documents is required"


def test_la_liste_de_mots_vides_est_exigee():
    rapport = extract_key_terms_in_corpus(CORPUS, [])
    assert rapport["reason"] == "a stop list is required, one per language"


def test_le_logarithme_nest_pas_plancher_a_un_contrairement_a_scikit_learn():
    """
    La décision du niveau, dite en chiffres : ici un terme partout vaut 0 ;
    avec le lissage de scikit-learn, il vaudrait 1.
    """
    partout = math.log(len(CORPUS) / len(CORPUS))
    lisse = math.log((1 + len(CORPUS)) / (1 + len(CORPUS))) + 1
    assert partout == 0.0 and lisse == 1.0


def test_un_terme_dun_seul_document_pese_le_plus():
    rapport = extract_key_terms_in_corpus(CORPUS, VIDES_FR)
    unique = [t for t in rapport["documents"][0]["terms"] if t["key"] == "café"][0]
    assert unique["score"] == round(math.floor(math.log(4 / 1) * 10000 + 0.5) / 10000, 4)


def test_le_classement_ne_depend_pas_de_lordre_des_egalites():
    """T : trois termes de même poids reviennent dans le même ordre."""
    corpus = ["alpha. bravo. charlie.", "delta. echo.", "alpha. foxtrot."]
    premier = textes(extract_key_terms_in_corpus(corpus, VIDES_FR))
    assert premier == ["bravo", "charlie", "alpha"]


def test_aucune_entree_ne_leve_et_la_raison_nomme_ce_qui_a_ete_recu():
    """R14 : la raison dit ce que le code a constaté — le type reçu."""
    assert extract_key_terms_in_corpus(None, VIDES_FR)["reason"] == (
        "expected a list, not NoneType")
    assert extract_key_terms_in_corpus("texte", VIDES_FR)["reason"] == (
        "expected a list, not str")
    for entree in [None, 42, "texte", {}]:
        rapport = extract_key_terms_in_corpus(entree, VIDES_FR)
        assert rapport["documents"] == []
        assert rapport["reason"].startswith("expected a list, not ")


def test_verdict_un_second_corpus_de_documents_courts_ou_les_egalites_dominent():
    """
    R4 et T4 : le verdict confronté à des données qu'il n'a pas choisies. Le
    jeu de contrats de cette fiche est taillé pour la démonstration ; celui-ci
    ne l'est pas, et il montre les deux côtés.

    Ce que N1 gagne : « conseil municipal » ouvre les quatre comptes rendus,
    donc il n'est le sujet d'aucun. N0 le garde dans les trois premiers termes
    des quatre documents ; N1 le fait disparaître partout.
    """
    vides = VIDES_FR + ["sera", "seront", "été", "étaient", "était"]
    par_n1 = extract_key_terms_in_corpus(CONSEIL, vides, top=3)
    premiers = [[t["text"] for t in d["terms"]] for d in par_n1["documents"]]
    assert premiers == [
        ["nouvelle médiathèque", "travaux commenceront", "approuvé"],
        ["piste cyclable reliera", "piste cyclable", "voté"],
        ["stationnement payant", "riverains garderont", "abonnement annuel"],
        ["école élémentaire Jean-Moulin", "validé", "rénovation"],
    ]
    par_n0 = [[t["text"] for t in extract_key_terms(texte, vides, top=3)["terms"]]
              for texte in CONSEIL]
    assert all("conseil municipal" in termes for termes in par_n0)
    assert not any("conseil municipal" in termes for termes in premiers)

    # Et ce que N1 ne gagne pas, dit ici plutôt que tu : sur ces documents
    # courts, un terme présent une fois dans son document et nulle part
    # ailleurs vaut log(4), comme tous ses voisins. Le premier document en
    # porte neuf à ce score, et l'ordre entre eux vient de la règle de
    # départage, pas du score.
    scores = [t["score"] for t in par_n1["documents"][0]["terms"]]
    assert scores == [round(math.log(4), 4)] * 3
    assert par_n1["documents"][0]["tied_at_cut"] == 8


def test_une_egalite_se_departage_par_le_sens_pas_par_lalphabet():
    """
    Commentaire : « What breaks the tie has to mean something — the longer
    phrase first, because it says more, then the one that appears earliest,
    because a document states its subject early. »

    C'était le défaut : le tri final était `(-score, -count, key)`, donc à
    égalité de score, c'est la lettre initiale qui décidait si le sujet du
    document entrait dans les huit termes retenus.
    """
    vides = VIDES_FR + ["sera", "seront", "été", "étaient", "était"]
    termes = extract_key_terms_in_corpus(CONSEIL, vides, top=12)["documents"][0]["terms"]
    a_egalite = [t for t in termes if t["score"] == round(math.log(4), 4)]
    assert len(a_egalite) >= 9
    # La phrase la plus longue d'abord.
    assert a_egalite[0]["text"] == "nouvelle médiathèque"
    assert len(a_egalite[0]["key"].split(" ")) == 2
    # Puis, à nombre de mots égal, celle qui apparaît le plus tôt.
    un_mot = [t for t in a_egalite if len(t["key"].split(" ")) == 1]
    assert [t["first"] for t in un_mot] == sorted(t["first"] for t in un_mot)
    # L'alphabet ne décide plus : « approuvé » vient après « médiathèque ».
    ordre = [t["text"] for t in a_egalite]
    assert ordre.index("nouvelle médiathèque") < ordre.index("approuvé")


def test_le_rapport_dit_combien_de_termes_sont_a_egalite_avec_le_dernier_retenu():
    """
    Commentaire : « How many terms outside the cut share the score of the last
    one kept: a caller that reads « the top five » of twelve equals should
    know. »
    """
    vides = VIDES_FR + ["sera", "seront", "été", "étaient", "était"]
    coupe = extract_key_terms_in_corpus(CONSEIL, vides, top=3)["documents"][0]
    assert coupe["tied_at_cut"] == 8
    # Témoin : quand rien n'est coupé, il n'y a personne à égalité dehors.
    entier = extract_key_terms_in_corpus(CONSEIL, vides, top=100)["documents"][0]
    assert entier["tied_at_cut"] == 0


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_entree_banale_un_dossier_de_contrats():
    """T5 : l'entrée ordinaire du public visé."""
    rapport = extract_key_terms_in_corpus(CORPUS, VIDES_FR)
    assert len(rapport["documents"]) == 4
    assert all(doc["terms"] for doc in rapport["documents"])


def test_production_entree_vide():
    rapport = extract_key_terms_in_corpus(["", ""], VIDES_FR)
    assert [doc["terms"] for doc in rapport["documents"]] == [[], []]


def test_production_entree_tres_grande_et_terminaison_rapide():
    enorme = [texte * 200 for texte in CORPUS] * 5
    debut = time.perf_counter()
    rapport = extract_key_terms_in_corpus(enorme, VIDES_FR)
    assert time.perf_counter() - debut < 60.0
    assert len(rapport["documents"]) == 20


def test_production_valeurs_aux_limites():
    # Deux documents identiques : tout est partout, donc tout vaut zéro.
    jumeaux = extract_key_terms_in_corpus([CORPUS[0], CORPUS[0]], VIDES_FR)
    assert {t["score"] for t in jumeaux["documents"][0]["terms"]} == {0.0}
    # Un document vide dans une collection qui ne l'est pas.
    melange = extract_key_terms_in_corpus([CORPUS[0], "", CORPUS[1]], VIDES_FR)
    assert melange["documents"][1]["terms"] == []
    assert melange["documents"][0]["terms"]


def test_production_un_document_illisible_nempeche_pas_de_lire_les_autres():
    """T8 : un élément qui n'est pas du texte ne fait pas tomber la collection."""
    rapport = extract_key_terms_in_corpus([CORPUS[0], None, CORPUS[1]], VIDES_FR)
    assert rapport["documents"][1]["terms"] == []
    assert textes(rapport, 0)[:3] == ["moulins", "café", "moulin"]
    assert textes(rapport, 2)[:3] == ["vélos électriques", "batterie", "vélo"]


def test_production_la_lecture_tient_la_classe_de_latence_annoncee():
    """latency « ~100 ms » : cent collections de quatre documents sous une borne large."""
    debut = time.perf_counter()
    for _ in range(100):
        extract_key_terms_in_corpus(CORPUS, VIDES_FR)
    assert time.perf_counter() - debut < 30.0


# ---------------------------------------------------------------------------
# Parité entre les deux langages
# ---------------------------------------------------------------------------


def test_python_et_javascript_rendent_le_meme_rapport():
    """La fiche montre les deux extraits : elle affirme la même chose des deux."""
    node = shutil.which("node")
    assert node, "node est requis pour comparer les deux implémentations"
    cas = [[CORPUS, VIDES_FR],
           [[CORPUS[0], CORPUS[0]], VIDES_FR],
           [[CORPUS[0], "", CORPUS[1]], VIDES_FR],
           [["alpha. bravo. charlie.", "delta. echo.", "alpha. foxtrot."], VIDES_FR],
           [[CORPUS[0]], VIDES_FR],
           [CORPUS, []]]
    attendu = [extract_key_terms_in_corpus(corpus, vides) for corpus, vides in cas]
    script = (
        f"import {{ extractKeyTermsInCorpus }} from {json.dumps((ICI / 'n1.js').as_uri())};"
        "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{"
        "process.stdout.write(JSON.stringify(JSON.parse(d)"
        ".map(([c,v])=>extractKeyTermsInCorpus(c,v))));});"
    )
    sortie = subprocess.run([node, "--input-type=module", "-e", script],
                            input=json.dumps(cas), capture_output=True,
                            text=True, timeout=60, check=True)
    assert json.loads(sortie.stdout) == attendu
