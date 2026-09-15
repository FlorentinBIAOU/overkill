"""
Le fonds est un petit règlement intérieur, celui que toute entreprise a.

N0 en Python, c'est la vraie table FTS5 de SQLite : chaque score affirmé ici
est celui de bm25(), et `n0.test.js` affirme les mêmes nombres, puisque le
fichier JavaScript prétend reproduire ce que fait la table.
"""

import ast
import sqlite3
import time
import unicodedata
from pathlib import Path

import pytest

import n0
from n0 import build_index, search, tokenise
from n1 import build_index as build_index_n1, search as search_n1

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

# Les six pages de l'essai : les quatre ci-dessus et deux de plus. Sur quatre
# pages, un mot présent dans deux d'entre elles a un poids nul (voir plus bas) ;
# sur six, « responsable » sépare encore quelque chose.
MANUEL = HANDBOOK + [
    {
        "id": "titres",
        "title": "Titres-restaurant",
        "body": "Un titre par jour de présence sur site. La part employeur est de "
                "soixante pour cent.",
    },
    {
        "id": "arret",
        "title": "Arrêt de travail",
        "body": "Le certificat médical part à la paie dans les quarante-huit heures. "
                "Le délai de carence est de trois jours.",
    },
]


def index():
    return build_index(HANDBOOK)


def ids(results):
    return [result["id"] for result in results]


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_une_recherche_par_le_sens():
    """
    breaking_point : « le lecteur demande la chose, le document la nomme
    autrement, et l'index n'a rien à faire correspondre ». Deux questions dont
    le règlement a la réponse ; posées avec les mots du document, elles
    trouvent.
    """
    assert search(index(), "combien de vacances puis-je poser") == []
    assert search(index(), "puis-je travailler depuis chez moi") == []
    # Témoin : les mêmes questions, dans les mots du document.
    assert ids(search(index(), "congés")) == ["conges"]
    assert ids(search(index(), "télétravail"))[0] == "teletravail"


def test_point_de_rupture_vacances_ne_renvoie_rien_alors_que_la_page_s_intitule_conges_payes():
    """
    breaking_point : « « combien de vacances puis-je poser » ne renvoie rien
    alors que la page s'intitule « Congés payés » ».
    """
    assert search(index(), "combien de vacances puis-je poser") == []
    assert HANDBOOK[0]["title"] == "Congés payés"
    assert "vacances" not in tokenise(" ".join(d["title"] + " " + d["body"] for d in HANDBOOK))
    # Témoin : le mot de la page trouve la page.
    assert search(index(), "congés payés") == [{"id": "conges", "score": 3.1876}]


def test_point_de_rupture_conges_responsable_ne_renvoie_rien_faute_d_une_page_portant_les_deux_mots():
    """
    breaking_point : « « congés responsable » ne renvoie rien non plus, parce
    qu'aucune page ne porte les deux mots ». Témoin : chaque mot, seul, trouve.
    """
    assert search(index(), "congés responsable") == []
    assert ids(search(index(), "congés")) == ["conges"]
    assert ids(search(index(), "responsable")) == ["teletravail", "materiel"]
    for document in HANDBOOK:
        words = set(tokenise(f"{document['title']} {document['body']}"))
        assert not {"conges", "responsable"} <= words


def test_point_de_rupture_le_et_implicite_aggrave_le_silence():
    """
    breaking_point : « le ET implicite de FTS5 aggrave le silence ». Avec la
    règle OU de N1, sur le même fonds, les deux requêtes muettes ramènent des
    pages : c'est bien la règle ET qui fait le silence, pas l'absence de tout
    mot commun.
    """
    assert search(index(), "congés responsable") == []
    assert ids(search_n1(build_index_n1(HANDBOOK), "congés responsable")) == [
        "conges", "teletravail", "materiel"
    ]
    assert search(index(), "combien de vacances puis-je poser") == []
    assert ids(search_n1(build_index_n1(HANDBOOK), "combien de vacances puis-je poser")) == [
        "frais", "conges", "materiel"
    ]


