import json
import shutil
import subprocess
import time
from pathlib import Path

import ftfy
import ftfy.bad_codecs  # noqa: F401 - enregistre le codec « sloppy-windows-1252 »

from n0 import repair_encoding

ICI = Path(__file__).parent

# Ce qu'un import venu d'un système ancien met dans une base : des octets UTF-8
# relus comme du Windows-1252.
CASSES = {
    "CrÃ©dit Agricole": "Crédit Agricole",
    "Rue des FrÃ¨res-LumiÃ¨re": "Rue des Frères-Lumière",
    "ThÃ©Ã¢tre": "Théâtre",
    "Ã€ bientÃ´t": "À bientôt",
    "naÃ¯ve": "naïve",
    "MÃ¼ller": "Müller",
    "Ã‰quipe": "Équipe",
    "câ€™est": "c’est",
    "â‚¬ 12,50": "€ 12,50",
    "ÃŸ": "ß",
    "Ã…ngstrÃ¶m": "Ångström",
    "ÐŸÑ€Ð¸Ð²ÐµÑ‚": "Привет",
    "ÃƒÂ©tÃƒÂ©": "été",
}

# Des chaînes déjà correctes, que la réparation ne doit pas toucher. Elles
# couvrent ce qui ressemble le plus à du texte cassé : tildes portugais,
# lettres nordiques, guillemets français, apostrophe typographique.
CORRECTES = [
    "Crédit Agricole", "Île-de-France", "À bientôt", "naïve", "Ångström",
    "Đà Nẵng", "Привет", "Müller", "cœur", "garçon", "€ 12,50", "« Bonjour »",
    "L’été à Nice", "São Paulo", "Mãe", "Ãs vezes", "Ål", "Ærø", "Þór",
    "Boulogne-Billancourt",
]

# Ce que `ftfy` refuse de réparer et que l'extrait JavaScript répare : une
# chaîne courte dont la réparation ouvrirait sur une majuscule accentuée. Ces
# mojibakes ne sont pas fabriqués à la main — ils sont produits ci-dessous par
# l'accident lui-même, encoder en UTF-8 puis relire en Windows-1252 relâché.
def _casser(texte: str) -> str:
    """L'accident : des octets UTF-8 relus comme du Windows-1252 relâché."""
    return texte.encode("utf8").decode("sloppy-windows-1252")


REFUSEES_PAR_FTFY = {_casser(m): m for m in
                     ["Île-de-France", "Îles Canaries", "Îlot", "Œuvre"]}

# Le même mot, avec du contexte devant : `ftfy` le répare. C'est le témoin qui
# montre que l'heuristique dépend du reste de la chaîne, pas du mot.
AVEC_CONTEXTE = _casser("Région Île-de-France")

# Un texte qui porte déjà un caractère de remplacement : l'octet est parti en
# amont, et `ftfy` lit ce caractère comme un octet, ce qui fait disparaître
# celui qui le précède.
DEJA_PERDU = "Ã�ambe"

# Cinq accidents empilés : `ftfy` les défait tous, l'extrait JavaScript en
# défait ROUNDS = 4 et s'arrête.
QUINTUPLE = "été"
for _ in range(5):
    QUINTUPLE = _casser(QUINTUPLE)

# La phrase d'un ticket de bogue, qui cite le texte cassé au lieu d'en souffrir.
TICKET = "Bug : on voit « Ã© » au lieu de « é » dans le PDF"
TICKET_ABIME = "Bug : on voit « é » au lieu de « é » dans le PDF"

# Le seul endroit où les deux extraits ne répondent pas la même chose.
A_TILDE_ESPACE = "Le caractère Ã se prononce a-tilde"


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_le_texte_qui_parle_de_lencodage_est_repare_aussi():
    """
    « La phrase d'un ticket, « on voit « Ã© » au lieu de « é » », ressort en
    « on voit « é » au lieu de « é » », et l'exemple cité a disparu. »
    """
    rapport = repair_encoding(TICKET)
    assert rapport["text"] == TICKET_ABIME
    assert rapport["changed"] is True
    # La phrase réparée ne dit plus rien : les deux côtés du « au lieu de »
    # sont devenus identiques.
    avant, apres = rapport["text"].split(" au lieu de ")
    assert avant.endswith("« é »") and apres.startswith("« é »")


