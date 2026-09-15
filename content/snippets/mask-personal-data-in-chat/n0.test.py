import ast
import re
import sys
import time
import unicodedata
from pathlib import Path

import pytest

import n0
from n0 import mask, normalise

ESSAI = Path(__file__).parents[2] / "tryouts" / "live" / "mask-personal-data-in-chat.js"
TEMOIN = "appelle-moi au 06 12 34 56 78"


def iban_checksum_is_valid(iban: str) -> bool:
    """ISO 13616 : lettres en nombres, quatre premiers caractères à la fin, reste modulo 97 égal à 1."""
    compact = iban.replace(" ", "").upper()
    rearranged = compact[4:] + compact[:4]
    return int("".join(str(int(c, 36)) for c in rearranged)) % 97 == 1


def essai_inputs() -> list[tuple[str, str]]:
    """Les saisies fr/en des cas de l'essai, lues dans le fichier de l'essai lui-même."""
    source = ESSAI.read_text(encoding="utf-8")
    return re.findall(r"input: \{\s*fr: '([^']*)',\s*en: '([^']*)',?\s*\}", source)


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_les_chiffres_en_lettres_passent_au_travers():
    """« zéro six douze » / « Spelled-out digits » : rien n'est masqué."""
    assert mask("zéro six douze") == "zéro six douze"
    assert mask("call me on zero six twelve thirty-four") == "call me on zero six twelve thirty-four"
    # Témoin : le même numéro en chiffres est masqué.
    assert mask(TEMOIN) == "appelle-moi au [phone]"


def test_point_de_rupture_les_chiffres_sosies_passent_au_travers():
    """« O6 I2 34 » : des lettres à la place des chiffres, rien n'est masqué."""
    assert mask("O6 I2 34") == "O6 I2 34"
    assert mask("appelle-moi au O6 I2 34 56 78") == "appelle-moi au O6 I2 34 56 78"
    assert mask(TEMOIN) == "appelle-moi au [phone]"


def test_point_de_rupture_des_emojis_intercales_passent_au_travers():
    """« des emojis intercalés » : rien ne ressemble plus à un numéro."""
    assert mask("appelle-moi au 06🙂12🙂34🙂56🙂78") == "appelle-moi au 06🙂12🙂34🙂56🙂78"
    assert mask(TEMOIN) == "appelle-moi au [phone]"


def test_point_de_rupture_une_reference_de_commande_est_masquee_comme_un_iban():
    """
    « Le motif d'IBAN n'a pas de somme de contrôle : une référence de commande
    écrite « DE 12 3456 7890 1234 » est masquée à tort. »
    """
    reference = "DE 12 3456 7890 1234"
    assert not iban_checksum_is_valid(reference)  # ce n'est pas un IBAN
    assert mask(f"commande {reference} expédiée") == "commande [iban] expédiée"

    # Témoin : la même référence sans lettres de pays n'est pas touchée,
    # et un IBAN valide est masqué de la même façon.
    assert mask("commande 12 3456 7890 1234 expédiée") == "commande 12 3456 7890 1234 expédiée"
    assert iban_checksum_is_valid("FR76 3000 6000 0112 3456 7890 189")
    assert mask("compte FR76 3000 6000 0112 3456 7890 189") == "compte [iban]"


# ---------------------------------------------------------------------------
# Autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_masque_une_adresse_electronique():
    assert mask("write to me at jean.dupont@example.com") == "write to me at [email]"


def test_masque_un_numero_avec_espace_point_tiret_ou_sans_separateur():
    """Commentaire : « The separator between digits may be a space, a dot or a dash, or absent. »"""
    for written in ("0612345678", "06 12 34 56 78", "06.12.34.56.78", "06-12-34-56-78", "+33 6 12 34 56 78", "+33612345678"):
        assert mask(f"call me on {written}") == "call me on [phone]", written


@pytest.mark.xfail(
    strict=True,
    reason="INFIRMÉ : la docstring dit que chaque motif tolère les séparateurs réellement tapés ; "
    "« 06/12/34/56/78 » et une double espace « 06 12  34 56 78 » passent en clair",
)
def test_chaque_motif_tolere_les_separateurs_reellement_tapes():
    for written in ("06/12/34/56/78", "06 12  34 56 78"):
        assert mask(f"call me on {written}") == "call me on [phone]", written


def test_masque_un_iban_espace_ou_non():
    for written in ("FR7630006000011234567890189", "FR76 3000 6000 0112 3456 7890 189"):
        assert mask(f"account {written} please") == "account [iban] please", written