# ---------------------------------------------------------------------------
# Autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_le_score_est_celui_de_bm25_de_fts5_au_signe_pres():
    """
    name : « Index plein texte de la base de données, classé par BM25 » ;
    docstring : « bm25() returns a negative number, the best match being the
    most negative. Negate it ». Les nombres sont ceux que `n0.test.js` affirme.
    """
    connection = build_index(MANUEL)
    raw = connection.execute(
        "SELECT doc_id, bm25(documents, 0.0, 10.0, 1.0) FROM documents "
        "WHERE documents MATCH '\"responsable\"' ORDER BY bm25(documents, 0.0, 10.0, 1.0)"
    ).fetchall()
    assert [doc_id for doc_id, _ in raw] == ["teletravail", "materiel"]
    assert all(score < 0 for _, score in raw)
    assert raw[0][1] < raw[1][1]  # le meilleur est le plus négatif
    assert search(connection, "responsable") == [
        {"id": "teletravail", "score": 0.7235},
        {"id": "materiel", "score": 0.6368},
    ]


def test_les_scores_de_fts5_que_le_fichier_javascript_doit_reproduire():
    """
    docstring JS : « the same tokenizer […], the same implicit AND between
    terms, the same BM25 with the same constants and column weights ». Ces
    valeurs sortent de la vraie table FTS5 ; `n0.test.js` affirme les mêmes.
    """
    assert search(index(), "notes de frais") == [{"id": "frais", "score": 3.3722}]
    assert search(index(), "accord responsable") == [{"id": "teletravail", "score": 1.0534}]
    assert search(index(), "demi") == [{"id": "conges", "score": 0.6506}]
    manuel = build_index(MANUEL)
    assert search(manuel, "notes de frais") == [{"id": "frais", "score": 5.1574}]
    assert search(manuel, "télétravail") == [
        {"id": "teletravail", "score": 1.1988},
        {"id": "conges", "score": 0.6591},
    ]
    assert search(manuel, "trois jours") == [{"id": "arret", "score": 1.2796}]


def test_une_requete_brute_est_une_erreur_de_syntaxe_la_meme_mise_entre_guillemets_est_une_recherche():
    """
    docstring : « MATCH takes a query language, not a string. A user typing a
    double quote, AND or NEAR must never be handed to it raw: quoting each token
    turns the query back into plain words, and turns a syntax error into a
    search ».
    """
    connection = index()
    raw = "SELECT doc_id FROM documents WHERE documents MATCH ?"
    for query in ('congés" paie', "conges AND", "conges OR"):
        with pytest.raises(sqlite3.OperationalError):
            connection.execute(raw, (query,)).fetchall()
    # Brut, « title: » est un filtre de colonne et NEAR un opérateur.
    assert connection.execute(raw, ("title:conges",)).fetchall() == [("conges",)]
    # Entre guillemets, ce sont des mots ordinaires.
    assert tokenise('congés" paie') == ["conges", "paie"]
    assert ids(search(connection, 'congés" paie')) == ["conges"]
    assert search(connection, "conges AND") == []
    assert search(connection, "NEAR(congés paie)") == []
    assert search(connection, "title:congés") == []


def test_un_match_vide_est_une_erreur_de_syntaxe_pas_un_resultat_vide():
    """Commentaire : « An empty MATCH is a syntax error, not an empty result set »."""
    with pytest.raises(sqlite3.OperationalError):
        index().execute("SELECT doc_id FROM documents WHERE documents MATCH ''").fetchall()
    for query in ("", "   ", "!?", "«»"):
        assert search(index(), query) == []


def test_tous_les_termes_de_la_requete_doivent_apparaitre():
    """Commentaire : « Quoted terms, separated by a space: FTS5 requires all of them to appear »."""
    assert ids(search(index(), "accord responsable")) == ["teletravail"]
    assert search(index(), "congés responsable") == []


def test_un_titre_l_emporte_sur_deux_occurrences_dans_le_corps():
    """Commentaire : « A title match counts for more than a body match »."""
    assert ids(search(index(), "télétravail")) == ["teletravail", "conges"]


