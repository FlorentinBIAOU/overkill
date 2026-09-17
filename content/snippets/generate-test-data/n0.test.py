import builtins
import json
import os
import re
import shutil
import subprocess
import sys
import time
import unicodedata
from collections import Counter
from pathlib import Path

import pytest

from _harness.fake_llm import hash_word
import n0
from n0 import UNIT, draw, finalise, generate_rows, stable_hash

ICI = Path(__file__).parent

# The schema lives in the test, never in the snippet: the snippet shows a
# generator, not one company's order table.
#
# Every value below is invented. The addresses are built on example.test, a
# domain reserved for exactly this, so no message can ever leave for a real
# mailbox.
ORDERS = {
    "order_id": {"type": "sequence", "prefix": "ORD-", "width": 5},
    "email": {"type": "sequence", "prefix": "user-", "width": 4, "suffix": "@example.test"},
    "city": {"type": "choice", "values": ["Paris", "Lyon", "Nantes", "Lille"]},
    "quantity": {"type": "int", "min": 1, "max": 9},
    "signed_up_on": {"type": "date", "start": "2024-01-01", "days": 365},
    "newsletter": {"type": "bool", "true_percent": 30},
}

# The exact rows expected for one seed. The same literal appears in n0.test.js:
# that is what pins the two implementations to each other, and it would break
# the moment either language drew a different number for the same cell.
GOLDEN = [
    {
        "order_id": "ORD-00001",
        "email": "user-0001@example.test",
        "city": "Paris",
        "quantity": 9,
        "signed_up_on": "2024-09-18",
        "newsletter": True,
    },
    {
        "order_id": "ORD-00002",
        "email": "user-0002@example.test",
        "city": "Nantes",
        "quantity": 7,
        "signed_up_on": "2024-08-02",
        "newsletter": False,
    },
    {
        "order_id": "ORD-00003",
        "email": "user-0003@example.test",
        "city": "Lyon",
        "quantity": 4,
        "signed_up_on": "2024-02-23",
        "newsletter": True,
    },
]

# Les graines de l'essai (content/tryouts/live/generate-test-data.js).
GRAINES_ESSAI = ["commandes-2024", "commandes-2025", "incident-4471", "inscriptions-mars"]


def generate_rows_en_javascript(appels):
    """Exécute le vrai n0.js dans Node, pour chaque (schema, count, seed)."""
    node = shutil.which("node")
    assert node, "node est requis pour comparer les deux implémentations"
    script = (
        f"import {{ generateRows }} from {json.dumps((ICI / 'n0.js').as_uri())};"
        "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{"
        "process.stdout.write(JSON.stringify(JSON.parse(d).map(([s,n,g])=>generateRows(s,n,g))));});"
    )
    sortie = subprocess.run(
        [node, "--input-type=module", "-e", script],
        input=json.dumps(appels), capture_output=True, text=True, timeout=60, check=True,
    )
    return json.loads(sortie.stdout)


def account_key(email: str) -> str:
    """
    Stands in for the production code under test: the mailbox an address
    belongs to, used as the key of an account.

    It has a bug, and the point of the test below is that generated data can
    never show it.
    """
    return email.split("@")[0].lower()


def boite(email: str) -> str:
    """La boîte réelle d'une adresse : sans étiquette après un +, sans casse."""
    locale, _, domaine = email.lower().partition("@")
    return f"{locale.split('+')[0]}@{domaine}"


def paires_de_meme_boite_mal_fusionnees(adresses):
    """
    La propriété qu'une suite écrirait : deux adresses de la même boîte ont la
    même clé de compte. Rend (paires vérifiées, paires en échec).
    """
    verifiees, echecs = 0, 0
    for i, a in enumerate(adresses):
        for b in adresses[i + 1:]:
            if a != b and boite(a) == boite(b):
                verifiees += 1
                echecs += account_key(a) != account_key(b)
    return verifiees, echecs


# ---------------------------------------------------------------------------
# Point de rupture
# ---------------------------------------------------------------------------