@pytest.mark.xfail(
    strict=True,
    reason="INFIRMÉ : le commentaire dit « up to thirty alphanumerics » après la clé ; le motif en accepte 28, "
    "un IBAN russe valide de 33 caractères passe en clair",
)
def test_un_iban_compte_jusqu_a_trente_caracteres_apres_la_cle():
    russian = "RU0304452522540817810538091310419"  # 29 caractères après la clé, somme valide
    assert iban_checksum_is_valid(russian)
    assert mask(f"compte {russian}") == "compte [iban]"


def test_un_iban_de_vingt_huit_caracteres_apres_la_cle_est_masque():
    saint_lucia = "LC55HEMM000100010012001200023015"
    assert iban_checksum_is_valid(saint_lucia)
    assert mask(f"compte {saint_lucia}") == "compte [iban]"


def test_laisse_le_texte_ordinaire_intact():
    text = "The meeting is at 10, room 4, bring the 2024 report."
    assert mask(text) == text


def test_la_normalisation_replie_les_espaces_de_la_typographie_francaise():
    """Commentaire : « The space characters French typography puts inside numbers, plus the word joiner »."""
    for space in (" ", " ", " ", " ", " ", "⁠"):
        assert normalise(f"06{space}12") == "06 12", hex(ord(space))
        assert mask(f"06{space}12{space}34{space}56{space}78") == "[phone]", hex(ord(space))


def test_le_repli_de_compatibilite_ramene_les_chiffres_pleine_largeur():
    assert normalise("０６ １２") == "06 12"
    assert mask("appelle au ０６ １２ ３４ ５６ ７８") == "appelle au [phone]"
    assert mask("jean＠example.com") == "[email]"


@pytest.mark.xfail(
    strict=True,
    reason="INFIRMÉ : la docstring dit que les liants invisibles laissés par le repli deviennent une espace ; "
    "seul U+2060 l'est, le liant sans chasse U+200D reste, et le numéro passe",
)
def test_les_liants_invisibles_deviennent_une_espace():
    assert normalise("06‍12") == "06 12"
    assert mask("06‍12‍34‍56‍78") == "[phone]"


def test_la_normalisation_garde_les_caracteres_d_une_adresse():
    """« Retirer la ponctuation détruirait les caractères mêmes dont une adresse est faite. »"""
    address = "jean.du-pont+chat@exemple.fr"
    assert normalise(address) == address
    assert mask(f"écris à {address}") == "écris à [email]"


def test_l_ordre_des_motifs_compte_pour_une_adresse_qui_contient_un_numero():
    """« Order matters: an email may contain digits that would otherwise be read as the start of a phone number. »"""
    address = "jean0612345678@example.com"
    assert mask(address) == "[email]"

    # Le téléphone d'abord : le nom et le domaine restent lisibles.
    text = normalise(address)
    for pattern, label in reversed(n0.PATTERNS):
        text = pattern.sub(label, text)
    assert text == "jean[phone]@example.com"


def test_une_etiquette_nomme_ce_qui_a_ete_retire():
    """« A label beats a row of asterisks: whoever reads the thread later can see that a phone number was removed. »"""
    message = "jean@example.com, 06 12 34 56 78, FR76 3000 6000 0112 3456 7890 189"
    assert mask(message) == "[email], [phone], [iban]"


def test_n0_n_emploie_que_la_bibliotheque_standard():
    source = (Path(__file__).parent / "n0.py").read_text(encoding="utf-8")
    modules = set()
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, ast.Import):
            modules |= {alias.name.split(".")[0] for alias in node.names}
        elif isinstance(node, ast.ImportFrom):
            modules.add(node.module.split(".")[0])
    assert modules and modules <= set(sys.stdlib_module_names)


def test_n0_est_deterministe():
    message = "Bonjour, appelez-moi au 06 12 34 56 78 ou écrivez à marie.durand@exemple.fr"
    assert len({mask(message) for _ in range(50)}) == 1


def test_un_message_se_masque_en_une_fraction_de_milliseconde():
    """scenario : « en une fraction de milliseconde » ; latency : « <1 ms ». Meilleur de cinq séries de cent appels."""
    message = "Bonjour, appelez-moi au 06 12 34 56 78 ou écrivez à marie.durand@exemple.fr"
    runs = []
    for _ in range(5):
        start = time.perf_counter()
        for _ in range(100):
            mask(message)
        runs.append((time.perf_counter() - start) / 100)
    assert min(runs) < 0.001


