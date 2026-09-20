import json
import shutil
import subprocess
import time
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker

from n0 import MAX_ERRORS, validate_import

ICI = Path(__file__).parent

# Le contrat d'un import de factures : ce qu'une entreprise écrit vraiment.
SCHEMA = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "required": ["reference", "montant", "date"],
    "additionalProperties": False,
    "properties": {
        "reference": {"type": "string", "pattern": "^FA-[0-9]{6}$"},
        "montant": {"type": "number", "minimum": 0},
        "date": {"type": "string", "format": "date"},
        "client": {"type": "string"},
    },
}

# Le même contrat, avec le montant exprimé comme un multiple d'un centime.
SCHEMA_CENTIMES = {"type": "number", "multipleOf": 0.01}
SCHEMA_ENTIER = {"type": "integer", "minimum": 0}

BANALE = {"reference": "FA-000123", "montant": 1250.0, "date": "2026-01-12",
          "client": "Boulangerie Martin"}


def lot(nombre: int, mauvais=()) -> dict:
    """Un fichier d'import : un tableau d'enregistrements, dont certains faux."""
    enregistrements = []
    for i in range(nombre):
        ligne = dict(BANALE, reference="FA-%06d" % i)
        if i in mauvais:
            ligne["montant"] = "1 250,00"
        enregistrements.append(ligne)
    return enregistrements


SCHEMA_LOT = {"type": "array", "items": SCHEMA}


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_un_multiple_dun_centime_refuse_des_montants_justes():
    """
    « « multipleOf: 0.01 », la façon naturelle d'écrire un montant en euros et
    centimes, refuse 1 363 des 10 000 montants de 0,00 à 99,99 — dont 19,99 et
    4,35 — parce qu'un nombre JSON est un flottant binaire. »
    """
    montants = [round(i / 100, 2) for i in range(10_000)]
    refuses = [m for m in montants if not validate_import(m, SCHEMA_CENTIMES)["valid"]]
    assert len(refuses) == 1_363
    for montant in (19.99, 4.35, 0.29, 1234.56):
        assert validate_import(montant, SCHEMA_CENTIMES)["valid"] is False, montant
    # Et il en accepte d'autres, qui n'ont rien de différent : 12,37 passe.
    assert validate_import(12.37, SCHEMA_CENTIMES)["valid"] is True


def test_point_de_rupture_temoin_le_meme_montant_en_centimes_entiers_passe():
    """« Le témoin : les mêmes 10 000 montants, écrits en centimes entiers, passent tous. »"""
    refuses = [i for i in range(10_000) if not validate_import(i, SCHEMA_ENTIER)["valid"]]
    assert refuses == []


# ---------------------------------------------------------------------------
# Les autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_le_format_est_inerte_tant_quon_ne_lallume_pas():
    """
    Docstring : « `format` is an annotation, not an assertion. Left as the
    standard leaves it, "format": "date" accepts « 12/01/2026 » et
    « 2026-02-30 » without a word. »
    """
    schema_date = {"type": "string", "format": "date"}
    eteint = Draft202012Validator(schema_date)
    allume = Draft202012Validator(schema_date, format_checker=FormatChecker())
    for ecrit in ("12/01/2026", "2026-02-30"):
        assert eteint.is_valid(ecrit) is True, ecrit
        assert allume.is_valid(ecrit) is False, ecrit
        # L'extrait, lui, l'allume.
        assert validate_import(ecrit, schema_date)["valid"] is False, ecrit
    # Témoin : une date bien écrite passe des deux côtés.
    assert validate_import("2026-01-12", schema_date)["valid"] is True


def test_toutes_les_erreurs_sont_rendues_pas_seulement_la_premiere():
    """Docstring : « every error is collected »."""
    rapport = validate_import({"reference": "FA-12", "montant": "x", "date": "12/01/2026"}, SCHEMA)
    assert rapport["error_count"] == 3
    assert [e["rule"] for e in rapport["errors"]] == ["format", "type", "pattern"]
    assert [e["path"] for e in rapport["errors"]] == ["/date", "/montant", "/reference"]


def test_chaque_erreur_porte_un_chemin_et_le_nom_dune_regle():
    """Docstring : « the path and the rule are what your code should branch on »."""
    rapport = validate_import(lot(3, mauvais={1}), SCHEMA_LOT)
    assert rapport["errors"] == [
        {"path": "/1/montant", "rule": "type", "message": "'1 250,00' is not of type 'number'"}]


