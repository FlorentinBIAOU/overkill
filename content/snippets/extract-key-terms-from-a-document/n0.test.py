import json
import shutil
import subprocess
import time
import unicodedata
from pathlib import Path

from n0 import MAX_WORDS, candidates_of, extract_key_terms

ICI = Path(__file__).parent

# Une liste de mots vides française réduite à ce qu'il faut pour ce test. En
# production elle vient d'une ressource par langue, pas d'une constante.
VIDES_FR = ("de des du la le les un une et ou à au aux en dans sur pour par avec sans "
            "sous est sont a ont ce cette ces qui que dont se son sa ses leur leurs ne "
            "pas plus il elle nous vous ils elles on y d l s n c j m t qu").split()

VIDES_EN = ("the a an and or to of in on for with without is are be been this that "
            "these those it its their his her we you they").split()

# Des conditions générales de vente : le document ordinaire du public visé.
CGV = """Conditions générales de vente

La société Lumière, immatriculée au registre du commerce, vend des moulins à café.
Le moulin à café Lumière est garanti deux ans. La garantie couvre les pièces et
la main-d'oeuvre. Le client dispose d'un délai de rétractation de quatorze jours.
Les présentes conditions générales de vente sont soumises au droit français."""

ANGLAIS = """Terms and conditions of sale

Lumiere Ltd sells coffee grinders. The coffee grinder is covered by a two year
warranty. The customer has fourteen days to withdraw from the sale."""


def textes(rapport):
    return [terme["text"] for terme in rapport["terms"]]


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_un_terme_construit_sur_une_preposition_est_coupe_en_deux():
    """
    « « moulin à café » revient en « moulin » et « café », parce que « à » est
    dans la liste qui fait marcher la méthode. »
    """
    tous = candidates_of(CGV, VIDES_FR)
    assert "moulin à café" not in tous
    assert "moulin" in tous and "café" in tous


def test_point_de_rupture_temoin_un_terme_sans_preposition_revient_entier():
    """
    « Le témoin est dans le même test : « droit français », qui ne passe par
    aucune préposition, revient d'un seul tenant. »
    """
    assert "droit français" in candidates_of(CGV, VIDES_FR)
    assert "conditions générales" in candidates_of(CGV, VIDES_FR)


# ---------------------------------------------------------------------------
# Les autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_la_liste_de_mots_vides_est_exigee():
    for liste in (None, [], ()):
        rapport = extract_key_terms(CGV, liste)
        assert rapport["terms"] == []
        assert rapport["reason"] == "a stop list is required, one per language"


def test_sans_les_mots_vides_de_la_bonne_langue_le_decoupage_ne_veut_rien_dire():
    """R6 : la liste anglaise appliquée au texte français ne coupe presque rien."""
    francais = candidates_of(CGV, VIDES_FR)
    anglais = candidates_of(CGV, VIDES_EN)
    assert len(anglais) < len(francais)
    # « la société lumière immatriculée au registre du commerce » d'un bloc.
    assert max(len(c.split(" ")) for c in anglais) == MAX_WORDS
    assert "société lumière" in francais


def test_une_phrase_longue_est_coupee_a_la_longueur_declaree():
    long = "alpha beta gamma delta epsilon zeta"
    assert candidates_of(long, VIDES_FR) == ["alpha beta gamma delta", "epsilon zeta"]


def test_un_nombre_seul_nest_pas_un_terme():
    lus = candidates_of("Le délai est de 14 jours.", VIDES_FR)
    assert "14" not in lus and "14 jours" not in lus
    # Et le nombre coupe le terme, comme le ferait une ponctuation.
    assert lus == ["délai", "jours"]


def test_le_singulier_et_le_pluriel_sont_deux_termes():
    """Aucune morphologie ici : c'est une limite, pas un défaut caché."""
    tous = candidates_of("Le moulin Lumière. Les moulins Lumière.", VIDES_FR)
    assert "moulin lumière" in tous and "moulins lumière" in tous


def test_le_meme_mot_accentue_de_deux_facons_est_un_seul_terme():
    """La forme décomposée porte l'accent à part ; sans NFC, « société » est coupé."""
    compose = unicodedata.normalize("NFD", "société Lumière")
    assert compose != "société Lumière"
    assert candidates_of(f"société Lumière. {compose}.", VIDES_FR) == ["société lumière"]


def test_le_classement_ne_depend_pas_de_lordre_des_egalites():
    """T : deux phrases de même score reviennent toujours dans le même ordre."""
    texte = "delta echo. alpha bravo. charlie foxtrot."
    premier = textes(extract_key_terms(texte, VIDES_FR))
    inverse = textes(extract_key_terms("alpha bravo. charlie foxtrot. delta echo.", VIDES_FR))
    assert premier == inverse == ["alpha bravo", "charlie foxtrot", "delta echo"]


