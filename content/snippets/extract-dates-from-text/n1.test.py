"""
Tests du niveau N1 : l'analyseur de dates `dateparser`.

Ce qu'ils prouvent : ce que la bibliothèque lit et ce qu'elle ne lit pas, sur
les exemples cités par la fiche, et que la date de référence est bien celle du
document et non celle de l'exécution.

Ce qu'ils ne prouvent pas : que `dateparser` lit juste sur un corpus. Sa
version est épinglée dans `requirements-snippets.txt` ; une autre version peut
lire autrement, et c'est précisément ce que la docstring de l'extrait dit.
"""

import ast
import time
from datetime import date
from pathlib import Path

import pytest

from n0 import extract_dates as extract_n0
from n1 import LANGUAGES, extract_dates

# La date du document : un mardi, choisi parce que « jeudi prochain » se lit
# différemment selon l'analyseur, ce que la fiche dit.
REFERENCE = date(2024, 3, 12)


def jours(text, reference=REFERENCE, **kwargs):
    return [(written, value.isoformat()) for written, value in extract_dates(text, reference, **kwargs)]


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_une_duree_ecrite_en_toutes_lettres_ne_rend_rien():
    """breaking_point : « « dans quinze jours » ne rend rien, quand « dans 15 jours » rend le 27 mars »."""
    assert jours("échéance dans quinze jours") == []
    # Témoin : la même durée en chiffres est lue.
    assert jours("échéance dans 15 jours") == [("dans 15 jours", "2024-03-27")]


def test_point_de_rupture_l_analyseur_ne_s_abstient_jamais():
    """
    breaking_point : « sur « 03/04/2024 » seul il tranche selon ses propres
    règles, et les deux bibliothèques ne tranchent pas pareil — 4 mars pour
    dateparser, 3 avril pour chrono-node ».
    """
    assert jours("le 03/04/2024") == [("le 03/04/2024", "2024-03-04")]
    # Témoin : N0, lui, s'abstient plutôt que de trancher.
    assert extract_n0("le 03/04/2024") == [("03/04/2024", None)]


def test_point_de_rupture_la_preuve_interne_du_document_est_ignoree():
    """breaking_point : le même document lu selon deux conventions, ce que N0 ne fait plus."""
    texte = "Commande 25/03/2024 puis 03/04/2024"
    assert jours(texte) == [("25/03/2024", "2024-03-25"), ("03/04/2024", "2024-03-04")]
    # Témoin : N0 tire la convention du document et lit les deux pareil.
    assert [value.isoformat() for _, value in extract_n0(texte)] == ["2024-03-25", "2024-04-03"]


def test_point_de_rupture_un_mois_abrege_est_mal_lu():
    """docstring : « On "3 janv. 2024" `dateparser` answers 3 January 2025 […] where rung N0 answers 3 January 2024 »."""
    assert ("2025-01-03") in [value for _, value in jours("Échéance le 3 janv. 2024")]
    assert [value.isoformat() for _, value in extract_n0("Échéance le 3 janv. 2024")] == ["2024-01-03"]


# ---------------------------------------------------------------------------
# Les autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_les_dates_relatives_sont_comptees_depuis_la_reference():
    """docstring : « "dans 15 jours" has to be counted from a date »."""
    assert jours("à régler dans 15 jours") == [("dans 15 jours", "2024-03-27")]
    assert jours("à partir de demain") == [("demain", "2024-03-13")]
    # La même phrase comptée depuis un autre document donne un autre jour.
    assert jours("à régler dans 15 jours", reference=date(2024, 12, 24)) == [
        ("dans 15 jours", "2025-01-08"),
    ]


def test_la_reference_est_obligatoire_et_c_est_la_date_du_document():
    """docstring : « `reference` has no default here, on purpose »."""
    with pytest.raises(TypeError):
        extract_dates("dans 15 jours")  # type: ignore[call-arg]
    with pytest.raises(TypeError, match="date of the document"):
        extract_dates("dans 15 jours", None)
    with pytest.raises(TypeError, match="date of the document"):
        extract_dates("dans 15 jours", "2024-03-12")


