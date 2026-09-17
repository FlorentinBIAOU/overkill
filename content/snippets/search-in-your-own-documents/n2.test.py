"""
Ces tests injectent un double local au lieu de charger un vrai encodeur.

Ce qu'ils prouvent : le fonds et la requête partent en un seul appel, un
encodeur qui tombe ou rend le mauvais nombre de vecteurs lève, les deux
classements sont fusionnés comme annoncé, et la fusion est déterministe jusque
dans ses égalités.

Ce qu'ils ne prouvent pas : qu'un vrai encodeur rapproche « vacances » de
« congés payés ». C'est toute la promesse du niveau, et c'est pourquoi la fiche
le déclare `verification: stubbed`.
"""

import sys
import time
import types

import dataclasses

import numpy as np
import pytest

from _harness.fake_model import FakeEncoder
from n0 import build_index as build_index_n0, search as search_n0
import n2
from n2 import MODEL_NAME, EncodingFailed, hybrid_search, unit, vector_ranking

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

WALLS = "quelle est la couleur des murs du bureau"


def encoder():
    # Assez large pour que deux mots de ce fonds ne partagent presque jamais une dimension.
    return FakeEncoder(dimensions=1024)


class SynonymEncoder(FakeEncoder):
    """
    Tient lieu de la seule chose qu'apporte un vrai encodeur : savoir que deux
    mots s'emploient aux mêmes endroits. Le synonyme est écrit ici, pas appris.
    """

    SYNONYMS = {"maison": "télétravail"}

    def encode(self, texts):
        expanded = [
            " ".join(self.SYNONYMS.get(word.lower(), word) for word in text.split())
            for text in texts
        ]
        return super().encode(expanded)


class TruncatedEncoder(FakeEncoder):
    """Un modèle qui perd en silence le dernier élément d'un lot."""

    def encode(self, texts):
        return super().encode(texts)[:-1]


class BrokenEncoder:
    """Un modèle qui ne peut pas tourner du tout."""

    def encode(self, texts):
        raise RuntimeError("out of memory while loading the model")


class TableEncoder:
    """Un encodeur dont chaque vecteur est posé à la main, par mot-clé du texte."""

    def __init__(self, table, default):
        self.table, self.default = table, default

    def encode(self, texts):
        return [next((v for key, v in self.table.items() if key in text), self.default) for text in texts]


def ids(results):
    return [result["id"] for result in results]


@pytest.fixture
def sentence_transformers(monkeypatch):
    """
    Un module `sentence_transformers` à la surface de la bibliothèque publiée :
    `SentenceTransformer(nom)` charge les poids, `.encode(liste)` rend un
    tableau numpy d'une ligne par texte. Il compte les chargements.
    """
    module = types.ModuleType("sentence_transformers")
    module.loads = []
    module.fail_next = False

    class SentenceTransformer:
        def __init__(self, name):
            if module.fail_next:
                module.fail_next = False
                raise OSError("could not download the weights")
            module.loads.append(name)
            self._fake = FakeEncoder(dimensions=1024)

        def encode(self, sentences):
            return np.array(self._fake.encode(list(sentences)), dtype=np.float32)

    module.SentenceTransformer = SentenceTransformer
    monkeypatch.setitem(sys.modules, "sentence_transformers", module)
    n2.default_encoder.cache_clear()
    yield module
    n2.default_encoder.cache_clear()


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_la_jambe_vectorielle_a_toujours_une_reponse():
    """
    breaking_point : « le manuel ne dit rien de la couleur des murs du bureau ;
    le plein texte répond honnêtement rien, la jambe vectorielle classe quand
    même les quatre pages, et la fusion en présente une en tête — celle des
    notes de frais ».
    """
    keyword_ids = ids(search_n0(build_index_n0(HANDBOOK), WALLS))
    assert keyword_ids == []  # le plein texte répond honnêtement rien
    assert len(vector_ranking(WALLS, HANDBOOK, encoder())) == 4
    found = hybrid_search(WALLS, HANDBOOK, keyword_ids, encoder=encoder())
    assert len(found) == 4
    assert found[0]["id"] == "frais"


def test_point_de_rupture_aucun_resultat_n_existe_plus_meme_pour_une_requete_vide_ou_absurde():
    """breaking_point : « « aucun résultat » n'existe plus »."""
    for query in ("", "zzzz qwxv", "🦄"):
        assert len(hybrid_search(query, HANDBOOK, [], encoder=encoder())) == 4