def test_les_erreurs_sont_rangees_par_place_dans_le_document():
    """
    Commentaire : « An index sorts as a number, so record 10 comes after record
    2 and not after record 1 as a string comparison would have it. »
    """
    rapport = validate_import(lot(20, mauvais={2, 10, 1}), SCHEMA_LOT)
    assert [e["path"] for e in rapport["errors"]] == ["/1/montant", "/2/montant", "/10/montant"]


def test_au_dela_du_plafond_le_compte_est_rendu_et_le_drapeau_leve():
    """Docstring : « capped, and the report says how many were left out »."""
    grand = lot(MAX_ERRORS + 50, mauvais=set(range(MAX_ERRORS + 50)))
    rapport = validate_import(grand, SCHEMA_LOT)
    assert rapport["error_count"] == MAX_ERRORS + 50
    assert len(rapport["errors"]) == MAX_ERRORS
    assert rapport["truncated"] is True
    # Sous le plafond, rien n'est tronqué.
    petit = validate_import(lot(3, mauvais={0}), SCHEMA_LOT)
    assert petit["truncated"] is False


def test_un_schema_inutilisable_est_une_raison_pas_une_exception():
    """
    Commentaire : « a rule the standard does not define — « objet » for
    « object » — would otherwise only surface as an exception in the middle of
    a file ».
    """
    for mauvais in ({"type": "objet"}, "pas un schéma", None, {"required": "reference"}):
        rapport = validate_import(BANALE, mauvais)
        assert rapport["valid"] is False
        assert rapport["reason"] == "this schema is not usable"
    # Témoin : le schéma de la fiche est utilisable.
    assert validate_import(BANALE, SCHEMA)["reason"] is None


def test_un_champ_mal_orthographie_est_attrape_parce_que_le_schema_est_ferme():
    """
    `additionalProperties: false` est ce qui fait la différence entre un champ
    perdu en silence et une erreur nommée.
    """
    avec_faute = dict(BANALE, montnat=1250.0)
    rapport = validate_import(avec_faute, SCHEMA)
    assert rapport["valid"] is False
    assert rapport["errors"][0]["rule"] == "additionalProperties"
    # Le même document contre un schéma ouvert : accepté, et le champ est perdu.
    ouvert = dict(SCHEMA)
    ouvert.pop("additionalProperties")
    assert validate_import(avec_faute, ouvert)["valid"] is True


def test_le_schema_compile_est_garde_et_le_cache_est_plafonne():
    """
    Commentaire : « Compiling a schema costs far more than checking one
    document against it ». Mesuré ici sur le même document et le même schéma,
    à un titre près — ce qui suffit à en faire un autre schéma à compiler.
    """
    from n0 import MAX_COMPILED, _COMPILED

    validate_import(BANALE, SCHEMA)  # une passe de chauffe
    garde = time.perf_counter()
    for _ in range(1_000):
        validate_import(BANALE, SCHEMA)
    garde = time.perf_counter() - garde

    recompile = time.perf_counter()
    for i in range(1_000):
        validate_import(BANALE, dict(SCHEMA, title="schéma %d" % i))
    recompile = time.perf_counter() - recompile

    assert garde * 5 < recompile
    # Et le cache ne grossit pas avec le nombre de schémas vus.
    assert len(_COMPILED) <= MAX_COMPILED + 1


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_entree_banale_une_facture_dun_export_comptable():
    """T5 : l'entrée ordinaire du public visé."""
    assert validate_import(BANALE, SCHEMA) == {
        "valid": True, "errors": [], "error_count": 0, "truncated": False, "reason": None}


def test_production_entree_vide():
    assert validate_import({}, SCHEMA)["error_count"] == 3
    assert validate_import([], SCHEMA_LOT)["valid"] is True
    assert validate_import(None, SCHEMA)["valid"] is False


def test_production_entree_tres_grande_et_terminaison_rapide():
    """Dix mille enregistrements, dont un faux : le fichier d'un import réel."""
    grand = lot(10_000, mauvais={4_321})
    debut = time.perf_counter()
    rapport = validate_import(grand, SCHEMA_LOT)
    assert time.perf_counter() - debut < 60.0
    assert rapport["error_count"] == 1
    assert rapport["errors"][0]["path"] == "/4321/montant"


