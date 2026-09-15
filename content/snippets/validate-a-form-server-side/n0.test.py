"""
Tests du niveau N0 : schéma déclaratif, un message d'erreur par champ.

Le schéma vit dans le test, pas dans l'extrait : c'est une donnée d'exemple, et
le test JavaScript déclare exactement le même, champ pour champ.
"""

import ast
import json
import time
import unicodedata
from pathlib import Path

import pytest

from n0 import check, validate

SCHEMA = {
    "email": {
        "required": True,
        "pattern": r"[^@\s]+@[^@\s]+\.[a-z]{2,}",
        "message": "is not a valid email address",
    },
    "display_name": {"required": True, "min": 2, "max": 30},
    "age": {"required": True, "type": "integer", "min": 18, "max": 130},
    "website": {"pattern": r"https?://\S+"},
}

VALID = {
    "email": "ada@example.com",
    "display_name": "Ada",
    "age": 36,
    "website": "https://example.com",
}


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_une_adresse_bien_formee_qui_n_existe_pas():
    """
    « Le test soumet `ada@no-such-mailbox.example` : la forme est correcte, le
    schéma accepte, et personne ne lit le courrier envoyé là » (existant, complété).
    """
    assert validate({**VALID, "email": "ada@no-such-mailbox.example"}, SCHEMA) == {}
    # Témoin : une adresse mal formée est refusée.
    assert validate({**VALID, "email": "ada.no-such-mailbox.example"}, SCHEMA) == {"email": "is not a valid email address"}


def test_point_de_rupture_un_pseudonyme_fait_de_deux_espaces_satisfait_la_longueur_minimale():
    """
    « Il soumet aussi un pseudonyme fait de deux espaces : `min` compte des
    caractères, une espace en est un, et le profil s'affiche vide » (existant, complété).
    """
    assert validate({**VALID, "display_name": "  "}, SCHEMA) == {}
    # Témoin : une seule espace, ou une lettre, restent sous le minimum.
    assert validate({**VALID, "display_name": " "}, SCHEMA) == {"display_name": "must be at least 2 characters"}
    assert validate({**VALID, "display_name": "A"}, SCHEMA) == {"display_name": "must be at least 2 characters"}


# ---------------------------------------------------------------------------
# Nom, docstring, commentaires, risques
# ---------------------------------------------------------------------------


def test_une_saisie_valide_passe():
    """Cas nominal (existant)."""
    assert validate(VALID, SCHEMA) == {}


def test_un_champ_facultatif_peut_etre_absent():
    """Existant."""
    assert validate({k: v for k, v in VALID.items() if k != "website"}, SCHEMA) == {}


def test_une_erreur_par_champ_fautif_qui_nomme_le_champ():
    """« the answer is a mapping of field name to message, never a boolean » (existant)."""
    errors = validate({"email": "ada.example.com", "display_name": "A", "age": 12, "website": "nope"}, SCHEMA)
    assert errors == {
        "email": "is not a valid email address",
        "display_name": "must be at least 2 characters",
        "age": "must be at least 18",
        "website": "is not in the expected format",
    }


def test_un_champ_obligatoire_absent_est_nomme():
    """Existant."""
    assert validate({}, SCHEMA) == {"email": "is required", "display_name": "is required", "age": "is required"}


def test_cle_absente_none_et_chaine_vide_sont_la_meme_chose():
    """« A missing key, an explicit None and an empty string are the same thing here » (existant, complété)."""
    for empty in ({}, {"email": None}, {"email": ""}):
        assert validate({**{k: v for k, v in VALID.items() if k != "email"}, **empty}, SCHEMA) == {"email": "is required"}


def test_les_verifications_s_arretent_a_la_premiere_regle_enfreinte():
    """« one message per field: checks stop at the first broken rule » : type avant bornes, bornes avant motif (existant, complété)."""
    assert validate({**VALID, "age": "12"}, SCHEMA) == {"age": "must be of type integer"}
    assert check("x@", {"min": 5, "pattern": r"[^@\s]+@[^@\s]+\.[a-z]{2,}"}) == "must be at least 5 characters"


