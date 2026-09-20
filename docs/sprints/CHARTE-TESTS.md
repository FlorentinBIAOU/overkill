# Charte des tests de fiche

Contrat remis à toute personne, ou tout agent, qui écrit les tests d'une fiche
Overkill. Elle complète la charte des extraits, qui dit ce qu'est un extrait, et
la charte de rédaction, qui dit ce qu'est une fiche. Celle-ci dit comment on
prouve qu'une fiche dit vrai.

---

## Ce qu'un test de fiche démontre

Une fiche affirme. Chaque affirmation qui peut être vérifiée en exécutant le code
l'est, par un test qui **échouera le jour où l'affirmation cessera d'être vraie**.

Un test qui passerait encore si la fiche disait le contraire ne démontre rien.
Avant de rendre un test, posez-vous la question : si l'extrait se mettait à
attraper ce cas, ou cessait de l'attraper, ce test tomberait-il ? Si la réponse
est non, le test est décoratif.

---

## Le périmètre : ce qui compte comme une affirmation

Tout ce que le lecteur voit sur la page de la fiche :

1. le frontmatter de `content/entries/<id>.mdx` : `scenario`, `name`,
   `breaking_point`, `escalate_when`, `unavailable_reason`, `verdict_rationale`,
   et le bloc `risks` (`deterministic`, `data_egress`, `testability`) ;
2. la docstring d'en-tête de chaque extrait, dans ses deux langues
   (`n*.py`, `n*.js`, et la traduction de `doc.fr.yaml`) ;
3. les commentaires du code qui affirment un fait sur le comportement ;
4. l'essai de `content/tryouts/`, quand il existe : ses libellés et ses `why` ;
5. **les chaînes que le code rend à l'appelant** : `reason`, `why`, `evidence`,
   `skipped`, `source`, `strategy`. Ce sont elles que l'appelant lit, journalise
   et sur lesquelles il branche son code, et elles ne sont affichées nulle part
   sur la page : personne ne les relit si un test ne les cite pas. C'est la
   règle R14 de la charte de rédaction, vue du testeur, et
   `node scripts/check-raisons.mjs` exige que chacune soit citée mot pour mot
   dans un test de la fiche.

Une affirmation dite dans les deux langues ne se teste qu'une fois, mais **dans
les deux langages** : la fiche montre les deux extraits, elle affirme donc la même
chose des deux.

---

## L'ordre

Pour chaque niveau disponible, dans cet ordre :

1. **Le point de rupture.** Un test par exemple cité dans `breaking_point`. Si la
   fiche cite trois contournements, il y a trois assertions, pas une.
2. **Les autres affirmations du niveau** : docstring, `name`, commentaires,
   `risks`.
3. **Les cas de production** (section suivante).
4. **Les affirmations transverses** de la fiche qui portent sur ce niveau :
   `scenario`, `verdict_rationale`, `escalate_when` quand il est observable,
   `unavailable_reason` d'un niveau voisin quand elle compare.

---

## Comment on démontre un point de rupture

Le test montre **l'échec**, pas la réussite. Il affirme que l'entrée citée passe
au travers, ou que la sortie est fausse de la manière décrite :

```python
def test_point_de_rupture_les_chiffres_sosies_passent_au_travers():
    """« O6 I2 34 » : des lettres à la place des chiffres, rien n'est masqué."""
    assert mask("appelez le O6 I2 34 56 78") == "appelez le O6 I2 34 56 78"
```

Trois exigences :

- **L'exemple est celui de la fiche**, mot pour mot quand c'est possible. Si la
  fiche dit « DE 12 3456 7890 1234 », le test utilise cette chaîne.
- **L'assertion est exacte**, pas un `!=` qui passerait pour n'importe quelle
  raison. On affirme la sortie réelle, ou la propriété précise qui fait l'échec.
- **Le test porte un témoin** quand c'est possible : la forme non obfusquée du
  même cas est bien traitée. Sans témoin, un extrait cassé partout ferait passer
  le test de rupture.