def test_une_echeance_se_lit_vers_l_avant():
    """docstring : « "le 3 janvier" in a March document is the next one, not the one gone by »."""
    assert jours("échéance le 3 janvier") == [("le 3 janvier", "2025-01-03")]


def test_les_langues_sont_declarees_par_l_appelant():
    """docstring : « Which languages the text may be in »."""
    assert LANGUAGES == ("fr", "en")
    assert jours("due in 15 days", languages=["en"]) == [("in 15 days", "2024-03-27")]
    # Le français seul ne lit pas la tournure anglaise.
    assert jours("due in 15 days", languages=["fr"]) == []


def test_l_extrait_n_importe_que_dateparser():
    """docstring : « installed rather than written » ; risks.vendor_lock: library."""
    source = ast.parse(Path(__file__).with_name("n1.py").read_text(encoding="utf-8"))
    imported = {a.name.split(".")[0] for n in ast.walk(source) if isinstance(n, ast.Import) for a in n.names}
    imported |= {n.module.split(".")[0] for n in ast.walk(source) if isinstance(n, ast.ImportFrom)}
    assert imported == {"datetime", "dateparser"}


def test_n1_est_deterministe():
    """risks.deterministic: true — deux lectures du même texte donnent la même chose."""
    texte = "Livraison dans 15 jours, facture le 03/04/2024."
    assert jours(texte) == jours(texte)


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_texte_vide_ou_sans_date():
    assert jours("") == []
    assert jours("   ") == []
    assert jours("aucune date ici") == []


def test_production_entree_ordinaire_d_un_document_de_gestion():
    """Entrée banale : le corps d'un courriel de relance, avec ce qu'un analyseur lit et ce qu'il laisse."""
    courriel = (
        "Bonjour, votre facture du 03/04/2024 reste impayée. "
        "Merci de régler dans 15 jours, soit avant le 3 janv. 2024."
    )
    lus = jours(courriel)
    assert ("dans 15 jours", "2024-03-27") in lus
    # Et ce que la bibliothèque lit de travers, l'extrait ne le cache pas.
    assert ("03/04/2024", "2024-03-04") in lus


def test_production_un_document_long_dans_une_borne_large():
    texte = "Livraison dans 15 jours. " * 400
    debut = time.perf_counter()
    lus = jours(texte)
    assert time.perf_counter() - debut < 60  # borne d'effondrement, pas une mesure
    assert len(lus) >= 1


def test_production_accents_decomposes_espaces_insecables_et_largeur_nulle():
    """Ce que la bibliothèque tolère et ce qu'elle ne tolère pas, dit plutôt que supposé."""
    decompose = "a\u0300 partir de demain"  # « à » écrit lettre plus accent
    assert jours(decompose) == [("demain", "2024-03-13")]
    insecable = "dans\u00a015 jours"
    assert jours(insecable) == [("dans 15 jours", "2024-03-27")]
    zero = "dans 15 jo\u200burs"  # largeur nulle dans le mot : la tournure est coupée
    assert jours(zero) == []


def test_production_valeurs_aux_limites_de_la_reference():
    """Le 29 février, et le passage d'année."""
    assert jours("dans 1 jour", reference=date(2024, 2, 28)) == [("dans 1 jour", "2024-02-29")]
    assert jours("dans 1 jour", reference=date(2023, 12, 31)) == [("dans 1 jour", "2024-01-01")]


def test_production_une_liste_de_langues_vide_est_refusee():
    """Commentaire : « An empty list means "every language it knows" to the library »."""
    with pytest.raises(ValueError, match="at least one language"):
        extract_dates("dans 15 jours", REFERENCE, languages=[])
