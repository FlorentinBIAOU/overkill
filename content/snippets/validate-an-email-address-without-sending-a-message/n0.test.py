import json
import shutil
import subprocess
import time
from pathlib import Path

from email_validator import EmailNotValidError, validate_email

from n0 import ASCII_WHITESPACE, MAX_ADDRESS, MAX_LOCAL, WHATWG, check_email_syntax

ICI = Path(__file__).parent

# Les trente-deux adresses sur lesquelles les trois définitions sont comparées.
BATTERIE = [
    "contact@exemple.fr", "Contact@Exemple.FR", "jean.dupont@exemple.fr",
    "jean+tag@exemple.fr", "jean..dupont@exemple.fr", ".jean@exemple.fr",
    "jean.@exemple.fr", "jean@exemple", "jean@localhost", "jean@[192.168.0.1]",
    "jean@exemple..fr", "jean@-exemple.fr", "jean@exemple-.fr",
    '"jean dupont"@exemple.fr', "jean dupont@exemple.fr", "jean@exemple.fr ",
    "jean@éxemple.fr", "jéan@exemple.fr", "jean@xn--xemple-9ua.fr",
    "jean@exemple.f", "a" * 65 + "@exemple.fr", "a@b.c",
    "jean@exemple.corporate", "jean@gmial.com", "jean@exemple.fr\n",
    "jean@@exemple.fr", "@exemple.fr", "jean@", "", "jean@exemple.fr.",
    "jean@1.2.3.4", "jean@[IPv6:::1]",
]

# Entrées ordinaires d'un public francophone.
BANALES = [
    "jean.dupont@exemple.fr",
    "Jean.Dupont@Exemple.FR",
    "contact@mairie-de-saint-étienne.fr".replace("é", "e"),
    "j.dupont+facture@exemple.fr",
    "service-client@exemple.coop",
    "  contact@exemple.fr  ",
    "prenom.nom@exemple.bzh",
]


def par_email_validator(adresse: str) -> bool:
    try:
        validate_email(adresse, check_deliverability=False)
        return True
    except EmailNotValidError:
        return False


def par_validator_js(adresses: list[str]) -> list[bool]:
    node = shutil.which("node")
    assert node, "node est requis pour comparer les définitions"
    script = (
        "import v from 'validator';let d='';process.stdin.on('data',c=>d+=c)"
        ".on('end',()=>{process.stdout.write(JSON.stringify("
        "JSON.parse(d).map(x=>v.isEmail(x))));});"
    )
    sortie = subprocess.run([node, "--input-type=module", "-e", script],
                            input=json.dumps(adresses), capture_output=True,
                            text=True, timeout=60, check=True)
    return json.loads(sortie.stdout)


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_une_faute_de_frappe_sur_le_domaine_passe():
    """
    « "jean@gmial.com" passe, alors que le domaine est une faute de frappe sur
    gmail.com, et "contact@exemple.fr" passe sur un domaine sans serveur de
    courrier. »
    """
    faute = check_email_syntax("jean@gmial.com")
    assert faute["valid"] is True and faute["routable"] is True
    assert check_email_syntax("contact@exemple.fr")["valid"] is True
    # La syntaxe ne distingue pas les deux domaines : ils ont la même forme.
    assert check_email_syntax("jean@gmail.com")["valid"] is True


def test_point_de_rupture_temoin_la_forme_est_bien_controlee():
    """« Le témoin : "jean@@exemple.fr" est refusé, la forme est bien contrôlée. »"""
    refuse = check_email_syntax("jean@@exemple.fr")
    assert refuse["valid"] is False
    assert refuse["reason"] == "does not match the HTML definition of an email address"
    for mauvaise in ["@exemple.fr", "jean@", "jean dupont@exemple.fr",
                     "jean@exemple.fr.", "jean@-exemple.fr", "jean@exemple..fr"]:
        assert check_email_syntax(mauvaise)["valid"] is False, mauvaise