def test_un_mot_du_titre_compte_dix_fois_un_mot_du_corps():
    """
    Commentaire : « bm25() takes one weight per column » ; COLUMN_WEIGHTS
    (0, 10, 1) ; essai : « un mot du titre compte dix fois un mot du corps ».
    Un mot une fois au titre et le même dix fois au corps, à longueur égale :
    même score. Témoin : neuf fois au corps, score plus bas.
    """
    filler = [{"id": f"f{i}", "title": "autre", "body": "a b c d e f g h i j"} for i in range(3)]
    title = {"id": "titre", "title": "zèbre", "body": "a b c d e f g h i j"}
    ten = {"id": "corps", "title": "k", "body": " ".join(["zèbre"] * 10)}
    nine = {"id": "corps", "title": "k", "body": " ".join(["zèbre"] * 9) + " a"}
    assert search(build_index([title, ten] + filler), "zèbre") == [
        {"id": "corps", "score": 0.6609},
        {"id": "titre", "score": 0.6609},
    ]
    assert search(build_index([title, nine] + filler), "zèbre") == [
        {"id": "titre", "score": 0.6609},
        {"id": "corps", "score": 0.6532},
    ]


def test_sans_les_poids_de_colonne_le_titre_ne_l_emporte_plus(monkeypatch):
    """Témoin de la précédente : à poids égaux, le corps répété passe devant."""
    monkeypatch.setattr(n0, "COLUMN_WEIGHTS", (0.0, 1.0, 1.0))
    filler = [{"id": f"f{i}", "title": "autre", "body": "a b c d e f g h i j"} for i in range(3)]
    docs = [
        {"id": "titre", "title": "zèbre", "body": "a b c d e f g h i j"},
        {"id": "corps", "title": "k", "body": " ".join(["zèbre"] * 10)},
    ] + filler
    assert ids(search(build_index(docs), "zèbre")) == ["corps", "titre"]


def test_accents_et_casse_ne_comptent_pas():
    """docstring de tokenise : « Lower case, strip accents, keep letters and digits »."""
    assert ids(search(index(), "CONGÉS")) == ids(search(index(), "conges")) == ["conges"]


@pytest.mark.xfail(
    strict=True,
    reason=(
        "INFIRMÉ : la docstring de tokenise dit « The same folding as the tokenizer "
        "declared above ». tokenise passe par NFKD, unicode61 non : un document qui "
        "porte la ligature « ﬁchier » (fréquente dans un texte tiré d'un PDF) est "
        "indexé « ﬁchier », la requête devient « fichier », et aucune requête ne "
        "peut plus le trouver"
    ),
)
def test_infirme_le_repli_de_la_requete_est_celui_de_l_index():
    connection = build_index([{"id": "pdf", "title": "Envoyer un ﬁchier", "body": ""}])
    assert ids(search(connection, "ﬁchier")) == ["pdf"]


def test_un_mot_present_dans_la_moitie_des_documents_ou_plus_n_ajoute_rien_au_score():
    """
    Rareté : « le » est dans trois pages sur quatre ; FTS5 plancher son poids à
    1e-6, et chaque page revient avec un score arrondi à zéro.
    """
    scores = {result["score"] for result in search(index(), "le")}
    assert scores == {0.0}


def test_la_limite_est_respectee():
    assert len(search(index(), "le", limit=2)) == 2


def test_l_extrait_n_importe_que_sqlite3_et_unicodedata():
    """risks.data_egress : none ; aucun service."""
    source = ast.parse(Path(__file__).with_name("n0.py").read_text(encoding="utf-8"))
    imported = {a.name for n in ast.walk(source) if isinstance(n, ast.Import) for a in n.names}
    imported |= {n.module for n in ast.walk(source) if isinstance(n, ast.ImportFrom)}
    assert imported == {"sqlite3", "unicodedata"}


def test_deux_index_rendent_les_memes_resultats():
    """risks.deterministic : true."""
    for query in ("le", "télétravail", "notes de frais", "responsable"):
        assert search(build_index(MANUEL), query) == search(build_index(MANUEL), query)


def test_l_index_suit_les_suppressions_et_les_sauvegardes_de_la_base():
    """
    regulatory : « l'index est une table de la base que vous exploitez déjà, et
    suit ses sauvegardes et ses suppressions ».
    """
    connection = index()
    connection.commit()
    backup = sqlite3.connect(":memory:")
    connection.backup(backup)
    connection.execute("DELETE FROM documents WHERE doc_id = 'conges'")
    assert search(connection, "congés") == []
    assert ids(search(backup, "congés")) == ["conges"]