def test_point_de_rupture_c_est_le_double_qui_designe_la_page_en_tete():
    """
    breaking_point : « mais c'est le double local qui la désigne, pas un
    encodeur réel ». Le même double, à une autre largeur, en désigne une autre.
    """
    heads = {d: hybrid_search(WALLS, HANDBOOK, [], encoder=FakeEncoder(dimensions=d))[0]["id"] for d in (8, 16, 32, 1024)}
    assert heads == {8: "conges", 16: "teletravail", 32: "materiel", 1024: "frais"}


def test_point_de_rupture_aucun_seuil_ne_peut_se_poser_sur_le_score_fusionne():
    """
    breaking_point : « le score fusionné ne permet pas de poser un seuil : la
    page de tête a le même score pour cette question que pour une question à
    laquelle le manuel répond. Un seuil devrait porter sur le cosinus, que
    l'extrait ne rend pas ». Le résultat ne porte que `id` et `score`.
    """
    off_topic = hybrid_search(WALLS, HANDBOOK, [], encoder=encoder())[0]["score"]
    on_topic = hybrid_search("notes de frais", HANDBOOK, [], encoder=encoder())[0]["score"]
    assert off_topic == on_topic == round(1 / 61, 6)
    assert {key for r in hybrid_search(WALLS, HANDBOOK, [], encoder=encoder()) for key in r} == {"id", "score"}


# ---------------------------------------------------------------------------
# Autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_un_document_que_les_deux_jambes_mettent_en_tete_gagne():
    """docstring : « `keyword_ids` is what N0 already gave you, best first »."""
    keyword_ids = ids(search_n0(build_index_n0(HANDBOOK), "notes de frais"))
    assert keyword_ids == ["frais"]
    assert hybrid_search("notes de frais", HANDBOOK, keyword_ids, encoder=encoder()) == [
        {"id": "frais", "score": 0.032787},
        {"id": "conges", "score": 0.016129},
        {"id": "materiel", "score": 0.015873},
        {"id": "teletravail", "score": 0.015625},
    ]


def test_chaque_liste_vote_par_un_sur_k_plus_rang():
    """Commentaire : « each list votes with 1/(k + rank) »."""
    found = {r["id"]: r["score"] for r in hybrid_search("notes de frais", HANDBOOK, ["materiel"], encoder=encoder())}
    ranking = vector_ranking("notes de frais", HANDBOOK, encoder())
    for doc_id in ranking:
        expected = 1 / (60 + ranking.index(doc_id) + 1) + (1 / 61 if doc_id == "materiel" else 0)
        assert found[doc_id] == round(expected, 6)


def test_k_dit_ce_que_vaut_la_premiere_place():
    """Commentaire : « k says how much being second is worth compared with being first »."""
    top = hybrid_search("notes de frais", HANDBOOK, ["frais"], encoder=encoder(), k=0)[0]
    assert top == {"id": "frais", "score": 2.0}


def test_rien_n_a_a_etre_remis_a_l_echelle():
    """
    Commentaire : « Nothing has to be rescaled ». Des vecteurs mille fois plus
    longs donnent le même classement : seul le rang compte, et `unit` normalise.
    """
    class Scaled(FakeEncoder):
        def encode(self, texts):
            return [[1000 * x for x in v] for v in super().encode(texts)]

    assert hybrid_search("notes de frais", HANDBOOK, ["frais"], encoder=Scaled(dimensions=1024)) == hybrid_search(
        "notes de frais", HANDBOOK, ["frais"], encoder=encoder()
    )


def test_unit_normalise_une_fois_et_laisse_le_vecteur_nul_intact():
    """docstring de unit : « Normalise once, so that a cosine is a dot product afterwards »."""
    assert unit([3, 4]) == [0.6, 0.8]
    assert unit([0, 0]) == [0.0, 0.0]


def test_les_egalites_sont_departagees_par_l_identifiant():
    """Commentaire : « Ties are broken on the identifier, so two runs give the same order »."""
    flat = TableEncoder({}, [0.0, 0.0])
    shuffled = [HANDBOOK[2], HANDBOOK[0], HANDBOOK[3], HANDBOOK[1]]
    assert vector_ranking("x", shuffled, flat) == ["conges", "frais", "materiel", "teletravail"]