def test_une_valeur_hors_bornes_et_les_bornes_incluses():
    """« For a string the bounds read as a length; for a number, as a value » (existant, complété : limites)."""
    assert validate({**VALID, "age": 150}, SCHEMA) == {"age": "must be at most 130"}
    assert validate({**VALID, "display_name": "A" * 31}, SCHEMA) == {"display_name": "must be at most 30 characters"}
    for age, expected in ((17, {"age": "must be at least 18"}), (18, {}), (130, {}), (131, {"age": "must be at most 130"})):
        assert validate({**VALID, "age": age}, SCHEMA) == expected
    for name, expected in (("AB", {}), ("A" * 30, {})):
        assert validate({**VALID, "display_name": name}, SCHEMA) == expected


def test_un_booleen_n_est_pas_un_entier():
    """Commentaire : « `bool` is excluded from `integer` on purpose: in Python a boolean *is* an int, and a checkbox is not an age » (existant)."""
    assert validate({**VALID, "age": True}, SCHEMA) == {"age": "must be of type integer"}
    assert validate({**VALID, "age": 36.5}, SCHEMA) == {"age": "must be of type integer"}
    assert validate({**VALID, "age": float("nan")}, SCHEMA) == {"age": "must be of type integer"}


def test_le_motif_couvre_tout_le_champ():
    """`re.fullmatch` : un fragment conforme ne suffit pas."""
    assert validate({**VALID, "website": "see https://example.com"}, SCHEMA) == {"website": "is not in the expected format"}
    assert check("ab", {"pattern": "a|ab"}) is None


def test_les_messages_ne_contiennent_jamais_la_valeur_saisie():
    """regulatory : « Les messages renvoyés nomment le champ et la règle enfreinte, jamais la valeur saisie »."""
    secret = "S3cr3t-Value"
    submissions = [
        {"email": secret, "display_name": secret * 5, "age": secret, "website": secret},
        {"email": secret + "@x", "display_name": secret[:1], "age": 7, "website": "ftp://" + secret},
    ]
    for data in submissions:
        errors = validate(data, SCHEMA)
        assert errors and all(secret not in message and "7" not in message for message in errors.values())


def test_le_schema_est_une_donnee():
    """« the schema is data, not code. It can be written next to the form » : il passe par JSON sans perte."""
    assert validate(VALID, json.loads(json.dumps(SCHEMA))) == {}


def test_n0_est_deterministe_et_n_emploie_que_la_bibliotheque_standard():
    """« Deterministic, standard library only » ; risks `deterministic: true`, `vendor_lock: none` ; scenario « la même saisie reçoive deux fois la même réponse »."""
    bad = {"email": "x", "display_name": "", "age": 3}
    assert all(validate(bad, SCHEMA) == validate(bad, SCHEMA) for _ in range(20))
    source = ast.parse(Path(__file__).with_name("n0.py").read_text(encoding="utf-8"))
    assert {a.name for n in ast.walk(source) if isinstance(n, ast.Import) for a in n.names} == {"re"}


def test_un_validateur_tient_en_quarante_lignes():
    """« a validator worth having fits in forty lines » : 29 lignes de code hors docstrings et commentaires."""
    source = Path(__file__).with_name("n0.py").read_text(encoding="utf-8")
    tree = ast.parse(source)
    docstrings = set()
    for node in ast.walk(tree):
        if isinstance(node, (ast.Module, ast.FunctionDef)) and ast.get_docstring(node) is not None:
            docstrings.update(range(node.body[0].lineno, node.body[0].end_lineno + 1))
    lines = [i for i, line in enumerate(source.splitlines(), 1) if line.strip() and not line.strip().startswith("#") and i not in docstrings]
    assert len(lines) <= 40