def test_point_de_rupture_aucune_adresse_na_de_plus_de_majuscule_ni_dapostrophe():
    """
    « le générateur n'émet qu'une seule forme d'adresse, sans plus, sans
    majuscule et sans apostrophe […] quelle que soit la graine et quel que soit
    le nombre de lignes ».
    """
    for graine in ["orders-2024", *GRAINES_ESSAI]:
        for nombre in (1, 500, 5000):
            adresses = [row["email"] for row in generate_rows(ORDERS, nombre, graine)]
            assert not any("+" in a for a in adresses)
            assert not any(c.isupper() for a in adresses for c in a)
            assert not any("'" in a or "\u2019" in a for a in adresses)
            assert all(re.fullmatch(r"user-\d{4,}@example\.test", a) for a in adresses)


def test_point_de_rupture_la_fonction_qui_oublie_letiquette_reste_verte_sur_le_jeu_genere():
    """
    « Le test le montre sur une fonction de production qui oublie l'étiquette
    après un plus dans une adresse […] la suite reste verte […] et le doublon de
    compte n'apparaît qu'en production ».
    """
    rows = generate_rows(ORDERS, 500, "orders-2024")
    addresses = [row["email"] for row in rows]

    # The suite passes: every generated address yields its own account key.
    keys = [account_key(address) for address in addresses]
    assert len(set(keys)) == len(keys)
    # La propriété « même boîte, même compte » passe… sur zéro paire vérifiée.
    assert paires_de_meme_boite_mal_fusionnees(addresses) == (0, 0)

    # In production, these two spellings reach one mailbox and must share one
    # account. They do not.
    same_mailbox = ("i.fontaine@example.test", "i.fontaine+billing@example.test")
    assert account_key(same_mailbox[0]) != account_key(same_mailbox[1])


def test_point_de_rupture_temoin_la_meme_suite_tombe_des_que_le_schema_porte_la_forme_reelle():
    """
    Témoin : c'est la forme des adresses, et elle seule, qui cache le bogue. Un
    schéma dont les valeurs portent l'étiquette fait tomber la même propriété.
    """
    reelles = {"email": {"type": "choice", "values": [
        "i.fontaine@example.test", "i.fontaine+billing@example.test", "M.Villeneuve@example.test",
    ]}}
    adresses = [row["email"] for row in generate_rows(reelles, 50, "orders-2024")]
    verifiees, echecs = paires_de_meme_boite_mal_fusionnees(adresses)
    assert verifiees > 0 and echecs > 0


# ---------------------------------------------------------------------------
# Les autres affirmations du niveau
# ---------------------------------------------------------------------------


def test_produit_les_lignes_attendues():
    assert generate_rows(ORDERS, 3, "orders-2024") == GOLDEN


def test_les_lignes_attendues_sont_exactement_celles_du_test_javascript():
    """Commentaire du test : « The same literal appears in n0.test.js »."""
    source = (ICI / "n0.test.js").read_text(encoding="utf-8")
    bloc = re.search(r"const GOLDEN = (\[.*?\n\]);", source, re.S).group(1)
    en_json = re.sub(r"(\w+):", r'"\1":', bloc.replace("'", '"'))
    en_json = re.sub(r",(\s*[}\]])", r"\1", en_json)
    assert json.loads(en_json) == GOLDEN


def test_python_et_javascript_produisent_les_memes_lignes_pour_la_meme_graine():
    """
    Docstring : « The same seed and the same schema give exactly the same rows,
    on every machine, in both languages » ; verdict_rationale : « dans les deux
    langages ». Comparé à l'exécution réelle de n0.js.
    """
    schema_large = dict(ORDERS, **{
        "vip": {"type": "bool", "true_percent": 3},
        "ancien": {"type": "date", "start": "1999-12-31", "days": 10_000},
        "grand": {"type": "int", "min": -1_000_000, "max": 3_000_000_000},
        "unique": {"type": "choice", "values": ["seul"]},
        "champ accentué": {"type": "int", "min": 0, "max": 1},
    })
    appels = [[ORDERS, 3, "orders-2024"], [schema_large, 400, "orders-2024"]]
    for graine in ["", "graine-été", unicodedata.normalize("NFD", "graine-été"),
                   "🧪 recette", "\ufeffBOM", "a\u200bb", "\u00a0", *GRAINES_ESSAI]:
        appels.append([schema_large, 60, graine])
    attendu = [generate_rows(*appel) for appel in appels]
    assert generate_rows_en_javascript(appels) == attendu