def test_le_fonds_et_la_requete_partent_en_un_seul_appel():
    """Commentaire : « One batched call: the query travels with the documents not yet encoded »."""
    fake = encoder()
    hybrid_search("notes de frais", HANDBOOK, [], encoder=fake)
    texts = [f"{d['title']} {d['body']}" for d in HANDBOOK]
    assert fake.calls == [texts + ["notes de frais"]]


def test_un_fonds_vide_n_atteint_jamais_le_modele():
    fake = encoder()
    assert hybrid_search("notes de frais", [], [], encoder=fake) == []
    assert fake.calls == []


def test_la_limite_est_respectee():
    assert len(hybrid_search("frais", HANDBOOK, ["frais"], encoder=encoder(), limit=2)) == 2


def test_un_lot_tronque_leve_plutot_que_de_perdre_un_document():
    """docstring d'EncodingFailed : « returned something unusable »."""
    with pytest.raises(EncodingFailed):
        hybrid_search("frais", HANDBOOK, [], encoder=TruncatedEncoder(dimensions=1024))


def test_un_modele_qui_ne_peut_pas_tourner_leve():
    """docstring d'EncodingFailed : « The encoder could not be run »."""
    with pytest.raises(EncodingFailed):
        hybrid_search("frais", HANDBOOK, [], encoder=BrokenEncoder())


def test_des_vecteurs_inutilisables_levent_encoding_failed():
    """
    docstring d'EncodingFailed : « returned something unusable » ; message :
    « vectors of different sizes, or values that are not finite numbers ».
    NaN, infini, dimensions incohérentes, valeur non numérique.
    """
    nan = TableEncoder({}, [float("nan")] * 3)
    infinite = TableEncoder({}, [float("inf"), 0.0])
    ragged = TableEncoder({"quoi": [1.0, 0.0, 5.0]}, [1.0, 0.0])
    text = TableEncoder({"quoi": [1.0, 0.0]}, [1.0, "beaucoup"])
    for bad in (nan, infinite, ragged, text):
        with pytest.raises(EncodingFailed):
            hybrid_search("quoi", HANDBOOK, [], encoder=bad)


def test_un_encodeur_qui_a_rendu_des_vecteurs_inutilisables_ne_garde_rien_en_cache():
    """Témoin de la précédente : l'appel suivant, sain, rend un classement complet."""
    class Flaky(FakeEncoder):
        broken = True

        def encode(self, texts):
            vectors = super().encode(texts)
            if self.broken:
                self.broken = False
                vectors[0] = [float("nan")] * self.dimensions
            return vectors

    flaky = Flaky(dimensions=1024)
    with pytest.raises(EncodingFailed):
        hybrid_search("frais", HANDBOOK, [], encoder=flaky)
    assert len(hybrid_search("frais", HANDBOOK, [], encoder=flaky)) == 4
    assert len(flaky.calls[1]) == 5


def test_la_jambe_vectorielle_trouve_ce_que_les_mots_ne_trouvaient_pas():
    """
    docstring : « that gap is what this rung exists to close » ; « borrows the
    reach of the vectors ». « maison » n'est dans aucune page ; un encodeur qui le
    relie à « télétravail » fait monter les deux pages qui en parlent.
    """
    question = "puis-je rester à la maison"
    assert search_n0(build_index_n0(HANDBOOK), question) == []
    assert vector_ranking(question, HANDBOOK, encoder())[-1] == "teletravail"
    found = hybrid_search(question, HANDBOOK, [], encoder=SynonymEncoder(dimensions=1024))
    assert ids(found)[:2] == ["conges", "teletravail"]


def test_la_tete_du_plein_texte_reste_devant_tout_document_qu_il_n_a_pas_trouve():
    """
    docstring : « Fusing the two rankings keeps the first keyword result ahead
    of any page the keywords did not find ». La page que le plein texte met en
    premier, même classée dernière par la jambe vectorielle, reste devant une
    page que la jambe vectorielle met en premier et que le plein texte n'a pas
    trouvée.
    """
    table = TableEncoder({"informatique": [-1.0, 0.0], "Congés": [1.0, 0.0], "QUESTION": [1.0, 0.0]}, [0.0, 1.0])
    found = hybrid_search("QUESTION", HANDBOOK, ["materiel"], encoder=table)
    assert ids(found)[:2] == ["materiel", "conges"]


