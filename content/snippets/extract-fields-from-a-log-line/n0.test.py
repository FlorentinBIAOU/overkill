import json
import shutil
import subprocess
import time
from pathlib import Path

from n0 import LOOSE, PATTERNS, PIECES, compile_pattern, loose_pieces, parse_lines

ICI = Path(__file__).parent

APACHE = [
    '192.168.0.12 - jean [10/Oct/2026:13:55:36 +0200] "GET /factures/42 HTTP/1.1"'
    ' 200 2326 "https://exemple.fr/" "Mozilla/5.0 (X11; Linux x86_64)"',
    '203.0.113.7 - - [10/Oct/2026:13:55:37 +0200] "POST /connexion HTTP/1.1"'
    ' 302 - "-" "curl/8.5.0"',
    '2001:db8::1 - marie [10/Oct/2026:13:55:38 +0200] "GET /café HTTP/1.1"'
    ' 404 512 "-" "Mozilla/5.0"',
]

SYSLOG = "<34>Oct 10 13:55:36 serveur1 sshd[1234]: Failed password for jean from 203.0.113.7"

# Ce que contient vraiment /var/log/syslog, /var/log/auth.log ou la sortie de
# journalctl : le collecteur retire la priorité entre chevrons avant d'écrire.
SYSLOG_FICHIER = [
    "Oct 10 13:55:36 serveur1 sshd[1234]: Failed password for root",
    "Oct 10 13:55:36 serveur1 systemd[1]: Started Session 3 of user jean.",
    "Oct 10 13:55:37 serveur1 CRON[4521]: pam_unix(cron:session): session opened",
]

# Une ligne d'accès dont la requête porte un guillemet échappé, ce qu'écrit
# mod_log_config et ce que produisent les scanners tous les jours.
APACHE_GUILLEMET = (
    r'203.0.113.9 - - [10/Oct/2026:13:55:39 +0200] "GET /a\"b HTTP/1.1"'
    r' 404 512 "-" "curl/8.5.0"'
)

# Le même motif, avec l'horodatage ET l'étiquette décrits par un morceau trop
# lâche. Les deux sont relâchés : c'est ce que le point de rupture publie.
LACHE = "<%{INT:priority}>%{DATA:timestamp} %{WORD:host} %{DATA:tag}: %{GREEDY:message}"

# Une trace d'exception : une ligne qui correspond, et cinq qui ne
# correspondent pas mais qui portent l'information.
TRACE = [
    "<27>Oct 10 13:55:40 serveur1 app[42]: Traceback (most recent call last):",
    '  File "/srv/app/facture.py", line 118, in enregistrer',
    "    total = ligne.montant_ht + ligne.tva",
    "AttributeError: 'NoneType' object has no attribute 'montant_ht'",
]


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_un_motif_trop_lache_decoupe_faux_sans_rien_signaler():
    """
    « Le motif qui décrit l'horodatage et l'étiquette par « %{DATA} » rend
    timestamp « Oct », host « 10 » et tag « 13:55:36 serveur1 sshd[1234] », et
    la ligne n'est pas rejetée. »

    Les deux morceaux sont relâchés, et c'est ce que le motif exécuté fait :
    ne relâcher que l'horodatage donne un autre découpage, tout aussi faux mais
    différent, et la fiche publie celui qui est mesuré ici.
    """
    assert LACHE.count("%{DATA:") == 2, "l'horodatage et l'étiquette"
    rapport = parse_lines([SYSLOG], LACHE)
    assert rapport["rejected"] == []
    champ = rapport["parsed"][0]
    assert champ["timestamp"] == "Oct"
    assert champ["host"] == "10"
    assert champ["tag"] == "13:55:36 serveur1 sshd[1234]"
    # Et le rapport nomme les morceaux qui peuvent couper n'importe où.
    assert rapport["loose_pieces"] == ["timestamp", "tag"]
    # Ne relâcher que l'horodatage découpe faux autrement : c'est pour cela que
    # la phrase de la fiche parle des deux.
    un_seul = "<%{INT:priority}>%{DATA:timestamp} %{WORD:host} %{NOTCOLON:tag}: %{GREEDY:message}"
    autre = parse_lines([SYSLOG], un_seul)["parsed"][0]
    assert (autre["timestamp"], autre["host"], autre["tag"]) == (
        "Oct 10", "13:55:36", "serveur1 sshd[1234]")


