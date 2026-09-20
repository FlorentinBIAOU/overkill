import json
import random
import shutil
import string
import subprocess
import time
from pathlib import Path

from stdnum import iban as registre

from n0 import (MAX_CHARACTERS, MAX_LENGTH, MIN_LENGTH, RIB_LETTERS,
                check_bank_details, national_key_ok)

ICI = Path(__file__).parent

# Deux comptes du même établissement, tous deux parfaitement formés, clé RIB
# comprise. C'est la forme que prend la facture au RIB changé : rien dans le
# numéro ne dit lequel est le vôtre.
ATTENDU = "FR7630006000011234567890189"
SUBSTITUE = "FR7630006000010987654321028"

# Un numéro dont la clé ISO 13616 est juste et dont la seule clé RIB est
# fausse : c'est le cas qu'il faut pour démontrer que l'extrait ajoute bien
# quelque chose à la bibliothèque.
CLE_RIB_SEULE_FAUSSE = "FR0630006000011234567890188"

# Deux IBAN monégasques : Monaco emploie la même clé que la France.
MONEGASQUES = ["MC5811222000010123456789030", "MC1112739000700011111000H79"]

# Les six confusions de saisie entre un chiffre et une lettre qui lui ressemble.
SOSIES = {"0": "O", "1": "I", "2": "Z", "5": "S", "6": "G", "8": "B"}

# Entrées ordinaires d'un public francophone, souvent européen.
BANALES = [
    "FR76 3000 6000 0112 3456 7890 189",
    "FR7630006000011234567890189",
    "fr76 3000 6000 0112 3456 7890 189",
    "FR76 3000 6000 0112 3456 7890 189",
    "FR76-3000-6000-0112-3456-7890-189",
    "BE62 5100 0754 7061",
    "DE89 3704 0044 0532 0130 00",
    "CH93 0076 2011 6238 5295 7",
    "MC58 1122 2000 0101 2345 6789 030",
    "LU28 0019 4006 4475 0000",
]


def cle_iso(pays: str, bban: str) -> str:
    """Les deux chiffres de contrôle d'ISO 13616, pour fabriquer des IBAN de test."""
    etendu = "".join(str(int(c, 36)) for c in bban + pays + "00")
    return "%02d" % (98 - int(etendu) % 97)


def cle_rib(banque: str, guichet: str, compte: str) -> str:
    """La clé RIB française : celle que l'extrait recalcule."""
    chiffres = "".join(RIB_LETTERS.get(c, c) for c in banque + guichet + compte)
    return "%02d" % ((97 - int(chiffres + "00") % 97) % 97)


def ibans_francais(nombre: int, graine: int = 3) -> list[str]:
    """Des IBAN français valides, fabriqués, jamais ceux de quelqu'un."""
    alea = random.Random(graine)
    sortie = []
    while len(sortie) < nombre:
        banque, guichet = "%05d" % alea.randint(10000, 99999), "%05d" % alea.randint(0, 99999)
        compte = "%011d" % alea.randint(0, 10**11 - 1)
        bban = banque + guichet + compte + cle_rib(banque, guichet, compte)
        candidat = "FR" + cle_iso("FR", bban) + bban
        if check_bank_details(candidat)["valid"]:
            sortie.append(candidat)
    return sortie


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_deux_comptes_du_meme_etablissement_passent_tous_les_deux():
    """
    « FR76 3000 6000 0112 3456 7890 189 et FR76 3000 6000 0109 8765 4321 028
    passent toutes les deux » : la clé ne dit rien du titulaire.
    """
    for numero in (ATTENDU, SUBSTITUE):
        rapport = check_bank_details(numero)
        assert rapport["valid"] is True, numero
        assert rapport["national_key"] is True
    # Même pays, mêmes chiffres de contrôle, même code banque, même guichet :
    # seul le numéro de compte change.
    assert ATTENDU[:4] == SUBSTITUE[:4] == "FR76"
    assert ATTENDU[4:14] == SUBSTITUE[4:14] == "3000600001"
    assert ATTENDU[14:] != SUBSTITUE[14:]


