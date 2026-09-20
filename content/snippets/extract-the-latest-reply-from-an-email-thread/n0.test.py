import json
import shutil
import subprocess
import time
from pathlib import Path

from email_reply_parser import EmailReplyParser

from n0 import extract_reply

ICI = Path(__file__).parent

# Le fil ordinaire : une réponse au-dessus, la citation dessous, telle que
# l'écrivent Gmail, Thunderbird et à peu près tout le reste.
FIL_FR = """Bonjour Marie,

Le devis est signé, vous pouvez lancer la production.

Bien à vous,
Jean Dupont

Le 10 octobre 2026 à 13:55, Marie Martin <marie@exemple.fr> a écrit :
> Bonjour Jean,
>
> Pouvez-vous confirmer le devis DV-2026-118 avant vendredi ?
>
> Cordialement,
> Marie
"""

FIL_EN = """Hi Marie,

The quote is signed, you can start production.

Best,
Jean

On Oct 10, 2026, at 1:55 PM, Marie Martin <marie@exemple.fr> wrote:
> Hi Jean,
>
> Could you confirm quote DV-2026-118 before Friday?
>
> Regards,
> Marie
"""

# Outlook ne préfixe rien : il pose un trait et recopie les en-têtes.
FIL_OUTLOOK_FR = """Bonjour Marie,

C'est noté, je m'en occupe.

Jean

________________________________
De : Marie Martin <marie@exemple.fr>
Envoyé : jeudi 10 octobre 2026 13:55
À : Jean Dupont <jean@exemple.fr>
Objet : RE: Devis DV-2026-118

Bonjour Jean,
Pouvez-vous confirmer le devis avant vendredi ?
Marie
"""

# La réponse est écrite entre les lignes citées, sous chaque question.
FIL_INTERCALE = """Le 10 octobre 2026 à 13:55, Marie Martin <marie@exemple.fr> a écrit :
> Pouvez-vous confirmer le devis DV-2026-118 avant vendredi ?
Oui, il est signé de ce matin.
> Et la livraison est-elle toujours prévue le 20 ?
Non, le 22 : le transporteur a décalé la tournée.
"""

# La réponse est écrite sous la citation, en entier.
FIL_SOUS = """Le 10 octobre 2026 à 13:55, Marie Martin <marie@exemple.fr> a écrit :
> Bonjour Jean,
> Pouvez-vous confirmer le devis DV-2026-118 avant vendredi ?
> Cordialement,
> Marie

Bonjour Marie,

Le devis est signé, vous pouvez lancer la production dès lundi.

Bien à vous,
Jean Dupont
"""

# Gmail replie la ligne d'attribution quand elle est longue.
FIL_REPLIE = """Bonjour Marie,

C'est d'accord.

Le mer. 10 oct. 2026 à 13:55, Marie Martin
<marie.martin@service-achats.exemple.fr> a
écrit :
> Pouvez-vous confirmer ?
"""

FIL_ORIGINE = """Merci, c'est reçu.

-----Message d'origine-----
De : Marie Martin
Objet : Devis

Bonjour Jean,
"""

FIL_SANS_CITATION = """Bonjour Marie,

Le devis est signé.

Bien à vous,
Jean Dupont
"""

# La ligne d'attribution de Gmail, qui fait soixante-neuf caractères : c'est
# elle qui était comptée comme du texte écrit sous la citation, si bien que
# toute réponse plus courte qu'elle déclenchait le signal.
ATTRIBUTION = "Le 10 octobre 2026 à 13:55, Marie Martin <marie@exemple.fr> a écrit :"

# Une réponse courte, celle qui remplit une boîte aux lettres professionnelle.
def fil_avec(reponse: str) -> str:
    """Le fil ordinaire, avec la réponse qu'on veut au-dessus de la citation."""
    return (f"{reponse}\n\n{ATTRIBUTION}\n> Bonjour Jean,\n"
            "> Pouvez-vous confirmer le devis DV-2026-118 avant vendredi ?\n> Marie\n")


