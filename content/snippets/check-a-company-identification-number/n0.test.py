import json
import shutil
import subprocess
import time
from pathlib import Path

from n0 import MAX_CHARACTERS, SEPARATORS, check_company_number

ICI = Path(__file__).parent

# Deux numéros qui ne diffèrent que par l'inversion « 09 » → « 90 », et que la
# clé accepte tous les deux. Le premier est celui qu'on voulait saisir.
VOULU = "382209401"
SAISI = "382290401"

# La Poste : le siège satisfait Luhn, l'établissement de Rennes ne le satisfait
# pas et reste un SIRET valide (règle INSEE de la somme multiple de cinq).
LA_POSTE_SIEGE = "35600000000048"
LA_POSTE_RENNES = "35600000009075"

# Entrées ordinaires d'un public francophone : ce qu'on copie d'un extrait
# Kbis, d'un tableur ou d'une mention légale.
BANALES = [
    "732 829 320",
    "732829320",
    "732.829.320",
    "732 829 320 00074",
    "73282932000074",
    "732 829 320",
    "732 829 320",
    " 732829320 ",
    "732-829-320-00074",
    LA_POSTE_RENNES,
]


def luhn_simple(numero: str) -> bool:
    """La clé de Luhn seule, sans l'exception de La Poste : cinq lignes."""
    total = 0
    for rang, caractere in enumerate(reversed(numero)):
        chiffre = int(caractere)
        if rang % 2 == 1:
            chiffre = chiffre * 2
            chiffre = chiffre - 9 if chiffre > 9 else chiffre
        total += chiffre
    return total % 10 == 0


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_un_numero_bien_forme_peut_ne_designer_personne():
    """« 000000000 passe » : la clé dit la forme, pas l'existence."""
    assert check_company_number("000000000") == {
        "valid": True, "kind": "SIREN", "compact": "000000000", "reason": None,
    }
    assert check_company_number("00000000000000")["valid"] is True
    # Témoin : la clé refuse bien quelque chose — le même numéro à un chiffre près.
    assert check_company_number("000000001")["valid"] is False


def test_point_de_rupture_linversion_09_90_passe_la_cle():
    """« 382 209 401 saisi 382 290 401 passe aussi » : Luhn ne voit pas 09 ↔ 90."""
    assert check_company_number(VOULU)["valid"] is True
    assert check_company_number(SAISI)["valid"] is True
    assert VOULU != SAISI
    # L'inversion est bien de deux chiffres voisins, et d'eux seuls.
    ecarts = [i for i, (a, b) in enumerate(zip(VOULU, SAISI)) if a != b]
    assert ecarts == [4, 5] and VOULU[4:6] == "09" and SAISI[4:6] == "90"


def test_point_de_rupture_temoin_une_faute_dun_seul_chiffre_est_toujours_refusee():
    """« Le témoin est dans le même test : changer un seul chiffre est toujours refusé. »"""
    passees = 0
    for base in (VOULU, SAISI, "732829320", "000000000"):
        for rang in range(9):
            for chiffre in "0123456789":
                if chiffre == base[rang]:
                    continue
                faute = base[:rang] + chiffre + base[rang + 1:]
                if check_company_number(faute)["valid"]:
                    passees += 1
    assert passees == 0


# ---------------------------------------------------------------------------
# Les autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_le_siret_de_rennes_echoue_a_luhn_et_reste_valide():
    """
    Docstring : « 35600000009075, the Rennes establishment, fails Luhn and is
    valid ». C'est la raison mesurée de prendre la bibliothèque plutôt que
    d'écrire la clé.
    """
    assert luhn_simple(LA_POSTE_RENNES) is False
    assert check_company_number(LA_POSTE_RENNES)["valid"] is True
    # La règle INSEE pour La Poste : la somme des quatorze chiffres est un multiple de cinq.
    assert sum(int(c) for c in LA_POSTE_RENNES) % 5 == 0
    # Témoin : le siège, lui, satisfait les deux règles.
    assert luhn_simple(LA_POSTE_SIEGE) is True
    assert check_company_number(LA_POSTE_SIEGE)["valid"] is True


def test_lexception_ne_vaut_que_pour_le_siren_de_la_poste():
    """Un SIRET d'un autre SIREN dont la somme est multiple de cinq reste refusé."""
    autre = "73282932000004"
    assert sum(int(c) for c in autre) % 5 == 0
    assert luhn_simple(autre) is False
    assert check_company_number(autre)["valid"] is False


def test_le_rapport_dit_quelle_cle_a_ete_appliquee():
    """Docstring : « the report says which one was applied so the caller can tell »."""
    assert check_company_number("732829320")["kind"] == "SIREN"
    assert check_company_number("73282932000074")["kind"] == "SIRET"


def test_la_longueur_decide_quand_lappelant_ne_declare_rien():
    """Docstring : « Left out, the length decides — the only reading there is »."""
    assert check_company_number("7328293200")["reason"] == "10 digits: expected nine or fourteen"
    assert check_company_number("7328293200")["kind"] is None


def test_lappelant_peut_declarer_le_type_attendu():
    """Un SIREN présenté là où un SIRET est attendu est refusé, et la raison le dit."""
    rapport = check_company_number("732 829 320", expected="SIRET")
    assert rapport["valid"] is False
    assert rapport["reason"] == "SIRET is 14 digits, got 9"
    assert rapport["kind"] == "SIRET"
    # Témoin : déclarer le bon type ne change rien au résultat.
    assert check_company_number("732 829 320", expected="SIREN")["valid"] is True


