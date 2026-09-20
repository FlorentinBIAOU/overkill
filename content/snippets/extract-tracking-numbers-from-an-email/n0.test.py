import json
import shutil
import subprocess
import time
from pathlib import Path

from n0 import (DEFAULT_FAMILIES, FAMILIES, UPS_BODY, check_digit,
                find_tracking_numbers, ups_check_digit)

ICI = Path(__file__).parent

# Une confirmation d'expédition ordinaire : le public visé de la fiche.
MAIL = """Bonjour,

Votre commande 1234567890 du 10 octobre 2026 est expédiée.
Numéro de suivi Colissimo : RB123456785GB.
Suivi UPS : 1Z9999W99999999997.

Cordialement,
Le service client — 0123456789"""

# Le numéro canonique d'UPS, celui que le transporteur donne en exemple : la
# somme pondérée de ses quinze caractères fait 96, donc la clé vaut 4.
UPS_CANONIQUE = "1Z999AA10123456784"

# Le même, avec un chiffre du numéro de série abîmé par une recopie.
ABIME = MAIL.replace("RB123456785GB", "RB123456784GB")

TOUS = [MAIL, ABIME, "", "SA123456785GB", "RB123456785GB RB123456785FR",
        "rb123456785gb", "XRB123456785GBX", "1Z9999W9999999999",
        "Le 1234567890 et le 12345678901", "RB123456780GB",
        UPS_CANONIQUE, "1Z999AA10123456785", "Appelez le 01 23 45 67 89"]


def trouves(texte, familles=DEFAULT_FAMILIES):
    return [(t["text"], t["family"], t["checked"])
            for t in find_tracking_numbers(texte, familles)["found"]]


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_une_famille_sans_chiffre_de_controle_attrape_tout():
    """
    « Dix chiffres nus, c'est la forme d'une lettre de transport DHL Express,
    et c'est aussi celle d'un numéro de commande. »
    """
    avec = trouves(MAIL, ("upu-s10", "ups", "ten-digits"))
    # Le numéro de commande et le numéro de téléphone du même message, tous
    # deux rendus comme des colis. Les deux exemples sont ceux de la fiche.
    assert ("1234567890", "ten-digits", False) in avec
    assert ("0123456789", "ten-digits", False) in avec
    assert "1234567890" in MAIL.split("\n")[2]
    assert "0123456789" in MAIL.split("\n")[-1]
    # C'est la forme compacte qui est attrapée : le même numéro écrit à la
    # française, par paires, ne l'est pas. Le point de rupture le dit.
    espace = trouves("Appelez le 01 23 45 67 89", ("upu-s10", "ups", "ten-digits"))
    assert espace == []


def test_point_de_rupture_temoin_ce_qui_porte_un_controle_est_verifie():
    """
    « Le témoin est dans le même test : le numéro S10 du même message revient
    vérifié, et le même numéro avec un chiffre changé revient refusé, avec sa
    raison. »
    """
    assert ("RB123456785GB", "upu-s10", True) in trouves(MAIL)
    refuse = find_tracking_numbers(ABIME)["found"][0]
    assert refuse["checked"] is False
    assert refuse["why"] == "the check digit does not match the serial number"


# ---------------------------------------------------------------------------
# Le chiffre de contrôle, confronté à la norme
# ---------------------------------------------------------------------------


def test_lexemple_de_la_norme_est_reproduit():
    """
    R10 : la valeur du contrôle vient de la norme UPU S10, qui donne son
    exemple — numéro de série 47312482, chiffre de contrôle 9.
    """
    assert check_digit("47312482") == 9


def test_le_controle_attrape_toute_substitution_dun_chiffre():
    """
    Ce que la norme dit que le contrôle sert à détecter, mesuré : sur les
    soixante-douze substitutions possibles d'un chiffre du numéro de série,
    aucune ne passe.
    """
    serie = "47312482"
    juste = check_digit(serie)
    passees = 0
    for position in range(8):
        for chiffre in "0123456789":
            if chiffre == serie[position]:
                continue
            abime = serie[:position] + chiffre + serie[position + 1:]
            if check_digit(abime) == juste:
                passees += 1
    assert passees == 0


