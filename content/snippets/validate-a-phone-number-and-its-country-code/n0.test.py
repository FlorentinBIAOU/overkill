import json
import shutil
import subprocess
import time
from pathlib import Path

from n0 import MAX_CHARACTERS, validate_phone_number

ICI = Path(__file__).parent

# Le Bénin est passé à dix chiffres : l'ancienne forme à huit n'est plus dans
# le plan, la nouvelle y est.
BENIN_ANCIEN = "+229 97 12 34 56"
BENIN_ACTUEL = "+229 01 97 12 34 56"

# Les mêmes chiffres, deux pays, deux natures de ligne.
AMBIGU = "0470 12 34 56"

# Entrées ordinaires du public visé : francophone, souvent européen ou africain.
BANALES = [
    ("06 12 34 56 78", "FR", "+33612345678", "MOBILE"),
    ("01 23 45 67 89", "FR", "+33123456789", "FIXED_LINE"),
    ("+33 6 12 34 56 78", None, "+33612345678", "MOBILE"),
    ("0033 6 12 34 56 78", "FR", "+33612345678", "MOBILE"),
    ("+32 470 12 34 56", None, "+32470123456", "MOBILE"),
    ("+41 79 123 45 67", None, "+41791234567", "MOBILE"),
    ("+225 07 12 34 56 78", None, "+2250712345678", "MOBILE"),
    ("+221 77 123 45 67", None, "+221771234567", "MOBILE"),
    ("+212 6 12 34 56 78", None, "+212612345678", "MOBILE"),
    ("+237 6 71 23 45 67", None, "+237671234567", "MOBILE"),
]


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_un_numero_beninois_dhier_est_refuse_aujourdhui():
    """
    « "+229 97 12 34 56" était un numéro béninois ordinaire avant le passage à
    dix chiffres, et la bibliothèque le refuse aujourd'hui. »
    """
    rapport = validate_phone_number(BENIN_ANCIEN)
    assert rapport["valid"] is False
    assert rapport["region"] == "BJ"
    assert rapport["reason"] == "not in a numbering plan: no prefix of that country's plan matches"
    # Le numéro est bien lu, et la longueur seule ne suffit pas à le refuser :
    # c'est le préfixe qui n'est plus attribué.
    assert rapport["e164"] == "+22997123456"


def test_point_de_rupture_temoin_la_forme_actuelle_passe():
    """« Le témoin : "+229 01 97 12 34 56", la forme actuelle, passe. »"""
    rapport = validate_phone_number(BENIN_ACTUEL)
    assert rapport == {
        "valid": True, "region": "BJ", "type": "MOBILE",
        "e164": "+2290197123456", "reason": None,
    }


# ---------------------------------------------------------------------------
# Les autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_la_region_nest_jamais_devinee():
    """
    Docstring : « the region is either written in the number, as the leading +,
    or declared by the caller, or the number is refused ».
    """
    rapport = validate_phone_number("06 12 34 56 78")
    assert rapport["valid"] is False
    assert rapport["reason"] == "no country code in the number and no region declared by the caller"
    # Témoin : le même numéro avec le + n'a besoin de rien.
    assert validate_phone_number("+33 6 12 34 56 78")["valid"] is True


def test_les_memes_chiffres_donnent_deux_pays_et_deux_natures_de_ligne():
    """
    Docstring : « the same digits are a valid mobile number in several other
    countries ». 0470 12 34 56 est une ligne fixe en France et un mobile en
    Belgique : deviner la région, c'est envoyer un SMS à un poste fixe.
    """
    francais = validate_phone_number(AMBIGU, default_region="FR")
    belge = validate_phone_number(AMBIGU, default_region="BE")
    assert francais["valid"] is True and belge["valid"] is True
    assert (francais["e164"], francais["type"]) == ("+33470123456", "FIXED_LINE")
    assert (belge["e164"], belge["type"]) == ("+32470123456", "MOBILE")
    # Témoin : hors de ces deux pays, les mêmes chiffres ne sont pas un numéro.
    assert validate_phone_number(AMBIGU, default_region="CH")["valid"] is False