def test_point_de_rupture_temoin_le_motif_de_la_fiche_rend_les_quatre_champs_justes():
    """« Le témoin : le motif de la fiche, qui décrit la date comme une date, rend les quatre champs justes. »"""
    champ = parse_lines([SYSLOG], "syslog-3164")["parsed"][0]
    assert champ["timestamp"] == "Oct 10 13:55:36"
    assert champ["host"] == "serveur1"
    assert champ["tag"] == "sshd[1234]"
    assert champ["message"] == "Failed password for jean from 203.0.113.7"


# ---------------------------------------------------------------------------
# Les autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_le_motif_syslog_lit_les_lignes_dun_fichier_de_journal():
    """
    Commentaire : « The syslog priority between angle brackets exists on the
    wire […] and the collector strips it before writing. »

    R1 : l'entrée ordinaire du lecteur est une ligne de `/var/log/syslog`, pas
    un paquet UDP. Le motif livré les rejetait toutes.
    """
    rapport = parse_lines(SYSLOG_FICHIER, "syslog-3164")
    assert rapport["rejected"] == []
    assert [c["host"] for c in rapport["parsed"]] == ["serveur1"] * 3
    assert [c["tag"] for c in rapport["parsed"]] == ["sshd[1234]", "systemd[1]", "CRON[4521]"]
    # La priorité est nulle quand la ligne n'en porte pas, et lue quand elle
    # en porte une : c'est le même motif pour le fil et pour le fichier.
    assert [c["priority"] for c in rapport["parsed"]] == [None, None, None]
    assert parse_lines([SYSLOG], "syslog-3164")["parsed"][0]["priority"] == "34"


def test_une_requete_avec_un_guillemet_echappe_nest_pas_rejetee():
    """
    Commentaire du morceau `QUOTED` : « `mod_log_config` writes a `\"` inside
    the request and the agent, and scanners produce them every day. »
    """
    rapport = parse_lines([APACHE_GUILLEMET], "apache-combined")
    assert rapport["rejected"] == []
    assert rapport["parsed"][0]["request"] == r'GET /a\"b HTTP/1.1'
    assert rapport["parsed"][0]["status"] == "404"
    # Témoin : la même ligne sans guillemet échappé est lue comme avant.
    assert parse_lines([APACHE[1]], "apache-combined")["rejected"] == []


def test_les_morceaux_laches_hors_de_la_derniere_position_sont_nommes():
    """
    Docstring : « `loose_pieces` names the pieces that can cut anywhere.
    Nothing is rejected because of them — that is exactly the problem. »
    """
    assert LOOSE == ("DATA", "GREEDY")
    assert loose_pieces(r"%{DATA:a} %{WORD:b} %{GREEDY:c}") == ["a"]
    # Un morceau lâche en dernière position s'arrête où la ligne s'arrête :
    # c'est à cela qu'il sert, et il n'est pas signalé.
    assert loose_pieces(PATTERNS["syslog-3164"]) == []
    assert loose_pieces(PATTERNS["nginx-error"]) == []
    assert loose_pieces(PATTERNS["apache-combined"]) == []


def test_une_ligne_qui_ne_correspond_pas_est_rendue_jamais_perdue():
    """
    Docstring : « A line that does not match is never dropped: it comes back in
    `rejected`, with its number ».
    """
    rapport = parse_lines(APACHE + ["pas une ligne de journal"], "apache-combined")
    assert len(rapport["parsed"]) == 3
    assert rapport["rejected"] == [{"line": 4, "text": "pas une ligne de journal"}]
    # Le numéro est celui du fichier, pas celui de la liste des rejets.
    melange = parse_lines(["x", APACHE[0], "y"], "apache-combined")
    assert [r["line"] for r in melange["rejected"]] == [1, 3]
    assert [p["line"] for p in melange["parsed"]] == [2]