def test_la_meme_graine_redonne_les_memes_lignes_et_une_autre_graine_non():
    """
    The property the whole rung rests on: a seed printed next to a failure is
    enough to rebuild the data that caused it.
    """
    assert generate_rows(ORDERS, 50, "orders-2024") == generate_rows(ORDERS, 50, "orders-2024")
    assert generate_rows(ORDERS, 50, "orders-2024") != generate_rows(ORDERS, 50, "orders-2025")


def test_chaque_cellule_est_tiree_dun_hachage_de_graine_champ_ligne():
    """Docstring : « Each cell is drawn from a hash of (seed, field, row) rather than from a running stream »."""
    rows = generate_rows(ORDERS, 40, "orders-2024")
    for row_index, row in enumerate(rows):
        n = finalise(stable_hash(f"orders-2024{UNIT}quantity{UNIT}{row_index}"))
        assert draw("orders-2024", "quantity", row_index) == n
        assert row["quantity"] == 1 + n % 9
        assert row["city"] == ORDERS["city"]["values"][draw("orders-2024", "city", row_index) % 4]


def test_deux_colonnes_tirees_separement_sont_independantes():
    """
    `finalise` : « two columns that should be independent come out perfectly
    anticorrelated » sans elle. Tableau de contingence sur dix mille lignes :
    les quatre combinaisons existent, chacune entre 20 % et 30 %.
    """
    schema = {
        "a": {"type": "choice", "values": ["x", "y"]},
        "b": {"type": "choice", "values": ["x", "y"]},
    }
    rows = generate_rows(schema, 10_000, "s")
    table = Counter((row["a"], row["b"]) for row in rows)
    assert set(table) == {("x", "x"), ("x", "y"), ("y", "x"), ("y", "y")}
    for combinaison, compte in table.items():
        assert 2000 <= compte <= 3000, (combinaison, compte)


def test_une_colonne_a_deux_valeurs_n_a_pas_de_periode_deux():
    """`finalise` : « one column alternates strictly » sans elle ; ici, l'alternance stricte n'existe pas."""
    rows = generate_rows({"plan": {"type": "choice", "values": ["free", "pro"]}}, 100, "demo")
    plans = [row["plan"] for row in rows]
    alternances = sum(1 for i in range(1, len(plans)) if plans[i] != plans[i - 1])
    assert 30 < alternances < 70, alternances
    # Et une colonne d'entiers sur quatre valeurs n'a pas de période 4.
    quantites = [row["q"] for row in generate_rows({"q": {"type": "int", "min": 1, "max": 4}}, 100, "demo")]
    assert any(quantites[i] != quantites[i - 4] for i in range(4, len(quantites)))


def test_le_hachage_est_le_fnv_1a_32_bits_de_reference():
    """Commentaire : « FNV-1a, the same constants as the rest of the catalogue »."""
    assert stable_hash("") == 0x811C9DC5
    assert stable_hash("a") == 0xE40C292C
    assert stable_hash("foobar") == 0xBF9CF968
    for mot in ["orders-2024", "graine-été", "🧪"]:
        assert stable_hash(mot) == hash_word(mot)


def test_le_hash_natif_de_python_change_dun_processus_a_lautre():
    """Docstring de stable_hash : « that one is salted per process »."""
    valeurs = set()
    for graine in ("1", "2"):
        env = {**os.environ, "PYTHONHASHSEED": graine}
        r = subprocess.run([sys.executable, "-c", "print(hash('orders-2024'))"],
                           capture_output=True, text=True, env=env, check=True, timeout=30)
        valeurs.add(r.stdout.strip())
    assert len(valeurs) == 2


