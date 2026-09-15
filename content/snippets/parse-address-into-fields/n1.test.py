import ast
import time
from pathlib import Path

import pytest

from n0 import parse as parse_n0
from n1 import LABELS, features, fold, parse, tokenise, train

# Le jeu d'entraînement de ce niveau : des adresses étiquetées à la main, jeton
# par jeton. Toutes sont inventées. Écrites en segments plutôt qu'avec une
# étiquette par jeton, parce que c'est la forme qu'un humain peut vérifier.
TAGGED = [
    [("8", "number"), ("rue", "street_type"), ("des Lilas", "street"), ("75011", "postcode"), ("Paris", "city")],
    [("14", "number"), ("avenue", "street_type"), ("des Cerisiers", "street"), ("69003", "postcode"), ("Lyon", "city")],
    [("3", "number"), ("allée", "street_type"), ("du Château", "street"), ("33000", "postcode"), ("Bordeaux", "city")],
    [("27", "number"), ("boulevard", "street_type"), ("des Acacias", "street"), ("13006", "postcode"), ("Marseille", "city")],
    [("5", "number"), ("impasse", "street_type"), ("des Peupliers", "street"), ("44000", "postcode"), ("Nantes", "city")],
    [("2", "number"), ("place", "street_type"), ("des Tilleuls", "street"), ("31000", "postcode"), ("Toulouse", "city")],
    [("41", "number"), ("chemin", "street_type"), ("des Vignes", "street"), ("38000", "postcode"), ("Grenoble", "city")],
    [("9", "number"), ("route", "street_type"), ("de la Forêt", "street"), ("35000", "postcode"), ("Rennes", "city")],
    [("12 bis", "number"), ("rue", "street_type"), ("des Écoles", "street"), ("59000", "postcode"), ("Lille", "city")],
    [("6", "number"), ("quai", "street_type"), ("des Ormes", "street"), ("67000", "postcode"), ("Strasbourg", "city")],
    [("8", "number"), ("rue", "street_type"), ("des Lilas", "street"), ("Bâtiment C", "complement"), ("75011", "postcode"), ("Paris", "city")],
    [("14", "number"), ("avenue", "street_type"), ("des Cerisiers", "street"), ("Appartement 12", "complement"), ("69003", "postcode"), ("Lyon", "city")],
    [("Appartement 4", "complement"), ("3", "number"), ("allée", "street_type"), ("du Château", "street"), ("33000", "postcode"), ("Bordeaux", "city")],
    [("Bâtiment B", "complement"), ("Escalier 2", "complement"), ("27", "number"), ("boulevard", "street_type"), ("des Acacias", "street"), ("13006", "postcode"), ("Marseille", "city")],
    [("5", "number"), ("impasse", "street_type"), ("des Peupliers", "street"), ("Résidence Les Ormes", "complement"), ("44000", "postcode"), ("Nantes", "city")],
    [("2", "number"), ("place", "street_type"), ("des Tilleuls", "street"), ("Escalier A", "complement"), ("31000", "postcode"), ("Toulouse", "city")],
    [("41", "number"), ("chemin", "street_type"), ("des Vignes", "street"), ("Étage 3", "complement"), ("38000", "postcode"), ("Grenoble", "city")],
    [("9", "number"), ("route", "street_type"), ("de la Forêt", "street"), ("Porte 12", "complement"), ("35000", "postcode"), ("Rennes", "city")],
]


def expand(segments):
    """Des segments vers le couple (adresse, une étiquette par jeton) attendu par `train`."""
    address = " ".join(text for text, _ in segments)
    labels = [label for text, label in segments for _ in tokenise(text)]
    return address, labels


@pytest.fixture(scope="module")
def model():
    return train([expand(segments) for segments in TAGGED])


EMPTY = dict.fromkeys(LABELS, "")


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_l_adresse_allemande_rend_une_rue_vide_et_un_numero_qui_vaut_5(model):
    """« Sur « Hauptstrasse 5, 10115 Berlin », il rend une rue vide et un numéro qui vaut 5 ». Essai : la rue « passe en complément »."""
    assert parse(model, "Hauptstrasse 5, 10115 Berlin") == {
        "number": "5", "street_type": "", "street": "", "complement": "Hauptstrasse", "postcode": "10115", "city": "Berlin"}
    # Témoin : une adresse française de la même forme est juste.
    assert parse(model, "8 rue des Lilas, 75011 Paris")["street"] == "rue des Lilas"