def test_lhorodatage_est_rendu_tel_quil_est_ecrit():
    """
    Docstring : « the RFC 3164 syslog format carries neither year nor time
    zone, and turning « Oct 10 13:55:36 » into an instant means inventing both ».
    """
    champ = parse_lines([SYSLOG], "syslog-3164")["parsed"][0]
    assert champ["timestamp"] == "Oct 10 13:55:36"
    assert "2026" not in champ["timestamp"] and "+" not in champ["timestamp"]
    # Le format d'Apache, lui, porte son décalage, et il est rendu entier.
    assert parse_lines(APACHE, "apache-combined")["parsed"][0]["timestamp"] == (
        "10/Oct/2026:13:55:36 +0200")


def test_la_notation_nommee_est_compilee_dans_la_syntaxe_du_langage():
    """
    Docstring : « Python spells a named group `(?P<name>…)` and JavaScript
    `(?<name>…)` ».
    """
    expression = compile_pattern("%{INT:status} %{WORD:size}")
    assert "(?P<status>" in expression.pattern
    assert expression.match("200 2326").groupdict() == {"status": "200", "size": "2326"}
    # Un morceau inconnu ne compile pas, et le rapport le dit.
    assert parse_lines(["x"], "%{INCONNU:champ}")["reason"] == "this pattern is not usable"
    assert parse_lines(["x"], "(")["reason"] == "this pattern is not usable"


def test_les_trois_formats_livres_lisent_leurs_lignes():
    for nom, ligne in [
        ("apache-combined", APACHE[0]),
        ("syslog-3164", SYSLOG),
        ("nginx-error", "2026/10/10 13:55:36 [error] 1234#0: *5 open() failed"),
    ]:
        rapport = parse_lines([ligne], nom)
        assert rapport["rejected"] == [], nom
        assert rapport["parsed"][0]["line"] == 1, nom
    assert set(PATTERNS) == {"apache-combined", "syslog-3164", "nginx-error"}


def test_un_motif_peut_etre_ecrit_par_lappelant():
    """`pattern` est un nom de la table, ou un motif écrit dans la même notation."""
    rapport = parse_lines(["utilisateur=jean action=connexion duree=42"],
                          r"utilisateur=%{WORD:user} action=%{WORD:action} duree=%{INT:ms}")
    assert rapport["parsed"][0] == {"line": 1, "user": "jean", "action": "connexion", "ms": "42"}
    assert rapport["loose_pieces"] == []


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_entree_banale_trois_lignes_dun_journal_dacces():
    """T5 : l'entrée ordinaire du public visé."""
    rapport = parse_lines(APACHE, "apache-combined")
    assert rapport["rejected"] == []
    assert [p["status"] for p in rapport["parsed"]] == ["200", "302", "404"]
    assert rapport["parsed"][2]["client"] == "2001:db8::1"
    # Un tiret à la place d'une taille, comme l'écrit Apache sur une redirection.
    assert rapport["parsed"][1]["size"] == "-"


def test_production_entree_vide():
    assert parse_lines([], "apache-combined") == {
        "parsed": [], "rejected": [], "loose_pieces": [], "reason": None}
    assert parse_lines([""], "apache-combined")["rejected"] == [{"line": 1, "text": ""}]


def test_production_entree_tres_grande_et_terminaison_rapide():
    """Cent mille lignes : c'est le volume qui décide de ce niveau."""
    lignes = APACHE * 33_334
    debut = time.perf_counter()
    rapport = parse_lines(lignes, "apache-combined")
    ecoule = time.perf_counter() - debut
    assert ecoule < 60.0
    assert len(rapport["parsed"]) == 100_002
    # Et une ligne hostile ne fait pas exploser le motif.
    debut = time.perf_counter()
    parse_lines(['1.2.3.4 - - [' + "a" * 100_000], "apache-combined")
    assert time.perf_counter() - debut < 10.0