def test_production_encodages_inattendus():
    # Accents, emoji, largeur nulle, marque d'ordre des octets dans une valeur :
    # ce sont des chaînes valides, et le schéma ne dit rien de plus.
    for client in ("Boulangerie Martin", "Café de la Gare", "🥖", "﻿Martin", "a​b"):
        assert validate_import(dict(BANALE, client=client), SCHEMA)["valid"] is True, client
    # Une clé accentuée n'est pas la clé attendue, et le schéma fermé le dit.
    assert validate_import({**BANALE, "réference": "x"}, SCHEMA)["valid"] is False


def test_production_valeurs_aux_limites():
    # Exactement le minimum, juste en dessous.
    assert validate_import(dict(BANALE, montant=0), SCHEMA)["valid"] is True
    assert validate_import(dict(BANALE, montant=-0.01), SCHEMA)["valid"] is False
    # Un entier là où un nombre est attendu : la norme dit que c'en est un.
    assert validate_import(dict(BANALE, montant=1250), SCHEMA)["valid"] is True
    # Un booléen n'en est pas un, bien que Python le range parmi les entiers.
    assert validate_import(dict(BANALE, montant=True), SCHEMA)["valid"] is False
    # Exactement le plafond d'erreurs.
    au_plafond = validate_import(lot(MAX_ERRORS, mauvais=set(range(MAX_ERRORS))), SCHEMA_LOT)
    assert (au_plafond["error_count"], au_plafond["truncated"]) == (MAX_ERRORS, False)


def test_production_un_enregistrement_faux_nempeche_pas_de_voir_les_autres():
    """T8 : une donnée sale ne fait pas tomber le lot, et les autres sont vues."""
    rapport = validate_import(lot(5, mauvais={0, 4}), SCHEMA_LOT)
    assert [e["path"] for e in rapport["errors"]] == ["/0/montant", "/4/montant"]
    assert rapport["error_count"] == 2


def test_production_la_validation_tient_la_classe_de_latence_annoncee():
    """
    latency « ~10 ms » : mille validations d'un enregistrement sous une borne
    d'effondrement large. Le coût est celui de la compilation du schéma, qui se
    refait à chaque appel dans cet extrait.
    """
    debut = time.perf_counter()
    for _ in range(1_000):
        validate_import(BANALE, SCHEMA)
    assert time.perf_counter() - debut < 60.0


# ---------------------------------------------------------------------------
# Parité entre les deux langages
# ---------------------------------------------------------------------------


def test_python_et_javascript_rendent_le_meme_rapport_sauf_le_texte_du_message():
    """
    Docstring : « The wording of the message belongs to the library and differs
    between the two; the path and the rule are what your code should branch on. »
    """
    node = shutil.which("node")
    assert node, "node est requis pour comparer les deux implémentations"
    cas = [
        (BANALE, SCHEMA),
        ({"reference": "FA-12", "montant": "x", "date": "12/01/2026"}, SCHEMA),
        (dict(BANALE, montnat=1), SCHEMA),
        (dict(BANALE, date="2026-02-30"), SCHEMA),
        (dict(BANALE, montant=-1), SCHEMA),
        ({}, SCHEMA),
        (None, SCHEMA),
        (lot(20, mauvais={2, 10, 1}), SCHEMA_LOT),
        (lot(3), SCHEMA_LOT),
        ([], SCHEMA_LOT),
        (19.99, SCHEMA_CENTIMES),
        (12.37, SCHEMA_CENTIMES),
        (1234.56, SCHEMA_CENTIMES),
        ("12/01/2026", {"type": "string", "format": "date"}),
        ("2026-01-12", {"type": "string", "format": "date"}),
        (BANALE, {"type": "objet"}),
    ]
    sans_message = lambda r: {**r, "errors": [{"path": e["path"], "rule": e["rule"]}
                                             for e in r["errors"]]}
    attendu = [sans_message(validate_import(doc, schema)) for doc, schema in cas]
    script = (
        f"import {{ validateImport }} from {json.dumps((ICI / 'n0.js').as_uri())};"
        "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{"
        "const r=JSON.parse(d).map(([doc,schema])=>validateImport(doc,schema));"
        "process.stdout.write(JSON.stringify(r.map(x=>({...x,"
        "errors:x.errors.map(e=>({path:e.path,rule:e.rule}))}))));});"
    )
    sortie = subprocess.run([node, "--input-type=module", "-e", script],
                            input=json.dumps(cas), capture_output=True,
                            text=True, timeout=120, check=True)
    assert json.loads(sortie.stdout) == attendu
