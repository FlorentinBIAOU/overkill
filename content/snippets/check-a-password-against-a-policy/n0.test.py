import hashlib
import json
import shutil
import subprocess
import time
import unicodedata
from pathlib import Path

from n0 import (BLOCKING, MAXIMUM, MINIMUM, MINIMUM_WITH_SECOND_FACTOR, RANGE_URL,
                check_password, pwned_count)

ICI = Path(__file__).parent

# La liste de fuites que le double sert. Ce sont les mots de passe qui ont
# réellement fuité par millions ; leur compte ici est celui du double, pas
# celui du service.
FUITES = {
    "motdepasse": 9_999,
    "Motdepasse1!": 42,
    "correct horse battery staple": 120,
    "azertyuiopqsdfghjklm": 7,
    "aaaaaaaaaaaaaaaa": 3,
}

# Vingt-deux caractères, le prénom et l'année de naissance de la fille du
# titulaire : absent de toute liste de fuite, et personne ne devrait l'accepter.
FILLE = "Clementine-2019-Martin"

BANALES = ["le chat dort sur le radiateur", "j'habite au 12 rue des Lilas",
           "Mon café du matin est trop chaud", FILLE]


def sha1(mot: str) -> str:
    return hashlib.sha1(mot.encode("utf-8")).hexdigest().upper()


def double(vues=None):
    """
    Le service Have I Been Pwned, remplacé par une plage locale.

    `vues` recueille les adresses demandées : c'est ce qui permet de vérifier
    que le mot de passe ne sort jamais.
    """
    def fetch(url: str) -> str:
        if vues is not None:
            vues.append(url)
        prefixe = url[len(RANGE_URL):]
        lignes = [f"{sha1(m)[5:]}:{n}" for m, n in FUITES.items() if sha1(m)[:5] == prefixe]
        # Le bourrage du service : des entrées à zéro, toujours en nombre égal.
        lignes += ["%035X:0" % i for i in range(800 - len(lignes))]
        return "\r\n".join(lignes)
    return fetch


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_le_controle_ne_connait_que_ce_qui_a_deja_fuite():
    """
    « « Clementine-2019-Martin » — vingt-deux caractères, le prénom et l'année
    de naissance de la fille du titulaire — n'est dans aucune liste de fuite et
    passe. »
    """
    rapport = check_password(FILLE, fetch=double())
    assert rapport == {"acceptable": True, "reasons": [], "breaches": 0, "length": 22}


def test_point_de_rupture_temoin_un_mot_de_passe_assez_long_mais_fuite_est_refuse():
    """
    « Le témoin : « correct horse battery staple », assez long lui aussi, est
    refusé parce qu'il a fuité. »
    """
    rapport = check_password("correct horse battery staple", fetch=double())
    assert rapport["length"] == 28 and rapport["length"] >= MINIMUM
    assert rapport["acceptable"] is False
    assert rapport["reasons"] == ["breached"]
    assert rapport["breaches"] == 120


# ---------------------------------------------------------------------------
# Les autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_le_mot_de_passe_ne_sort_jamais_seuls_cinq_caracteres_de_son_hache():
    """
    Docstring : « the password is never sent […] the whole privacy argument is
    in two lines ». Ce test lit ce qui a été demandé.
    """
    vues = []
    mot = "le chat dort sur le radiateur"
    check_password(mot, fetch=double(vues))
    assert len(vues) == 1
    adresse = vues[0]
    assert adresse == RANGE_URL + sha1(mot)[:5]
    assert len(adresse[len(RANGE_URL):]) == 5
    # Ni le mot de passe, ni son haché complet, ne figurent dans la requête.
    assert mot not in adresse
    assert sha1(mot) not in adresse
    assert sha1(mot)[5:] not in adresse


