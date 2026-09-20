import json
import shutil
import subprocess
import time
from pathlib import Path

from n0 import HONORIFICS, LEGAL_FORMS, PARTICLES, extract_names

ICI = Path(__file__).parent

# Un paragraphe de presse française ordinaire : le public visé de la fiche.
ARTICLE = ("Le contrat lie la société Lumière SARL à Jean de La Fontaine et à "
           "Mme Marie Martin, de Lyon. M. Boulanger a livré le colis mercredi.")

ANGLAIS = ("Sir Alex Ferguson and Acme Inc. signed the contract in Manchester. "
           "The company Lumiere Ltd was not represented.")

TOUS = [ARTICLE, ANGLAIS, "Boulanger a livré le colis.",
        "La société Boulanger a livré le colis.", "M. Boulanger a livré le colis.",
        "Lumière a livré le colis à Paris.", "Marks and Spencer ouvre à Lille.",
        "", "Jean de La Fontaine", "IBM et SAP", "l'entreprise Lumière",
        "Le groupe Lumière", "the firm Lumiere", "Mme  Marie Martin",
        "société lumière sarl", "Dr Martin et Pr Dupont"]


def lus(texte):
    return [(n["text"], n["type"], n["evidence"]) for n in extract_names(texte)["names"]]


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_un_nom_sans_marqueur_nest_pas_type():
    """
    « Sans marqueur, la phrase ne prouve rien : « Boulanger » revient
    `unknown`, et c'est un nom de famille autant qu'une enseigne. »
    """
    assert lus("Le colis a été livré par Boulanger.") == [("Boulanger", "unknown", None)]
    # Un lieu non plus n'est pas distingué d'une personne.
    assert lus("Le colis part pour Lyon.") == [("Lyon", "unknown", None)]


def test_point_de_rupture_temoin_un_marqueur_tranche_dans_les_deux_sens():
    """
    « Le témoin est dans le même test : la même phrase avec « la société »
    devant donne une entreprise, et avec « M. » devant, une personne. »
    """
    assert lus("La société Boulanger a livré le colis.") == [
        ("Boulanger", "company", "la société")]
    assert lus("M. Boulanger a livré le colis.") == [("Boulanger", "person", "m")]


# ---------------------------------------------------------------------------
# Les autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_les_trois_familles_de_marqueurs_sont_reconnues():
    assert lus("Dr Martin et Pr Dupont")[0] == ("Martin", "person", "dr")
    assert lus("Jean d'Artagnan a signé.")[0][0] == "Jean d'Artagnan"
    assert lus("Acme Inc. a signé.")[0] == ("Acme Inc", "company", "inc")
    assert lus("Le groupe Lumière a signé.")[0] == ("Lumière", "company", "le groupe")


def test_une_particule_tient_un_nom_ensemble():
    assert lus("Jean de La Fontaine") == [("Jean de La Fontaine", "unknown", None)]
    assert "de" in PARTICLES and "et" not in PARTICLES


def test_et_ne_tient_pas_un_nom_ensemble_et_la_fiche_le_dit():
    """La contrepartie assumée : « Marks and Spencer » revient en morceaux."""
    assert lus("L'enseigne Marks and Spencer ouvre à Lille.") == [
        ("Marks", "company", "l'enseigne"), ("Spencer", "unknown", None),
        ("Lille", "unknown", None)]
    # Et le bénéfice, dans la même phrase : deux noms énumérés restent deux.
    assert [n[0] for n in lus("Le contrat lie Alex Ferguson et Acme Inc.")] == [
        "Alex Ferguson", "Acme Inc"]


def test_un_mot_capitalise_en_tete_de_phrase_est_compte_pas_rendu():
    rapport = extract_names("Boulanger a livré le colis.")
    assert rapport["names"] == []
    assert rapport["skipped_at_sentence_start"] == 1
    # Un déterminant en tête de phrase n'est même pas compté.
    assert extract_names("Le colis est parti.")["skipped_at_sentence_start"] == 0