def test_point_de_rupture_temoin_vingt_chaines_correctes_ressortent_inchangees():
    """
    « Témoin dans le même test : vingt chaînes déjà correctes, dont
    « São Paulo » et « Ångström », ressortent inchangées. »
    """
    assert len(CORRECTES) == 20
    for correcte in CORRECTES:
        rapport = repair_encoding(correcte)
        assert rapport["text"] == correcte, correcte
        assert rapport["changed"] is False, correcte


# ---------------------------------------------------------------------------
# Les autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_les_cas_ordinaires_dun_import_sont_repares():
    """Docstring : « that is a byte identity, not a judgement »."""
    for casse, attendu in CASSES.items():
        rapport = repair_encoding(casse)
        assert rapport["text"] == attendu, casse
        assert rapport["changed"] is True, casse


def test_deux_tours_du_meme_accident_sont_defaits():
    """Docstring : « two rounds of the same accident »."""
    assert repair_encoding("ÃƒÂ©tÃƒÂ©")["text"] == "été"
    # Un seul tour, pour comparaison.
    assert repair_encoding("Ã©tÃ©")["text"] == "été"


def test_un_texte_a_moitie_casse_ressort_avec_lautre_moitie_intacte():
    """
    Commentaire : « Working run by run rather than on the whole string is what
    lets a text where only some fields are broken come back with the rest
    untouched ».
    """
    melange = "Un mélange : Crédit Agricole et CrÃ©dit Mutuel"
    assert repair_encoding(melange)["text"] == "Un mélange : Crédit Agricole et Crédit Mutuel"


def test_fix_text_abime_lapostrophe_typographique_fix_encoding_non():
    """
    Docstring : « It calls `fix_encoding` and not `fix_text`: the latter also
    straightens quotation marks ».
    """
    assert ftfy.fix_text("L’été à Nice") == "L'été à Nice"
    assert repair_encoding("L’été à Nice")["text"] == "L’été à Nice"
    # Et sur un texte cassé, les deux réparent bien l'encodage.
    assert ftfy.fix_text("CrÃ©dit")[:6] == repair_encoding("CrÃ©dit")["text"][:6]


def test_le_drapeau_lossy_dit_que_des_octets_ont_deja_ete_perdus():
    """Docstring : « Those are bytes a decoder threw away before this function ever saw the string »."""
    perdu = repair_encoding("Cr�dit Agricole")
    assert perdu["lossy"] is True
    assert perdu["changed"] is False
    assert perdu["text"] == "Cr�dit Agricole"
    # Témoin : le même nom, cassé mais complet, se répare et n'est pas lossy.
    entier = repair_encoding("CrÃ©dit Agricole")
    assert (entier["lossy"], entier["changed"]) == (False, True)


def test_rien_nest_repare_en_silence():
    """Docstring : « a repair that nobody recorded is indistinguishable from data that was always like that »."""
    assert repair_encoding("Crédit")["changed"] is False
    assert repair_encoding("CrÃ©dit")["changed"] is True


def test_ftfy_refuse_de_reparer_une_chaine_courte_ouvrant_sur_une_majuscule_accentuee():
    """
    Docstring : « `ftfy` weighs the whole string before repairing, and declines
    when what would come out is a short run opening on an accented capital ».

    C'est la forme d'une cellule de tableur et d'une colonne `region`, donc
    l'entrée ordinaire du public de cette fiche. Quatre mots, et le témoin
    juste après : le même mot avec du contexte devant est réparé.
    """
    for casse, attendu in REFUSEES_PAR_FTFY.items():
        rapport = repair_encoding(casse)
        assert rapport["text"] == casse, f"{casse} devrait ressortir tel quel"
        assert rapport["changed"] is False, casse
        assert rapport["text"] != attendu, casse
    # Témoin : l'heuristique dépend du reste de la chaîne, pas du mot.
    assert repair_encoding(AVEC_CONTEXTE)["text"] == "Région Île-de-France"