def test_point_de_rupture_temoin_aucune_faute_dun_chiffre_ne_passe():
    """
    « Le témoin : aucune faute d'un seul chiffre ne passe » — les 20 700
    essais de cent IBAN, mesurés ici même. Le générateur est à graine fixe
    (3), donc le décompte est reproductible à l'unité : il est asserté à
    l'égalité, pas dans une fourchette.
    """
    passees = essais = 0
    for numero in ibans_francais(100):
        for rang in range(4, len(numero)):
            for chiffre in string.digits:
                if chiffre == numero[rang]:
                    continue
                essais += 1
                if check_bank_details(numero[:rang] + chiffre + numero[rang + 1:])["valid"]:
                    passees += 1
    assert essais == 20_700  # 100 IBAN × 23 positions × 9 autres chiffres
    assert passees == 0


# ---------------------------------------------------------------------------
# Les autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_aucune_transposition_de_deux_caracteres_voisins_ne_passe():
    """
    Docstring : « nor one of their 1 973 adjacent transpositions ». Le
    décompte est celui du générateur à graine 3, asserté à l'égalité.
    """
    passees = essais = 0
    for numero in ibans_francais(100):
        for rang in range(4, len(numero) - 1):
            if numero[rang] == numero[rang + 1]:
                continue
            essais += 1
            permute = numero[:rang] + numero[rang + 1] + numero[rang] + numero[rang + 2:]
            if check_bank_details(permute)["valid"]:
                passees += 1
    assert essais == 1_973
    assert passees == 0


def test_la_cle_rib_ferme_ce_que_la_cle_iso_laisse_passer():
    """
    Docstring : « The ISO key alone lets 31 of those 6 882 pass — 0.45 % […]
    the RIB key is what closes that ». Les deux contrôles sur les mêmes
    entrées, et les trois chiffres publiés assertés à l'égalité : le générateur
    est à graine fixe (3), donc rien n'autorise une fourchette.
    """
    seule_iso = ensemble = passees = 0
    for numero in ibans_francais(500):
        for rang in range(4, len(numero)):
            if numero[rang] not in SOSIES:
                continue
            ensemble += 1
            faute = numero[:rang] + SOSIES[numero[rang]] + numero[rang + 1:]
            # La bibliothèque seule, sans la clé nationale de l'extrait.
            if registre.is_valid(faute):
                seule_iso += 1
            if check_bank_details(faute)["valid"]:
                passees += 1
    assert ensemble == 6_882
    assert seule_iso == 31
    assert passees == 0
    assert round(100 * seule_iso / ensemble, 2) == 0.45


def test_la_cle_rib_est_celle_de_la_norme_bancaire_francaise():
    """Commentaire : « A and J are 1, B, K and S are 2, and so on to I, R and Z at 9 »."""
    assert "".join(RIB_LETTERS[c] for c in "ABCDEFGHIJKLMNOPQRSTUVWXYZ") == (
        "12345678912345678923456789")
    assert national_key_ok("FR", ATTENDU[4:]) is True
    assert national_key_ok("FR", SUBSTITUE[4:]) is True
    # Un numéro qui passe la clé ISO et échoue à la seule clé RIB : c'est
    # celui-là qu'il faut, sans « ou ». L'ancienne version fabriquait la
    # fausse clé en changeant les deux derniers chiffres, ce qui casse d'abord
    # la clé ISO, et son assertion s'accommodait du mauvais chemin.
    assert registre.is_valid(CLE_RIB_SEULE_FAUSSE), "la clé ISO, elle, est bonne"
    rapport = check_bank_details(CLE_RIB_SEULE_FAUSSE)
    assert rapport["valid"] is False
    assert rapport["national_key"] is False
    assert rapport["reason"] == "the RIB key inside the account number does not match"