def test_point_de_rupture_l_adresse_britannique_rend_pas_de_code_postal_et_4tq_pour_ville(model):
    """« sur « 42 Rowan Street, Bristol BS1 4TQ », pas de code postal, et « 4TQ » pour toute ville — […] il étiquette quand même »."""
    parsed = parse(model, "42 Rowan Street, Bristol BS1 4TQ")
    assert parsed["postcode"] == "" and parsed["city"] == "4TQ"
    assert parsed == {"number": "42", "street_type": "", "street": "", "complement": "Rowan Street Bristol BS1",
                      "postcode": "", "city": "4TQ"}
    # Chaque jeton a reçu une étiquette : rien n'est laissé de côté.
    assert sorted(" ".join(v for k, v in parsed.items() if k != "street").split()) == sorted(tokenise("42 Rowan Street, Bristol BS1 4TQ"))


def test_point_de_rupture_toutes_les_adresses_du_jeu_placent_le_numero_devant_et_cinq_chiffres_avant_la_ville():
    """« toutes les adresses de son jeu d'entraînement placent le numéro devant et cinq chiffres avant la ville »."""
    for segments in TAGGED:
        labels = [label for _, label in segments]
        assert labels.index("number") < labels.index("street_type")
        assert labels.index("postcode") == labels.index("city") - 1
        postcode = [t for t, l in segments if l == "postcode"][0]
        assert postcode.isdigit() and len(postcode) == 5


# ---------------------------------------------------------------------------
# Autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_l_aide_d_etiquetage_aligne_les_etiquettes_sur_les_jetons():
    address, labels = expand(TAGGED[0])
    assert address == "8 rue des Lilas 75011 Paris"
    assert labels == ["number", "street_type", "street", "street", "postcode", "city"]


def test_decoupe_une_adresse_ordinaire(model):
    assert parse(model, "8 rue des Lilas, 75011 Paris") == {
        "number": "8", "street_type": "rue", "street": "rue des Lilas", "complement": "", "postcode": "75011", "city": "Paris"}


def test_un_complement_au_milieu_de_la_ligne_n_avale_plus_la_voie(model):
    """
    Docstring : « un complément au milieu de la ligne n'avale plus la voie » ;
    verdict : « N0 le colle dans le nom de la rue sans jamais le signaler ». Sur l'exemple même du point de rupture de N0.
    """
    address = "8 rue des Lilas Bâtiment C Appartement 12, 75011 Paris"
    assert parse(model, address)["street"] == "rue des Lilas"
    assert parse(model, address)["complement"] == "Bâtiment C Appartement 12"
    assert parse_n0(address)["street"] == "rue des Lilas Bâtiment C Appartement 12"


def test_separe_un_complement_que_n0_avalait(model):
    parsed = parse(model, "Appartement 12, Bâtiment C, 8 rue des Lilas, 75011 Paris")
    assert parsed["complement"] == "Appartement 12 Bâtiment C"
    assert parsed["number"] == "8" and parsed["street"] == "rue des Lilas"


def test_lit_une_rue_une_residence_et_une_ville_jamais_vues(model):
    """Essai : « Une rue, une résidence et une ville jamais vues »."""
    seen = " ".join(text for segments in TAGGED for text, _ in segments)
    for word in ("Moulin", "Charmes", "Dijon", "21000"):
        assert word not in seen
    parsed = parse(model, "7 rue du Moulin, Résidence Les Charmes, 21000 Dijon")
    assert parsed["street"] == "rue du Moulin" and parsed["complement"] == "Résidence Les Charmes" and parsed["city"] == "Dijon"


def test_lit_capitales_et_absence_de_virgule(model):
    """Essai : « Tout en capitales, sans une virgule »."""
    parsed = parse(model, "6 QUAI DES ORMES 67000 STRASBOURG")
    assert parsed["number"] == "6" and parsed["street"] == "QUAI DES ORMES" and parsed["city"] == "STRASBOURG"


