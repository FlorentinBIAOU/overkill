import json
import shutil
import subprocess
import time
from pathlib import Path

from jsonschema import Draft202012Validator

from n0 import MAX_ERRORS, validate_request

ICI = Path(__file__).parent

# Le contrat d'une API de facturation, écrit comme on les écrit : un chemin
# exact à côté d'un chemin gabarité, des références internes, et un champ
# annulable à la façon d'OpenAPI 3.0.
DOCUMENT = {
    "openapi": "3.1.0",
    "info": {"title": "Facturation", "version": "1.0.0"},
    "paths": {
        "/factures": {
            "post": {
                "requestBody": {
                    "required": True,
                    "content": {"application/json": {
                        "schema": {"$ref": "#/components/schemas/Facture"}}},
                },
                "responses": {"201": {"description": "créée"}},
            },
        },
        "/factures/{id}": {
            "get": {"responses": {"200": {"description": "ok"}}},
            "put": {
                "requestBody": {"content": {"application/json": {
                    "schema": {"$ref": "#/components/schemas/Facture"}}}},
                "responses": {"200": {"description": "ok"}},
            },
        },
        "/factures/resume": {"get": {"responses": {"200": {"description": "ok"}}}},
    },
    "components": {
        "schemas": {
            "Facture": {
                "type": "object",
                "required": ["reference", "montant_ht", "tva", "montant_ttc"],
                "additionalProperties": False,
                "properties": {
                    "reference": {"type": "string", "pattern": "^FA-[0-9]{6}$"},
                    "montant_ht": {"type": "number", "minimum": 0},
                    "tva": {"type": "number", "minimum": 0},
                    "montant_ttc": {"type": "number", "minimum": 0},
                    "client": {"$ref": "#/components/schemas/Client"},
                },
            },
            "Client": {
                "type": "object",
                "required": ["nom"],
                "properties": {"nom": {"type": "string"},
                               "siren": {"type": "string", "nullable": True}},
            },
        },
    },
}

FACTURE = {"reference": "FA-000123", "montant_ht": 1000, "tva": 200, "montant_ttc": 1200}
FAUSSE_ARITHMETIQUE = {**FACTURE, "montant_ttc": 999}


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_une_facture_qui_ne_tombe_pas_juste_est_valide():
    """
    « Un contrat OpenAPI ne sait pas additionner : 1 000 et 200 de TVA
    déclarés avec un total de 999 passent, parce qu'aucun mot-clé de JSON
    Schema ne met deux champs en rapport. »
    """
    rapport = validate_request(DOCUMENT, "POST", "/factures", FAUSSE_ARITHMETIQUE)
    assert rapport["valid"] is True
    assert rapport["operation"] == "post /factures"
    # L'erreur est bien dans les nombres, pas dans la forme.
    assert (FAUSSE_ARITHMETIQUE["montant_ht"] + FAUSSE_ARITHMETIQUE["tva"]
            != FAUSSE_ARITHMETIQUE["montant_ttc"])


def test_point_de_rupture_temoin_une_faute_de_forme_est_bien_attrapee():
    """« Le témoin : le même montant écrit en texte est refusé, avec son chemin. »"""
    rapport = validate_request(DOCUMENT, "POST", "/factures", {**FACTURE, "montant_ht": "1000"})
    assert rapport["valid"] is False
    assert rapport["errors"] == [{"path": "/montant_ht", "rule": "type"}]


# ---------------------------------------------------------------------------
# Les autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_un_chemin_exact_gagne_sur_un_chemin_gabarite():
    """
    Docstring : « `/factures/resume` is the summary endpoint and not an invoice
    whose identifier happens to be « resume » ».
    """
    assert validate_request(DOCUMENT, "GET", "/factures/resume", None)["operation"] == (
        "get /factures/resume")
    assert validate_request(DOCUMENT, "GET", "/factures/42", None)["operation"] == (
        "get /factures/{id}")
    # Et l'opération matchée est rendue, pour qu'on voie d'où vient la réponse.
    assert validate_request(DOCUMENT, "PUT", "/factures/42", FACTURE)["operation"] == (
        "put /factures/{id}")


def test_une_reference_interne_se_resout_meme_imbriquee():
    """
    Docstring : « every `$ref: '#/components/schemas/…'` inside it resolves on
    its own, however deep ».
    """
    rapport = validate_request(DOCUMENT, "POST", "/factures", {**FACTURE, "client": {}})
    assert rapport["errors"] == [{"path": "/client", "rule": "required"}]
    assert validate_request(DOCUMENT, "POST", "/factures",
                            {**FACTURE, "client": {"nom": "Martin"}})["valid"] is True


