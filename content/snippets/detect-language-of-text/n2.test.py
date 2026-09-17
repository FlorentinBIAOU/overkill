"""
Ces tests injectent un double local au lieu de charger CLD3.

Ce qu'ils prouvent : ce que l'extrait fait de la réponse du modèle — le refus
sur « und », sur `is_reliable` faux, sous le seuil, sur un texte vide ; la
panne nommée ; et l'extrait envoyé, pas le message entier.

Ce qu'ils ne prouvent pas : que CLD3 reconnaît une langue. Aucun test d'ici ne
le mesure, et la fiche ne l'affirme pas.
"""

import ast
from pathlib import Path
from types import SimpleNamespace

import pytest

import n2
from n2 import MAX_BYTES, MIN_BYTES, THRESHOLD, Cld3Identifier, IdentificationUnavailable, detect


class FakeIdentifier:
    """La surface de `gcld3.NNetLanguageIdentifier`, réduite à ce que l'extrait lit."""

    def __init__(self, language="fr", probability=0.99, is_reliable=True, fail=None):
        self.answer = {"language": language, "probability": probability, "is_reliable": is_reliable}
        self.fail = fail
        self.texts = []

    def find(self, text):
        self.texts.append(text)
        if self.fail is not None:
            raise self.fail
        return dict(self.answer)


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_le_code_rendu_est_celui_de_cld3_pas_le_votre():
    """
    breaking_point : « CLD3 answers in BCP-47 style, and tells Latin-script
    Hindi from Devanagari Hindi with "hi-Latn". A caller expecting "hi" gets a
    code it has never seen. »
    """
    assert detect("kaise ho", FakeIdentifier(language="hi-Latn")) == "hi-Latn"
    # Témoin : l'hindi en devanagari rend « hi », et les deux sont la même langue.
    assert detect("कैसे हो", FakeIdentifier(language="hi")) == "hi"


# ---------------------------------------------------------------------------
# Les autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_une_langue_sure_est_rendue():
    identifier = FakeIdentifier(language="fr", probability=0.99)
    assert detect("Bonjour, je voudrais annuler ma commande.", identifier) == "fr"
    assert identifier.texts == ["Bonjour, je voudrais annuler ma commande."]


def test_quatre_refus_et_ils_ne_sont_pas_le_meme_dit_quatre_fois():
    """
    docstring de detect : « None on four counts […] an empty text, the code
    CLD3 uses for "undetermined", its own `is_reliable` set to false, and a
    probability below the threshold ».
    """
    vide = FakeIdentifier()
    assert detect("", vide) is None and detect("   ", vide) is None
    assert vide.texts == []  # un texte vide ne coûte même pas un appel
    assert detect("xxxx", FakeIdentifier(language="und")) is None
    assert detect("xxxx", FakeIdentifier(is_reliable=False)) is None
    assert detect("xxxx", FakeIdentifier(probability=THRESHOLD - 1e-9)) is None
    # Limite : exactement au seuil, la réponse est rendue.
    assert detect("xxxx", FakeIdentifier(probability=THRESHOLD)) == "fr"


def test_les_deux_poignees_doivent_s_accorder():
    """docstring : « CLD3 also carries its own `is_reliable` […] both have to agree »."""
    assert detect("x", FakeIdentifier(probability=1.0, is_reliable=False)) is None
    assert detect("x", FakeIdentifier(probability=0.1, is_reliable=True)) is None
    assert detect("x", FakeIdentifier(probability=1.0, is_reliable=True)) == "fr"


def test_le_seuil_est_a_l_appelant():
    identifier = FakeIdentifier(probability=0.5)
    assert detect("x", identifier) is None
    assert detect("x", identifier, threshold=0.4) == "fr"


def test_une_panne_de_la_bibliotheque_est_nommee():
    with pytest.raises(IdentificationUnavailable):
        detect("x", FakeIdentifier(fail=RuntimeError("model not loaded")))


def test_une_reponse_sans_langue_est_inutilisable():
    class Muet:
        def find(self, text):
            return {"probability": 1.0, "is_reliable": True}

    with pytest.raises(IdentificationUnavailable, match="no language"):
        detect("x", Muet())