def test_chaque_mot_est_etiquete_d_apres_ce_a_quoi_il_ressemble_et_ce_qui_l_entoure():
    """« d'après ce à quoi il ressemble et d'après ce qui se trouve de part et d'autre »."""
    traits = features(["8", "Rue", "des"], 1)
    assert traits["token=rue"] == 1 and traits["previous=8"] == 1 and traits["next=des"] == 1
    assert features(["75011"], 0)["five_digits"] == 1.0 and features(["75011"], 0)["previous=<start>"] == 1
    assert fold("Allée") == fold("allee") == "allee"


@pytest.mark.xfail(
    strict=True,
    reason="INFIRMÉ : la docstring de features dit que cinq chiffres suivis d'un mot capitalisé sont un code postal et une ville "
    "« où qu'ils soient dans la ligne » ; sur « 75011 Paris, 8 rue des Lilas », Paris passe en complément et Lilas en ville",
)
def test_cinq_chiffres_et_un_mot_capitalise_sont_code_postal_et_ville_ou_qu_ils_soient(model):
    parsed = parse(model, "75011 Paris, 8 rue des Lilas")
    assert parsed["postcode"] == "75011" and parsed["city"] == "Paris"


def test_les_champs_sont_regroupes_dans_l_ordre_de_lecture_et_le_type_ouvre_la_voie(model):
    parsed = parse(model, "Bâtiment B Escalier 2 27 boulevard des Acacias 13006 Marseille")
    assert parsed["complement"] == "Bâtiment B Escalier 2"
    assert parsed["street"] == "boulevard des Acacias" and parsed["street_type"] == "boulevard"


def test_un_exemple_mal_aligne_est_refuse_plutot_qu_appris():
    with pytest.raises(ValueError, match="4 tokens for 2 labels"):
        train([("8 rue des Lilas", ["number", "street_type"])])


def test_le_jeu_d_entrainement_compte_dix_huit_adresses():
    """Essai : « Modèle entraîné sur 18 adresses étiquetées mot par mot ». Voir le relevé pour « quelques dizaines »."""
    assert len(TAGGED) == 18


def test_n1_est_deterministe_et_s_appuie_sur_scikit_learn(model):
    again = train([expand(segments) for segments in TAGGED])
    assert all(parse(again, a) == parse(model, a) for a in ("8 rue des Lilas, 75011 Paris", "Hauptstrasse 5, 10115 Berlin"))
    source = (Path(__file__).parent / "n1.py").read_text(encoding="utf-8")
    modules = {a.name.split(".")[0] for n in ast.walk(ast.parse(source)) if isinstance(n, ast.Import) for a in n.names}
    modules |= {n.module.split(".")[0] for n in ast.walk(ast.parse(source)) if isinstance(n, ast.ImportFrom)}
    assert modules == {"re", "unicodedata", "sklearn"}


def test_une_adresse_se_decoupe_en_moins_d_une_milliseconde(model):
    runs = []
    for _ in range(5):
        start = time.perf_counter()
        for _ in range(50):
            parse(model, "8 rue des Lilas, 75011 Paris")
        runs.append((time.perf_counter() - start) / 50)
    assert min(runs) < 0.001


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_une_chaine_vide_et_de_la_ponctuation_seule(model):
    assert parse(model, "") == EMPTY
    assert parse(model, " ,;. ") == EMPTY


def test_production_un_jeu_d_entrainement_vide_est_refuse():
    with pytest.raises(ValueError):
        train([])


def test_production_une_adresse_de_trois_mille_caracteres_termine(model):
    start = time.perf_counter()
    parsed = parse(model, "8 rue des Lilas Bâtiment C " * 120 + " 75011 Paris")
    assert time.perf_counter() - start < 2
    assert parsed["postcode"].endswith("75011")


def test_production_marque_d_ordre_pleine_largeur_nfd(model):
    assert parse(model, "﻿8 rue des Lilas, 75011 Paris")["street"] == "rue des Lilas"
    assert parse(model, "８ rue des Lilas, ７５０１１ Paris")["postcode"] == "75011"
    assert parse(model, "3 Allée du Château, 33000 Bordeaux")["street"] == "Allée du Château"


def test_production_une_ligne_qui_n_est_pas_une_adresse_est_etiquetee_quand_meme(model):
    """« rien ne lui permet de dire qu'il n'a jamais vu ça, il étiquette quand même »."""
    parsed = parse(model, "the meeting is at ten in room four")
    assert parsed["number"] == "the" and parsed["city"] == "four"
