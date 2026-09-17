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
    « La clé de contrôle d'un IBAN peut être satisfaite par coïncidence : une
    référence de commande écrite « DE 86 3456 7890 1234 » la passe, et elle est
    masquée à tort. »
    """
    reference = "DE 86 3456 7890 1234"
    assert iban_checksum_is_valid(reference)  # la clé tombe juste par coïncidence
    assert mask(f"commande {reference} expédiée") == "commande [iban] expédiée"

    # Témoin : la même référence avec une autre clé n'est pas touchée,
    # et un vrai IBAN est masqué de la même façon.
    assert mask("commande DE 12 3456 7890 1234 expédiée") == "commande DE 12 3456 7890 1234 expédiée"
    assert mask("commande 86 3456 7890 1234 expédiée") == "commande 86 3456 7890 1234 expédiée"
    assert iban_checksum_is_valid("FR76 3000 6000 0112 3456 7890 189")
    assert mask("compte FR76 3000 6000 0112 3456 7890 189") == "compte [iban]"


def test_point_de_rupture_sur_les_cent_cles_de_la_reference_une_seule_est_masquee():
    """« par coïncidence » : de « DE 00 … » à « DE 99 … », seule la clé 86 passe."""
    masked = [key for key in range(100) if mask(f"DE {key:02d} 3456 7890 1234") == "[iban]"]
    assert masked == [86]
    assert [key for key in range(100) if iban_checksum_is_valid(f"DE{key:02d}345678901234")] == [86]


# ---------------------------------------------------------------------------
# Autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_masque_une_adresse_electronique():
    assert mask("write to me at jean.dupont@example.com") == "write to me at [email]"


def test_masque_un_numero_avec_espace_point_tiret_barre_ou_sans_separateur():
    """
    Commentaire : « 0X XX XX XX XX, +33 X XX XX XX XX, or +33 (0)X XX XX XX XX.
    Between digits: a space, a dot, a dash or a slash, one or two of them, or nothing. »
    """
    for written in (
        "0612345678", "06 12 34 56 78", "06.12.34.56.78", "06-12-34-56-78", "06/12/34/56/78",
        "+33 6 12 34 56 78", "+33612345678", "+33 (0)6 12 34 56 78",
    ):
        assert mask(f"call me on {written}") == "call me on [phone]", written


def test_le_motif_de_telephone_tolere_un_ou_deux_separateurs_pas_trois():
    """Docstring : « the phone pattern tolerates the separators people type between digits — […] one or two of them »."""
    for written in ("06 12  34 56 78", "06//12//34//56//78", "06. 12 34 56 78", "06 /12 34 56 78", "+33  (0) 6.12.34.56.78"):
        assert mask(f"call me on {written}") == "call me on [phone]", written
    # Limite : trois séparateurs à la suite ne sont plus un numéro.
    for written in ("06   12 34 56 78", "06 . 12 34 56 78"):
        assert mask(f"call me on {written}") == f"call me on {written}", written


def test_masque_un_iban_espace_ou_non():
    for written in ("FR7630006000011234567890189", "FR76 3000 6000 0112 3456 7890 189"):
        assert mask(f"account {written} please") == "account [iban] please", written


def test_un_iban_russe_de_trente_trois_caracteres_est_masque_groupe_ou_non():
    """Commentaire : « then the account number in groups of four, spaced or not »."""
    russian = "RU0304452522540817810538091310419"  # 33 caractères, clé valide
    assert iban_checksum_is_valid(russian)
    assert mask(f"compte {russian}") == "compte [iban]"
    assert mask("compte RU03 0445 2522 5408 1781 0538 0913 1041 9") == "compte [iban]"


def test_la_cle_decide_pas_le_motif_limites_de_longueur():
    """
    Commentaire : « The check digits decide, not the pattern. » Quinze caractères
    (Norvège) : masqué ; trente-quatre : masqué ; quatorze, clé juste : pas un IBAN.
    """
    assert mask("compte NO9386011117947") == "compte [iban]"
    assert mask("compte NO93 8601 1117 947") == "compte [iban]"
    longest = "XK87ABCD12345678901234567890EFGHIJ"
    assert len(longest) == 34 and iban_checksum_is_valid(longest)
    assert mask(f"compte {longest}") == "compte [iban]"
    fourteen = "NO698601111794"
    assert iban_checksum_is_valid(fourteen)
    assert mask(f"compte {fourteen}") == f"compte {fourteen}"


def test_un_iban_de_vingt_huit_caracteres_apres_la_cle_est_masque():
    saint_lucia = "LC55HEMM000100010012001200023015"
    assert iban_checksum_is_valid(saint_lucia)
    assert mask(f"compte {saint_lucia}") == "compte [iban]"


def test_laisse_le_texte_ordinaire_intact():
    text = "The meeting is at 10, room 4, bring the 2024 report."
    assert mask(text) == text


def test_la_normalisation_replie_les_espaces_de_la_typographie_francaise():
    """Docstring : « the spaces of French typography […] become a plain space »."""
    for space in (" ", " ", " ", " ", " ", "⁠"):
        assert normalise(f"06{space}12") == "06 12", hex(ord(space))
        assert mask(f"06{space}12{space}34{space}56{space}78") == "[phone]", hex(ord(space))


def test_le_repli_de_compatibilite_ramene_les_chiffres_pleine_largeur():
    assert normalise("０６ １２") == "06 12"
    assert mask("appelle au ０６ １２ ３４ ５６ ７８") == "appelle au [phone]"
    assert mask("jean＠example.com") == "[email]"


def test_les_caracteres_sans_chasse_et_le_trait_d_union_conditionnel_deviennent_une_espace():
    """
    Docstring : « the zero-width characters and the soft hyphen become a plain space » ;
    commentaire : « the soft hyphen, the zero-width space and joiners, the word joiner and the byte order mark ».
    """
    for invisible in ("\u200b", "\u200c", "\u200d", "\u2060", "\u00ad", "\ufeff"):
        assert normalise(f"06{invisible}12") == "06 12", hex(ord(invisible))
        assert mask(invisible.join(["06", "12", "34", "56", "78"])) == "[phone]", hex(ord(invisible))


def test_la_normalisation_garde_les_caracteres_d_une_adresse():
    """Docstring : « every character is written in its plain form » : la ponctuation d'une adresse reste."""
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


