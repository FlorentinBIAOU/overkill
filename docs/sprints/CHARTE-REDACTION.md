# Charte de rédaction des fiches

Contrat pour toute personne, ou tout agent, qui écrit une fiche Overkill.

---

## D'où vient le contenu d'une fiche

**Du code, pas de l'imagination.**

Les extraits existent déjà, ils sont testés, et leurs tests démontrent leurs points de
rupture. Avant d'écrire une ligne de fiche, lisez `content/snippets/<id>/` en entier :
l'extrait de chaque barreau, et surtout son test.

Le test nommé « breaking point » ou « point de rupture » vous dit exactement ce qui fait
échouer l'approche, avec un exemple qui a réellement été exécuté. C'est ce que vous écrivez
dans le champ `breaking_point`. Pas une approximation, pas une généralité : ce que le test
démontre.

Si vous vous surprenez à écrire une affirmation que rien dans le dépôt ne soutient,
supprimez-la.

---

## Les trois interdits qui vous concernent

### 1. N'inventez aucun chiffre

Pas de prix absolu. Pas de gramme de CO₂. Pas de pourcentage de performance. Pas de taille de
modèle en mégaoctets. Pas de durée en millisecondes.

Le coût se dit avec cinq mots, la latence avec cinq classes, l'empreinte avec quatre niveaux
relatifs. Rien d'autre n'est permis, et `scripts/check-figures.mjs` le vérifie.

| `cost` | Ce que ça veut dire |
|---|---|
| `nul` | aucun coût marginal |
| `négligeable` | moins d'un euro par million d'opérations |
| `faible` | de l'ordre de l'euro par million d'opérations |
| `modéré` | de l'ordre de la dizaine d'euros par million d'opérations |
| `élevé` | de l'ordre de la centaine d'euros par million d'opérations, ou plus |

`latency` : exactement `<1 ms`, `~10 ms`, `~100 ms`, `~1 s` ou `>1 s`.

`footprint` : `negligible`, `low`, `moderate`, `high`. C'est un ordre de grandeur **relatif
aux autres barreaux de la même fiche**, pas une mesure.

### 2. N'écrivez aucun conseil juridique

Le champ `regulatory` est une liste courte de faits. Formulation attendue : ce que l'approche
**vous fait entrer dans le périmètre de**, et ce qu'elle **ne vous dispense pas de**.

Jamais « vous êtes conforme », jamais « vous devez », jamais « il suffit de ». Si un barreau
n'ajoute aucun périmètre, écrivez-le : `["Aucun périmètre spécifique ajouté"]`.

Exemples acceptables :

- « Traitement de données personnelles sur votre infrastructure »
- « Transfert de données personnelles à un sous-traitant, avec l'encadrement contractuel que
  cela suppose »
- « Localisation du traitement à vérifier auprès du fournisseur »

### 3. N'écrivez aucun texte de remplissage

Un paragraphe creux qui tient lieu de contenu est pire qu'un champ vide. Si vous ne savez pas
quoi mettre dans un champ, c'est un signal : soit vous n'avez pas lu le code, soit la fiche
n'est pas prête et son `status` doit passer à `draft`.

Interdits de fait : « il est important de noter que », « dans de nombreux cas », « cela
dépend de votre contexte », « les deux approches ont leurs avantages ».

---

## Champ par champ

### `scenario` — deux à quatre phrases

**Ce qu'on voit faire, et pourquoi c'est discutable.** Pas une définition du problème, une
observation de terrain. Commencez par ce que les gens font vraiment.

Bon : « On voit régulièrement un appel de modèle sur chaque message entrant pour repérer les
coordonnées. Le besoin est pourtant déterministe, et le motif d'une adresse électronique n'a
pas changé depuis vingt ans. »

Mauvais : « Le masquage de données personnelles est un enjeu important pour de nombreuses
organisations. »

### `name` d'un barreau — court et concret

« Normalisation puis expressions régulières », pas « Approche par règles ». On doit
comprendre ce que fait le code sans l'ouvrir.

### `breaking_point` — ce qui fait échouer, avec un exemple

Repris du test. Une ou deux phrases. Un exemple concret, pas une catégorie.

Bon : « L'obfuscation volontaire : chiffres écrits en lettres, caractères sosies, emojis
intercalés. »

Mauvais : « Cette approche a des limites en cas d'entrées inhabituelles. »

### `escalate_when` — la condition précise

Une phrase qui décrit un **événement observable**, pas un jugement. Le lecteur doit pouvoir
dire « ça y est, ça m'arrive ».

Bon : « Vos utilisateurs contournent activement le filtre. »
Mauvais : « Quand la précision devient insuffisante. »

### `unavailable_reason` — pourquoi ce barreau n'est pas là

Une raison réelle, tirée de la matrice. Elle dit **pourquoi c'est un mauvais choix ici**,
pas « non applicable ».

Bon : « Comparer les paires par appel à un modèle généraliste est quadratique : sur dix mille
fiches, cela fait cinquante millions d'appels. »

### `verdict_rationale` — deux à trois phrases, assumées

Pourquoi ce barreau et pas le suivant. Dites le compromis à voix haute. Si le verdict est N3,
assumez-le sans vous excuser : le site n'est pas anti-IA.

### `further_reading` et `sources`

Des liens **réellement consultés**. Documentation officielle, article de référence, dépôt.
Aucun lien inventé, aucun lien vers un article de blog promotionnel.

Si vous n'avez pas de source, laissez la liste vide. Une liste vide est honnête.

---

## Le bilinguisme

Le français et l'anglais sont **écrits chacun dans sa langue**, pas traduits mot à mot depuis
l'autre. L'anglais est la version canonique du site : il doit se lire comme de l'anglais.

Cela veut dire : pas de calque de structure, pas de « it is important to note », pas de
tournure française déguisée. Écrivez la même idée, deux fois, correctement.

Une fiche dont une langue est incomplète ne se publie pas. Le schéma la rejette.

---

## Le ton

Direct, dense, sans vulgarisation superflue. Les quatre publics de ce site incluent un
développeur expérimenté qui n'a pas le temps, et un développeur junior qui n'a pas les
références. Servez les deux : soyez précis, et expliquez les termes que vous employez la
première fois.

Pas d'emphase molle. Pas de « très », pas de « vraiment », pas de point d'exclamation.
Une affirmation forte se porte par sa précision, pas par son adverbe.

---

## Avant de rendre

```bash
node --import tsx scripts/check-content.mjs   # le schéma et le disque
node scripts/check-figures.mjs                # les chiffres interdits
node scripts/test-snippets.mjs <id>           # le code de votre fiche
```

Les trois doivent être verts. Si l'un ne l'est pas, la fiche n'est pas finie.