def test_monaco_porte_la_meme_cle_que_la_france():
    """
    Commentaire : « Monaco uses the French banking standard: its national part
    is twenty-three characters too and satisfies the same modulo 97. »
    """
    for numero in MONEGASQUES:
        rapport = check_bank_details(numero)
        assert rapport["country"] == "MC", numero
        assert rapport["national_key"] is True, numero
        assert rapport["valid"] is True, numero
    # Témoin : un pays sans clé nationale connue ici rend toujours None.
    assert check_bank_details("DE89370400440532013000")["national_key"] is None


def test_la_cle_nationale_nest_pas_calculee_hors_de_france():
    """Docstring : « or null when this snippet has none for that country »."""
    assert national_key_ok("DE", "370400440532013000") is None
    assert check_bank_details("DE89370400440532013000")["national_key"] is None
    assert check_bank_details("BE62510007547061")["national_key"] is None


def test_le_pays_est_rendu_meme_quand_le_numero_est_refuse():
    """
    Docstring : « `country` comes back whether the number is valid or not, so
    the caller can decide about reachability ».
    """
    assert check_bank_details("FR7630006000011234567890188")["country"] == "FR"
    # Un IBAN brésilien est bien formé, et aucun virement SEPA n'y arrive.
    bresilien = check_bank_details("BR1800360305000010009795493C1")
    assert bresilien["valid"] is True and bresilien["country"] == "BR"


def test_le_pays_attendu_refuse_le_detournement_vers_un_autre_pays():
    """Docstring : « the country changing between the quote and the payment details »."""
    rapport = check_bank_details("LU280019400644750000", expected_country="FR")
    assert rapport["valid"] is False
    assert rapport["reason"] == "expected a FR account, this one is LU"
    # Témoin : le pays attendu ne change rien quand il correspond.
    assert check_bank_details(ATTENDU, expected_country="fr")["valid"] is True


def test_la_casse_est_relevee_pas_refusee():
    """Commentaire : « Upper case is the electronic format of ISO 13616 »."""
    assert check_bank_details("fr7630006000011234567890189")["compact"] == ATTENDU


def test_le_numero_est_rendu_groupe_par_quatre():
    """Commentaire : « The printed grouping in fours »."""
    assert check_bank_details(ATTENDU)["printed"] == "FR76 3000 6000 0112 3456 7890 189"


def test_aucune_entree_ne_leve_et_la_raison_nomme_ce_qui_a_ete_recu():
    """
    Docstring : « Nothing raises ». R14 : la raison dit ce que le code a
    constaté — le type reçu.
    """
    assert check_bank_details(None)["reason"] == "an IBAN is text, not NoneType"
    assert check_bank_details(b"FR76")["reason"] == "an IBAN is text, not bytes"
    assert check_bank_details(76.3)["reason"] == "an IBAN is text, not float"
    for entree in [None, 0, 76.3, b"FR76", [], {}, object(), "", "x" * 10_000]:
        rapport = check_bank_details(entree)
        assert rapport["valid"] is False
        assert isinstance(rapport["reason"], str) and rapport["reason"]


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_entree_banale_ce_quon_colle_dune_facture():
    """T5 : l'entrée ordinaire du public visé, francophone et souvent européen."""
    for banale in BANALES:
        rapport = check_bank_details(banale)
        assert rapport["valid"] is True, banale
        assert rapport["country"] == banale.strip()[:2].upper()


def test_production_entree_vide():
    assert check_bank_details("")["reason"] == "not letters, digits and separators only"
    assert check_bank_details("    ")["valid"] is False


def test_production_entree_tres_grande_et_terminaison_rapide():
    enorme = "FR76" + "3" * 1_000_000
    debut = time.perf_counter()
    rapport = check_bank_details(enorme)
    assert time.perf_counter() - debut < 5.0
    assert rapport["reason"] == f"longer than {MAX_CHARACTERS} characters"


def test_production_encodages_inattendus():
    # Espaces insécables et fines : des séparateurs déclarés.
    fines = "FR76 3000 6000 0112 3456 7890 189"
    assert check_bank_details(fines)["valid"] is True
    # Marque d'ordre des octets, largeur nulle, emoji, chiffres arabo-indiens.
    for parasite in ("﻿", "​", "💶", "٧"):
        assert check_bank_details(f"{parasite}{ATTENDU}")["valid"] is False
    # Un E accentué décomposé ne se glisse pas dans un IBAN sans être vu.
    assert check_bank_details("FRÉ76300060000112345678901")["valid"] is False


