import ast
import pickle
import time
import unicodedata
from pathlib import Path

import pytest
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline

from n0 import mask as mask_n0
from n1 import is_hiding_contact_details, shape, train

# Un petit jeu étiqueté, celui qu'un après-midi d'étiquetage produit.
HIDING = [
    "call me on zero six twelve thirty four fifty six",
    "reach me at O6 I2 34 56 78",
    "my number is 06 12 34 56 78",
    "ring zero six one two three four five six seven eight",
    "phone: 0 6 1 2 3 4 5 6 7 8",
    "text me on o6.i2.34.56.78",
    "contact seven eight nine four five six one two",
    "my line is O6-I2-34-56-78 thanks",
]

ORDINARY = [
    "the meeting is at ten in room four",
    "we shipped version two point three yesterday",
    "there are six items left in stock",
    "please review the 2024 report before friday",
    "invoice 4512 is still unpaid",
    "the build takes about three minutes",
    "chapter seven covers the migration",
    "we need four more seats for the workshop",
]

LABELS = [1] * len(HIDING) + [0] * len(ORDINARY)


@pytest.fixture(scope="module")
def model():
    return train(HIDING + ORDINARY, LABELS)


def score(model, message):
    return model.predict_proba([shape(message)])[0][1]


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_des_homoglyphes_cyrilliques_passent_au_travers(model):
    """
    « Des homoglyphes venus d'un autre alphabet […] ne portent ni chiffre ni mot
    connu : rien ne survit à la mise en forme, et le message passe. »
    """
    cyrillic = "reach me at Об Іb ЗЧ"
    assert "D" not in shape(cyrillic).split()  # aucun chiffre ne survit
    assert shape(cyrillic) == "reach me at об іb зч"
    assert not is_hiding_contact_details(model, cyrillic)
    # Témoin : les sosies latins, eux, sont attrapés.
    assert is_hiding_contact_details(model, "reach me at O6 I2 34 56 78")


def test_point_de_rupture_des_chiffres_romains_passent_au_travers(model):
    """« […] ou des chiffres romains, ne portent ni chiffre ni mot connu. »"""
    roman = "call me on VI XII XXXIV LVI"
    assert shape(roman) == "call me on vi xii xxxiv lvi"
    assert not is_hiding_contact_details(model, roman)
    # Témoin : le même message en chiffres écrits en lettres est attrapé.
    assert is_hiding_contact_details(model, "call me on zero six twelve thirty four")


def test_point_de_rupture_le_modele_ne_connait_que_les_contournements_montres(model):
    """« Le modèle ne connaît que les contournements qu'on lui a montrés » : des chiffres en allemand passent."""
    german = "call me on null sechs zwölf"
    assert "D" not in shape(german).split()
    assert not is_hiding_contact_details(model, german)
    assert is_hiding_contact_details(model, "call me on zero six twelve thirty four")


# ---------------------------------------------------------------------------
# Autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_la_mise_en_forme_replie_chiffres_et_sosies():
    assert shape("O6 I2 34") == "DD DD DD"
    assert shape("call me on zero six") == "call me on D D"


def test_la_mise_en_forme_garde_les_mots_et_retire_la_ponctuation():
    assert shape("hi! my number, ok?") == "hi my number ok"


def test_la_mise_en_forme_ne_replie_pas_les_lettres_sans_chiffre_reel():
    """« Le jeton doit déjà contenir un vrai chiffre […] "loll" deviendrait 1011. »"""
    assert shape("loll that is funny") == "loll that is funny"
    # Témoin : avec un vrai chiffre, le même jeton est replié.
    assert shape("l0ll") == "DDDD"


def test_la_casse_compte_pour_les_sosies():
    """Commentaire : « Case matters for lookalikes » : « l0 » est replié, « L0 » ne l'est pas."""
    assert shape("l0") == "DD"
    assert shape("L0") == "l0"


def test_attrape_un_numero_en_lettres_que_n0_laisse_passer(model):
    message = "call me on zero six twelve thirty four"
    assert mask_n0(message) == message
    assert is_hiding_contact_details(model, message)


def test_attrape_les_caracteres_sosies(model):
    assert is_hiding_contact_details(model, "reach me at O6 I2 34 56 78")


def test_laisse_passer_les_messages_ordinaires(model):
    for message in ORDINARY:
        assert not is_hiding_contact_details(model, message), message


def test_le_seuil_est_a_vous(model):
    """
    « Rapprochez-le de 1 si un faux positif bloque un message légitime ;
    rapprochez-le de 0 si en laisser passer un est le pire. »
    """
    messages = HIDING + ORDINARY + ["reach me at 07 98 76 54 32", "call me on VI XII XXXIV LVI"]

    def flagged(threshold):
        return sum(is_hiding_contact_details(model, m, threshold) for m in messages)

    counts = [flagged(t) for t in (0.0, 0.3, 0.5, 0.7, 1.0)]
    assert counts == sorted(counts, reverse=True)
    assert counts[0] == len(messages) and counts[-1] == 0
    # Le seuil est inclusif.
    s = score(model, "reach me at O6 I2 34 56 78")
    assert is_hiding_contact_details(model, "reach me at O6 I2 34 56 78", threshold=s)