def test_ftfy_lit_un_caractere_de_remplacement_comme_un_octet():
    """
    Docstring : « `ftfy` also reads an existing replacement character as a
    byte: « Ã » + U+FFFD + « ambe » comes back as U+FFFD + « ambe », and the
    « Ã » is gone. »
    """
    rapport = repair_encoding(DEJA_PERDU)
    assert rapport["text"] == "\ufffdambe"
    assert rapport["changed"] is True
    assert rapport["lossy"] is True
    # Témoin : le même mot dont l'octet n'a pas été jeté se répare sans perte.
    intact = repair_encoding(_casser("Ïambe"))
    assert (intact["text"], intact["lossy"]) == ("Ïambe", False)


def test_ftfy_defait_nimporte_quelle_profondeur_daccidents_empiles():
    """Docstring : « it unwinds any depth of stacked accidents »."""
    assert repair_encoding(QUINTUPLE)["text"] == "été"


def test_la_transformation_est_une_table_de_deux_cent_cinquante_six_octets():
    """
    `unavailable_reason` de N1 : « la transformation est une table de 256
    octets et une norme, appliquée dans un sens ou dans l'autre, et elle est
    exactement inversible ».
    """
    octets = bytes(range(256))
    table = octets.decode("sloppy-windows-1252")
    assert len(table) == 256
    assert len(set(table)) == 256, "la table est injective, donc inversible"
    assert table.encode("sloppy-windows-1252") == octets


def test_ftfy_lit_un_a_tilde_suivi_dune_espace_comme_un_a_accent_grave():
    """
    La seule divergence entre les deux extraits, dite ici : `ftfy` ajoute une
    règle que l'extrait JavaScript n'a pas — « Ã » suivi d'une espace ordinaire
    est lu comme le « à » dont l'espace insécable a été perdue en route.
    """
    assert repair_encoding(A_TILDE_ESPACE)["text"] == "Le caractère à se prononce a-tilde"
    assert repair_encoding("Ã tout de suite")["text"] == "à tout de suite"


def test_aucune_entree_ne_leve_et_la_raison_nomme_ce_qui_a_ete_recu():
    """R14 : la raison dit ce que le code a constaté — le type reçu."""
    assert repair_encoding(None)["reason"] == "text is expected, not NoneType"
    assert repair_encoding(0)["reason"] == "text is expected, not int"
    assert repair_encoding(b"CrA\xa9dit")["reason"] == "text is expected, not bytes"
    for entree in [None, 0, 4.2, b"CrA\xa9dit", [], {}, object()]:
        rapport = repair_encoding(entree)
        assert rapport["text"] is None
        assert rapport["reason"].startswith("text is expected, not ")


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_entree_banale_une_colonne_de_noms_importee():
    """T5 : l'entrée ordinaire du public visé, une colonne de base de données."""
    colonne = ["Crédit Agricole", "CrÃ©dit Mutuel", "Boulogne-Billancourt",
               "Rue des FrÃ¨res-LumiÃ¨re", "L’été à Nice"]
    repares = [repair_encoding(v) for v in colonne]
    assert [r["changed"] for r in repares] == [False, True, False, True, False]
    assert repares[1]["text"] == "Crédit Mutuel"


def test_production_entree_vide():
    vide = repair_encoding("")
    assert vide == {"text": "", "changed": False, "lossy": False, "reason": None}


def test_production_entree_tres_grande_et_terminaison_rapide():
    enorme = "CrÃ©dit Agricole, " * 50_000
    debut = time.perf_counter()
    rapport = repair_encoding(enorme)
    assert time.perf_counter() - debut < 30.0
    assert rapport["text"].startswith("Crédit Agricole, Crédit")


def test_production_encodages_inattendus():
    # Marque d'ordre des octets, largeur nulle, emoji, espaces insécables :
    # aucun n'est une séquence UTF-8 mal lue, tous ressortent tels quels.
    for parasite in ("﻿", "​", "🙂", " ", " "):
        assert repair_encoding(f"Crédit{parasite}Agricole")["changed"] is False, repr(parasite)
    # Accents décomposés : ce n'est pas un problème d'encodage, rien ne bouge.
    assert repair_encoding("café")["text"] == "café"
    # Un emoji cassé se répare comme le reste.
    assert repair_encoding("ð\u009f\u0099\u0082")["text"] == "🙂"