def test_l_essai_masque_ses_trois_premiers_cas_et_laisse_passer_le_numero_en_lettres():
    """
    Essai : « Un téléphone et un email », « Un IBAN au milieu d'une phrase »,
    « Un numéro collé, sans espaces » ; cas qui échoue : « Rien n'est masqué :
    la règle cherche des chiffres, et il n'y en a aucun. »
    """
    (fr1, en1), (fr2, en2), (fr3, en3), (fr4, en4) = essai_inputs()
    assert mask(fr1) == "Bonjour, appelez-moi au [phone] ou écrivez à [email]"
    assert mask(en1) == "Hello, call me on [phone] or write to [email]"
    assert mask(fr2) == "Le virement part sur [iban], dis-moi si ça arrive"
    assert mask(en2) == "The transfer goes to [iban], tell me when it lands"
    assert mask(fr3) == "mon num c’est [phone], appelle quand tu veux"
    assert mask(en3) == "my number is [phone], call whenever"
    for spelled in (fr4, en4):
        assert not any(c.isdigit() for c in spelled)
        assert mask(spelled) == spelled


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_une_chaine_vide_rend_une_chaine_vide():
    assert mask("") == ""


def test_production_mille_messages_d_un_bloc_terminent_vite():
    message = "Bonjour, appelez-moi au 06 12 34 56 78 ou écrivez à marie.durand@exemple.fr. "
    start = time.perf_counter()
    out = mask(message * 1000)
    assert time.perf_counter() - start < 1
    assert out.count("[phone]") == 1000 and out.count("[email]") == 1000


@pytest.mark.xfail(
    strict=True,
    reason="DÉFAUT : une suite de 30 000 caractères de mot sans @ prend plus d'une seconde "
    "(retour arrière quadratique de [\\w.+-]+@ : 0,2 s à 10 000, 3 s à 40 000)",
)
def test_defaut_une_longue_suite_de_lettres_se_traite_en_temps_lineaire():
    start = time.perf_counter()
    mask("a" * 30_000)
    assert time.perf_counter() - start < 0.2


@pytest.mark.xfail(
    strict=True,
    reason="DÉFAUT : l'espace sans chasse U+200B et le trait d'union conditionnel U+00AD laissent passer un numéro",
)
def test_defaut_un_caractere_de_largeur_nulle_ne_laisse_pas_passer_un_numero():
    for invisible in ("​", "­"):
        assert mask(invisible.join(["06", "12", "34", "56", "78"])) == "[phone]", hex(ord(invisible))


@pytest.mark.xfail(
    strict=True,
    reason="DÉFAUT : un message sans coordonnée ressort réécrit par NFKC : « … » devient « ... », "
    "« m² » devient « m2 », « ﬁ » devient « fi », l'espace insécable devient ordinaire",
)
def test_defaut_un_message_sans_coordonnee_ressort_intact():
    text = "Merci… à bientôt ! La pièce fait 20 m², ﬁn du devis."
    assert mask(text) == text


@pytest.mark.xfail(strict=True, reason="DÉFAUT : un IBAN tapé en minuscules passe en clair")
def test_defaut_un_iban_en_minuscules_est_masque():
    assert mask("compte fr76 3000 6000 0112 3456 7890 189") == "compte [iban]"


@pytest.mark.xfail(strict=True, reason="DÉFAUT : le format international courant « +33 (0)6 12 34 56 78 » passe en clair")
def test_defaut_le_format_international_avec_zero_entre_parentheses_est_masque():
    assert mask("tel +33 (0)6 12 34 56 78") == "tel [phone]"


def test_production_une_adresse_accentuee_est_masquee_en_entier():
    """En Python, \\w couvre les lettres accentuées, composées ou décomposées."""
    for address in ("josé@exemple.fr", "marie.hélène@exemple.fr", unicodedata.normalize("NFD", "marie.hélène@exemple.fr")):
        assert mask(f"écris à {address}") == "écris à [email]", address


def test_production_marque_d_ordre_des_octets_et_casse_mixte():
    assert mask("﻿06 12 34 56 78") == "﻿[phone]"
    assert mask("Jean.Dupont@Example.COM") == "[email]"


def test_production_un_numero_a_exactement_dix_chiffres():
    assert mask("n 0612345678") == "n [phone]"
    assert mask("n 061234567") == "n 061234567"  # neuf chiffres
    assert mask("n 06123456789") == "n 06123456789"  # onze chiffres
    assert mask("n 00 12 34 56 78") == "n 00 12 34 56 78"  # 0 suivi de 0