def test_attrape_les_emojis_touches_parce_qu_ils_portent_de_vrais_chiffres(model):
    keycaps = "call me on 0️⃣6️⃣ 1️⃣2️⃣ 3️⃣4️⃣"
    assert mask_n0(keycaps) == keycaps
    assert is_hiding_contact_details(model, keycaps)


def test_des_chiffres_poses_a_cote_de_call_pesent_plus_qu_a_cote_de_mots_neutres(model):
    """
    Docstring : « une suite de jetons surtout faits de chiffres […] posés à côté
    de mots comme « call » ou « reach » ». Précision : la suite seule pèse encore
    plus (les mots diluent le vecteur) ; voir le relevé.
    """
    number = "07 98 76 54 32"
    assert score(model, f"call me on {number}") > score(model, f"the code is {number}")


def test_entraine_sur_des_formes_il_attrape_un_numero_jamais_vu(model):
    """Docstring de shape : « Entraîné sur des formes, il apprend à quoi ressemble un numéro caché. »"""
    unseen = "reach me at 07 98 76 54 32"
    assert all("07 98" not in m for m in HIDING)
    assert is_hiding_contact_details(model, unseen)


@pytest.mark.xfail(
    strict=True,
    reason="INFIRMÉ : la docstring de shape dit qu'un classifieur entraîné sur le texte brut mémorise les numéros ; "
    "sur ce jeu, il attrape aussi un numéro jamais vu (score 0,57)",
)
def test_un_classifieur_sur_texte_brut_memorise_les_numeros_d_entrainement():
    raw = make_pipeline(
        TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 4), min_df=1),
        LogisticRegression(class_weight="balanced", max_iter=1000),
    )
    raw.fit(HIDING + ORDINARY, LABELS)
    assert raw.predict_proba(["reach me at 07 98 76 54 32"])[0][1] < 0.5


def test_les_poids_sont_assez_petits_pour_vivre_dans_le_depot(model):
    """Docstring : « Les poids sont assez petits pour vivre dans le dépôt » : 16 Ko sérialisés sur ce jeu."""
    assert len(pickle.dumps(model)) < 100_000


@pytest.mark.xfail(
    strict=True,
    reason="INFIRMÉ : unavailable_reason N2 dit que N1 traite déjà les adresses ; la mise en forme retire @ et le point, "
    "une adresse électronique a la même forme que les mêmes mots séparés par des espaces",
)
def test_n1_distingue_une_adresse_electronique_des_memes_mots(model):
    assert shape("write to jean.dupont@example.com") != shape("write to jean dupont example com")


def test_n1_est_une_regression_logistique_de_bibliotheque(model):
    """name : « Régression logistique sur la forme des jetons » ; risks : vendor_lock library (scikit-learn)."""
    assert isinstance(model[-1], LogisticRegression)
    source = (Path(__file__).parent / "n1.py").read_text(encoding="utf-8")
    modules = set()
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, ast.Import):
            modules |= {alias.name.split(".")[0] for alias in node.names}
        elif isinstance(node, ast.ImportFrom):
            modules.add(node.module.split(".")[0])
    assert modules == {"re", "sklearn"}


def test_n1_est_deterministe(model):
    again = train(HIDING + ORDINARY, LABELS)
    assert (again[-1].coef_ == model[-1].coef_).all()
    messages = HIDING + ORDINARY
    assert [is_hiding_contact_details(again, m) for m in messages] == [is_hiding_contact_details(model, m) for m in messages]


def test_une_decision_prend_moins_d_une_milliseconde(model):
    runs = []
    for _ in range(5):
        start = time.perf_counter()
        for _ in range(50):
            is_hiding_contact_details(model, "reach me at O6 I2 34 56 78")
        runs.append((time.perf_counter() - start) / 50)
    assert min(runs) < 0.001


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_un_message_vide_rend_une_decision(model):
    assert shape("") == ""
    assert is_hiding_contact_details(model, "") is False


def test_production_un_message_de_cent_ko_termine_vite(model):
    start = time.perf_counter()
    assert is_hiding_contact_details(model, "please review the report " * 4000) is False
    is_hiding_contact_details(model, "a" * 100_000)
    assert time.perf_counter() - start < 2


def test_production_les_chiffres_pleine_largeur_sont_replies():
    assert shape("call me on ０６ １２") == "call me on DD DD"


def test_defaut_un_chiffre_en_lettres_decompose_est_reconnu():
    composed = "appelle au zéro six"
    assert shape(unicodedata.normalize("NFD", composed)) == shape(composed)


def test_production_un_jeu_d_entrainement_vide_est_refuse():
    with pytest.raises(ValueError):
        train([], [])