TOUS = [FIL_FR, FIL_EN, FIL_OUTLOOK_FR, FIL_INTERCALE, FIL_SOUS, FIL_REPLIE,
        FIL_ORIGINE, FIL_SANS_CITATION,
        fil_avec("Oui."), fil_avec("C'est noté, merci."),
        fil_avec("a" * (len(ATTRIBUTION) - 1)), fil_avec("a" * len(ATTRIBUTION))]


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_une_reponse_ecrite_dans_la_citation_nest_pas_au_dessus():
    """
    « Une réponse écrite sous la citation, ou à l'intérieur d'elle, n'est pas
    au-dessus du premier marqueur. »
    """
    rapport = extract_reply(FIL_INTERCALE)
    assert rapport["reply"] == ""
    assert "Oui, il est signé de ce matin." in FIL_INTERCALE
    # Rien n'est rendu, mais rien n'est affirmé non plus : le rapport le dit.
    assert rapport["reason"] == "more text was written under the quote than above it"
    # Le fil entièrement répondu sous la citation se comporte pareil.
    assert extract_reply(FIL_SOUS)["reply"] == ""
    assert extract_reply(FIL_SOUS)["reason"] is not None


def test_une_reponse_courte_nest_pas_du_texte_ecrit_sous_la_citation():
    """
    Docstring : « What the attribution line itself holds is not counted as text
    written under the quote — it is the dressing of the quote, and it is
    sixty-nine characters long, which is longer than most business replies. »

    C'est ce qui a fait tomber cette fiche : une réponse d'affaires courte —
    « Oui », « C'est noté », « Ci-joint » — déclenchait le signal qui envoie le
    fil au niveau N3, c'est-à-dire à un appel facturé par message.
    """
    assert len(ATTRIBUTION) == 69
    for reponse in ["Oui.", "Oui, c'est signé.", "C'est noté, merci."]:
        rapport = extract_reply(fil_avec(reponse))
        assert rapport["reply"] == reponse, reponse
        assert rapport["reason"] is None, reponse


def test_valeurs_aux_limites_du_signal_de_texte_sous_la_citation():
    """
    Le seuil est la longueur de ce qui est écrit sous la coupe, habillage de la
    citation exclu. Ici la citation est préfixée par « > », donc rien n'est
    compté dessous : aucune réponse, si courte soit-elle, ne lève le signal.
    """
    for longueur in (1, len(ATTRIBUTION) - 1, len(ATTRIBUTION), len(ATTRIBUTION) + 1):
        rapport = extract_reply(fil_avec("a" * longueur))
        assert rapport["reply"] == "a" * longueur, longueur
        assert rapport["reason"] is None, longueur
    # Et le témoin, de l'autre côté du seuil : une seule ligne non préfixée
    # sous la citation, plus longue que la réponse, et le signal se lève.
    sous = fil_avec("Oui.").rstrip("\n") + "\n\nJe confirme aussi la livraison de lundi."
    rapport = extract_reply(sous)
    assert rapport["reply"] == "Oui."
    assert rapport["reason"] == "more text was written under the quote than above it"


def test_une_phrase_qui_commence_par_le_et_finit_par_a_ecrit_nest_pas_un_marqueur():
    """
    Commentaire : « Every mail client writes a date or an address in that line.
    Requiring one keeps « Le client a écrit : », which is a sentence and not a
    marker, from cutting the message at its first line. »
    """
    message = ("Le client a écrit :\n« merci pour le devis »\n\n"
               "Je confirme la commande.\n\nJean")
    rapport = extract_reply(message)
    assert rapport["reply"] == message.strip()
    assert rapport["quoted_from_line"] is None
    # Témoin : la même tournure avec une date est bien un marqueur.
    assert extract_reply(fil_avec("Oui."))["quoted_from_line"] == 2


def test_point_de_rupture_temoin_le_fil_ordinaire_revient_entier():
    """
    « Le témoin est dans le même test : la réponse écrite au-dessus revient
    entière, signature comprise, et sans une ligne de la citation. »
    """
    rapport = extract_reply(FIL_FR)
    assert rapport["reply"] == ("Bonjour Marie,\n\nLe devis est signé, vous pouvez "
                                "lancer la production.\n\nBien à vous,\nJean Dupont")
    assert rapport["reason"] is None
    assert "Marie" not in rapport["reply"].split("Bonjour Marie,")[1]


# ---------------------------------------------------------------------------
# Le verdict, confronté aux deux bibliothèques de référence
# ---------------------------------------------------------------------------