def test_nullable_de_la_version_3_0_est_traduit_avant_validation():
    """
    Docstring : « `ajv` honours it, `jsonschema` ignores it and refuses a null
    the contract allows ». La traduction est faite ici, et le test montre les
    deux comportements.
    """
    avec_null = {**FACTURE, "client": {"nom": "Martin", "siren": None}}
    assert validate_request(DOCUMENT, "POST", "/factures", avec_null)["valid"] is True
    # Sans la traduction, la bibliothèque Python refuse ce que le contrat permet.
    brut = Draft202012Validator({**DOCUMENT, "$ref": "#/components/schemas/Client"})
    assert brut.is_valid({"nom": "Martin", "siren": None}) is False
    assert brut.is_valid({"nom": "Martin", "siren": "732829320"}) is True


def test_un_chemin_ou_une_methode_absents_sont_une_raison():
    """Un appel hors contrat est nommé, pas confondu avec un corps invalide."""
    assert validate_request(DOCUMENT, "POST", "/clients", {})["reason"] == (
        "no path in the document matches /clients")
    assert validate_request(DOCUMENT, "DELETE", "/factures/42", None)["reason"] == (
        "DELETE is not declared on /factures/{id}")


def test_une_operation_sans_corps_declare_refuse_un_corps():
    """
    Commentaire : « No body declared: anything sent is outside the contract ».
    """
    assert validate_request(DOCUMENT, "GET", "/factures/42", None)["valid"] is True
    refus = validate_request(DOCUMENT, "GET", "/factures/42", {"a": 1})
    assert refus["valid"] is False
    assert refus["reason"] == "no body is declared"


def test_toutes_les_erreurs_sont_rendues_rangees_par_chemin():
    rapport = validate_request(DOCUMENT, "POST", "/factures", {
        "reference": "FA-12", "montant_ht": -1, "tva": "x", "montant_ttc": 1, "extra": 1})
    assert rapport["error_count"] == 4
    assert rapport["errors"] == [
        {"path": "", "rule": "additionalProperties"},
        {"path": "/montant_ht", "rule": "minimum"},
        {"path": "/reference", "rule": "pattern"},
        {"path": "/tva", "rule": "type"},
    ]


def test_un_document_inutilisable_est_une_raison_pas_une_exception():
    casse = {"paths": {"/x": {"post": {"requestBody": {
        "content": {"application/json": {"schema": {"type": "objet"}}}}}}}}
    for mauvais in (None, "openapi", 42, casse):
        rapport = validate_request(mauvais, "POST", "/x", {})
        assert rapport["valid"] is False
        assert isinstance(rapport["reason"], str)


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_entree_banale_une_facture_postee_par_un_partenaire():
    """T5 : l'entrée ordinaire du public visé."""
    rapport = validate_request(DOCUMENT, "POST", "/factures",
                               {**FACTURE, "client": {"nom": "Boulangerie Martin",
                                                      "siren": "732829320"}})
    assert rapport == {"valid": True, "operation": "post /factures", "errors": [],
                       "error_count": 0, "truncated": False, "reason": None}


def test_production_entree_vide():
    vide = validate_request(DOCUMENT, "POST", "/factures", {})
    assert vide["valid"] is False
    assert vide["error_count"] == 4
    assert validate_request(DOCUMENT, "POST", "", {})["reason"].startswith("no path")


# Le même contrat, avec un point d'accès qui reçoit un lot de factures.
DOCUMENT_LOT = {
    **DOCUMENT,
    "paths": {**DOCUMENT["paths"], "/factures/lot": {"post": {"requestBody": {
        "content": {"application/json": {"schema": {
            "type": "array", "items": {"$ref": "#/components/schemas/Facture"}}}}}}}},
}


def test_production_entree_tres_grande_et_terminaison_rapide():
    """Dix mille champs en trop, puis trois cents factures fausses dans un lot."""
    enorme = {**FACTURE, **{f"champ{i}": i for i in range(10_000)}}
    debut = time.perf_counter()
    rapport = validate_request(DOCUMENT, "POST", "/factures", enorme)
    assert time.perf_counter() - debut < 60.0
    # Un seul échec : même place, même règle, quelle que soit la quantité.
    assert rapport["errors"] == [{"path": "", "rule": "additionalProperties"}]

    lot = [{**FACTURE, "montant_ht": "x"} for _ in range(300)]
    plafonne = validate_request(DOCUMENT_LOT, "POST", "/factures/lot", lot)
    assert plafonne["error_count"] == 300
    assert len(plafonne["errors"]) == MAX_ERRORS
    assert plafonne["truncated"] is True


def test_production_encodages_inattendus():
    for nom in ("Boulangerie Martin", "Café de la Gare", "🥖", "﻿Martin"):
        assert validate_request(DOCUMENT, "POST", "/factures",
                                {**FACTURE, "client": {"nom": nom}})["valid"] is True, nom
    # Un chemin accentué n'est pas le chemin déclaré.
    assert validate_request(DOCUMENT, "POST", "/factûres", FACTURE)["operation"] is None


