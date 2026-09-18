"""
Tests du niveau N0 : schéma déclaratif, un message d'erreur par champ.

Le schéma vit dans le test, pas dans l'extrait : c'est une donnée d'exemple, et
le test JavaScript déclare exactement le même, champ pour champ.
"""

import ast
import json
import sys
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


def test_les_blancs_de_bord_tombent_avant_tout_controle():
    """
    docstring : « leading and trailing whitespace comes off every string before
    anything is checked, and a string left empty by that is treated as absent ».
    Les trois cas que cela règle, et qu'une règle absente laissait passer.
    """
    # Un champ obligatoire rempli d'espaces est vide, donc manquant.
    assert validate({**VALID, "display_name": "  "}, SCHEMA) == {"display_name": "is required"}
    # Une adresse que la saisie semi-automatique a fait précéder d'une espace passe.
    assert validate({**VALID, "email": " ada@example.com "}, SCHEMA) == {}
    # Et la valeur retenue est bien la valeur nettoyée : deux lettres entourées
    # d'espaces font deux caractères, pas quatre.
    assert validate({**VALID, "display_name": " A "}, SCHEMA) == {"display_name": "must be at least 2 characters"}
    assert validate({**VALID, "display_name": " Ad "}, SCHEMA) == {}
    # Ce qui n'est pas une chaîne n'est pas touché.
    assert validate({**VALID, "age": 36}, SCHEMA) == {}


def test_un_pseudonyme_fait_de_caracteres_invisibles_passe_la_longueur_minimale():
    """
    breaking_point : « un pseudonyme fait de caractères de largeur nulle ».
    `strip` ne retire ni U+200B ni U+FEFF, et `min` les compte comme des
    caractères : le profil s'affiche vide.
    """
    invisible = "\u200b\u200b"
    assert validate({**VALID, "display_name": invisible}, SCHEMA) == {}
    assert len(invisible.strip()) == 2


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
    imported = {a.name.split(".")[0] for n in ast.walk(source) if isinstance(n, ast.Import) for a in n.names}
    imported |= {(n.module or "").split(".")[0] for n in ast.walk(source) if isinstance(n, ast.ImportFrom)}
    # Le nom des modules n'est pas l'affirmation : « standard library only » l'est.
    assert imported and imported <= sys.stdlib_module_names


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
    # « A field the schema does not declare is refused, not ignored » : un schéma
    # vide ne déclare rien, donc il refuse tout, champ par champ.
    assert validate(VALID, {}) == {field: "is not a field of this form" for field in VALID}
    for value in (["ada@example.com"], {"a": 1}, 42, False):
        assert validate({**VALID, "email": value}, SCHEMA) == {"email": "must be of type string"}
    assert validate({**VALID, "display_name": []}, SCHEMA) == {"display_name": "must be of type string"}


def test_production_une_saisie_enorme_termine_vite():
    """Un million de caractères dans chaque champ texte, et des motifs à retour arrière."""
    huge = {
        "email": "a@" + "a." * 500_000 + "!",
        "display_name": "x" * 1_000_000,
        "age": 10**100,
        # Sans les deux barres obliques : ce n'est pas l'espace de bord qui le
        # refuse, puisqu'elle tombe désormais, c'est le motif.
        "website": "https:/" + "a" * 1_000_000 + " ",
    }
    start = time.perf_counter()
    errors = validate(huge, SCHEMA)
    assert time.perf_counter() - start < 2
    assert set(errors) == {"email", "display_name", "age", "website"}


def test_production_encodage_espaces_insecables_et_casse():
    """Précision : un domaine en majuscules est refusé par le motif du test, pas corrigé ; les blancs de bord, eux, tombent."""
    assert validate({**VALID, "email": " ada@example.com "}, SCHEMA) == {}
    assert validate({**VALID, "email": "ada@EXAMPLE.COM"}, SCHEMA) == {"email": "is not a valid email address"}
    assert validate({**VALID, "email": "ada @example.com"}, SCHEMA) == {"email": "is not a valid email address"}
    assert validate({**VALID, "display_name": "﻿Ada 🙂"}, SCHEMA) == {}


def test_defaut_les_bornes_comptent_des_caracteres_percus():
    assert validate({**VALID, "display_name": unicodedata.normalize("NFD", "é" * 16)}, SCHEMA) == {}
    assert validate({**VALID, "display_name": "🙂"}, SCHEMA) == {"display_name": "must be at least 2 characters"}


def test_un_raccourci_de_motif_n_a_pas_le_meme_sens_des_deux_cotes():
    """
    docstring : « the shorthands for a digit and a word character reach beyond
    ASCII in Python and stop at it in JavaScript, so write [0-9] and [A-Za-z] ».
    Voici les deux moitiés de cette phrase, mesurées.
    """
    # `\d` accepte ici les chiffres arabes-indiens ; en JavaScript, il les refuse.
    assert check("١٢٣٤٥", {"pattern": r"\d{5}"}) is None
    # `[0-9]` les refuse des deux côtés : c'est le conseil de la docstring.
    assert check("١٢٣٤٥", {"pattern": r"[0-9]{5}"}) == "is not in the expected format"
    assert check("12345", {"pattern": r"[0-9]{5}"}) is None
    # Et le prix de ce conseil, dit dans la docstring : `[A-Za-z]` refuse « Zoé »,
    # que `\w` accepte ici — et refuse en JavaScript. Pour les lettres, la parité
    # se tient avec une classe Unicode explicite, `\p{L}`, hors de `re`.
    assert check("Zoé", {"pattern": r"\w+"}) is None
    assert check("Zoé", {"pattern": r"[A-Za-z]+"}) == "is not in the expected format"


def test_un_champ_hors_schema_est_signale():
    assert validate({**VALID, "is_admin": True}, SCHEMA) != {}


def test_production_un_motif_sur_un_entier_lit_l_entier_comme_du_texte():
    """`check` compose le texte avant de l'apparier : « 36 » correspond à `[0-9]+`, comme en JavaScript."""
    assert check(36, {"type": "integer", "pattern": r"[0-9]+"}) is None
    assert check(36, {"type": "integer", "pattern": r"[0-9]{3}"}) == "is not in the expected format"