def test_le_controle_attrape_toute_transposition_de_deux_chiffres_voisins():
    serie = "47312482"
    juste = check_digit(serie)
    passees = 0
    for position in range(7):
        if serie[position] == serie[position + 1]:
            continue
        echange = (serie[:position] + serie[position + 1] + serie[position]
                   + serie[position + 2:])
        if check_digit(echange) == juste:
            passees += 1
    assert passees == 0


def test_un_numero_tire_au_hasard_passe_une_fois_sur_dix():
    """
    L'autre face du même chiffre : pour un numéro de série donné, un seul des
    dix chiffres de contrôle possibles convient.
    """
    serie = "47312482"
    acceptes = sum(1 for chiffre in "0123456789" if check_digit(serie) == int(chiffre))
    assert acceptes == 1


# ---------------------------------------------------------------------------
# Les autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_les_indicatifs_reserves_par_la_norme_ne_sont_pas_des_numeros():
    assert trouves("SA123456785GB") == []
    assert trouves("TA123456785GB") == []
    # Le même numéro avec un indicatif permis est bien trouvé.
    assert trouves("RB123456785GB")[0][2] is True


def test_les_familles_sans_controle_ne_sont_pas_cherchees_par_defaut():
    assert DEFAULT_FAMILIES == ("upu-s10", "ups")
    assert "ten-digits" in FAMILIES
    assert all(f != "ten-digits" for _, f, _ in trouves(MAIL))


def test_une_famille_inconnue_est_nommee():
    rapport = find_tracking_numbers(MAIL, ("colissimo",))
    assert rapport["found"] == []
    assert rapport["reason"] == "unknown families: colissimo"


def test_chaque_resultat_dit_ce_quil_vaut():
    trouve = find_tracking_numbers(MAIL)["found"]
    ups = [t for t in trouve if t["family"] == "ups"][0]
    assert ups["checked"] is True
    assert ups["why"] is None
    assert ups["carriers"] == ["UPS"]


def test_un_numero_ups_porte_une_cle_et_elle_est_calculee():
    """
    Commentaire : « The eighteenth character of a `1Z` number is a check digit
    over the fifteen that precede it. »

    « Cette famille ne porte rien à vérifier » était faux : UPS en porte une.
    Le calcul est reproduit sur l'exemple canonique du transporteur, celui dont
    la somme pondérée fait 96.
    """
    assert UPS_BODY == 15
    assert ups_check_digit(UPS_CANONIQUE[2:2 + UPS_BODY]) == 4
    assert UPS_CANONIQUE[-1] == "4"
    canonique = find_tracking_numbers(UPS_CANONIQUE)["found"][0]
    assert (canonique["family"], canonique["checked"], canonique["why"]) == ("ups", True, None)
    # Un chiffre de clé changé : trouvé quand même, et refusé avec sa raison.
    faux = find_tracking_numbers("1Z999AA10123456785")["found"][0]
    assert faux["text"] == "1Z999AA10123456785"
    assert faux["checked"] is False
    assert faux["why"] == "the UPS check digit does not match the rest of the number"


def test_chaque_famille_a_sa_propre_raison():
    """
    Docstring de `_verify` : « One reason per family, because they are not the
    same statement. » « Dix chiffres » ne porte aucune clé ; UPS en porte une.
    """
    dix = find_tracking_numbers("0123456789", ("ten-digits",))["found"][0]
    assert dix["why"] == "shape only: ten digits carry no key to check"
    faux = find_tracking_numbers("1Z999AA10123456785")["found"][0]
    assert faux["why"] == "the UPS check digit does not match the rest of the number"
    assert dix["why"] != faux["why"]


def test_un_numero_colle_a_autre_chose_nest_pas_un_numero():
    assert trouves("XRB123456785GBX") == []
    assert trouves("1Z9999W9999999999") == []  # un caractère de moins