Le point de rupture est « là, et seulement là » : si la fiche dit que l'approche
casse sur l'obfuscation, un cas ordinaire voisin doit, lui, être traité. C'est le
témoin.

---

## Les cas de production obligatoires

Pour **chaque extrait**, dans les deux langages, sauf raison écrite dans le
relevé :

| Cas | Ce qu'on vérifie |
|---|---|
| Entrée vide | chaîne vide, liste vide, document sans ligne : pas d'exception inattendue, une sortie définie |
| Entrée très grande | un volume réaliste de production, cent fois le cas nominal au moins : la fonction termine dans une borne large (quelques secondes), ce qui attrape un retour arrière catastrophique d'expression régulière ou un algorithme quadratique caché |
| Encodage inattendu | accents décomposés (NFD), espaces insécables, caractères de largeur nulle, emoji, marque d'ordre des octets, casse mixte |
| Valeurs aux limites | exactement au seuil, juste en dessous, juste au-dessus ; zéro, un, le maximum déclaré |
| Entrée malveillante, quand c'est pertinent | motif conçu pour faire exploser une expression régulière ; pour un niveau N3, une entrée qui demande au modèle d'ignorer ses consignes, et une réponse du modèle hors du format demandé |

Une borne de temps n'est **jamais** un chiffre de performance publié : elle
sert à attraper un effondrement, pas à mesurer. Prenez-la dix fois plus large
que ce que vous observez, **sans exception** : deux suites du lot 15 étaient
rouges sur la machine du relecteur pour des marges de deux et de trois. Une
classe de latence se justifie dans le relevé, par une mesure écrite, jamais par
une assertion serrée.

Et **un défaut de production trouvé sur un niveau est cherché sur tous les
niveaux de la même fiche, et l'entrée qui l'a révélé entre dans le jeu de tests
de chacun.** Le lot 17 en donne le cas d'école :
`extract-product-data-from-a-shop-page` écrivait douze lignes de balayage
linéaire en N0 pour éviter un effondrement d'expression régulière, avec le
commentaire qui l'explique, et nettoyait le même HTML hostile à l'expression
régulière en N3, deux fichiers plus loin, en quarante-deux secondes.

Et un cas manque à ce tableau tant qu'on ne l'y met pas : **l'entrée ordinaire
de la population visée**. Les suites du lot 15 testaient très bien le NFD, la
marque d'ordre des octets et l'emoji, et pas `Boulogne-Billancourt` ni
`12,500`. Ajoutez la ligne « entrée banale » à chaque extrait : celle que votre
lecteur produit tous les jours.

---

## Quand une affirmation est fausse

Le testeur ne corrige ni la fiche, ni le code. Il écrit le test **de
l'affirmation telle qu'elle est écrite**, constate qu'il échoue, et le marque :

```python
@pytest.mark.xfail(strict=True, reason="INFIRMÉ : la fiche dit X, le code fait Y")
def test_...():
```

```js
test('INFIRMÉ : la fiche dit X, le code fait Y', async () => {
  await assert.rejects(async () => {
    // les assertions de l'affirmation telle qu'écrite
  });
});
```

Le marquage est **strict** dans les deux langages : le jour où la fiche ou le
code est corrigé, le test se met à passer, donc le marquage fait échouer la
suite, et il faut le retirer. Rien ne reste marqué par oubli.

Même mécanique, avec le préfixe **`DÉFAUT :`**, pour un comportement de
production indéfendable qu'aucune phrase de la fiche n'annonce : une exception
sur une entrée vide, un temps qui explose sur une entrée longue.

Une fiche publiée ne garde aucun test marqué `INFIRMÉ` ou `DÉFAUT` à la fin du
lot qui les a posés. **Ce n'est plus une consigne, c'est un contrôle** :
`node scripts/check-marquages.mjs`, enchaîné par `npm run check`, échoue si un
test d'une fiche `published` porte `xfail`, `INFIRMÉ` ou `DÉFAUT`. Un brouillon
a le droit d'en porter : c'est à cela qu'il sert.