def test_la_nature_de_la_ligne_dit_quun_sms_narrivera_pas():
    """Docstring : « in France a number starting 01 is a fixed line, and it is valid »."""
    fixe = validate_phone_number("01 23 45 67 89", default_region="FR")
    assert fixe["valid"] is True and fixe["type"] == "FIXED_LINE"
    mobile = validate_phone_number("06 12 34 56 78", default_region="FR")
    assert mobile["valid"] is True and mobile["type"] == "MOBILE"


def test_la_raison_separe_la_longueur_du_prefixe():
    """
    Commentaire : « `is_possible_number` only checks the length, so it
    separates a number that is too short from one whose prefix is not
    allocated ».
    """
    trop_court = validate_phone_number("+33 6 45")
    assert trop_court["reason"] == "not in a numbering plan: the wrong length for its country"
    assert validate_phone_number(BENIN_ANCIEN)["reason"] == (
        "not in a numbering plan: no prefix of that country's plan matches")


def test_aucune_entree_ne_leve():
    """Docstring : « Nothing raises »."""
    for entree in [None, 0, 33.6, b"+33", [], {}, object(), "", "x" * 10_000, "+++"]:
        rapport = validate_phone_number(entree, default_region="FR")
        assert rapport["valid"] is False
        assert isinstance(rapport["reason"], str) and rapport["reason"]


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_entree_banale_ce_quon_saisit_dans_un_formulaire():
    """T5 : l'entrée ordinaire du public visé."""
    for ecrit, region, e164, nature in BANALES:
        rapport = validate_phone_number(ecrit, default_region=region)
        assert rapport["valid"] is True, ecrit
        assert rapport["e164"] == e164, ecrit
        assert rapport["type"] == nature, ecrit


def test_production_entree_vide():
    assert validate_phone_number("", default_region="FR")["valid"] is False
    assert validate_phone_number("   ", default_region="FR")["valid"] is False
    assert validate_phone_number("")["reason"] == (
        "no country code in the number and no region declared by the caller")


def test_production_entree_tres_grande_et_terminaison_rapide():
    enorme = "+33" + "6" * 1_000_000
    debut = time.perf_counter()
    rapport = validate_phone_number(enorme)
    assert time.perf_counter() - debut < 5.0
    assert rapport["reason"] == f"longer than {MAX_CHARACTERS} characters"


def test_production_encodages_inattendus():
    # Espaces de toutes largeurs, points, tirets, parenthèses : le numéro lu
    # reste le même. L'espace fine insécable est celle que la bibliothèque ne
    # traverse pas d'elle-même, et que l'extrait nivelle avant de l'appeler.
    for ecrit in ["06\u00a012\u00a034\u00a056\u00a078", "06.12.34.56.78",
                  "06-12-34-56-78", "(0)6 12 34 56 78",
                  "06\u202f12\u202f34\u202f56\u202f78",
                  "06\u200912\u200934\u200956\u200978",
                  "06\u300012\u300034\u300056\u300078"]:
        assert validate_phone_number(ecrit, default_region="FR")["e164"] == "+33612345678", ecrit
    # Les chiffres arabo-indiens sont des chiffres : la bibliothèque les
    # convertit, et le numéro lu est le même.
    arabes = "\u0660\u0666\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668"
    assert validate_phone_number(arabes, default_region="FR")["e164"] == "+33612345678"
    # Largeur nulle, marque d'ordre des octets, emoji : ce ne sont ni des
    # chiffres ni de la ponctuation de numéro, et ils sont refusés.
    for parasite in ("\u200b", "\ufeff", "\u260e\ufe0f"):
        rapport = validate_phone_number(f"06 12 34 56 78{parasite}", default_region="FR")
        assert rapport["valid"] is False, parasite
        assert rapport["reason"] == "contains something that is not a number"