# ---------------------------------------------------------------------------
# Les autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_les_trois_definitions_ne_disent_pas_la_meme_chose():
    """
    Docstring : « email-validator 2.3.0 […] and validator.js 13.15.35 […]
    return different verdicts four times, and the browser's definition differs
    from one or the other fourteen times ». Les trois, sur les mêmes entrées.
    """
    par_js = par_validator_js(BATTERIE)
    entre_bibliotheques = desaccords = 0
    for adresse, js in zip(BATTERIE, par_js):
        py = par_email_validator(adresse)
        extrait = check_email_syntax(adresse)["valid"]
        if py != js:
            entre_bibliotheques += 1
        if not (py == js == extrait):
            desaccords += 1
    assert len(BATTERIE) == 32
    assert entre_bibliotheques == 4
    assert desaccords == 14


def test_email_validator_accepte_une_partie_locale_de_soixante_cinq_caracteres():
    """
    Docstring : « a sixty-five-character local part, which `email-validator`
    accepts although RFC 5321 caps it at sixty-four ».
    """
    longue = "a" * 65 + "@exemple.fr"
    assert par_email_validator(longue) is True
    rapport = check_email_syntax(longue)
    assert rapport["valid"] is False
    assert rapport["reason"] == f"the part before the @ is over {MAX_LOCAL} characters"
    # Témoin : soixante-quatre passent.
    assert check_email_syntax("a" * 64 + "@exemple.fr")["valid"] is True


def test_seul_le_domaine_est_mis_en_minuscules():
    """
    Docstring : « The local part is left in its case, because RFC 5321 makes it
    case-sensitive and only the domain is not ».
    """
    rapport = check_email_syntax("Jean.DUPONT@Exemple.FR")
    assert rapport["normalised"] == "Jean.DUPONT@exemple.fr"
    assert rapport["local"] == "Jean.DUPONT"
    assert rapport["domain"] == "exemple.fr"


def test_routable_ne_dit_quune_chose_la_presence_dun_point():
    """
    Commentaire : « That is all this field says: `jean@1.2.3.4` has three dots
    and comes back routable, because nothing here resolves anything. »
    """
    quatre_nombres = check_email_syntax("jean@1.2.3.4")
    assert quatre_nombres["valid"] is True
    assert quatre_nombres["routable"] is True
    # Et le cas vedette de la fiche : une faute de frappe est routable aussi.
    assert check_email_syntax("jean.dupont@gmial.com")["routable"] is True


def test_un_domaine_sans_point_est_valide_et_non_routable():
    """
    Docstring : « `routable` is false for jean@localhost, which the HTML
    definition accepts ».
    """
    rapport = check_email_syntax("jean@localhost")
    assert rapport["valid"] is True
    assert rapport["routable"] is False
    # Témoin : le même compte sur un domaine public est routable.
    assert check_email_syntax("jean@exemple.fr")["routable"] is True


def test_une_adresse_accentuee_est_refusee_comme_par_le_navigateur():
    """
    La définition HTML n'accepte que l'ASCII de part et d'autre de l'arobase.
    Les deux bibliothèques, elles, acceptent l'adresse internationalisée.
    """
    for accentuee in ["jéan@exemple.fr", "jean@éxemple.fr"]:
        assert check_email_syntax(accentuee)["valid"] is False, accentuee
        assert par_email_validator(accentuee) is True, accentuee
    # Témoin : la forme punycode du même domaine passe.
    assert check_email_syntax("jean@xn--xemple-9ua.fr")["valid"] is True