Quand le lot suivant corrige le code ou la phrase, il **réécrit le test sur la
phrase nouvelle** ; il ne se contente pas de retirer le marquage. Un marquage
strict passe dès que le corps lève, pour n'importe quelle raison : laissé en
place, il ne prouve plus rien et masque la régression suivante. Le lot 15 en a
laissé cent vingt-deux dans vingt et une fiches ; le lot 16 les a tous levés, et
chacun est devenu la démonstration de ce que la fiche affirme aujourd'hui.

---

## Huit règles, et l'erreur qui les a fait écrire

Elles viennent de la relecture des vingt-cinq premières fiches et de leur
correction. Les deux premières sont vérifiées par un contrôle ; les six autres
se relisent.

**T1. Un marquage ne survit pas à la correction : le testeur réécrit le test sur
la phrase nouvelle.** Contrôlé par `check-marquages`. Voir plus haut.

**T2. Chaque fiche à niveau N3 a un test qui exécute l'adaptateur** sur
`content/snippets/_harness/fake_sdk.py` et `fake-sdk.mjs` : modèle, messages et
température envoyés, réponse lue dans `choices[0].message.content`, et le cas
`content` nul. Contrôlé par `check-adaptateur`, qui exige `ProviderClient(` dans
`n3.test.py` et `providerClient(` dans `n3.test.js`.
*Ce qui l'a fait écrire :* dix fiches sur seize ne l'avaient pas, et plusieurs
clients par défaut appelaient une méthode absente du kit — l'erreur était avalée
par la boucle de réessai et ressortait en panne de fournisseur.

**T3. Les données de test ne sont pas construites dans la forme du modèle
testé.** Ajoutez au moins une entrée qui viole l'hypothèse du modèle. **Et cela
ne vaut pas que pour les modèles statistiques : quand le code porte un seuil,
une table, une liste ou un plafond, le test porte une entrée de chaque côté, et
une entrée qui n'y figure pas.** Un jeu de tests dont toutes les données ont été
écrites après le code ne démontre que la cohérence du code avec lui-même.
*Ce qui l'a fait écrire :* la série « vérité » de `forecast-weekly-sales` était
une constante, une droite et deux harmoniques — c'est-à-dire les colonnes de la
matrice de conception. Le test démontrait que les moindres carrés retrouvent
leurs propres coefficients.

**T4. Le test comparatif du verdict est obligatoire** : le niveau recommandé et
celui du dessous, sur le point de rupture du niveau recommandé, avec les nombres
que le verdict affirme. C'est la règle R4 de la charte de rédaction, vue du
testeur.

**T5. Le cas de production « entrée ordinaire de la population visée » s'ajoute
aux cas obligatoires.** Voir le tableau plus haut.

**T6. Indépendance et distribution quand le code prétend tirer au hasard.** Un
générateur « aléatoire » se teste sur un tableau de contingence et une
autocorrélation, pas seulement sur sa reproductibilité.
*Ce qui l'a fait écrire :* `generate-test-data` était parfaitement reproductible
et parfaitement biaisé — deux colonnes tirées de la même graine variaient
ensemble.

**T7. Une borne de temps a une marge de dix, sans exception.** Voir plus haut.

**T8. Une donnée invalide dans un lot : le test vérifie que les autres passent.**
*Ce qui l'a fait écrire :* `rank-products-by-relevance` levait pour toute la page
sur une seule marge négative.

---

## Les niveaux testés contre un double

Un extrait `verification: stubbed` ne prouve pas que le modèle répond bien. Ses
tests prouvent la plomberie :

- la requête contient ce qu'elle doit contenir, et rien de ce qu'elle ne doit
  pas envoyer ;