def test_la_liste_nest_interrogee_que_si_la_reponse_peut_encore_changer():
    """
    Commentaire : « a request that will change nothing is a request not to
    make ».
    """
    vues = []
    check_password("court", fetch=double(vues))
    assert vues == []
    check_password("le chat dort sur le radiateur", fetch=double(vues))
    assert len(vues) == 1


def test_aucune_regle_de_composition_nest_imposee():
    """
    Docstring : « What this file deliberately does not do is count capitals,
    digits and symbols ».
    """
    # Seize lettres identiques, sans majuscule ni chiffre : refusé seulement
    # parce que la liste de fuites le connaît, jamais pour sa composition.
    assert check_password("aaaaaaaaaaaaaaaa", fetch=double())["reasons"] == ["breached"]
    # Une phrase en minuscules, sans chiffre ni symbole : acceptée.
    assert check_password("le chat dort sur le radiateur", fetch=double())["acceptable"] is True
    # Le mot de passe que les règles de composition produisent : refusé, et pas
    # pour sa composition.
    assert check_password("Motdepasse1!", fetch=double())["reasons"] == ["too-short"]


def test_deux_ecritures_du_meme_mot_de_passe_sont_le_meme_mot_de_passe():
    """
    Docstring : « a password typed with a composed « é » and one typed with
    « e » plus an accent are the same password ».
    """
    compose = unicodedata.normalize("NFC", "le café du matin est trop chaud")
    decompose = unicodedata.normalize("NFD", "le café du matin est trop chaud")
    assert compose != decompose
    vues = []
    check_password(compose, fetch=double(vues))
    check_password(decompose, fetch=double(vues))
    assert vues[0] == vues[1]
    assert (check_password(compose, fetch=double())
            == check_password(decompose, fetch=double()))


def test_un_mot_du_contexte_est_refuse():
    """Docstring : « the site's name, the account's local part »."""
    rapport = check_password("boulangerie-martin", context=["Boulangerie-Martin"], fetch=double())
    assert "context-word" in rapport["reasons"]
    # Témoin : sans le contexte, le même mot de passe passe.
    assert check_password("boulangerie-martin", fetch=double())["acceptable"] is True


def test_le_plancher_descend_quand_il_y_a_un_second_facteur():
    """Docstring : « eight when it is only one factor among several »."""
    mot = "aubergine12"
    assert len(mot) == 11
    assert check_password(mot, fetch=double())["reasons"] == ["too-short"]
    assert check_password(mot, second_factor=True, fetch=double())["acceptable"] is True


def test_pwned_count_rend_zero_quand_le_suffixe_nest_pas_dans_la_plage():
    assert pwned_count("motdepasse", double()) == 9_999
    assert pwned_count(FILLE, double()) == 0


def test_une_liste_de_fuites_qui_ne_repond_pas_ne_bloque_pas_une_inscription():
    """
    Docstring : « a service that does not answer must not raise here: the
    failure comes back as `blocklist-unavailable` in `reasons`, with `breaches`
    at None, and `acceptable` says what the rest of the check says. »

    R8 : dégrader plutôt que lever dans un chemin de requête. Une panne de la
    liste de fuites renvoyait une exception au chemin d'inscription, après cinq
    secondes d'attente, pour chaque nouvel utilisateur.
    """
    def en_panne(url):
        raise OSError("connection reset")

    rapport = check_password("Clementine-2019-Martin", fetch=en_panne)
    assert rapport["acceptable"] is True
    assert rapport["reasons"] == ["blocklist-unavailable"]
    assert rapport["breaches"] is None
    # « blocklist-unavailable » n'est pas une raison de refus : l'appelant
    # décide, et il a de quoi décider.
    assert "blocklist-unavailable" not in BLOCKING
    # Un refus qui ne vient pas de la liste reste un refus, panne ou pas.
    court = check_password("court", fetch=en_panne)
    assert (court["acceptable"], court["reasons"]) == (False, ["too-short"])
    # Témoin : le même mot de passe avec une liste qui répond.
    assert check_password("Clementine-2019-Martin", fetch=double())["reasons"] == []


