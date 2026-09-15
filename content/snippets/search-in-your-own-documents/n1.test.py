"""
Le même règlement que n0, pour comparer les deux niveaux sur le même fonds.

Chaque nombre affirmé ici l'est à l'identique dans n1.test.js : les deux
implémentations classent les mêmes documents dans le même ordre avec les mêmes
scores.
"""

import ast
import math
import time
import unicodedata
from pathlib import Path

import pytest

from n0 import build_index as build_index_n0, search as search_n0
from n1 import FIELD_WEIGHTS, build_index, search, tokenise

HANDBOOK = [
    {
        "id": "conges",
        "title": "Congés payés",
        "body": "Le salarié acquiert deux jours et demi de congés payés par mois "
                "travaillé. Le solde figure sur le bulletin de paie. Le télétravail "
                "ne change rien à ce calcul, et une journée de télétravail reste "
                "une journée travaillée.",
    },
    {
        "id": "teletravail",
        "title": "Télétravail",
        "body": "Deux jours par semaine sont ouverts, après accord écrit du "
                "responsable.",
    },
    {
        "id": "frais",
        "title": "Notes de frais",
        "body": "Les notes de frais se déposent avant le cinq du mois. Le "
                "remboursement suit la paie du mois suivant.",
    },
    {
        "id": "materiel",
        "title": "Matériel informatique",
        "body": "Le poste de travail est renouvelé tous les quatre ans. La demande "
                "passe par le responsable.",
    },
]

INDEX = build_index(HANDBOOK)


def ids(results):
    return [result["id"] for result in results]


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_le_decoupage_en_mots_devient_votre_probleme():
    """
    breaking_point : « « vacances » ne trouve toujours rien, et « congé » au
    singulier ne trouve rien non plus, là où le manuel écrit « congés » ».
    Témoin : le pluriel du manuel trouve la page.
    """
    assert search(INDEX, "vacances") == []
    assert search(INDEX, "congé") == []
    assert ids(search(INDEX, "congés")) == ["conges"]


def test_point_de_rupture_le_singulier_ne_trouve_rien_pas_plus_qu_a_n0():
    """
    breaking_point : « « congé » au singulier ne trouve rien non plus […] — pas
    plus qu'à N0 : rien dans ce code ne connaît la morphologie du français ».
    Témoin : le pluriel trouve la page aux deux niveaux.
    """
    n0_index = build_index_n0(HANDBOOK)
    assert search_n0(n0_index, "congé") == []
    assert search(INDEX, "congé") == []
    assert [r["id"] for r in search_n0(n0_index, "congés")] == ids(search(INDEX, "congés")) == ["conges"]


def test_point_de_rupture_desuffixation_synonymes_et_mots_vides_ne_sont_pas_traites():
    """
    breaking_point : « Désuffixation, élision, synonymes, mots vides — chacun
    devient une règle que vous écrivez ». Rien ne rapproche « travail » de
    « travaillé », ni « vacances » de « congés » ; « le » est cherché et compte.
    """
    assert "materiel" in ids(search(INDEX, "travail"))
    assert "conges" not in ids(search(INDEX, "travail"))  # la page dit « travaillé »
    assert search(INDEX, "vacances") == []
    stop = search(INDEX, "le")
    assert ids(stop) == ["conges", "materiel", "frais"]
    assert all(result["score"] > 0 for result in stop)


def test_point_de_rupture_l_elision_laisse_un_mot_l_qui_pese_plus_que_le_vrai_mot():
    """
    breaking_point : « élision ». L'apostrophe coupe bien « l'accord » en deux,
    mais le « l » qui reste est un terme comme un autre, rare donc lourd : il
    pèse plus que « accord » dans la page qui l'emploie.
    """
    corpus = HANDBOOK + [{"id": "accord", "title": "Accord", "body": "l'accord du responsable"}]
    result = search(build_index(corpus), "l'accord")[0]
    assert result["id"] == "accord"
    assert result["terms"] == {"l": 1.9377, "accord": 1.6844}
    assert result["terms"]["l"] > result["terms"]["accord"]


# ---------------------------------------------------------------------------
# Autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_trouve_et_note_le_bon_document():
    assert search(INDEX, "congés payés") == [
        {"id": "conges", "score": 3.6746, "terms": {"conges": 1.8373, "payes": 1.8373}}
    ]