def test_les_etiquettes_sont_posees_dans_le_message_tel_qu_il_a_ete_ecrit():
    """
    Docstring : « The labels are then put into the message as it was written » : autour
    d'un numéro repéré dans la copie normalisée, le reste du message garde ses caractères.
    """
    assert mask("Merci… appelle au 06\u202f12\u202f34\u202f56\u202f78, 20 m², ﬁn") == "Merci… appelle au [phone], 20 m², ﬁn"
    assert mask("tel\u00a006 12 34 56 78\u00a0!") == "tel\u00a0[phone]\u00a0!"
    assert mask("au ０６ １２ ３４ ５６ ７８ ⁂") == "au [phone] ⁂"
    # Un caractère que le repli allonge (ﷺ devient dix-huit caractères) ne décale pas l'étiquette.
    assert len(normalise("ﷺ")) == 18
    assert mask("ﷺ 06 12 34 56 78 ﷺ jean@example.com") == "ﷺ [phone] ﷺ [email]"


def test_un_message_sans_coordonnee_ressort_inchange_a_la_composition_des_accents_pres():
    """
    Docstring : « a message with nothing to mask comes back unchanged, apart from the
    composition of its accents (NFC), which changes nothing on screen ».
    """
    text = "Merci… à bientôt\u00a0! La pièce fait 20 m², ﬁn du devis.\u202f"
    assert mask(text) == text
    decomposed = unicodedata.normalize("NFD", "élève à côté, 20 m²")
    assert mask(decomposed) == unicodedata.normalize("NFC", decomposed)
    assert mask(decomposed) != decomposed


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


def test_production_une_longue_suite_de_lettres_sans_arobase_se_traite_vite():
    start = time.perf_counter()
    mask("a" * 30_000)
    assert time.perf_counter() - start < 0.2
    start = time.perf_counter()
    mask("a" * 300_000)
    assert time.perf_counter() - start < 3


def test_sans_le_regard_arriere_une_longue_suite_de_lettres_prend_un_temps_quadratique():
    """
    Commentaire : « The lookbehind starts a match only at the beginning of a word: without it,
    a long run of letters with no @ takes quadratic time. » Même motif, regard arrière retiré.
    """
    lookbehind = r"(?<![\w.+-])"
    assert n0.EMAIL.pattern.startswith(lookbehind)
    without = re.compile(n0.EMAIL.pattern[len(lookbehind):])
    letters = "a" * 10_000

    start = time.perf_counter()
    n0.EMAIL.sub("x", letters)
    kept = time.perf_counter() - start
    start = time.perf_counter()
    without.sub("x", letters)
    removed = time.perf_counter() - start
    assert removed > 20 * kept
    # Doubler la longueur multiplie le temps sans regard arrière par bien plus que deux.
    start = time.perf_counter()
    without.sub("x", letters * 2)
    assert time.perf_counter() - start > 2.5 * removed


def test_production_de_longues_suites_de_chiffres_de_blocs_ou_de_points_se_traitent_vite():
    for text in ("1" * 300_000, "AB12 " + "ABCD " * 60_000, "06 " * 100_000, "a." * 100_000 + "@", "ﷺ" * 100_000):
        start = time.perf_counter()
        mask(text)
        assert time.perf_counter() - start < 3, text[:10]