def test_le_separateur_napparait_dans_aucune_partie_de_la_cle():
    """
    Commentaires : UNIT « separates the parts of a cell key, and appears in none
    of them » ; ESCAPE « stands in for UNIT inside a part, and is escaped itself » ;
    docstring de _part : « two different cells never share a key ».
    """
    assert draw("a\x1fb", "c", 0) != draw("a", "b\x1fc", 0)
    assert draw("a\x1e1", "c", 0) != draw("a\x1f", "c", 0)
    assert draw("a\x1e", "1c", 0) != draw("a", "\x1e1c", 0)
    # Aucune partie échappée ne contient UNIT, et la clé est injective : toutes
    # les paires (graine, champ) de trois caractères au plus sur {a, 0, 1, U+001E,
    # U+001F} donnent des clés distinctes.
    alphabet = ["a", "0", "1", "\x1e", "\x1f"]
    textes = [""] + ["".join(p) for n in (1, 2, 3) for p in __import__("itertools").product(alphabet, repeat=n)]
    assert all(UNIT not in n0._part(t) for t in textes)
    cles = {n0._part(s) + UNIT + n0._part(f) for s in textes for f in textes}
    assert len(cles) == len(textes) ** 2


def test_l_echappement_est_sans_effet_sur_une_graine_et_un_champ_ordinaires():
    """Corrections : sans U+001E ni U+001F, la clé est celle d'avant ; les jeux épinglés (GOLDEN, essai) sont inchangés."""
    for graine, champ, ligne in [("orders-2024", "city", 0), ("", "", 7), ("🧪 été", "montant", 49_999)]:
        assert draw(graine, champ, ligne) == finalise(stable_hash(f"{graine}{UNIT}{champ}{UNIT}{ligne}"))
    assert generate_rows(ORDERS, 3, "orders-2024") == GOLDEN


def test_le_generateur_ne_lit_que_le_schema_et_la_graine_et_une_valeur_reelle_du_schema_ressort_telle_quelle():
    """
    risks.regulatory : « le générateur ne lit que le schéma et la graine, et une
    valeur réelle écrite dans le schéma, choix ou préfixe, ressort telle quelle
    dans les lignes ».
    """
    schema = {
        "client": {"type": "choice", "values": ["Jeanne Dupont"]},
        "email": {"type": "sequence", "prefix": "jeanne.dupont+", "suffix": "@exemple.fr", "width": 2},
        "ville": {"type": "choice", "values": ["Paris", "Lyon"]},
    }
    rows = generate_rows(schema, 5, "recette")
    assert {r["client"] for r in rows} == {"Jeanne Dupont"}
    assert [r["email"] for r in rows] == [f"jeanne.dupont+{i:02d}@exemple.fr" for i in range(1, 6)]
    # Schéma et graine seuls : mêmes entrées, mêmes lignes ; une colonne de
    # séquence ne lit même que le schéma, elle est identique sous deux graines.
    assert generate_rows(schema, 5, "recette") == rows
    assert [r["email"] for r in generate_rows(schema, 5, "autre")] == [r["email"] for r in rows]


def test_le_random_de_python_accepte_une_graine():
    """Docstring : « Python's `random` takes a seed » (le témoin JavaScript est dans n0.test.js)."""
    import random

    assert [random.Random("s").random() for _ in range(3)] == [random.Random("s").random() for _ in range(3)]


def test_agrandir_le_jeu_le_prolonge_au_lieu_de_le_retirer():
    # Asking for more rows keeps the ones already there, so a fixture can grow
    # without invalidating the expectations written against it.
    assert generate_rows(ORDERS, 20, "orders-2024")[:5] == generate_rows(ORDERS, 5, "orders-2024")


