"""
These tests inject a local double instead of loading a real encoder.

What they prove: the records are normalised the same way for every rung, the
encoder is called once with the whole batch, the vectors that come back are
turned into pairs correctly, and an encoder that fails or answers the wrong
shape raises rather than returning an empty result that reads like "no
duplicates found".

What they do not prove: that a real encoder puts the right records close
together. That is why this snippet is declared `verification: stubbed` on the
entry, and why the page says so next to the code.
"""

import time
from pathlib import Path

import pytest

import n0
import n1
from _harness.fake_model import FakeEncoder
from n2 import MODEL_NAME, EncodingFailed, find_duplicates, normalise, record_text

LETTERS = "abcdefghijklmnopqrstuvwxyz"

CUSTOMERS = [
    {"name": "Jean Dupont", "address": "12 rue des Lilas", "postcode": "75011", "city": "Paris"},
    {"name": "Dupont Jean", "address": "12 rue des Lilas", "postcode": "75011", "city": "Paris"},
    {"name": "Marie Martin", "address": "5 avenue Victor Hugo", "postcode": "69003", "city": "Lyon"},
]

# A catalogue: one product entered twice in two different wordings, and a
# third product that differs from the first by one character.
CATALOGUE = [
    {"name": "Câble HDMI 2 m", "brand": "Belkin"},
    {"name": "HDMI lead, 2 metres, black", "brand": "Belkin"},
    {"name": "Câble HDMI 3 m", "brand": "Belkin"},
]


def encoder():
    # Wide enough that two different words never land in the same dimension.
    return FakeEncoder(dimensions=256)


class TruncatedEncoder(FakeEncoder):
    """A model that silently drops the last item of a batch."""

    def encode(self, texts):
        return super().encode(texts)[:-1]


class PaddedEncoder(FakeEncoder):
    """A model that answers one vector too many."""

    def encode(self, texts):
        vectors = super().encode(texts)
        return vectors + [vectors[-1]]


class BrokenEncoder:
    """A model that cannot be run at all."""

    def encode(self, texts):
        raise RuntimeError("out of memory while loading the model")


class GivenVectors:
    """A model whose vectors are given, to exercise what the snippet does with a bad answer."""

    def __init__(self, vectors):
        self.vectors = vectors

    def encode(self, texts):
        return self.vectors


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_cable_hdmi_2_m_est_plus_proche_de_3_m_que_de_la_meme_reference_en_anglais():
    """
    breaking_point : « « Câble HDMI 2 m » est plus proche de « Câble HDMI 3 m » que
    de la même référence écrite « HDMI lead, 2 metres, black » ». Le double local
    écrit ces vecteurs : ce que ferait un vrai encodeur n'est pas testé ici.
    """
    scores = {(i, j): s for i, j, s in find_duplicates(CATALOGUE, encoder=encoder(), threshold=0.0)}
    assert scores[(0, 2)] > scores[(0, 1)]


def test_point_de_rupture_au_seuil_par_defaut_les_deux_cables_differents_sont_rapproches_et_le_vrai_doublon_rate():
    """breaking_point : « au seuil par défaut, l'extrait rapproche les deux câbles différents et rate le vrai doublon »."""
    found = [(i, j) for i, j, _ in find_duplicates(CATALOGUE, encoder=encoder())]
    assert found == [(0, 2)]
    # Witness: the customer file, where the duplicate shares its words, is found.
    assert find_duplicates(CUSTOMERS, encoder=encoder()) == [(0, 1, 1.0)]


# ---------------------------------------------------------------------------
# Autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_trouve_la_paire_en_doublon():
    """name : « Encodeur de phrases auto-hébergé, comparaison par cosinus »."""
    assert find_duplicates(CUSTOMERS, encoder=encoder()) == [(0, 1, 1.0)]


def test_encode_tout_le_fichier_en_un_seul_appel_groupe():
    """commentaire : « One batched call »."""
    fake = encoder()
    find_duplicates(CUSTOMERS, encoder=fake)
    assert fake.calls == [[record_text(record) for record in CUSTOMERS]]