def test_production_un_caractere_de_largeur_nulle_ne_laisse_pas_passer_un_numero():
    for invisible in ("​", "­"):
        assert mask(invisible.join(["06", "12", "34", "56", "78"])) == "[phone]", hex(ord(invisible))


def test_production_un_message_sans_coordonnee_ressort_intact():
    text = "Merci… à bientôt ! La pièce fait 20 m², ﬁn du devis."
    assert mask(text) == text


def test_un_iban_est_lu_en_majuscules_seulement():
    """Commentaire : « Upper case only, the way ISO 13616 prints one »."""
    assert mask("compte FR76 3000 6000 0112 3456 7890 189") == "compte [iban]"
    assert mask("compte GB82 WEST 1234 5698 7654 32") == "compte [iban]"
    # En minuscules, il passe : c'est le prix du faux positif évité juste après.
    assert mask("compte fr76 3000 6000 0112 3456 7890 189") == "compte fr76 3000 6000 0112 3456 7890 189"
    assert mask("compte Gb82 West 1234 5698 7654 32") == "compte Gb82 West 1234 5698 7654 32"


def test_une_phrase_ordinaire_n_est_pas_masquee_comme_un_iban():
    """Commentaire : « any sentence whose words happened to fall in fours […] "le 10 mars 2023 pour" does »."""
    text = "rendez-vous le 10 mars 2023 pour la signature"
    assert mask(text) == text
    # Témoin : la même phrase en majuscules, elle, est encore prise.
    assert mask(text.upper()) == "RENDEZ-VOUS [iban] LA SIGNATURE"


def test_production_un_iban_suivi_d_un_mot_est_masque_et_le_mot_reste():
    """Docstring de iban_prefix : « cut at a space: the pattern may swallow the next word »."""
    assert mask("BE68 5390 0754 7034 dans la journée") == "[iban] dans la journée"
    assert mask("BE68 5390 0754 7034 abcd ok") == "[iban] abcd ok"
    assert mask("BE68 5390 0754 7034 abc") == "[iban] abc"


def test_production_une_phrase_ordinaire_en_minuscules_n_est_pas_masquee():
    """Le motif insensible à la casse lit « le 12 mars 2024 dans » comme un candidat ; la clé l'écarte."""
    for text in ("le 12 mars 2024 dans la salle", "on se voit le 15 juin 2025 pour la fête"):
        assert mask(text) == text




def test_production_le_format_international_avec_zero_entre_parentheses_est_masque():
    assert mask("tel +33 (0)6 12 34 56 78") == "tel [phone]"


def test_production_une_sequence_d_emoji_a_liant_est_conservee():
    """Le liant sans chasse est replié en espace dans la copie seulement : la famille reste entière."""
    family = "👨\u200d👩\u200d👧"
    assert mask(f"famille {family} 06 12 34 56 78") == f"famille {family} [phone]"
    assert mask(f"{family}jean@example.com{family}") == f"{family}[email]{family}"


def test_production_les_chiffres_arabes_indiens_ne_sont_pas_lus_comme_des_chiffres():
    """re.ASCII en Python, \\d sans drapeau u en JavaScript : même sortie dans les deux langages."""
    text = "tel ٠٦ ١٢ ٣٤ ٥٦ ٧٨"
    assert mask(text) == text


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
    # « 00 » ouvre un indicatif : huit chiffres derrière, c'est un numéro.
    assert mask("n 00 12 34 56 78") == "n [phone]"


def test_un_numero_etranger_ordinaire_est_masque():
    """
    Commentaire : « Without this pattern a Belgian, Swiss or British number goes
    through unmasked, which on a marketplace is not an evasion, it is a user ».
    """
    assert mask("appelle moi au +32 470 12 34 56") == "appelle moi au [phone]"
    assert mask("+44 7700 900123") == "[phone]"
    assert mask("0033 6 12 34 56 78") == "[phone]"
    assert mask("+41 79 123 45 67") == "[phone]"
    # Témoin : un montant et une date ne sont pas des numéros.
    inchange = "le prix est 1 234,56 euros le 01/02/2024"
    assert mask(inchange) == inchange


def test_la_longueur_maximale_de_e_164_borne_le_motif():
    """Commentaire : « Fifteen is the maximum length of a number in recommendation ITU-T E.164 »."""
    assert mask("+" + "1" * 15) == "[phone]"
    assert mask("+" + "1" * 16) == "+" + "1" * 16
    assert mask("+" + "1" * 8) == "[phone]"
    assert mask("+" + "1" * 7) == "+" + "1" * 7