def test_production_valeurs_aux_limites():
    # Un caractère, deux caractères, une séquence tronquée.
    assert repair_encoding("Ã")["changed"] is False
    assert repair_encoding("Ã©")["text"] == "é"
    assert repair_encoding("Ã¨Ã")["text"] == "èÃ"
    # Une forme trop longue, interdite par la norme, n'est pas décodée :
    # « À€ » est bien C0 80, qui encoderait le caractère nul sur deux octets.
    assert repair_encoding("À€")["changed"] is False
    # Un demi-codet isolé, interdit lui aussi, ne l'est pas davantage.
    assert repair_encoding("í ½")["changed"] is False
    # Et le caractère de remplacement, lui, est une séquence valide : il se
    # décode, et le drapeau lossy le signale.
    assert repair_encoding("ï¿½") == {
        "text": "\ufffd", "changed": True, "lossy": True, "reason": None}


def test_production_une_chaine_illisible_dans_un_lot_nempeche_pas_les_autres():
    """T8 : une valeur sale ne fait pas tomber la colonne."""
    lot = ["CrÃ©dit", None, "Ã©tÃ©", "", "Cr�dit"]
    rapports = [repair_encoding(v) for v in lot]
    assert [r["text"] for r in rapports] == ["Crédit", None, "été", "", "Cr�dit"]


def test_production_la_reparation_tient_la_classe_de_latence_annoncee():
    """latency « <1 ms » : dix mille réparations sous une borne d'effondrement large."""
    debut = time.perf_counter()
    for _ in range(10_000):
        repair_encoding("Rue des FrÃ¨res-LumiÃ¨re")
    assert time.perf_counter() - debut < 20.0


# ---------------------------------------------------------------------------
# Les deux langages, et leurs trois divergences
# ---------------------------------------------------------------------------


def test_les_deux_extraits_saccordent_sur_trente_neuf_des_quarante_sept_chaines():
    """
    Docstring : « The two agree on thirty-nine of this entry's forty-seven
    strings, and they part in both directions ». Le décompte est fait ici, et
    chacun des trois sens de divergence est vérifié séparément.
    """
    node = shutil.which("node")
    assert node, "node est requis pour comparer les deux implémentations"
    entrees = (list(CASSES) + CORRECTES + list(REFUSEES_PAR_FTFY)
               + [TICKET, A_TILDE_ESPACE, "Ã tout de suite", DEJA_PERDU, QUINTUPLE,
                  "Cr\ufffddit Agricole", "Un mélange : Crédit Agricole et CrÃ©dit Mutuel",
                  "", "Ã", "Ã©"])
    attendu = [repair_encoding(e) for e in entrees]
    script = (
        f"import {{ repairEncoding }} from {json.dumps((ICI / 'n0.js').as_uri())};"
        "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{"
        "process.stdout.write(JSON.stringify(JSON.parse(d).map(repairEncoding)));});"
    )
    sortie = subprocess.run([node, "--input-type=module", "-e", script],
                            input=json.dumps(entrees), capture_output=True,
                            text=True, timeout=60, check=True)
    par_js = json.loads(sortie.stdout)
    ecarts = [e for e, py, js in zip(entrees, attendu, par_js) if py != js]
    assert len(entrees) == 47
    # Les huit écarts, dans les deux sens, et rien d'autre. Le décompte publié
    # dans la docstring — trente-neuf accords sur quarante-sept — est celui-ci.
    assert ecarts == [*REFUSEES_PAR_FTFY, A_TILDE_ESPACE, "Ã tout de suite",
                      DEJA_PERDU, QUINTUPLE]
    assert len(entrees) - len(ecarts) == 39
    # Sens 1 : ftfy renonce, l'extrait JavaScript répare.
    for casse, attendu_mot in REFUSEES_PAR_FTFY.items():
        js = par_js[entrees.index(casse)]
        assert js["text"] == attendu_mot, casse
        assert repair_encoding(casse)["text"] == casse, casse
    # Sens 2 : ftfy applique sa règle de l'espace, l'extrait JavaScript non.
    assert par_js[entrees.index(A_TILDE_ESPACE)]["text"] == A_TILDE_ESPACE
    # Sens 3 : ftfy défait cinq tours, l'extrait JavaScript s'arrête à quatre.
    assert par_js[entrees.index(QUINTUPLE)]["text"] == "Ã©tÃ©"
    # Sens 4 : ftfy mange le caractère devant le remplacement, l'autre non.
    assert par_js[entrees.index(DEJA_PERDU)]["text"] == DEJA_PERDU