def test_production_valeurs_aux_limites():
    # Exactement le minimum, juste en dessous.
    assert validate_request(DOCUMENT, "POST", "/factures",
                            {**FACTURE, "montant_ht": 0})["valid"] is True
    assert validate_request(DOCUMENT, "POST", "/factures",
                            {**FACTURE, "montant_ht": -0.01})["valid"] is False
    # Un chemin avec et sans barre oblique finale.
    assert validate_request(DOCUMENT, "GET", "/factures/42/", None)["operation"] == (
        "get /factures/{id}")
    # Un segment vide dans le chemin ne matche pas un gabarit à deux segments.
    assert validate_request(DOCUMENT, "GET", "/factures//42", None)["operation"] is None


def test_production_une_requete_fausse_nempeche_pas_de_valider_les_suivantes():
    """T8 : une requête hors contrat ne fait pas tomber le lot."""
    lot = [("POST", "/factures", FACTURE), ("POST", "/clients", {}),
           ("PUT", "/factures/7", FACTURE), ("GET", "/factures/7", None)]
    assert [validate_request(DOCUMENT, m, p, b)["valid"] for m, p, b in lot] == [
        True, False, True, True]


def test_production_la_validation_tient_la_classe_de_latence_annoncee():
    """latency « <1 ms » : mille validations sous une borne d'effondrement large."""
    validate_request(DOCUMENT, "POST", "/factures", FACTURE)
    debut = time.perf_counter()
    for _ in range(1_000):
        validate_request(DOCUMENT, "POST", "/factures", FACTURE)
    assert time.perf_counter() - debut < 60.0


def test_le_document_compile_est_garde_et_le_cache_est_plafonne():
    """
    Commentaire : « compiling a document costs more than checking one body
    against it — far more in JavaScript ». Le gain est mesuré dans les deux
    langages et il est très inégal ; le relevé donne les deux chiffres.
    """
    from n0 import MAX_COMPILED, _COMPILED

    validate_request(DOCUMENT, "POST", "/factures", FACTURE)
    garde = time.perf_counter()
    for _ in range(500):
        validate_request(DOCUMENT, "POST", "/factures", FACTURE)
    garde = time.perf_counter() - garde

    recompile = time.perf_counter()
    for i in range(500):
        autre = {**DOCUMENT, "info": {"title": "t%d" % i, "version": "1"}}
        validate_request(autre, "POST", "/factures", FACTURE)
    recompile = time.perf_counter() - recompile

    assert garde < recompile
    assert len(_COMPILED) <= MAX_COMPILED + 1


# ---------------------------------------------------------------------------
# Parité entre les deux langages
# ---------------------------------------------------------------------------


def test_python_et_javascript_rendent_le_meme_rapport():
    """La fiche montre les deux extraits : elle affirme la même chose des deux."""
    node = shutil.which("node")
    assert node, "node est requis pour comparer les deux implémentations"
    cas = [
        ("POST", "/factures", FACTURE),
        ("POST", "/factures", FAUSSE_ARITHMETIQUE),
        ("POST", "/factures", {**FACTURE, "montant_ht": "1000"}),
        ("POST", "/factures", {**FACTURE, "client": {"nom": "x", "siren": None}}),
        ("POST", "/factures", {**FACTURE, "client": {}}),
        ("POST", "/factures", {"reference": "FA-12", "montant_ht": -1, "tva": "x",
                               "montant_ttc": 1, "extra": 1}),
        ("POST", "/factures", {}),
        ("GET", "/factures/resume", None),
        ("GET", "/factures/42", None),
        ("GET", "/factures/42", {"a": 1}),
        ("GET", "/factures/42/", None),
        ("GET", "/factures//42", None),
        ("PUT", "/factures/42", FACTURE),
        ("DELETE", "/factures/42", None),
        ("POST", "/clients", {}),
        ("POST", "/factûres", FACTURE),
        ("POST", "/factures", {**FACTURE, "a": 1, "b": 2, "c": 3}),
    ]
    attendu = [validate_request(DOCUMENT, m, p, b) for m, p, b in cas]
    script = (
        f"import {{ validateRequest }} from {json.dumps((ICI / 'n0.js').as_uri())};"
        "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{"
        "const {document,cas}=JSON.parse(d);"
        "process.stdout.write(JSON.stringify("
        "cas.map(([m,p,b])=>validateRequest(document,m,p,b))));});"
    )
    sortie = subprocess.run([node, "--input-type=module", "-e", script],
                            input=json.dumps({"document": DOCUMENT, "cas": cas}),
                            capture_output=True, text=True, timeout=120, check=True)
    assert json.loads(sortie.stdout) == attendu
