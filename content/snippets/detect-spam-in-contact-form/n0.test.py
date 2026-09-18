import ast
import re
import time
import unicodedata
from pathlib import Path

import pytest

from n0 import (
    BANNED,
    HONEYPOT_FIELD,
    LINK,
    MAXIMUM_LINKS,
    MINIMUM_SECONDS,
    fold,
    is_spam,
    issue_token,
    reasons,
    seconds_on_page,
)

GENUINE = {
    "name": "Claire Dubois",
    "email": "claire@example.com",
    "message": "Hello, I ordered a lamp last week and it arrived damaged. What should I do?",
    "website": "",
}

PATIENT_BOT_EN = (
    "Good morning, I came across your company and I would like to discuss "
    "a partnership to increase your visibility. When would suit you?"
)
PATIENT_BOT_FR = (
    "Bonjour, je découvre votre société et je souhaiterais discuter d’un "
    "partenariat pour accroître votre visibilité."
)
VERDICT_SOLICITATION = "Hi, we can boost your google ranking with quality links, cheap offer."


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_un_robot_patient_qui_evite_les_liens():
    """
    breaking_point : « Il attend avant d'envoyer, laisse le champ caché vide, ne
    met aucun lien et n'emploie aucun mot de la liste […] Le test le passe au
    travers des quatre contrôles sans un seul motif de rejet ».
    """
    patient_bot = {"name": "Growth Team", "email": "outreach@example.com", "message": PATIENT_BOT_EN, "website": ""}
    assert reasons(patient_bot, seconds=30) == []
    assert not is_spam(patient_bot, seconds=30)


def test_point_de_rupture_la_phrase_citee_en_francais_passe_aussi():
    """breaking_point (fr) : « Bonjour, je découvre votre société […] accroître votre visibilité. »"""
    assert reasons({"message": PATIENT_BOT_FR, "website": ""}, seconds=30) == []


def test_point_de_rupture_temoin_chacun_des_quatre_controles_est_vivant():
    """
    Témoin : le même message, avec le champ caché rempli, envoyé trop vite, avec
    trois liens ou avec un mot de la liste, est rejeté pour le motif attendu.
    Aucun des quatre ne regarde l'intention.
    """
    base = {"message": PATIENT_BOT_EN, "website": ""}
    assert reasons({**base, "website": "x"}, 30) == ["honeypot filled"]
    assert reasons(base, 1) == ["submitted too fast"]
    assert reasons({**base, "message": PATIENT_BOT_EN + " http://a.com http://b.com http://c.com"}, 30) == ["too many links"]
    assert reasons({**base, "message": PATIENT_BOT_EN + " guest post"}, 30) == ["banned phrase: guest post"]


# ---------------------------------------------------------------------------
# Autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_accepte_une_vraie_demande():
    assert reasons(GENUINE, seconds=42) == []
    assert not is_spam(GENUINE, seconds=42)


def test_attrape_un_pot_de_miel_rempli():
    assert reasons({**GENUINE, "website": "http://example.com"}, seconds=42) == ["honeypot filled"]
    assert HONEYPOT_FIELD == "website"


def test_attrape_un_envoi_plus_rapide_qu_un_humain():
    assert "submitted too fast" in reasons(GENUINE, seconds=0.4)


def test_deux_controles_regardent_l_expediteur_pas_le_texte():
    """docstring : « Two of the checks look at the sender rather than the text »."""
    for message in ("", GENUINE["message"], "backlink casino " * 3):
        found = reasons({"message": message, "website": "filled"}, 0.1)
        assert found[:2] == ["honeypot filled", "submitted too fast"]


def test_attrape_un_mur_de_liens():
    fields = {**GENUINE, "message": "visit http://a.com and www.b.net and http://c.org and d.xyz"}
    assert "too many links" in reasons(fields, seconds=42)