def test_lalgorithme_de_nettoyage_du_standard_est_applique_en_entier():
    """
    Commentaire : « Strip newlines from the value, then strip leading and
    trailing ASCII whitespace from the value. » Les deux moitiés, et dans cet
    ordre. La fiche tire toute son autorité de ce texte : en appliquer la
    moitié, c'est refuser ce que le champ a accepté, ou l'inverse.
    """
    # Les blancs de bord, comme avant.
    assert check_email_syntax("  contact@exemple.fr\n")["normalised"] == "contact@exemple.fr"
    assert par_email_validator("contact@exemple.fr\n") is False
    # Première moitié : un saut de ligne AU MILIEU, ce que produit une adresse
    # collée d'une signature ou d'un PDF coupé en deux lignes. Le navigateur le
    # retire et valide.
    coupee = check_email_syntax("jean@ex\nemple.fr")
    assert coupee["valid"] is True
    assert coupee["normalised"] == "jean@exemple.fr"
    assert check_email_syntax("jean\r\n@exemple.fr")["normalised"] == "jean@exemple.fr"
    # Seconde moitié : la tabulation verticale n'est PAS un blanc ASCII au sens
    # du standard, donc le navigateur refuse, donc cet extrait refuse.
    assert ASCII_WHITESPACE == "\t\n\f\r "
    assert "\v" not in ASCII_WHITESPACE
    verticale = check_email_syntax("jean@exemple.fr\x0b")
    assert verticale["valid"] is False
    assert verticale["reason"] == "does not match the HTML definition of an email address"
    # Témoin : un blanc ordinaire à l'intérieur reste une faute.
    assert check_email_syntax("con tact@exemple.fr")["valid"] is False


def test_lexpression_du_standard_est_transcrite_caractere_pour_caractere():
    """
    Docstring : « transcribed character for character ». La fiche repose
    entièrement là-dessus, donc la source est recopiée ici et comparée : le
    jour où quelqu'un « améliore » l'expression, ce test tombe.
    """
    # html.spec.whatwg.org/multipage/input.html, section « E-mail state », au
    # « \/ » près que le littéral JavaScript du standard impose.
    du_standard = (
        r"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+"
        r"@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?"
        r"(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$"
    )
    assert WHATWG.pattern == du_standard


def test_aucune_entree_ne_leve_et_la_raison_nomme_ce_qui_a_ete_recu():
    """Docstring : « Nothing raises ». R14 : la raison dit le type reçu."""
    assert check_email_syntax(None)["reason"] == "an address is text, not NoneType"
    assert check_email_syntax(b"a@b.fr")["reason"] == "an address is text, not bytes"
    for entree in [None, 0, 4.2, b"a@b.fr", [], {}, object(), "", "x" * 10_000]:
        rapport = check_email_syntax(entree)
        assert rapport["valid"] is False
        assert isinstance(rapport["reason"], str) and rapport["reason"]


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_entree_banale_ce_quon_saisit_dans_un_formulaire():
    """T5 : l'entrée ordinaire du public visé."""
    for banale in BANALES:
        rapport = check_email_syntax(banale)
        assert rapport["valid"] is True, banale
        assert rapport["routable"] is True, banale


def test_production_entree_vide():
    assert check_email_syntax("")["valid"] is False
    assert check_email_syntax("   ")["valid"] is False
    assert check_email_syntax("   ")["reason"] == (
        "does not match the HTML definition of an email address")


def test_production_entree_tres_grande_et_terminaison_rapide():
    """
    Une adresse d'un mégaoctet : l'expression régulière ne doit pas s'effondrer.
    Le motif du standard n'a pas de retour arrière imbriqué, et le test le
    vérifie plutôt que de le supposer.
    """
    for enorme in ["a" * 1_000_000 + "@exemple.fr", "a@" + "b" * 1_000_000,
                   "a" * 500_000 + "." * 500_000 + "@exemple.fr"]:
        debut = time.perf_counter()
        rapport = check_email_syntax(enorme)
        assert time.perf_counter() - debut < 5.0
        assert rapport["valid"] is False