def test_verdict_les_deux_bibliotheques_de_reference_se_contredisent_en_francais():
    """
    R4 : la raison de ne pas appeler l'une des deux. Sur le même fil français,
    `email_reply_parser` garde l'en-tête de citation dans la réponse, et
    `email-reply-parser` retire la signature — qu'il garde en anglais.
    """
    python = EmailReplyParser.parse_reply(FIL_FR)
    assert python.endswith("a écrit :")  # l'en-tête français reste dans la réponse
    assert "a écrit" not in extract_reply(FIL_FR)["reply"]

    javascript = _visible([FIL_FR, FIL_EN])
    assert "Jean Dupont" not in javascript[0]  # « Bien à vous, » ouvre une signature
    assert "Jean" in javascript[1]  # « Best, » n'est pas dans sa liste
    assert "Jean Dupont" in extract_reply(FIL_FR)["reply"]
    assert "Jean" in extract_reply(FIL_EN)["reply"]

    # Et les deux extraits de la fiche, eux, répondent la même chose des deux.
    assert extract_reply(FIL_FR)["reply"].endswith("Jean Dupont")


def _visible(fils):
    """Ce que rend `email-reply-parser`, la bibliothèque JavaScript."""
    node = shutil.which("node")
    assert node, "node est requis pour comparer les deux bibliothèques"
    script = (
        "import P from 'email-reply-parser';"
        "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{"
        "process.stdout.write(JSON.stringify(JSON.parse(d)"
        ".map((f)=>new P().read(f).getVisibleText())));});"
    )
    sortie = subprocess.run([node, "--input-type=module", "-e", script],
                            input=json.dumps(fils), capture_output=True, text=True,
                            timeout=60, check=True, cwd=ICI)
    return json.loads(sortie.stdout)


# ---------------------------------------------------------------------------
# Les autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_les_quatre_familles_de_marqueurs_sont_reconnues():
    assert extract_reply(FIL_FR)["quoted_from_line"] == 7  # « Le … a écrit : »
    assert extract_reply(FIL_OUTLOOK_FR)["quoted_from_line"] == 6  # le trait
    assert extract_reply(FIL_ORIGINE)["quoted_from_line"] == 2  # le message d'origine
    assert extract_reply("Bonjour\n> cité")["quoted_from_line"] == 1  # le préfixe


def test_une_attribution_repliee_sur_trois_lignes_est_reconnue():
    """Gmail coupe la ligne quand l'adresse est longue ; le marqueur tient."""
    assert extract_reply(FIL_REPLIE)["reply"] == "Bonjour Marie,\n\nC'est d'accord."


def test_la_signature_nest_pas_retiree():
    """Un nom seul sur une ligne est parfois tout le message."""
    assert extract_reply(FIL_OUTLOOK_FR)["reply"].endswith("\nJean")
    assert extract_reply("Jean\n> cité")["reply"] == "Jean"


def test_un_fil_sans_citation_revient_entier_et_sans_coupe():
    rapport = extract_reply(FIL_SANS_CITATION)
    assert rapport["reply"] == FIL_SANS_CITATION.strip()
    assert rapport["quoted_from_line"] is None
    assert rapport["reason"] is None


def test_sous_un_bloc_recopie_rien_ne_distingue_une_reponse_de_lancien_message():
    """
    La mesure n'a lieu que sous une citation préfixée : sous le trait d'Outlook,
    l'ancien message n'est pas préfixé non plus, et le compter ferait crier
    chaque fil normal.
    """
    assert extract_reply(FIL_OUTLOOK_FR)["reason"] is None
    sous_outlook = FIL_OUTLOOK_FR.replace("Bonjour Marie,\n\nC'est noté, je m'en occupe.\n\nJean\n", "")
    assert extract_reply(sous_outlook)["reply"] == ""
    assert extract_reply(sous_outlook)["reason"] is None  # et personne ne le sait


def test_aucune_entree_ne_leve_et_la_raison_nomme_ce_qui_a_ete_recu():
    """R14 : la raison dit ce que le code a constaté — le type reçu."""
    assert extract_reply(None)["reason"] == "expected text, not NoneType"
    assert extract_reply(b"octets")["reason"] == "expected text, not bytes"
    assert extract_reply(42)["reason"] == "expected text, not int"
    for entree in [None, 42, [], {}, b"octets", ""]:
        rapport = extract_reply(entree)
        assert rapport["reply"] == ""
        if not isinstance(entree, str):
            assert rapport["reason"].startswith("expected text, not ")


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_entree_banale_un_fil_de_deux_messages():
    """T5 : l'entrée ordinaire du public visé — une réponse à un devis."""
    assert extract_reply(FIL_FR)["reply"].startswith("Bonjour Marie,")
    assert extract_reply(FIL_EN)["reply"].startswith("Hi Marie,")