def test_production_encodages_inattendus():
    # Une URL accentuée, un agent avec des parenthèses, une adresse IPv6.
    champ = parse_lines(APACHE, "apache-combined")["parsed"][2]
    assert champ["request"] == "GET /café HTTP/1.1"
    assert parse_lines(APACHE, "apache-combined")["parsed"][0]["agent"] == (
        "Mozilla/5.0 (X11; Linux x86_64)")
    # Une fin de ligne Windows est retirée, et rien d'autre.
    assert parse_lines([SYSLOG + "\r\n"], "syslog-3164")["parsed"][0]["message"].endswith(
        "203.0.113.7")
    # Une ligne qui n'est pas du texte est rejetée, pas levée.
    assert parse_lines([None, 42], "apache-combined")["rejected"] == [
        {"line": 1, "text": None}, {"line": 2, "text": None}]


def test_production_valeurs_aux_limites():
    # Une ligne vide, une ligne d'un caractère, une ligne sans le dernier champ.
    tronquee = APACHE[0].rsplit(' "', 1)[0]
    rapport = parse_lines(["", "x", tronquee], "apache-combined")
    assert len(rapport["rejected"]) == 3
    # Les morceaux disponibles sont ceux que la fiche annonce.
    assert set(PIECES) == {"IP", "WORD", "INT", "DATA", "QUOTED",
                           "BRACKETED", "NOTCOLON", "SYSLOGDATE", "GREEDY"}


def test_production_une_trace_dexception_donne_une_ligne_et_des_rejets():
    """
    T8 : les lignes qui ne correspondent pas ne font pas tomber le lot, et ce
    sont elles qui portent l'information — c'est à cela que sert `rejected`.
    """
    rapport = parse_lines(TRACE, "syslog-3164")
    assert len(rapport["parsed"]) == 1
    assert len(rapport["rejected"]) == 3
    assert "AttributeError" in rapport["rejected"][2]["text"]


def test_production_le_decoupage_tient_la_classe_de_latence_annoncee():
    """latency « <1 ms » : cent mille lignes, soit bien moins d'une milliseconde chacune."""
    debut = time.perf_counter()
    parse_lines(APACHE * 33_334, "apache-combined")
    assert time.perf_counter() - debut < 60.0


# ---------------------------------------------------------------------------
# Parité entre les deux langages
# ---------------------------------------------------------------------------


def test_python_et_javascript_rendent_le_meme_decoupage():
    """La fiche montre les deux extraits : elle affirme la même chose des deux."""
    node = shutil.which("node")
    assert node, "node est requis pour comparer les deux implémentations"
    cas = [
        (APACHE, "apache-combined"),
        ([APACHE_GUILLEMET], "apache-combined"),
        (SYSLOG_FICHIER, "syslog-3164"),
        (APACHE + ["pas une ligne de journal"], "apache-combined"),
        ([SYSLOG], "syslog-3164"),
        ([SYSLOG], LACHE),
        (TRACE, "syslog-3164"),
        (["2026/10/10 13:55:36 [error] 1234#0: *5 open() failed"], "nginx-error"),
        ([""], "apache-combined"),
        ([], "apache-combined"),
        (["x"], "%{INCONNU:champ}"),
        (["utilisateur=jean action=connexion duree=42"],
         r"utilisateur=%{WORD:user} action=%{WORD:action} duree=%{INT:ms}"),
        ([SYSLOG + "\r\n"], "syslog-3164"),
    ]
    attendu = [parse_lines(lignes, motif) for lignes, motif in cas]
    script = (
        f"import {{ parseLines }} from {json.dumps((ICI / 'n0.js').as_uri())};"
        "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{"
        "process.stdout.write(JSON.stringify("
        "JSON.parse(d).map(([l,m])=>parseLines(l,m))));});"
    )
    sortie = subprocess.run([node, "--input-type=module", "-e", script],
                            input=json.dumps(cas), capture_output=True,
                            text=True, timeout=60, check=True)
    assert json.loads(sortie.stdout) == attendu
