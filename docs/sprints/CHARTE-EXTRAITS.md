# Charte des extraits de code

Contrat remis à toute personne, ou tout agent, qui écrit un extrait pour une fiche.
Un extrait qui ne respecte pas cette charte n'entre pas dans le dépôt.

---

## La règle qui prime sur tout

**Aucune fiche n'est publiée si son code n'a pas été exécuté et vérifié.**

Un catalogue dont le code ne tourne pas n'a aucune valeur. Si vous n'avez pas lancé
l'extrait et vu son test passer, ne le rendez pas. En cas de doute, dites-le : la fiche
passera en brouillon, ce qui est honnête, plutôt que d'être publiée fausse.

---

## Emplacement et nommage

```
content/snippets/<identifiant-de-fiche>/
    n0.py   n0.test.py   n0.js   n0.test.js
    n1.py   n1.test.py   n1.js   n1.test.js
    ...
```

Un fichier par barreau et par langage. Les deux langages sont systématiques : Python et
JavaScript, jamais l'un sans l'autre. Chaque extrait a son test à côté de lui.

---

## Ce que doit être un extrait

| Règle | Détail |
|---|---|
| **Court** | 40 lignes de code utile au maximum, commentaires non compris. Au-delà, c'est un projet, pas un extrait. L'adaptateur commun du client de fournisseur des niveaux N3 (section « Les barreaux N2 et N3 ») n'entre pas dans le décompte : il est identique d'une fiche à l'autre et ne porte aucune logique de la fiche. |
| **Autonome** | Il s'exécute seul. Aucun fichier de données externe, aucun état partagé entre extraits. |
| **Hors ligne** | Aucun accès réseau, jamais. Ni pendant l'exécution, ni pendant le test. |
| **Sans effet de bord** | Aucune écriture de fichier hors d'un répertoire temporaire. Aucune variable d'environnement modifiée. |
| **Lisible avant d'être malin** | La cible inclut un développeur junior. Une ligne astucieuse et opaque vaut moins que trois lignes évidentes. |
| **Complet** | Il fait vraiment le travail annoncé par le nom de l'approche. Pas de « ... reste de l'implémentation » en commentaire. |
| **Commenté en anglais** | L'anglais est la version canonique du site. Les commentaires du code sont en anglais, dans les deux langages. |

### Dépendances autorisées

**Python** : la bibliothèque standard d'abord. Au-delà, uniquement ce qui figure dans
`content/snippets/requirements-snippets.txt`. Toute dépendance nouvelle doit être justifiée
par le contenu de la fiche et ajoutée au fichier.

**JavaScript** : la bibliothèque standard de Node 22, et rien d'autre. Un algorithme
classique de quelques dizaines de lignes vaut mieux qu'une dépendance : c'est d'ailleurs la
thèse du site.

---

## Ce que doit être un test

Le test **exécute l'extrait**. Il ne teste pas une reformulation de l'extrait.

```python
# content/snippets/<id>/n0.test.py
from n0 import ma_fonction        # importe le vrai fichier

def test_cas_nominal():
    assert ma_fonction("entrée connue") == "sortie attendue"

def test_point_de_rupture():
    """Le point de rupture annoncé sur la fiche doit être vrai."""
    assert ma_fonction("cas qui casse") != "ce qu'on aurait voulu"
```

Trois cas au minimum :

1. **Le cas nominal**, celui qu'un lecteur essaiera en premier.
2. **Un cas limite** réaliste : chaîne vide, accents, casse, entrée très longue.
3. **Le point de rupture annoncé sur la fiche.** C'est le test le plus important : il prouve
   que ce que la fiche affirme sur les limites de l'approche est vrai. Une fiche qui annonce
   un point de rupture non démontré est une fiche qui invente.

Les données d'exemple vivent **dans le test**, jamais dans l'extrait. L'extrait montre une
fonction, pas une démonstration.

---

## Les barreaux N2 et N3

Certains extraits ne peuvent pas s'exécuter à l'identique en intégration continue : un
modèle de plusieurs centaines de mégaoctets ne se télécharge pas à chaque build, et un
appel à une API de modèle généraliste coûte de l'argent et exige une clé.

Ce n'est pas une raison pour publier du code non vérifié. C'est une raison pour dire la
vérité sur le niveau de preuve.

| Niveau | Ce que cela veut dire | Ce que le test fait |
|---|---|---|
| `executed` | L'extrait tourne tel quel, avec ses vraies dépendances. | Il l'appelle directement. |
| `stubbed` | L'extrait tourne, un service ou un modèle externe étant remplacé par un double local. | Il injecte le double, vérifie la requête construite, et décode une réponse figée. |

Le niveau est déclaré dans le frontmatter de la fiche, et **affiché sur la page**.
Un extrait marqué `executed` dont le test injecte un double est une faute grave.

### Comment écrire un extrait testable avec un double

L'extrait prend la dépendance externe en paramètre, avec une valeur par défaut réelle.
Le lecteur voit le vrai code. Le test injecte le double.

```python
from _harness.fake_llm import FakeLLM      # dans le test uniquement

def summarise(text, client=None):
    client = client or OpenAIClient()      # le vrai client, visible par le lecteur
    return client.complete(prompt=..., ...)
```

```python
# n3.test.py
def test_construit_la_bonne_requete():
    fake = FakeLLM(response="un résumé")
    assert summarise("texte long", client=fake) == "un résumé"
    assert "texte long" in fake.last_request["prompt"]
```

**Le client par défaut doit exister.** Au lot 15, les trente-deux extraits N3
appelaient `client.complete(...)` sur un client `OpenAI()` qui n'a pas cette
méthode : aucun test ne l'avait vu, parce que tous injectaient un double qui,
lui, l'avait. Le défaut est désormais un petit adaptateur écrit dans l'extrait
(`ProviderClient` en Python, `providerClient` en JavaScript), bâti sur la vraie
surface du kit (`chat.completions.create`, `choices[0].message.content`), et
testé avec `_harness/fake_sdk.py` / `_harness/fake-sdk.mjs`, qui imitent cette
surface et n'ont pas de méthode `complete`. La surface imitée est vérifiée
contre le kit publié, transport remplacé, dans `docs/lot15/verification-sdk/`.

Ce que ce test prouve réellement : que la requête est bien formée, que la réponse est bien
décodée, et que les cas d'erreur sont traités. C'est la part du code qui contient les bugs.
Ce qu'il ne prouve pas : que le modèle répond bien. Dites-le, ne le cachez pas.

---

## Chiffres

Aucun extrait, aucun commentaire et aucun test ne contient :

- un prix absolu, sous quelque forme que ce soit
- un chiffre de performance non mesuré sur la machine qui a lancé le test
- une empreinte carbone

Le coût et la latence se déclarent dans le frontmatter de la fiche, avec le vocabulaire
d'ordre de grandeur imposé, et nulle part ailleurs.

---

## Lancer les tests

```bash
npm run test:snippets                     # tous
npm run test:snippets -- <id-de-fiche>    # une seule fiche
```

Le contrôle échoue si un test échoue, si un extrait est absent du disque, ou si une fiche
publiée référence un extrait sans test.