def test_production_un_mot_colle_au_numero_est_refuse_et_non_lu_en_chiffres():
    """
    Commentaire : « libphonenumber reads them as the keys of a telephone
    keypad, so « 06 12 34 56 78 poste 42 » becomes a longer number that is not
    the one anybody typed. » La garde refuse avant d'appeler.
    """
    rapport = validate_phone_number("06 12 34 56 78 poste 42", default_region="FR")
    assert rapport["valid"] is False
    assert rapport["e164"] is None
    assert rapport["reason"] == "contains something that is not a number"
    # Témoin : le même numéro sans le mot passe.
    assert validate_phone_number("06 12 34 56 78", default_region="FR")["valid"] is True


def test_production_valeurs_aux_limites():
    # Exactement le plafond de caractères, et un de plus.
    au_plafond = "+33 6 12 34 56 78".rjust(MAX_CHARACTERS)
    assert len(au_plafond) == MAX_CHARACTERS
    assert validate_phone_number(au_plafond)["valid"] is True
    assert validate_phone_number(" " + au_plafond)["reason"] == (
        f"longer than {MAX_CHARACTERS} characters")
    # Un chiffre de moins, un chiffre de plus que le plan français.
    assert validate_phone_number("+3361234567")["valid"] is False
    assert validate_phone_number("+336123456789")["valid"] is False
    assert validate_phone_number("+33612345678")["valid"] is True


def test_production_un_numero_invalide_dans_un_lot_nempeche_pas_les_autres():
    """T8 : une donnée sale ne fait pas tomber la liste de diffusion."""
    lot = ["+33612345678", "pas un numéro", BENIN_ACTUEL, "", BENIN_ANCIEN, "+32470123456"]
    assert [validate_phone_number(x)["valid"] for x in lot] == [
        True, False, True, False, False, True]


def test_production_le_controle_tient_la_classe_de_latence_annoncee():
    """latency « <1 ms » : dix mille contrôles sous une borne d'effondrement large."""
    debut = time.perf_counter()
    for _ in range(10_000):
        validate_phone_number("06 12 34 56 78", default_region="FR")
    assert time.perf_counter() - debut < 20.0


# ---------------------------------------------------------------------------
# Parité entre les deux langages
# ---------------------------------------------------------------------------


def test_python_et_javascript_rendent_le_meme_rapport():
    """La fiche montre les deux extraits : elle affirme la même chose des deux."""
    node = shutil.which("node")
    assert node, "node est requis pour comparer les deux implémentations"
    numeros = [e for e, *_ in BANALES] + [
        BENIN_ANCIEN, BENIN_ACTUEL, AMBIGU, "", "   ", "+33 6 45", "+3361234567",
        "+336123456789", "bonjour", "+++", "06.12.34.56.78", "(0)6 12 34 56 78",
        "٠٦١٢٣٤٥٦٧٨", "06 12 34 56 78​☎️", "x" * 45, "+1 202 555 0143",
        "+44 7911 123456", "+49 151 12345678", "+229 97 12 34 56", "0470 12 34 56",
        "+352 621 123 456", "+243 81 234 5678", "+33 8 99 12 34 56", "+33 800 123 456",
        "06 12 34 56 78 poste 42", "1-800-FLOWERS", "06 12 34 56 78\n",
        "\ufeff06 12 34 56 78", "06 12 34 56 78\ufeff", "06 12 34 56 78\u200b",
        "06\u202f12\u202f34\u202f56\u202f78", "06\u300012\u300034\u300056\u300078",
        " \t 06 12 34 56 78 \t ", "+33\u00a06\u00a012\u00a034\u00a056\u00a078",
    ]
    regions = [None, "FR", "BE", "CH"]
    attendu = [[validate_phone_number(n, default_region=r) for r in regions] for n in numeros]
    script = (
        f"import {{ validatePhoneNumber }} from {json.dumps((ICI / 'n0.js').as_uri())};"
        "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{"
        "const {numeros,regions}=JSON.parse(d);"
        "process.stdout.write(JSON.stringify(numeros.map(n=>regions.map("
        "r=>validatePhoneNumber(n,{defaultRegion:r??undefined})))));});"
    )
    sortie = subprocess.run(
        [node, "--input-type=module", "-e", script],
        input=json.dumps({"numeros": numeros, "regions": regions}),
        capture_output=True, text=True, timeout=120, check=True,
    )
    assert json.loads(sortie.stdout) == attendu