def test_plus_bas_dans_la_liste_chaque_jambe_pese_autant_que_l_autre():
    """
    docstring : « further down the list, each leg weighs as much as the
    other ». Sur 300 pages, le 14e résultat du plein texte,
    classé dernier par la jambe vectorielle, passe derrière une page qui ne porte
    aucun mot de la requête mais que la jambe vectorielle met en tête ; le 13e
    reste devant. Chaque jambe pèse autant que l'autre.
    """
    documents = [{"id": f"autre{i:03}", "title": "autre", "body": ""} for i in range(285)]
    documents += [{"id": f"k{i:02}", "title": "exact", "body": ""} for i in range(1, 15)]
    documents += [{"id": "intrus", "title": "intrus", "body": ""}]
    table = TableEncoder({"exact": [-1.0, 0.0], "intrus": [1.0, 0.0], "QUESTION": [1.0, 0.0]}, [0.0, 1.0])
    order = ids(hybrid_search("QUESTION", documents, [f"k{i:02}" for i in range(1, 15)], encoder=table, limit=300))
    assert order.index("k13") < order.index("intrus") < order.index("k14")


def test_le_modele_nomme_est_multilingue():
    """
    Commentaire : « A multilingual model: its card lists French among its
    languages » : le nom seul est vérifiable ici, la carte ne l'est pas.
    """
    assert MODEL_NAME == "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"


def test_le_modele_par_defaut_a_la_surface_de_sentence_transformers(sentence_transformers):
    """
    docstring : un encodeur auto-hébergé par défaut. Contre un module à la forme
    de la bibliothèque publiée (constructeur, `.encode` qui rend un tableau
    numpy), l'appel du code existe et fonctionne.
    """
    found = hybrid_search("notes de frais", HANDBOOK, ["frais"])
    assert found == hybrid_search("notes de frais", HANDBOOK, ["frais"], encoder=encoder())
    assert sentence_transformers.loads[0] == MODEL_NAME


def test_production_un_vecteur_refuse_n_empoisonne_pas_le_cache_d_un_encodeur_deja_servi():
    """
    Un encodeur a déjà servi une recherche ; à la suivante, le vecteur d'une
    page nouvelle est refusé (NaN). Le vecteur refusé n'entre pas dans le cache
    gardé pour l'encodeur, si bien que la recherche d'après ré-encode cette page
    et répond. Même comportement en JavaScript, depuis ce lot.
    """
    class FlakyOnSecondCall(FakeEncoder):
        count = 0

        def encode(self, texts):
            vectors = super().encode(texts)
            self.count += 1
            if self.count == 2:
                vectors[0] = [float("nan")] * self.dimensions
            return vectors

    flaky = FlakyOnSecondCall(dimensions=1024)
    hybrid_search("frais", HANDBOOK[:1], [], encoder=flaky)
    with pytest.raises(EncodingFailed):
        hybrid_search("frais", HANDBOOK[:2], [], encoder=flaky)
    assert len(hybrid_search("frais", HANDBOOK[:2], [], encoder=flaky)) == 2
    assert flaky.calls[2] == [f"{HANDBOOK[1]['title']} {HANDBOOK[1]['body']}", "frais"]


def test_production_le_modele_par_defaut_est_charge_une_fois_par_processus(sentence_transformers):
    """docstring de default_encoder : « Loaded once per process, then kept warm »."""
    hybrid_search("notes de frais", HANDBOOK, ["frais"])
    hybrid_search("télétravail", HANDBOOK, ["teletravail"])
    assert sentence_transformers.loads == [MODEL_NAME]


def test_production_un_chargement_qui_echoue_est_retente_a_la_recherche_suivante(sentence_transformers):
    """
    `functools.cache` ne retient pas une exception. Constat : l'échec du
    chargement sort tel quel (ici `OSError`), pas en `EncodingFailed`.
    """
    sentence_transformers.fail_next = True
    with pytest.raises(OSError):
        hybrid_search("notes de frais", HANDBOOK, ["frais"])
    assert len(hybrid_search("notes de frais", HANDBOOK, ["frais"])) == 4
    assert sentence_transformers.loads == [MODEL_NAME]