def test_production_valeurs_aux_limites():
    # Quatorze, quinze, trente-quatre, trente-cinq caractères.
    assert check_bank_details("FR763000600001")["reason"] == (
        f"14 characters: an IBAN has {MIN_LENGTH} to {MAX_LENGTH}")
    assert check_bank_details("FR7630006000011")["reason"] == (
        "ISO 13616 check digits, length or registry format do not match")
    trente_cinq = "FR76" + "3" * 31
    assert len(trente_cinq) == 35
    assert check_bank_details(trente_cinq)["reason"] == (
        f"35 characters: an IBAN has {MIN_LENGTH} to {MAX_LENGTH}")
    # Exactement le plafond de caractères, et un de plus.
    au_plafond = ATTENDU.rjust(MAX_CHARACTERS, " ")
    assert len(au_plafond) == MAX_CHARACTERS
    assert check_bank_details(au_plafond)["valid"] is True
    assert check_bank_details(" " + au_plafond)["reason"] == (
        f"longer than {MAX_CHARACTERS} characters")
    # Un numéro qui ne commence pas par deux lettres et deux chiffres.
    assert check_bank_details("7630006000011234567890189F")["reason"] == (
        "an IBAN starts with two letters then two digits")


def test_production_un_iban_invalide_dans_un_lot_nempeche_pas_les_autres():
    """T8 : une donnée sale ne fait pas tomber le lot de virements."""
    lot = [ATTENDU, "pas un IBAN", "BE62510007547061", "", SUBSTITUE]
    assert [check_bank_details(x)["valid"] for x in lot] == [True, False, True, False, True]


def test_production_le_controle_tient_la_classe_de_latence_annoncee():
    """latency « <1 ms » : dix mille contrôles sous une borne d'effondrement large."""
    debut = time.perf_counter()
    for _ in range(10_000):
        check_bank_details("FR76 3000 6000 0112 3456 7890 189")
    assert time.perf_counter() - debut < 10.0


# ---------------------------------------------------------------------------
# Parité entre les deux langages
# ---------------------------------------------------------------------------


def test_python_et_javascript_rendent_le_meme_rapport():
    """La fiche montre les deux extraits : elle affirme la même chose des deux."""
    node = shutil.which("node")
    assert node, "node est requis pour comparer les deux implémentations"
    entrees = BANALES + ibans_francais(200) + [
        "", "   ", ATTENDU, SUBSTITUE, "BE68539007547034", "BR1800360305000010009795493C1",
        "GB82WEST12345698765432", "ES9121000418450200051332", "IT60X0542811101000000123456",
        "NL91ABNA0417164300", "PT50000201231234567890154", "NO9386011117947",
        "FR7630006000011234567890188", "FR763000600001", "FR76" + "3" * 31,
        "﻿" + ATTENDU, "FR76 3000 6000 0112 3456 7890 189",
        "7630006000011234567890189F", "IBAN FR76…", "x" * 70, ATTENDU.rjust(64, " "),
        "FR7630006000011B34567890189", "FR6741190776781951731591447",
    ]
    attendu = [check_bank_details(e) for e in entrees]
    attendu += [check_bank_details(e, expected_country="FR") for e in entrees[:6]]
    script = (
        f"import {{ checkBankDetails }} from {json.dumps((ICI / 'n0.js').as_uri())};"
        "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{"
        "const e=JSON.parse(d);const r=e.map(x=>checkBankDetails(x));"
        "r.push(...e.slice(0,6).map(x=>checkBankDetails(x,{expectedCountry:'FR'})));"
        "process.stdout.write(JSON.stringify(r));});"
    )
    sortie = subprocess.run(
        [node, "--input-type=module", "-e", script],
        input=json.dumps(entrees), capture_output=True, text=True, timeout=120, check=True,
    )
    assert json.loads(sortie.stdout) == attendu