def test_production_entree_vide():
    assert extract_reply("") == {"reply": "", "quoted_from_line": None, "reason": None}
    assert extract_reply("\n\n\n")["reply"] == ""


def test_production_entree_tres_grande_et_terminaison_rapide():
    """Un fil de cinquante messages empilés, coupé au premier marqueur."""
    enorme = FIL_FR + "".join(f"> ligne {n}\n" for n in range(200_000))
    debut = time.perf_counter()
    rapport = extract_reply(enorme)
    assert time.perf_counter() - debut < 10.0
    assert rapport["reply"].endswith("Jean Dupont")


def test_production_encodages_inattendus():
    """CRLF, CR seuls, espace insécable, marque d'ordre des octets."""
    assert extract_reply(FIL_FR.replace("\n", "\r\n"))["reply"].endswith("Jean Dupont")
    assert extract_reply(FIL_FR.replace("\n", "\r"))["reply"].endswith("Jean Dupont")
    insecable = "Bonjour, \n\nLe devis est signé.\n\n> cité"
    assert " " in extract_reply(insecable)["reply"]
    assert extract_reply("﻿Bonjour\n> cité")["reply"] == "Bonjour"


def test_production_valeurs_aux_limites():
    # Un marqueur en première ligne : la réponse est vide, et c'est dit.
    assert extract_reply("> tout est cité")["quoted_from_line"] == 0
    # Un « > » au milieu d'une ligne n'est pas une citation.
    assert extract_reply("2 > 1, donc c'est bon.")["quoted_from_line"] is None
    # Une phrase qui commence par « Le » sans être une attribution.
    assert extract_reply("Le devis est signé.\n> cité")["reply"] == "Le devis est signé."
    # « De : » dans une phrase ne coupe pas ; en tête de ligne, si.
    assert extract_reply("Reçu de : Marie.")["quoted_from_line"] is None
    assert extract_reply("Merci.\nDe : Marie")["quoted_from_line"] == 1


def test_production_un_fil_illisible_nempeche_pas_de_lire_les_autres():
    """T8 : un élément du lot qui n'est pas du texte ne fait pas tomber le lot."""
    lot = [FIL_FR, None, FIL_EN]
    rapports = [extract_reply(fil) for fil in lot]
    assert [bool(r["reply"]) for r in rapports] == [True, False, True]


def test_production_la_lecture_tient_la_classe_de_latence_annoncee():
    """latency « <1 ms » : dix mille lectures sous une borne d'effondrement large."""
    debut = time.perf_counter()
    for _ in range(10_000):
        extract_reply(FIL_FR)
    assert time.perf_counter() - debut < 20.0


# ---------------------------------------------------------------------------
# Parité entre les deux langages
# ---------------------------------------------------------------------------


def test_python_et_javascript_rendent_le_meme_rapport():
    """La fiche montre les deux extraits : elle affirme la même chose des deux."""
    node = shutil.which("node")
    assert node, "node est requis pour comparer les deux implémentations"
    fils = TOUS + ["", "> tout est cité", "2 > 1, donc c'est bon.", "Jean\n> cité",
                   "﻿Bonjour\n> cité", FIL_FR.replace("\n", "\r\n"),
                   FIL_FR.replace("\n", "\r"), "Merci.\nDe : Marie",
                   "Reçu de : Marie.", "Le devis est signé.\n> cité"]
    attendu = [extract_reply(fil) for fil in fils]
    script = (
        f"import {{ extractReply }} from {json.dumps((ICI / 'n0.js').as_uri())};"
        "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{"
        "process.stdout.write(JSON.stringify(JSON.parse(d).map(extractReply)));});"
    )
    sortie = subprocess.run([node, "--input-type=module", "-e", script],
                            input=json.dumps(fils), capture_output=True,
                            text=True, timeout=60, check=True)
    assert json.loads(sortie.stdout) == attendu