def test_les_separateurs_sont_ceux_quon_colle_et_rien_dautre():
    """
    Commentaire : « Anything else surviving the clean-up is refused rather than
    quietly dropped ». Un préfixe de TVA n'est pas un séparateur.
    """
    for separateur in SEPARATORS:
        assert check_company_number(f"732{separateur}829{separateur}320")["valid"] is True
    assert check_company_number("FR44732829320")["valid"] is False
    assert check_company_number("FR44732829320")["reason"] == "not digits and separators only"
    assert check_company_number("SIREN : 732 829 320")["valid"] is False


def test_aucune_entree_ne_leve():
    """Docstring : « Nothing here raises on bad input »."""
    for entree in [None, 0, 732829320, b"732829320", [], {}, object(), "", "x" * 10_000]:
        rapport = check_company_number(entree)
        assert rapport["valid"] is False
        assert isinstance(rapport["reason"], str) and rapport["reason"]


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_entree_banale_ce_quon_colle_dun_extrait_kbis():
    """T5 : l'entrée ordinaire du public visé, francophone."""
    for banale in BANALES:
        rapport = check_company_number(banale)
        assert rapport["valid"] is True, banale
        assert rapport["compact"].isdigit()


def test_production_entree_vide():
    assert check_company_number("") == {
        "valid": False, "kind": None, "compact": "",
        "reason": "not digits and separators only",
    }
    # Une chaîne faite de séparateurs seuls ne devient pas un numéro vide valide.
    assert check_company_number("   ")["valid"] is False


def test_production_entree_tres_grande_et_terminaison_rapide():
    """Un mégaoctet collé dans le champ : refusé, et sans que le contrôle traîne."""
    enorme = "7" * 1_000_000
    debut = time.perf_counter()
    rapport = check_company_number(enorme)
    assert time.perf_counter() - debut < 5.0
    assert rapport["valid"] is False
    assert rapport["reason"] == f"longer than {MAX_CHARACTERS} characters"


def test_production_encodages_inattendus():
    # Chiffres arabo-indiens : ce sont des chiffres pour Unicode, pas pour la clé.
    assert check_company_number("٧٣٢٨٢٩٣٢٠")["valid"] is False
    # Marque d'ordre des octets, largeur nulle, emoji : refusés, pas nettoyés.
    for parasite in ("﻿", "​", "🏢"):
        assert check_company_number(f"{parasite}732829320")["valid"] is False
    # Espaces insécables, eux, sont des séparateurs déclarés.
    assert check_company_number("732 829 320")["valid"] is True
    assert check_company_number("732 829 320")["valid"] is True


def test_production_valeurs_aux_limites():
    # Huit, neuf, dix chiffres.
    assert check_company_number("73282932")["reason"] == "8 digits: expected nine or fourteen"
    assert check_company_number("732829320")["valid"] is True
    assert check_company_number("7328293200")["reason"] == "10 digits: expected nine or fourteen"
    # Treize, quatorze, quinze.
    assert check_company_number("7328293200007")["kind"] is None
    assert check_company_number("73282932000074")["valid"] is True
    assert check_company_number("732829320000741")["kind"] is None
    # Exactement le plafond, et un caractère de plus.
    au_plafond = "732829320".rjust(MAX_CHARACTERS, " ")
    assert len(au_plafond) == MAX_CHARACTERS
    assert check_company_number(au_plafond)["valid"] is True
    assert check_company_number(" " + au_plafond)["reason"] == (
        f"longer than {MAX_CHARACTERS} characters"
    )


def test_production_un_numero_invalide_dans_un_lot_nempeche_pas_les_autres():
    """T8 : une donnée sale ne fait pas tomber le lot."""
    lot = ["732829320", "pas un numéro", "73282932000074", "", LA_POSTE_RENNES]
    rapports = [check_company_number(numero) for numero in lot]
    assert [r["valid"] for r in rapports] == [True, False, True, False, True]


def test_production_le_controle_tient_la_classe_de_latence_annoncee():
    """
    latency « <1 ms » : dix mille contrôles en moins de dix secondes, soit la
    borne large de la charte (marge de dix sur la mesure du relevé).
    """
    debut = time.perf_counter()
    for _ in range(10_000):
        check_company_number("732 829 320 00074")
    assert time.perf_counter() - debut < 10.0


# ---------------------------------------------------------------------------
# Parité entre les deux langages
# ---------------------------------------------------------------------------


def test_python_et_javascript_rendent_le_meme_rapport():
    """
    La fiche montre les deux extraits : elle affirme donc la même chose des
    deux. Toutes les entrées de ce fichier, passées aux deux.
    """
    node = shutil.which("node")
    assert node, "node est requis pour comparer les deux implémentations"
    entrees = BANALES + [
        "", "   ", "000000000", "00000000000000", VOULU, SAISI, LA_POSTE_SIEGE,
        "732829321", "7328293200", "73282932", "٧٣٢٨٢٩٣٢٠", "﻿732829320",
        "FR44732829320", "SIREN : 732 829 320", "x" * 70, "732829320".rjust(64, " "),
        "732‑829‑320", "732–829–320", "732‐829‐320",
    ]
    attendu = [check_company_number(e) for e in entrees]
    attendu += [check_company_number(e, expected="SIRET") for e in entrees[:4]]
    script = (
        f"import {{ checkCompanyNumber }} from {json.dumps((ICI / 'n0.js').as_uri())};"
        "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{"
        "const e=JSON.parse(d);"
        "const r=e.map(x=>checkCompanyNumber(x));"
        "r.push(...e.slice(0,4).map(x=>checkCompanyNumber(x,{expected:'SIRET'})));"
        "process.stdout.write(JSON.stringify(r));});"
    )
    sortie = subprocess.run(
        [node, "--input-type=module", "-e", script],
        input=json.dumps(entrees), capture_output=True, text=True, timeout=60, check=True,
    )
    assert json.loads(sortie.stdout) == attendu