def test_les_fiches_sont_normalisees_de_la_meme_facon_a_chaque_niveau():
    for text in ("Jean DUPÔNT", "  Société-Générale,  Paris ", "Câble HDMI 2 m"):
        assert normalise(text) == n0.normalise(text) == n1.normalise(text)


def test_un_fichier_trop_petit_pour_une_paire_n_atteint_jamais_le_modele():
    fake = encoder()
    assert find_duplicates([CUSTOMERS[0]], encoder=fake) == []
    assert find_duplicates([], encoder=fake) == []
    assert fake.calls == []


def test_le_seuil_est_a_vous_et_toutes_les_paires_sont_comparees():
    """verdict_rationale : « les deux autres comparent, dans le pire des cas, toutes les paires »."""
    loose = find_duplicates(CUSTOMERS, encoder=encoder(), threshold=0.0)
    assert [(i, j) for i, j, _ in loose] == [(0, 1), (0, 2), (1, 2)]


def test_des_fiches_vides_ne_divisent_pas_par_zero():
    blanks = [{"name": "", "city": ""}, {"name": "", "city": ""}]
    assert find_duplicates(blanks, encoder=encoder(), threshold=0.0) == [(0, 1, 0.0)]


def test_un_lot_tronque_ou_trop_long_leve_plutot_que_perdre_une_fiche():
    """Test docstring : « an encoder that […] answers the wrong shape raises rather than returning an empty result »."""
    with pytest.raises(EncodingFailed):
        find_duplicates(CUSTOMERS, encoder=TruncatedEncoder(dimensions=256))
    with pytest.raises(EncodingFailed):
        find_duplicates(CUSTOMERS, encoder=PaddedEncoder(dimensions=256))


def test_un_modele_qui_ne_tourne_pas_leve():
    """EncodingFailed : « The encoder could not be run »."""
    with pytest.raises(EncodingFailed):
        find_duplicates(CUSTOMERS, encoder=BrokenEncoder())


@pytest.mark.xfail(
    strict=True,
    reason=(
        "DÉFAUT : des vecteurs de dimensions différentes, ou contenant NaN, ne lèvent "
        "pas : Python tronque le produit scalaire (zip) et rend un score faux, NaN "
        "fait disparaître la paire en silence ; exactement le « résultat vide qui se "
        "lit comme aucun doublon » que le test annonce éviter"
    ),
)
def test_defaut_des_vecteurs_de_mauvaise_forme_levent():
    for vectors in ([[1.0, 0.0, 0.0], [1.0, 0.0]], [[float("nan"), 0.0], [1.0, 0.0]]):
        with pytest.raises(EncodingFailed):
            find_duplicates([{"a": "x"}, {"a": "y"}], encoder=GivenVectors(vectors), threshold=0.0)


def test_l_encodeur_par_defaut_est_multilingue_et_n_est_charge_que_sans_double():
    """commentaire : « A multilingual model » ; « The encoder is a parameter with a real default »."""
    assert MODEL_NAME == "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    source = Path(__file__).with_name("n2.py").read_text(encoding="utf-8")
    assert "SentenceTransformer(MODEL_NAME)" in source and ".encode(texts)" in source


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_mille_fiches_dans_une_borne_large():
    records = [{"name": f"Client {i} {LETTERS[i % 26]}{LETTERS[(i * 7) % 26]}", "city": "Paris"} for i in range(1000)]
    debut = time.perf_counter()
    find_duplicates(records, encoder=FakeEncoder(dimensions=32))
    assert time.perf_counter() - debut < 60


def test_production_accents_decomposes_espaces_insecables_et_casse_partent_normalises():
    fake = encoder()
    find_duplicates([{"name": "Jean\u00a0DUPO\u0302NT"}, {"name": "Jean Dupont"}], encoder=fake)
    assert fake.calls == [["jean dupont", "jean dupont"]]


def test_production_des_fiches_identiques_sortent_au_seuil_un():
    same = [CUSTOMERS[0], dict(CUSTOMERS[0])]
    assert find_duplicates(same, encoder=encoder(), threshold=1.0) == [(0, 1, 1.0)]