def test_tolere_le_lien_qu_un_client_envoie_vraiment():
    fields = {**GENUINE, "message": "the page http://example.com/order-4512 shows an error"}
    assert reasons(fields, seconds=42) == []


def test_compte_un_lien_une_fois_et_non_une_fois_par_morceau():
    """
    Commentaire LINK : « One match per link, not one per part: a bare `https?://`
    alternative would count `http://example.com` twice and reject the customer
    who sends two ». Témoin : le motif naïf compte quatre liens là où il y en a deux.
    """
    message = "see http://example.com/a and http://example.com/b for the two photos"
    assert reasons({**GENUINE, "message": message}, seconds=42) == []
    assert len(LINK.findall(message)) == 2
    naive = re.compile(r"https?://|(?:www\.)\S+|\b[\w-]+\.(?:com|net|org|ru|xyz|top)\b")
    assert len(naive.findall(message)) == 4


def test_nomme_la_phrase_interdite_trouvee():
    fields = {**GENUINE, "message": "We sell cheap backlink packages for your site."}
    assert reasons(fields, seconds=42) == ["banned phrase: backlink"]


def test_le_repli_survit_a_la_casse_et_aux_accents():
    """docstring de fold : « so `Rétrolien` and `RETROLIEN` match alike »."""
    assert fold("Rétrolien") == fold("RETROLIEN") == "retrolien"
    assert fold("BÁCKLÎNK") == "backlink"
    assert "banned phrase: backlink" in reasons({**GENUINE, "message": "Cheap BÁCKLÎNKS, best prices."}, seconds=42)


def test_un_rejet_vient_avec_ses_motifs_une_liste_vide_veut_dire_accepter():
    """docstring de reasons : « Every reason to reject this submission. An empty list means: accept it »."""
    fields = {"message": "online casino viagra http://a.com http://b.com http://c.com", "website": "x"}
    assert reasons(fields, 0) == [
        "honeypot filled", "submitted too fast", "too many links",
        "banned phrase: online casino", "banned phrase: viagra",
    ]
    assert is_spam(fields, 0) is True and is_spam(GENUINE, 42) is False


def test_l_extrait_n_importe_que_la_bibliotheque_standard():
    """docstring : « no dependency, no training data » ; risks.data_egress : none."""
    source = ast.parse(Path(__file__).with_name("n0.py").read_text(encoding="utf-8"))
    importes = {a.name for n in ast.walk(source) if isinstance(n, ast.Import) for a in n.names}
    importes |= {n.module for n in ast.walk(source) if isinstance(n, ast.ImportFrom)}
    assert importes == {"hmac", "re", "time", "unicodedata", "hashlib"}


def test_le_delai_est_signe_par_le_serveur_et_un_jeton_trafique_compte_comme_trop_rapide():
    """
    docstring : « a hidden field holding the time the page was rendered is a
    number the sender writes […] So the server issues that timestamp itself,
    signed with a secret only it holds ». Zéro seconde est la réponse sûre :
    `reasons` la lit comme « submitted too fast ».
    """
    secret = b"le secret du serveur, jamais dans la page"
    jeton = issue_token(secret, issued_at=time.time() - 30)
    assert 29 <= seconds_on_page(jeton, secret) <= 31

    issued, _, signature = jeton.partition(".")
    truque = [
        f"{int(issued) - 3600}.{signature}",  # l'horodatage reculé, la signature gardée
        f"{issued}.{'0' * len(signature)}",   # la signature remplacée
        issued,                                # pas de signature du tout
        "",                                    # pas de jeton
        "abc.def",                             # un jeton inventé
        f"{issued}.{signature[:-1]}",          # un caractère en moins
    ]
    for faux in truque:
        assert seconds_on_page(faux, secret) == 0.0, faux
        assert reasons(GENUINE, seconds_on_page(faux, secret)) == ["submitted too fast"], faux

    # Et un secret qui n'est pas celui du serveur ne vaut pas mieux.
    assert seconds_on_page(jeton, b"un autre secret") == 0.0
    # Témoin : le vrai jeton, lu avec le vrai secret, traverse le contrôle.
    assert reasons(GENUINE, seconds_on_page(jeton, secret)) == []