def test_un_nom_de_plusieurs_mots_en_tete_de_phrase_est_rendu():
    """La règle ne vaut que pour un mot seul : deux mots capitalisés, c'est un nom."""
    assert lus("Marie Martin a livré le colis.") == [("Marie Martin", "unknown", None)]


def test_les_marqueurs_sont_une_liste_declaree_faite_pour_etre_etendue():
    assert "mme" in HONORIFICS and "sarl" in LEGAL_FORMS
    assert lus("La société Lumière GmbH a signé.")[0][1] == "company"


def test_aucune_entree_ne_leve():
    for entree in [None, 42, [], {}, b"octets", ""]:
        rapport = extract_names(entree)
        assert rapport["names"] == []
        if not isinstance(entree, str):
            assert rapport["reason"].startswith("expected text")


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_entree_banale_un_paragraphe_de_presse():
    """T5 : l'entrée ordinaire du public visé."""
    assert lus(ARTICLE) == [
        ("Lumière SARL", "company", "sarl"),
        ("Jean de La Fontaine", "unknown", None),
        ("Marie Martin", "person", "mme"),
        ("Lyon", "unknown", None),
        ("Boulanger", "person", "m"),
    ]


def test_production_entree_vide():
    assert extract_names("") == {"names": [], "skipped_at_sentence_start": 0,
                                 "reason": None}


def test_production_entree_tres_grande_et_terminaison_rapide():
    enorme = ARTICLE * 5000
    debut = time.perf_counter()
    rapport = extract_names(enorme)
    assert time.perf_counter() - debut < 60.0
    assert len(rapport["names"]) == 5 * 5000


def test_production_encodages_inattendus():
    assert lus("Mme  Marie Martin")[0] == ("Marie Martin", "person", "mme")
    assert lus("﻿M. Boulanger a signé.")[0][1] == "person"
    assert lus("ΑΘΗΝΑ Λτδ a signé.")[0][0] == "ΑΘΗΝΑ Λτδ"


def test_production_valeurs_aux_limites():
    assert lus("A") == []  # une lettre seule en tête de phrase
    assert lus("Le colis de A à Z.") == []
    assert lus("société lumière sarl") == []  # rien n'est capitalisé
    assert lus("IBM et SAP") == [("SAP", "unknown", None)]  # IBM ouvre la phrase


def test_production_un_nom_illisible_nempeche_pas_de_lire_les_autres():
    """T8 : un morceau inattendu ne fait pas tomber le paragraphe."""
    melange = "M. Boulanger, 42 ; Mme Martin."
    assert [n[0] for n in lus(melange)] == ["Boulanger", "Martin"]


def test_production_la_lecture_tient_la_classe_de_latence_annoncee():
    """latency « ~10 ms » : mille lectures d'un paragraphe sous une borne large."""
    debut = time.perf_counter()
    for _ in range(1000):
        extract_names(ARTICLE)
    assert time.perf_counter() - debut < 20.0


# ---------------------------------------------------------------------------
# Parité entre les deux langages
# ---------------------------------------------------------------------------


def test_python_et_javascript_rendent_le_meme_rapport():
    """La fiche montre les deux extraits : elle affirme la même chose des deux."""
    node = shutil.which("node")
    assert node, "node est requis pour comparer les deux implémentations"
    attendu = [extract_names(texte) for texte in TOUS]
    script = (
        f"import {{ extractNames }} from {json.dumps((ICI / 'n0.js').as_uri())};"
        "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{"
        "process.stdout.write(JSON.stringify(JSON.parse(d).map(extractNames)));});"
    )
    sortie = subprocess.run([node, "--input-type=module", "-e", script],
                            input=json.dumps(TOUS), capture_output=True,
                            text=True, timeout=60, check=True)
    assert json.loads(sortie.stdout) == attendu