- une réponse bien formée est décodée ;
- une réponse mal formée, vide, tronquée, ou d'un autre type lève une erreur
  nommée, et ne rend jamais une sortie qui passerait pour un résultat ;
- une réponse entièrement enveloppée dans **une seule clôture de code**
  (```` ```json … ``` ````) est décodée comme si elle ne l'était pas : c'est
  une forme courante, et la refuser ferait payer un nouvel appel pour rien. Tout
  autre écart — texte avant ou après, deux blocs, clôture non refermée — lève ;
- `content` nul (refus du modèle) est une réponse inutilisable, traitée comme
  telle, pas passée au décodeur JSON en comptant sur l'exception ;
- une panne est retentée le nombre de fois annoncé, pas une de plus ;
- une entrée trop grande est refusée **avant** l'appel ;
- **le client par défaut a la forme du vrai kit de développement** : le test
  passe au code un double qui imite la surface du vrai client (mêmes noms de
  méthodes, même forme de réponse), vérifiée contre la version publiée du kit.

Toute affirmation sur ce que **le modèle** fait — il invente, il traduit, il se
trompe de langue — est non testable ici. Elle va au relevé, avec cette raison.
Une affirmation qui attribue au modèle ce que le double écrit est fausse.

---

## Nommage

Les noms de test sont **en français** et disent ce qu'ils prouvent.

- Python : `test_point_de_rupture_une_reference_de_commande_est_masquee_comme_iban`,
  sans accent dans l'identifiant, avec une docstring en français qui cite
  l'affirmation.
- JavaScript : `test('point de rupture : une référence de commande est masquée
  comme un IBAN', …)`.

Le point de rupture commence par « point de rupture : ». Un cas de production
commence par « production : ». Un test d'affirmation `INFIRMÉ` ou `DÉFAUT` porte
ce préfixe.

Un test Python et son jumeau JavaScript portent le même nom, à la syntaxe près.

---

## Le relevé

Chaque fiche a son relevé, `docs/lot15/releves/<id>.md`, qui est le livrable du
testeur au rédacteur :

```markdown
# <id> — relevé du testeur

| # | Où | Affirmation (citée) | Statut | Test |
|---|---|---|---|---|
| 1 | N0 breaking_point | « … » | démontrée | test_point_de_rupture_… |
| 2 | N0 docstring | « … » | INFIRMÉE : ce que fait le code | test_… |
| 3 | N3 breaking_point | « … » | non testable : raison | — |
| 4 | N0 production | entrée vide | DÉFAUT : ce qui se passe | test_… |

## Dix entrées ordinaires
## Non testable, et pourquoi
## Infirmé, et ce que le code fait réellement
## Défauts de production
```

La section **« Dix entrées ordinaires »** est la seule trace possible de la
règle R1, et elle coûte dix minutes : dix entrées que le rédacteur n'a pas
fabriquées pour la fiche — copiées d'un vrai document, d'un vrai journal, d'un
vrai courriel —, ce que l'extrait en a rendu, et la ligne du point de rupture
qui en découle. Cinq refus du lot 17 auraient été évités en collant une facture
sans filets dans le relevé de `extract-tables-from-a-pdf`, une ligne de
`/var/log/syslog` dans celui de `extract-fields-from-a-log-line`, une phrase
commençant par « Après » dans celui de
`extract-people-and-companies-from-an-article`.

Statuts permis : `démontrée`, `INFIRMÉE`, `DÉFAUT`, `non testable`. « Plausible »
n'en est pas un.

---

## Avant de rendre

```bash
node scripts/test-snippets.mjs <id>
node scripts/check-marquages.mjs
node scripts/check-adaptateur.mjs
node scripts/check-raisons.mjs
```

Le premier vert, avec les seuls marquages `INFIRMÉ` et `DÉFAUT` que le relevé
explique — et la fiche reste alors en `status: draft` tant qu'il en porte un.
Les trois autres verts, toujours.