def test_un_jeton_du_futur_ne_donne_pas_un_delai_negatif():
    """`max(0.0, …)` : une horloge qui recule ne fabrique pas un délai."""
    secret = b"secret"
    futur = issue_token(secret, issued_at=time.time() + 600)
    assert seconds_on_page(futur, secret) == 0.0


def test_verdict_la_sollicitation_reelle_traverse_les_quatre_controles():
    """
    verdict_rationale : « « Hi, we can boost your google ranking with quality
    links, cheap offer. » ne porte ni lien ni mot interdit, traverse les quatre
    contrôles sans un seul motif de rejet ».
    """
    assert LINK.findall(fold(VERDICT_SOLICITATION)) == []
    assert BANNED.findall(fold(VERDICT_SOLICITATION)) == []
    assert reasons({"message": VERDICT_SOLICITATION, "website": ""}, 30) == []


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_formulaire_vide_et_message_d_un_megaoctet():
    assert reasons({}, seconds=42) == []
    started = time.monotonic()
    assert reasons({**GENUINE, "message": "I have a question about my order. " * 30000}, seconds=42) == []
    assert time.monotonic() - started < 2


def test_production_limites_du_delai_et_du_plafond_de_liens():
    assert MINIMUM_SECONDS == 3.0 and MAXIMUM_LINKS == 2
    assert reasons(GENUINE, 2.999) == ["submitted too fast"]
    assert reasons(GENUINE, 3.0) == []
    two = {**GENUINE, "message": "http://a.com http://b.com"}
    three = {**GENUINE, "message": "http://a.com http://b.com http://c.com"}
    assert reasons(two, 42) == [] and reasons(three, 42) == ["too many links"]


def test_production_un_pot_de_miel_d_espaces_compte_comme_vide():
    assert reasons({**GENUINE, "website": " \t "}, 42) == []


def test_production_contournements_du_texte_espace_de_largeur_nulle_et_homoglyphe():
    """Constat, la « moitié faible » : une espace de largeur nulle ou un « а » cyrillique déjouent la liste ; la pleine chasse, non."""
    assert reasons({"message": "back​links cheap"}, 42) == []
    assert reasons({"message": "bаcklinks cheap"}, 42) == []
    assert reasons({"message": "ｂａｃｋｌｉｎｋ"}, 42) == ["banned phrase: backlink"]
    assert reasons({"message": unicodedata.normalize("NFD", "BÁCKLINK")}, 42) == ["banned phrase: backlink"]


def test_production_constat_le_repli_python_garde_l_accent_circonflexe_ascii():
    """Constat de divergence : « back^link » passe en Python ; le JavaScript retire « ^ » (propriété Diacritic) et le rejette."""
    assert fold("back^link") == "back^link"
    assert reasons({"message": "back^link"}, 42) == []


def test_defaut_des_adresses_electroniques_comptent_comme_des_liens():
    message = "Write to me at claire@example.com or claire.dubois@gmail.com, or my colleague paul@example.org"
    assert reasons({**GENUINE, "message": message}, 42) == []


def test_defaut_une_phrase_interdite_est_trouvee_a_l_interieur_d_un_mot():
    for message in ("J'ai acheté ce produit au Géant Casino de Nantes.", "Votre module de cryptographie est-il certifié ?"):
        assert reasons({**GENUINE, "message": message}, 42) == []


def test_defaut_un_delai_nan_passe_le_controle_de_vitesse():
    assert reasons(GENUINE, float("nan")) == ["submitted too fast"]


def test_defaut_un_message_concu_fait_exploser_le_motif_des_liens():
    started = time.monotonic()
    reasons({**GENUINE, "message": "a-" * 20000}, 42)
    assert time.monotonic() - started < 0.5