def test_production_le_fonds_n_est_pas_reencode_a_chaque_requete():
    """
    Commentaire : « a document is encoded again only once its text has
    changed » ; docstring : « document vectors to recompute when a document
    changes ». La seconde requête part seule.
    """
    fake = encoder()
    hybrid_search("notes de frais", HANDBOOK, [], encoder=fake)
    hybrid_search("télétravail", HANDBOOK, [], encoder=fake)
    encoded = [text for call in fake.calls for text in call]
    assert encoded.count(f"{HANDBOOK[0]['title']} {HANDBOOK[0]['body']}") == 1
    assert fake.calls[1] == ["télétravail"]


def test_production_un_document_modifie_est_reencode_et_lui_seul():
    fake = encoder()
    hybrid_search("frais", HANDBOOK, [], encoder=fake)
    changed = [dict(HANDBOOK[0], body="Vingt-cinq jours ouvrés par an."), *HANDBOOK[1:]]
    found = hybrid_search("frais", changed, [], encoder=fake)
    assert fake.calls[1] == ["Congés payés Vingt-cinq jours ouvrés par an.", "frais"]
    # Le classement est celui d'un encodeur neuf sur le fonds modifié.
    assert found == hybrid_search("frais", changed, [], encoder=encoder())


def test_production_deux_documents_au_meme_texte_ne_partent_qu_une_fois():
    fake = encoder()
    twins = HANDBOOK + [dict(HANDBOOK[2], id="frais-copie")]
    found = hybrid_search("frais", twins, [], encoder=fake)
    assert len(fake.calls[0]) == 5
    assert {"frais", "frais-copie"} <= set(ids(found))


def test_production_le_cache_ne_garde_que_les_textes_de_la_derniere_recherche():
    """
    Commentaire : « the unit vector of each document text seen in the last
    search ». Une page retirée puis remise est encodée de nouveau.
    """
    fake = encoder()
    hybrid_search("frais", HANDBOOK, [], encoder=fake)
    hybrid_search("frais", HANDBOOK[1:], [], encoder=fake)
    hybrid_search("frais", HANDBOOK, [], encoder=fake)
    first = f"{HANDBOOK[0]['title']} {HANDBOOK[0]['body']}"
    assert fake.calls[1] == ["frais"]
    assert fake.calls[2] == [first, "frais"]


def test_production_constat_un_encodeur_non_hachable_leve_type_error():
    """
    Constat : le cache par encodeur est un `WeakKeyDictionary`, qui exige un
    encodeur hachable. Un encodeur injecté écrit en dataclass (non hachable)
    fait lever `TypeError` avant tout encodage. `SentenceTransformer` et les
    doubles du harnais sont hachables.
    """
    @dataclasses.dataclass
    class DataclassEncoder:
        dimensions: int = 8

        def encode(self, texts):
            return FakeEncoder(self.dimensions).encode(texts)

    with pytest.raises(TypeError, match="unhashable"):
        hybrid_search("frais", HANDBOOK, [], encoder=DataclassEncoder())


def test_deux_executions_rendent_le_meme_classement():
    """risks.deterministic : true (avec le double ; le modèle réel n'est pas exécuté)."""
    assert hybrid_search(WALLS, HANDBOOK, [], encoder=encoder()) == hybrid_search(WALLS, HANDBOOK, [], encoder=encoder())


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_limite_zero_et_k_nul():
    assert hybrid_search("frais", HANDBOOK, ["frais"], encoder=encoder(), limit=0) == []
    assert hybrid_search("frais", HANDBOOK, ["frais"], encoder=encoder(), k=0)[0]["score"] == 2.0


def test_production_dix_mille_pages():
    docs = [
        {"id": f"d{i:05}", "title": f"Page {i}", "body": "le salarié acquiert deux jours de congés payés par mois " * 5}
        for i in range(10_000)
    ]
    started = time.monotonic()
    found = hybrid_search("congés", docs, ["d00001"], encoder=FakeEncoder(dimensions=64))
    assert found[0]["id"] == "d00001"
    assert time.monotonic() - started < 30


def test_production_la_requete_part_telle_quelle_nfd_espace_insecable_emoji():
    fake = encoder()
    query = "congés payés 🌴﻿"
    assert len(hybrid_search(query, HANDBOOK, [], encoder=fake)) == 4
    assert fake.calls[0][-1] == query


def test_production_un_identifiant_du_plein_texte_absent_du_fonds_ressort_quand_meme():
    """Constat : la fusion ne vérifie pas que les identifiants du plein texte sont dans `documents`."""
    found = hybrid_search("x", HANDBOOK, ["supprime"], encoder=encoder())
    assert "supprime" in ids(found)