class FakeModule:
    """La surface de `gcld3`, réduite à ce que l'adaptateur appelle."""

    def __init__(self, language="fr", probability=0.99, is_reliable=True):
        self.answer = SimpleNamespace(language=language, probability=probability, is_reliable=is_reliable)
        self.built = []
        self.texts = []

    def NNetLanguageIdentifier(self, min_num_bytes, max_num_bytes):  # noqa: N802 - le nom du kit
        self.built.append((min_num_bytes, max_num_bytes))
        return self

    def FindLanguage(self, text):  # noqa: N802 - le nom du kit
        self.texts.append(text)
        return self.answer


def test_production_l_adaptateur_appelle_la_surface_du_vrai_kit():
    """
    docstring : « The real identifier, and the whole surface of the library
    this needs ». L'adaptateur sur un double à la forme de `gcld3` :
    `NNetLanguageIdentifier(min_num_bytes=…, max_num_bytes=…)`, puis
    `FindLanguage(text=…)` dont on lit `language`, `probability`, `is_reliable`.
    """
    module = FakeModule(language="hi-Latn", probability=0.81, is_reliable=True)
    identifier = Cld3Identifier(module=module)
    assert module.built == [(MIN_BYTES, MAX_BYTES)]
    assert identifier.find("kaise ho") == {
        "language": "hi-Latn",
        "probability": 0.81,
        "is_reliable": True,
    }
    assert module.texts == ["kaise ho"]
    # Et l'appelant peut changer le plancher en connaissance de cause.
    autre = FakeModule()
    Cld3Identifier(min_bytes=0, max_bytes=2000, module=autre)
    assert autre.built == [(0, 2000)]


def test_le_plancher_et_le_plafond_sont_ceux_de_la_bibliotheque():
    """
    commentaire : « The library's own defaults, read from its header: below 140
    bytes it returns "und", and it predicts on the first 700 bytes ». Les deux
    valeurs sont `kMinNumBytesToConsider` et `kMaxNumBytesToConsider` de
    `nnet_language_identifier.cc`, citées dans les sources de la fiche.
    """
    assert (MIN_BYTES, MAX_BYTES) == (140, 700)
    module = FakeModule()
    Cld3Identifier(module=module)
    assert module.built == [(140, 700)]


def test_l_identifiant_par_defaut_n_est_construit_qu_une_fois(monkeypatch):
    """docstring : « Build one, keep it, do not build one per message »."""
    built = []

    class Compteur:
        def __init__(self):
            built.append(1)

        def find(self, text):
            return {"language": "fr", "probability": 1.0, "is_reliable": True}

    monkeypatch.setattr(n2, "Cld3Identifier", Compteur)
    monkeypatch.setattr(n2, "_LOADED", None)
    assert detect("Bonjour, la réunion de lundi est reportée.") == "fr"
    assert detect("Bonjour, la réunion de mardi est reportée.") == "fr"
    assert built == [1]


def test_n2_n_importe_rien_hors_de_la_bibliotheque_standard_et_de_cld3():
    """Le chargement de `gcld3` est dans le constructeur : rien n'est importé sans lui."""
    source = ast.parse(Path(__file__).with_name("n2.py").read_text(encoding="utf-8"))
    top = {a.name.split(".")[0] for n in source.body if isinstance(n, ast.Import) for a in n.names}
    top |= {n.module.split(".")[0] for n in source.body if isinstance(n, ast.ImportFrom)}
    assert top == {"__future__"}


def test_le_client_par_defaut_est_la_vraie_bibliotheque(monkeypatch):
    """docstring : « In production it defaults to the real one above »."""
    monkeypatch.setattr(n2, "_LOADED", None)
    with pytest.raises(ModuleNotFoundError, match="gcld3"):
        detect("Bonjour")


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_un_message_tres_long_part_en_entier_et_le_budget_le_coupe():
    """Le plafond d'octets est dans la bibliothèque, pas dans l'extrait : rien n'est refusé."""
    identifier = FakeIdentifier()
    long_message = "Bonjour " * 20_000
    assert detect(long_message, identifier) == "fr"
    assert identifier.texts == [long_message]


def test_production_encodage_inattendu_et_emoji():
    identifier = FakeIdentifier()
    for text in ("Bonjour !", "été ﻿", "🎉 Bonjour 🎉"):
        assert detect(text, identifier) == "fr"


def test_production_une_probabilite_absente_est_lue_comme_nulle():
    class Partiel:
        def find(self, text):
            return {"language": "fr", "is_reliable": True}

    assert detect("x", Partiel()) is None