def test_aucune_entree_ne_leve():
    for entree in [None, 42, [], {}, b"octets", ""]:
        rapport = extract_key_terms(entree, VIDES_FR)
        assert rapport["terms"] == []
        if not isinstance(entree, str):
            assert rapport["reason"].startswith("expected text")


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_entree_banale_des_conditions_generales_de_vente():
    """T5 : l'entrée ordinaire du public visé."""
    lus = textes(extract_key_terms(CGV, VIDES_FR))
    assert "garanti deux ans" in lus
    # Et le passe-partout du document arrive en tête, ce que N1 corrige.
    assert any("conditions générales" in terme.lower() for terme in lus)


def test_production_entree_vide():
    assert extract_key_terms("", VIDES_FR) == {"terms": [], "reason": None}
    assert extract_key_terms("   \n\n  ", VIDES_FR)["terms"] == []


def test_production_entree_tres_grande_et_terminaison_rapide():
    enorme = CGV * 2000
    debut = time.perf_counter()
    rapport = extract_key_terms(enorme, VIDES_FR)
    assert time.perf_counter() - debut < 60.0
    assert rapport["terms"][0]["count"] == 2000


def test_production_encodages_inattendus():
    assert extract_key_terms("﻿moulin Lumière", VIDES_FR)["terms"][0]["text"] == "moulin Lumière"
    # L'espace insécable est une espace : elle sépare deux mots du même terme.
    assert candidates_of("moulin\u00a0Lumière", VIDES_FR) == ["moulin lumière"]
    assert candidates_of("emoji 🙂 moulin", VIDES_FR) == ["emoji", "moulin"]


def test_production_valeurs_aux_limites():
    assert candidates_of("a", VIDES_FR) == []  # un mot vide seul
    assert candidates_of("ok", VIDES_FR) == ["ok"]
    assert candidates_of("porte-monnaie", VIDES_FR) == ["porte-monnaie"]
    assert extract_key_terms(CGV, VIDES_FR, top=2)["terms"].__len__() == 2


def test_production_un_document_sans_aucun_terme_ne_fait_pas_tomber_le_lot():
    """T8 : un document muet rend une liste vide, pas une exception."""
    lot = [CGV, "de la le les", ANGLAIS]
    rapports = [extract_key_terms(texte, VIDES_FR) for texte in lot]
    assert [len(r["terms"]) > 0 for r in rapports] == [True, False, True]


def test_production_la_lecture_tient_la_classe_de_latence_annoncee():
    """latency « ~10 ms » : mille lectures d'un document sous une borne large."""
    debut = time.perf_counter()
    for _ in range(1000):
        extract_key_terms(CGV, VIDES_FR)
    assert time.perf_counter() - debut < 20.0


# ---------------------------------------------------------------------------
# Parité entre les deux langages
# ---------------------------------------------------------------------------


def test_python_et_javascript_rendent_le_meme_rapport():
    """La fiche montre les deux extraits : elle affirme la même chose des deux."""
    node = shutil.which("node")
    assert node, "node est requis pour comparer les deux implémentations"
    cas = [[CGV, VIDES_FR], [ANGLAIS, VIDES_EN], [CGV, VIDES_EN], ["", VIDES_FR],
           ["alpha beta gamma delta epsilon zeta", VIDES_FR], ["porte-monnaie", VIDES_FR],
           ["Le délai est de 14 jours.", VIDES_FR], ["emoji 🙂 moulin", VIDES_FR],
           ["moulin Lumière", VIDES_FR], [CGV, []],
           [unicodedata.normalize("NFD", CGV), VIDES_FR],
           ["Le moulin Lumière. Les moulins Lumière.", VIDES_FR],
           ["delta echo. alpha bravo. charlie foxtrot.", VIDES_FR]]
    attendu = [extract_key_terms(texte, vides) for texte, vides in cas]
    script = (
        f"import {{ extractKeyTerms }} from {json.dumps((ICI / 'n0.js').as_uri())};"
        "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{"
        "process.stdout.write(JSON.stringify(JSON.parse(d)"
        ".map(([t,v])=>extractKeyTerms(t,v))));});"
    )
    sortie = subprocess.run([node, "--input-type=module", "-e", script],
                            input=json.dumps(cas), capture_output=True,
                            text=True, timeout=60, check=True)
    assert json.loads(sortie.stdout) == attendu