def test_un_seul_terme_suffit_la_ou_n0_les_voulait_tous():
    """docstring : « this one keeps any document carrying at least one term, where FTS5 demands all of them »."""
    assert ids(search(INDEX, "congés responsable")) == ["conges", "teletravail", "materiel"]
    assert search_n0(build_index_n0(HANDBOOK), "congés responsable") == []


def test_n1_ne_reproduit_pas_fts5_a_la_decimale_regle_idf_longueur_et_poids_different():
    """
    docstring : « It does not reproduce FTS5 to the decimal: the matching rule,
    the idf, the length and the title weight all differ » ; verdict_rationale :
    « ne rend pas les scores de FTS5 ». Chaque écart, un par un.
    """
    n0_index = build_index_n0(HANDBOOK)
    # Poids du titre : 3 ici, 10 dans N0.
    assert FIELD_WEIGHTS == {"title": 3.0, "body": 1.0}
    # Même aux poids de N0, le score diffère.
    same_weights = build_index(HANDBOOK, {"title": 10.0, "body": 1.0})
    assert search(same_weights, "congés")[0]["score"] == 2.3173
    assert search_n0(n0_index, "congés")[0]["score"] == 1.5938
    # IDF : « le », dans trois pages sur quatre, garde un poids ici, pas dans FTS5.
    assert all(r["score"] > 0 for r in search(same_weights, "le"))
    assert {r["score"] for r in search_n0(n0_index, "le")} == {0.0}
    # Longueur : comptée en occurrences pondérées ici (un titre d'un mot pèse 10).
    assert same_weights["lengths"]["teletravail"] == 10 + len(tokenise(HANDBOOK[1]["body"]))
    # Règle d'appariement : OU ici, ET dans FTS5.
    assert ids(search(same_weights, "congés responsable")) != []
    assert search_n0(n0_index, "congés responsable") == []


def test_un_titre_l_emporte_sur_deux_occurrences_dans_le_corps():
    assert ids(search(INDEX, "télétravail")) == ["teletravail", "conges"]


def test_les_poids_de_champ_disent_ce_que_vaut_un_titre():
    """docstring : « the field weights say how much a title is worth »."""
    assert ids(search(build_index(HANDBOOK, {"body": 1.0}), "télétravail")) == ["conges"]


def test_le_score_est_la_somme_de_ce_que_chaque_terme_a_apporte():
    """docstring : « `terms` says what each query word contributed »."""
    result = search(INDEX, "paie du mois")[0]
    assert result["id"] == "frais"
    # Les deux côtés sont arrondis à l'affichage : ils concordent au chiffre affiché.
    assert abs(sum(result["terms"].values()) - result["score"]) < 0.001


def test_un_terme_rare_pese_plus_qu_un_terme_courant():
    """Commentaire : « The rarer the term, the more a match on it means »."""
    terms = search(INDEX, "congés le")[0]["terms"]
    assert terms["conges"] > terms["le"]


def test_k1_sature_la_repetition():
    """
    docstring : « k1 saturates repetition ». À b = 0, huit occurrences valent
    plus qu'une, jamais huit fois plus, et chaque doublement rapporte moins que
    le précédent ; le plafond est idf × (k1 + 1).
    """
    docs = [{"id": f"r{k}", "title": "x", "body": " ".join(["zèbre"] * k)} for k in (1, 2, 4, 8)]
    docs += [{"id": f"f{i}", "title": "x", "body": "y"} for i in range(6)]
    scores = {r["id"]: r["score"] for r in search(build_index(docs), "zèbre", b=0, limit=10)}
    assert scores == {"r8": 1.7099, "r4": 1.5126, "r2": 1.229, "r1": 0.8938}
    gains = [scores["r2"] - scores["r1"], scores["r4"] - scores["r2"], scores["r8"] - scores["r4"]]
    assert gains == sorted(gains, reverse=True)
    assert scores["r8"] < math.log(1 + (10 - 4 + 0.5) / (4 + 0.5)) * 2.2


def test_la_normalisation_de_longueur_est_une_molette_pas_une_loi():
    """docstring : « b corrects for document length » ; « Change one and the order changes »."""
    assert search(INDEX, "paie du mois")[1]["score"] == 1.1024
    assert search(INDEX, "paie du mois", b=0)[1] == {
        "id": "conges", "score": 1.3863, "terms": {"paie": 0.6931, "mois": 0.6931}
    }
    assert ids(search(INDEX, "jours")) == ["teletravail", "conges"]
    assert ids(search(INDEX, "jours", b=0)) == ["conges", "teletravail"]