def test_production_encodages_inattendus():
    # Marque d'ordre des octets, largeur nulle, emoji, espace insécable :
    # aucun n'est un caractère de la définition, tous sont refusés.
    for parasite in ("﻿", "​", "🙂", " "):
        assert check_email_syntax(f"jean{parasite}@exemple.fr")["valid"] is False, parasite
    # Accents décomposés : refusés comme les composés, l'ASCII seul passe.
    assert check_email_syntax("jéan@exemple.fr")["valid"] is False
    # Casse mixte du domaine : relevée, pas refusée.
    assert check_email_syntax("jean@EXEMPLE.FR")["domain"] == "exemple.fr"


def test_production_valeurs_aux_limites():
    # Partie locale : soixante-trois, soixante-quatre, soixante-cinq.
    for longueur, attendu in ((63, True), (64, True), (65, False)):
        assert check_email_syntax("a" * longueur + "@exemple.fr")["valid"] is attendu
    # Adresse entière : exactement le plafond, et un caractère de plus.
    domaine = "@" + "b" * 60 + ".fr"
    local = "a" * (MAX_ADDRESS - len(domaine))
    au_plafond = local + domaine
    assert len(au_plafond) == MAX_ADDRESS
    assert check_email_syntax(au_plafond)["valid"] is False  # partie locale trop longue
    # Un domaine long et une partie locale courte, exactement au plafond.
    etiquettes = ".".join(["b" * 61] * 4)
    adresse = "a@" + etiquettes
    assert len(adresse) == 2 + len(etiquettes)
    assert check_email_syntax(adresse)["valid"] is (len(adresse) <= MAX_ADDRESS)


def test_production_une_adresse_invalide_dans_un_lot_nempeche_pas_les_autres():
    """T8 : une donnée sale ne fait pas tomber la liste d'envoi."""
    lot = ["jean@exemple.fr", "pas une adresse", "marie@exemple.fr", "", "jean@localhost"]
    assert [check_email_syntax(x)["valid"] for x in lot] == [True, False, True, False, True]


def test_production_le_controle_tient_la_classe_de_latence_annoncee():
    """latency « <1 ms » : cent mille contrôles sous une borne d'effondrement large."""
    debut = time.perf_counter()
    for _ in range(100_000):
        check_email_syntax("jean.dupont@exemple.fr")
    assert time.perf_counter() - debut < 10.0


# ---------------------------------------------------------------------------
# Parité entre les deux langages
# ---------------------------------------------------------------------------


def test_python_et_javascript_rendent_le_meme_rapport():
    """La fiche montre les deux extraits : elle affirme la même chose des deux."""
    node = shutil.which("node")
    assert node, "node est requis pour comparer les deux implémentations"
    entrees = BATTERIE + BANALES + [
        "jean@EXEMPLE.FR", "jéan@exemple.fr", "jean﻿@exemple.fr",
        "jean​@exemple.fr", "jean🙂@exemple.fr", "jean @exemple.fr",
        "a" * 63 + "@exemple.fr", "a" * 64 + "@exemple.fr", "a" * 66 + "@exemple.fr",
        "a@" + ".".join(["b" * 61] * 4), "con tact@exemple.fr", "jean@exemple.fr\t",
        "\tjean@exemple.fr", "jean@gmail.com",
        # Les deux moitiés de l'algorithme de nettoyage, des deux côtés.
        "jean@ex\nemple.fr", "jean\r\n@exemple.fr", "jean@exemple.fr\x0b",
        "\x0bjean@exemple.fr",
    ]
    attendu = [check_email_syntax(e) for e in entrees]
    script = (
        f"import {{ checkEmailSyntax }} from {json.dumps((ICI / 'n0.js').as_uri())};"
        "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{"
        "process.stdout.write(JSON.stringify(JSON.parse(d).map(checkEmailSyntax)));});"
    )
    sortie = subprocess.run([node, "--input-type=module", "-e", script],
                            input=json.dumps(entrees), capture_output=True,
                            text=True, timeout=60, check=True)
    assert json.loads(sortie.stdout) == attendu