def test_une_phrase_de_passe_longue_nest_pas_refusee_pour_sa_longueur():
    """
    Commentaire : « sixty-four is a floor on the ceiling, not the ceiling
    […] a good password refused by a rule of shape, in an entry whose whole
    thesis is that rules of shape push people towards bad ones. »
    """
    assert MAXIMUM == 256
    six_mots = "correcte-agrafe-batterie-cheval-lanterne-tambour-boulangerie"
    longue = "mot-de-passe-de-sept-mots-tres-long-issu-dun-gestionnaire-de-mots-de-passe"
    assert len(longue) == 74
    for phrase in (six_mots, longue):
        rapport = check_password(phrase, fetch=double())
        assert rapport["acceptable"] is True, phrase
        assert rapport["reasons"] == [], phrase
    # Le plafond existe toujours, et il borne le hachage, pas le jugement.
    assert check_password("a" * (MAXIMUM + 1), fetch=double())["reasons"] == ["too-long"]


def test_le_contexte_ne_compare_que_des_mots_entiers():
    """
    `escalate_when` : « `context` ne compare que des mots entiers, pas des
    morceaux : « Boulangerie-Martin-2026 » passe une liste qui porte
    « Boulangerie-Martin ». »
    """
    assert check_password("Boulangerie-Martin", context=["Boulangerie-Martin"],
                          fetch=double())["reasons"] == ["context-word"]
    assert check_password("Boulangerie-Martin-2026", context=["Boulangerie-Martin"],
                          fetch=double())["reasons"] == []


def test_aucune_entree_ne_leve():
    for entree in [None, 0, 4.2, b"secret", [], {}, object()]:
        rapport = check_password(entree, fetch=double())
        assert rapport["acceptable"] is False
        assert rapport["reasons"] == ["not-text"]


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_entree_banale_une_phrase_de_passe_francaise():
    """T5 : l'entrée ordinaire du public visé."""
    for banale in BANALES:
        rapport = check_password(banale, fetch=double())
        assert rapport["acceptable"] is True, banale
        assert rapport["breaches"] == 0, banale


def test_production_entree_vide():
    vide = check_password("", fetch=double())
    assert vide == {"acceptable": False, "reasons": ["too-short"], "breaches": None, "length": 0}


def test_production_entree_tres_grande_et_terminaison_rapide():
    enorme = "a" * 1_000_000
    debut = time.perf_counter()
    rapport = check_password(enorme, fetch=double())
    assert time.perf_counter() - debut < 5.0
    assert rapport["reasons"] == ["too-long"]
    # Et la liste n'a pas été interrogée pour un mot de passe déjà refusé.
    vues = []
    check_password(enorme, fetch=double(vues))
    assert vues == []


def test_production_encodages_inattendus():
    # Emoji, espaces insécables, largeur nulle : ce sont des caractères comme
    # les autres, et la norme demande de les accepter.
    for mot in ["mon chat 🐈 dort sur le radiateur", "le chat dort sur le radiateur",
                "le chat​dort sur le radiateur"]:
        assert check_password(mot, fetch=double())["acceptable"] is True, mot
    # La longueur se compte en caractères, pas en octets : un emoji vaut un.
    assert check_password("🐈" * 15, fetch=double())["length"] == 15
    assert check_password("🐈" * 15, fetch=double())["acceptable"] is True


def test_production_valeurs_aux_limites():
    for longueur, attendu in ((MINIMUM - 1, ["too-short"]), (MINIMUM, []), (MINIMUM + 1, [])):
        mot = "b" * longueur
        assert check_password(mot, fetch=double())["reasons"] == attendu, longueur
    for longueur, attendu in ((MAXIMUM, []), (MAXIMUM + 1, ["too-long"])):
        assert check_password("c" * longueur, fetch=double())["reasons"] == attendu, longueur
    # Le plancher du second facteur, de part et d'autre.
    court = "d" * (MINIMUM_WITH_SECOND_FACTOR - 1)
    assert check_password(court, second_factor=True, fetch=double())["reasons"] == ["too-short"]
    assert check_password("d" * MINIMUM_WITH_SECOND_FACTOR,
                          second_factor=True, fetch=double())["reasons"] == []