def test_ajouter_un_champ_laisse_les_autres_colonnes_intactes():
    """Docstring : « Adding a field to the schema therefore leaves every other column untouched »."""
    wider = dict(ORDERS, discount={"type": "bool", "true_percent": 10})
    before = generate_rows(ORDERS, 10, "orders-2024")
    after = generate_rows(wider, 10, "orders-2024")
    assert [{k: v for k, v in row.items() if k != "discount"} for row in after] == before
    # Placé en tête plutôt qu'à la fin, le nouveau champ ne décale rien non plus.
    first = generate_rows(dict(discount={"type": "bool"}, **ORDERS), 10, "orders-2024")
    assert [{k: v for k, v in row.items() if k != "discount"} for row in first] == before


def test_chaque_ligne_respecte_le_schema():
    rows = generate_rows(ORDERS, 300, "orders-2024")
    assert len(rows) == 300
    for row in rows:
        assert set(row) == set(ORDERS)
        assert 1 <= row["quantity"] <= 9
        assert row["city"] in ORDERS["city"]["values"]
        assert "2024-01-01" <= row["signed_up_on"] <= "2024-12-30"
        assert isinstance(row["newsletter"], bool)


def test_un_identifiant_de_sequence_est_unique_par_construction():
    """Commentaire : « Unique by construction » ; verdict_rationale : « unique par construction plutôt que par chance »."""
    rows = generate_rows({"id": {"type": "sequence", "prefix": "C-", "width": 2}}, 20_000, "s")
    ids = [row["id"] for row in rows]
    assert len(set(ids)) == 20_000
    # Au-delà de la largeur, le rang s'allonge au lieu d'être tronqué.
    assert ids[98:101] == ["C-99", "C-100", "C-101"]


def test_les_booleens_se_lisent_en_pourcentage_pas_en_probabilite():
    """Commentaire : « Percentages, not probabilities »."""
    trente = generate_rows({"b": {"type": "bool", "true_percent": 30}}, 10_000, "s")
    assert 0.28 < sum(r["b"] for r in trente) / 10_000 < 0.32
    # Qui recopie une probabilité (0,3) obtient presque aucun vrai, sans erreur.
    probabilite = generate_rows({"b": {"type": "bool", "true_percent": 0.3}}, 10_000, "s")
    assert sum(r["b"] for r in probabilite) / 10_000 < 0.02


def test_une_contrainte_impossible_est_refusee_plutot_que_contournee():
    with pytest.raises(ValueError):
        generate_rows({"age": {"type": "int", "min": 80, "max": 18}}, 1, "seed")
    with pytest.raises(ValueError):
        generate_rows({"city": {"type": "choice", "values": []}}, 1, "seed")
    with pytest.raises(ValueError):
        generate_rows({"city": {"type": "postcode"}}, 1, "seed")


def test_aucun_fichier_ecrit(monkeypatch):
    """Docstring : « Standard library only, no file written »."""
    def refuser(*args, **kwargs):
        raise AssertionError("un fichier a été ouvert")

    monkeypatch.setattr(builtins, "open", refuser)
    monkeypatch.setattr(os, "open", refuser)
    rows = generate_rows(ORDERS, 50, "orders-2024")
    monkeypatch.undo()
    assert isinstance(rows, list) and len(rows) == 50


def test_trois_lignes_prennent_moins_dune_milliseconde():
    """latency « <1 ms » : mille jeux de trois lignes en moins d'une seconde."""
    debut = time.perf_counter()
    for _ in range(1000):
        generate_rows(ORDERS, 3, "orders-2024")
    assert time.perf_counter() - debut < 1.0


def test_lessai_une_autre_graine_donne_dautres_villes_dautres_quantites_dautres_dates():
    """Essai : « Une autre graine : d'autres villes, d'autres quantités », why : « change les villes, les quantités, les dates »."""
    a = generate_rows(ORDERS, 5, "commandes-2024")
    b = generate_rows(ORDERS, 5, "commandes-2025")
    for champ in ("city", "quantity", "signed_up_on"):
        assert [r[champ] for r in a] != [r[champ] for r in b], champ