def test_un_mot_tape_deux_fois_ne_compte_pas_double():
    """Commentaire : « a word typed twice is not twice as important »."""
    assert search(INDEX, "congés congés") == search(INDEX, "congés")


def test_accents_et_casse_ne_comptent_pas():
    assert search(INDEX, "CONGÉS") == search(INDEX, "conges")
    assert tokenise("Notes de frais !") == ["notes", "de", "frais"]


def test_une_requete_vide_ne_renvoie_rien():
    for query in ("", "   ", "!?"):
        assert search(INDEX, query) == []


def test_la_limite_est_respectee():
    assert len(search(INDEX, "le", limit=2)) == 2


def test_l_index_ne_suit_pas_les_suppressions_jusqu_a_la_reconstruction():
    """
    regulatory : « L'index vit hors de la base et ne suit plus ses suppressions :
    un document retiré y reste jusqu'à la reconstruction suivante ».
    """
    documents = [dict(d) for d in HANDBOOK]
    built = build_index(documents)
    documents.pop(0)
    assert ids(search(built, "congés")) == ["conges"]
    assert search(build_index(documents), "congés") == []


def test_l_extrait_n_importe_que_la_bibliotheque_standard():
    """risks.data_egress : none."""
    source = ast.parse(Path(__file__).with_name("n1.py").read_text(encoding="utf-8"))
    imported = {a.name for n in ast.walk(source) if isinstance(n, ast.Import) for a in n.names}
    imported |= {n.module for n in ast.walk(source) if isinstance(n, ast.ImportFrom)}
    assert imported == {"__future__", "math", "unicodedata", "collections"}


def test_deux_index_rendent_les_memes_resultats():
    """risks.deterministic : true."""
    for query in ("le", "jours", "congés responsable"):
        assert search(build_index(HANDBOOK), query) == search(build_index(HANDBOOK), query)


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_fonds_vide_et_documents_sans_texte():
    assert search(build_index([]), "congés") == []
    assert search(build_index([{"id": "vide", "title": "", "body": ""}]), "congés") == []


def test_production_un_champ_nul_est_indexe_comme_vide():
    """Commentaire : « a NULL column is empty »."""
    assert search(build_index([{"id": "nul", "title": None, "body": None}]), "none") == []
    assert ids(search(build_index([{"id": "nul", "title": None, "body": "congés"}]), "congés")) == ["nul"]


def test_production_dix_mille_pages_et_une_requete_de_vingt_mille_mots():
    docs = [
        {"id": f"d{i:05}", "title": f"Page {i}", "body": "le salarié acquiert deux jours de congés payés par mois " * 20}
        for i in range(10_000)
    ]
    started = time.monotonic()
    index = build_index(docs)
    assert len(search(index, "congés payés mois")) == 5
    assert search(index, " ".join(f"mot{i}" for i in range(20_000))) == []
    assert time.monotonic() - started < 30


def test_production_nfd_espace_insecable_bom_emoji_ligature_et_casse_mixte():
    assert ids(search(INDEX, unicodedata.normalize("NFD", "congés"))) == ["conges"]
    assert ids(search(INDEX, "notes de frais"))[0] == "frais"
    assert ids(search(INDEX, "﻿congés")) == ["conges"]
    assert ids(search(INDEX, "congés 🌴")) == ["conges"]
    assert ids(search(INDEX, "CoNgÉs")) == ["conges"]
    # Ici, le repli NFKD vaut des deux côtés : la ligature est retrouvée.
    assert ids(search(build_index([{"id": "pdf", "title": "Envoyer un ﬁchier", "body": ""}]), "fichier")) == ["pdf"]


def test_production_une_espace_de_largeur_nulle_coupe_le_mot_en_deux():
    assert tokenise("con​gés") == ["con", "ges"]
    assert search(INDEX, "con​gés") == []


def test_production_limites_zero_et_un_k1_nul_b_un():
    assert search(INDEX, "le", limit=0) == []
    assert ids(search(INDEX, "le", limit=1)) == ["conges"]
    # k1 = 0 : la répétition ne compte plus, seul l'IDF reste.
    shares = {r["id"]: r["score"] for r in search(INDEX, "le", k1=0)}
    assert len(set(shares.values())) == 1
    assert ids(search(INDEX, "jours", b=1)) == ["teletravail", "conges"]


def test_production_une_limite_negative_est_refusee():
    with pytest.raises(ValueError, match="limit must be zero or more"):
        search(INDEX, "le", limit=-1)