def test_une_validation_prend_moins_d_une_milliseconde():
    """latency `<1 ms`."""
    best = float("inf")
    for _ in range(50):
        start = time.perf_counter()
        validate(VALID, SCHEMA)
        best = min(best, time.perf_counter() - start)
    assert best < 0.001


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_schema_vide_et_valeurs_d_un_autre_type():
    assert validate(VALID, {}) == {}
    for value in (["ada@example.com"], {"a": 1}, 42, False):
        assert validate({**VALID, "email": value}, SCHEMA) == {"email": "must be of type string"}
    assert validate({**VALID, "display_name": []}, SCHEMA) == {"display_name": "must be of type string"}


def test_production_une_saisie_enorme_termine_vite():
    """Un million de caractères dans chaque champ texte, et des motifs à retour arrière."""
    huge = {
        "email": "a@" + "a." * 500_000 + "!",
        "display_name": "x" * 1_000_000,
        "age": 10**100,
        "website": "https://" + "a" * 1_000_000 + " ",
    }
    start = time.perf_counter()
    errors = validate(huge, SCHEMA)
    assert time.perf_counter() - start < 2
    assert set(errors) == {"email", "display_name", "age", "website"}


def test_production_encodage_espaces_insecables_et_casse():
    """Précision : une espace de bord ou un domaine en majuscules sont refusés par le motif du test, pas corrigés."""
    assert validate({**VALID, "email": " ada@example.com "}, SCHEMA) == {"email": "is not a valid email address"}
    assert validate({**VALID, "email": "ada@EXAMPLE.COM"}, SCHEMA) == {"email": "is not a valid email address"}
    assert validate({**VALID, "email": "ada @example.com"}, SCHEMA) == {"email": "is not a valid email address"}
    assert validate({**VALID, "display_name": "﻿Ada 🙂"}, SCHEMA) == {}


@pytest.mark.xfail(
    strict=True,
    reason="DÉFAUT : « at least N characters » compte des points de code : « é » décomposé (NFD) en vaut deux, et un "
    "pseudonyme de 16 lettres accentuées est refusé à 30 « characters » selon la forme Unicode envoyée par le navigateur",
)
def test_defaut_les_bornes_comptent_des_caracteres_percus():
    assert validate({**VALID, "display_name": unicodedata.normalize("NFD", "é" * 16)}, SCHEMA) == {}
    assert validate({**VALID, "display_name": "🙂"}, SCHEMA) == {"display_name": "must be at least 2 characters"}


@pytest.mark.xfail(
    strict=True,
    reason="DÉFAUT : « compared with the JavaScript one that guards the same form in the browser » ; le même motif n'a "
    "pas le même sens : `\\d` Python accepte « ١٢٣٤٥ » comme cinq chiffres, `\\w` JavaScript refuse « Zoé »",
)
def test_defaut_un_meme_motif_a_le_meme_sens_cote_navigateur_et_cote_serveur():
    assert check("١٢٣٤٥", {"pattern": r"\d{5}"}) == "is not in the expected format"
    assert check("Zoé", {"pattern": r"\w+"}) is None


@pytest.mark.xfail(
    strict=True,
    reason="DÉFAUT : un champ absent du schéma (« is_admin »: true) passe sans un mot ; `validate` rend {} et "
    "l'appelant qui enregistre la saisie enregistre aussi ce champ (assignation de masse)",
)
def test_defaut_un_champ_hors_schema_est_signale():
    assert validate({**VALID, "is_admin": True}, SCHEMA) != {}


def test_production_un_motif_sur_un_entier_fait_lever_en_python():
    """Précision : `re.fullmatch` sur un entier lève TypeError ; JavaScript convertit l'entier en texte."""
    with pytest.raises(TypeError):
        check(36, {"type": "integer", "pattern": r"\d+"})