# ---------------------------------------------------------------------------
# Cas de production
# ---------------------------------------------------------------------------


def test_production_schema_vide_zero_ligne_une_ligne_et_nombre_negatif():
    assert generate_rows({}, 3, "seed") == [{}, {}, {}]
    assert generate_rows(ORDERS, 0, "seed") == []
    assert len(generate_rows(ORDERS, 1, "seed")) == 1
    assert generate_rows(ORDERS, -5, "seed") == []


def test_production_graine_vide():
    rows = generate_rows(ORDERS, 3, "")
    assert rows == generate_rows(ORDERS, 3, "") and len(rows) == 3


def test_production_cinquante_mille_lignes_terminent_vite():
    debut = time.perf_counter()
    rows = generate_rows(ORDERS, 50_000, "orders-2024")
    assert time.perf_counter() - debut < 10.0
    assert len({r["order_id"] for r in rows}) == 50_000


def test_production_nfc_et_nfd_de_la_meme_graine_donnent_deux_jeux():
    """Une graine recopiée depuis un système qui décompose les accents ne rejoue plus le jeu."""
    nfc = unicodedata.normalize("NFC", "recette-été")
    nfd = unicodedata.normalize("NFD", "recette-été")
    assert generate_rows(ORDERS, 20, nfc) != generate_rows(ORDERS, 20, nfd)
    assert generate_rows(ORDERS, 20, nfc) == generate_rows(ORDERS, 20, "recette-été")


def test_production_emoji_insecable_largeur_nulle_et_bom_dans_la_graine():
    for graine in ["🧪", "a\u00a0b", "a\u200bb", "\ufeffseed", "SEED"]:
        rows = generate_rows(ORDERS, 10, graine)
        assert len(rows) == 10 and rows == generate_rows(ORDERS, 10, graine)
    assert generate_rows(ORDERS, 10, "SEED") != generate_rows(ORDERS, 10, "seed")


def test_production_valeurs_aux_limites():
    # int : min égal à max.
    assert {r["n"] for r in generate_rows({"n": {"type": "int", "min": 7, "max": 7}}, 50, "s")} == {7}
    # bool : 0 et 100 pour cent.
    assert not any(r["b"] for r in generate_rows({"b": {"type": "bool", "true_percent": 0}}, 500, "s"))
    assert all(r["b"] for r in generate_rows({"b": {"type": "bool", "true_percent": 100}}, 500, "s"))
    # choice : une seule valeur.
    assert {r["c"] for r in generate_rows({"c": {"type": "choice", "values": ["x"]}}, 50, "s")} == {"x"}
    # date : un jour, et une année bissextile atteinte jusqu'au 29 février.
    assert {r["d"] for r in generate_rows({"d": {"type": "date", "start": "2024-02-29"}}, 50, "s")} == {"2024-02-29"}
    dates = {r["d"] for r in generate_rows({"d": {"type": "date", "start": "2024-02-28", "days": 2}}, 50, "s")}
    assert dates == {"2024-02-28", "2024-02-29"}


def test_production_une_duree_nulle_negative_ou_non_entiere_est_refusee():
    """Refus nommé : « a date field needs a whole number of days from 1 » ; `days` à 1 accepté."""
    for days in (0, -5, 1.5, "3"):
        with pytest.raises(ValueError, match="whole number of days from 1"):
            generate_rows({"d": {"type": "date", "start": "2024-01-01", "days": days}}, 3, "s")
    assert generate_rows({"d": {"type": "date", "start": "2024-01-01", "days": 1}}, 2, "s") == [{"d": "2024-01-01"}] * 2


def test_production_un_champ_sans_type_leve_une_erreur():
    """Python lève KeyError, pas le ValueError « unknown field type » des autres refus."""
    with pytest.raises(KeyError):
        generate_rows({"d": {}}, 1, "s")