def test_production_un_mot_de_passe_refuse_nempeche_pas_de_verifier_les_suivants():
    """T8 : un mot de passe sale ne fait pas tomber le lot."""
    lot = [FILLE, None, "motdepasse", "", "le chat dort sur le radiateur"]
    assert [check_password(m, fetch=double())["acceptable"] for m in lot] == [
        True, False, False, False, True]


def test_production_le_controle_tient_la_classe_de_latence_annoncee():
    """
    latency « ~100 ms » : la classe est celle de l'aller-retour réseau, que le
    double ne mesure pas. Ce test ne borne que la part locale — hachage,
    normalisation, comparaison — sur dix mille contrôles.
    """
    fetch = double()
    debut = time.perf_counter()
    for _ in range(10_000):
        check_password("le chat dort sur le radiateur", fetch=fetch)
    assert time.perf_counter() - debut < 60.0


# ---------------------------------------------------------------------------
# Parité entre les deux langages
# ---------------------------------------------------------------------------


def test_python_et_javascript_rendent_le_meme_rapport():
    """La fiche montre les deux extraits : elle affirme la même chose des deux."""
    node = shutil.which("node")
    assert node, "node est requis pour comparer les deux implémentations"
    mots = BANALES + list(FUITES) + [
        "", "court", "a" * 70, "🐈" * 15, "boulangerie-martin",
        unicodedata.normalize("NFD", "le café du matin est trop chaud"),
        unicodedata.normalize("NFC", "le café du matin est trop chaud"),
        "STRASSE ist eine Straße hier", "İstanbul est une grande ville",
        "le chat dort sur le radiateur",
        "b" * MINIMUM, "b" * (MINIMUM - 1), "c" * MAXIMUM, "c" * (MAXIMUM + 1),
    ]
    contexte = ["Boulangerie-Martin"]
    attendu = [check_password(m, context=contexte, fetch=double()) for m in mots]
    attendu += [check_password(m, second_factor=True, context=contexte, fetch=double())
                for m in mots[:4]]
    script = (
        f"import {{ checkPassword, RANGE_URL }} from {json.dumps((ICI / 'n0.js').as_uri())};"
        "import { createHash } from 'node:crypto';"
        "let d='';process.stdin.on('data',c=>d+=c).on('end',async()=>{"
        "const {mots,contexte,fuites}=JSON.parse(d);"
        "const sha1=(m)=>createHash('sha1').update(m,'utf8').digest('hex').toUpperCase();"
        "const fetchRange=async(url)=>{const p=url.slice(RANGE_URL.length);"
        "const l=Object.entries(fuites).filter(([m])=>sha1(m).slice(0,5)===p)"
        ".map(([m,n])=>sha1(m).slice(5)+':'+n);"
        "for(let i=l.length;i<800;i++) l.push(i.toString(16).toUpperCase().padStart(35,'0')+':0');"
        "return l.join('\\r\\n');};"
        "const out=[];"
        "for (const m of mots) out.push(await checkPassword(m,{context:contexte,fetchRange}));"
        "for (const m of mots.slice(0,4)) out.push("
        "await checkPassword(m,{secondFactor:true,context:contexte,fetchRange}));"
        "process.stdout.write(JSON.stringify(out));});"
    )
    sortie = subprocess.run([node, "--input-type=module", "-e", script],
                            input=json.dumps({"mots": mots, "contexte": contexte,
                                              "fuites": FUITES}),
                            capture_output=True, text=True, timeout=120, check=True)
    assert json.loads(sortie.stdout) == attendu