def test_l_index_se_met_a_jour_dans_la_transaction_du_document():
    """
    verdict_rationale : « il se met à jour dans la même transaction que le
    document ». Vrai ici, où la table FTS5 est la table des documents : une
    insertion annulée ne laisse rien dans l'index.
    """
    connection = index()
    connection.commit()
    connection.execute(
        "INSERT INTO documents (doc_id, title, body) VALUES ('mutuelle', 'Mutuelle', 'Adhésion')"
    )
    assert ids(search(connection, "mutuelle")) == ["mutuelle"]
    connection.rollback()
    assert search(connection, "mutuelle") == []
    assert ids(search(connection, "congés")) == ["conges"]  # le reste est resté


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_fonds_vide_et_document_sans_texte():
    assert search(build_index([]), "congés") == []
    connection = build_index([{"id": "vide", "title": "", "body": ""}, {"id": "nul", "title": None, "body": "congés"}])
    assert ids(search(connection, "congés")) == ["nul"]


def test_production_dix_mille_pages_et_une_page_d_un_million_de_mots():
    docs = [
        {"id": f"d{i:05}", "title": f"Page {i}", "body": "le salarié acquiert deux jours de congés payés par mois " * 20}
        for i in range(10_000)
    ]
    started = time.monotonic()
    assert len(search(build_index(docs), "congés payés")) == 5
    big = build_index([{"id": "big", "title": "x", "body": "congés " * 1_000_000}])
    assert ids(search(big, "congés")) == ["big"]
    assert time.monotonic() - started < 30


def test_production_requete_de_vingt_mille_mots_et_cent_mille_guillemets():
    started = time.monotonic()
    assert search(index(), " ".join(f"mot{i}" for i in range(20_000))) == []
    assert ids(search(index(), '"' * 100_000 + "congés")) == ["conges"]
    assert time.monotonic() - started < 10


def test_production_nfd_espace_insecable_bom_emoji_et_casse_mixte():
    connection = index()
    assert ids(search(connection, unicodedata.normalize("NFD", "congés"))) == ["conges"]
    assert ids(search(connection, "notes de frais")) == ["frais"]
    assert ids(search(connection, "﻿congés")) == ["conges"]
    assert ids(search(connection, "congés 🌴")) == ["conges"]
    assert ids(search(connection, "NoTeS dE fRaIs")) == ["frais"]
    nfd = build_index([{"id": "nfd", "title": unicodedata.normalize("NFD", "Congés payés"), "body": ""}])
    assert ids(search(nfd, "congés")) == ["nfd"]


def test_production_une_espace_de_largeur_nulle_coupe_le_mot_en_deux():
    """Constat : « con\\u200bgés » devient « con » et « ges », rien n'est trouvé."""
    assert tokenise("con​gés") == ["con", "ges"]
    assert search(index(), "con​gés") == []


@pytest.mark.xfail(
    strict=True,
    reason=(
        "DÉFAUT : une élision dans la requête vide les résultats. « l'accord » donne "
        "les jetons « l » et « accord », le ET implicite exige « l », qu'aucune page "
        "ne porte seul : rien, alors que « accord » trouve la page Télétravail"
    ),
)
def test_defaut_une_elision_dans_la_requete_vide_les_resultats():
    assert ids(search(index(), "accord")) == ["teletravail"]
    assert ids(search(index(), "l'accord")) == ["teletravail"]


def test_production_limites_zero_et_un():
    assert search(index(), "le", limit=0) == []
    assert ids(search(index(), "le", limit=1)) == ["conges"]


@pytest.mark.xfail(
    strict=True,
    reason=(
        "DÉFAUT : une limite négative n'est pas refusée, et les deux langages "
        "divergent : SQLite lit LIMIT -1 comme « sans limite » (trois pages pour "
        "« le »), le JavaScript retire la dernière (deux pages)"
    ),
)
def test_defaut_une_limite_negative_n_est_pas_refusee():
    try:
        assert search(index(), "le", limit=-1) == []
    except ValueError:
        pass