def test_la_casse_compte_parce_que_la_norme_la_fixe():
    assert trouves("rb123456785gb") == []


def test_aucune_entree_ne_leve_et_la_raison_nomme_ce_qui_a_ete_recu():
    """R14 : la raison dit ce que le code a constaté — le type reçu."""
    assert find_tracking_numbers(None)["reason"] == "expected text, not NoneType"
    assert find_tracking_numbers(b"octets")["reason"] == "expected text, not bytes"
    for entree in [None, 42, [], {}, b"octets", ""]:
        rapport = find_tracking_numbers(entree)
        assert rapport["found"] == []
        if not isinstance(entree, str):
            assert rapport["reason"].startswith("expected text, not ")


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_entree_banale_une_confirmation_dexpedition():
    """T5 : l'entrée ordinaire du public visé."""
    assert trouves(MAIL) == [("RB123456785GB", "upu-s10", True),
                             ("1Z9999W99999999997", "ups", True)]


def test_production_entree_vide():
    assert find_tracking_numbers("") == {"found": [], "reason": None}


def test_production_entree_tres_grande_et_terminaison_rapide():
    # Joints par un saut de ligne : collés bout à bout, le numéro de
    # téléphone de la fin toucherait le « Bonjour » de la copie suivante.
    enorme = "\n".join([MAIL] * 20_000)
    debut = time.perf_counter()
    rapport = find_tracking_numbers(enorme, ("upu-s10", "ups", "ten-digits"))
    assert time.perf_counter() - debut < 60.0
    assert len(rapport["found"]) == 4 * 20_000


def test_production_encodages_inattendus():
    assert trouves("﻿RB123456785GB")[0][2] is True
    assert trouves("Suivi : RB123456785GB")[0][2] is True
    # Un chiffre arabe n'est pas un chiffre pour la norme.
    assert trouves("RB١٢٣٤٥٦٧٨٥GB") == []


def test_production_valeurs_aux_limites():
    # Un numéro de série tout à zéro : le contrôle vaut 5, par la règle du 11.
    assert check_digit("00000000") == 5
    assert trouves("AB000000005FR")[0][2] is True
    # Deux numéros collés par une espace sont deux numéros.
    assert len(trouves("RB123456785GB RB123456785FR")) == 2


def test_production_un_numero_refuse_nempeche_pas_de_lire_les_autres():
    """T8 : un numéro abîmé ne fait pas tomber le message."""
    melange = "RB123456784GB puis RB123456785GB"
    assert [t[2] for t in trouves(melange)] == [False, True]


def test_production_la_lecture_tient_la_classe_de_latence_annoncee():
    """latency « <1 ms » : dix mille lectures d'un message sous une borne large."""
    debut = time.perf_counter()
    for _ in range(10_000):
        find_tracking_numbers(MAIL)
    assert time.perf_counter() - debut < 20.0


# ---------------------------------------------------------------------------
# Parité entre les deux langages
# ---------------------------------------------------------------------------


def test_python_et_javascript_rendent_le_meme_rapport():
    """La fiche montre les deux extraits : elle affirme la même chose des deux."""
    node = shutil.which("node")
    assert node, "node est requis pour comparer les deux implémentations"
    cas = [[texte, list(familles)] for texte in TOUS
           for familles in (list(DEFAULT_FAMILIES), ["upu-s10", "ups", "ten-digits"])]
    attendu = [find_tracking_numbers(texte, tuple(familles)) for texte, familles in cas]
    script = (
        f"import {{ findTrackingNumbers }} from {json.dumps((ICI / 'n0.js').as_uri())};"
        "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{"
        "process.stdout.write(JSON.stringify(JSON.parse(d)"
        ".map(([t,f])=>findTrackingNumbers(t,f))));});"
    )
    sortie = subprocess.run([node, "--input-type=module", "-e", script],
                            input=json.dumps(cas), capture_output=True,
                            text=True, timeout=60, check=True)
    assert json.loads(sortie.stdout) == attendu
