# Charte de rédaction des fiches

Contrat pour toute personne, ou tout agent, qui écrit une fiche Overkill.

---

## D'où vient le contenu d'une fiche

**Du code, pas de l'imagination.**

Les extraits existent déjà, ils sont testés, et leurs tests démontrent leurs points de
rupture. Avant d'écrire une ligne de fiche, lisez `content/snippets/<id>/` en entier :
l'extrait de chaque niveau, et surtout son test.

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
aux autres niveaux de la même fiche**, pas une mesure.

### 2. N'écrivez aucun conseil juridique

Le champ `regulatory` est une liste courte de faits. Formulation attendue : ce que l'approche
**vous fait entrer dans le périmètre de**, et ce qu'elle **ne vous dispense pas de**.

Jamais « vous êtes conforme », jamais « vous devez », jamais « il suffit de ». Si un niveau
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

### `name` d'un niveau — court et concret

« Normalisation puis expressions régulières », pas « Approche par règles ». On doit
comprendre ce que fait le code sans l'ouvrir.

### `breaking_point` — ce qui fait échouer, avec un exemple

Repris du test. **Deux phrases, un exemple, un témoin.** Le reste — les renvois, les cas
voisins, ce que le double simule — va dans la docstring de l'extrait. Sur les 74 points de
rupture du catalogue relus au lot 15, 68 dépassaient soixante mots : ils ne se lisaient plus.

Bon : « L'obfuscation volontaire : chiffres écrits en lettres, caractères sosies, emojis
intercalés. »

Mauvais : « Cette approche a des limites en cas d'entrées inhabituelles. »

Et ce que le point de rupture nomme est la **première** chose qui casse sur des données
réelles, pas la plus élégante : voir la règle R1 ci-dessous.

### `escalate_when` — la condition précise

Une phrase qui décrit un **événement observable**, pas un jugement. Le lecteur doit pouvoir
dire « ça y est, ça m'arrive ».

Bon : « Vos utilisateurs contournent activement le filtre. »
Mauvais : « Quand la précision devient insuffisante. »

### `unavailable_reason` — pourquoi ce niveau n'est pas là

Une raison réelle, tirée de la matrice. Elle dit **pourquoi c'est un mauvais choix ici**,
pas « non applicable ».

Bon : « Comparer les paires par appel à un modèle généraliste est quadratique : sur dix mille
fiches, cela fait cinquante millions d'appels. »

### `verdict_rationale` — deux à trois phrases, assumées

Pourquoi ce niveau et pas le suivant. Dites le compromis à voix haute. Si le verdict est N3,
assumez-le sans vous excuser : le site n'est pas anti-IA.

### `further_reading` et `sources`

Des liens **réellement consultés**. Documentation officielle, article de référence, dépôt.
Aucun lien inventé, aucun lien vers un article de blog promotionnel.

**Tout ce que vous avez vérifié pour écrire la fiche va dans `sources`**, avec la phrase que
vous y avez lue quand elle porte un chiffre. Un lecteur ne lit pas votre compte rendu de
corrections. Une liste vide n'est honnête que si vous n'avez rien eu à vérifier — ce qui est
rare : au lot 15, `show-similar-articles` avançait 128 et 512 jetons, relevés sur deux fiches
de modèle, avec `sources: []`.

---

## Quatorze règles, et l'erreur qui les a fait écrire

Elles viennent de la relecture des vingt-cinq premières fiches, où vingt-quatre ont été
refusées, et de leur correction. Chacune porte le cas réel qui l'a fait naître, pour que
vous reconnaissiez le vôtre. Elles sont classées par importance.

**R1. Faites tourner l'extrait sur l'entrée ordinaire de votre lecteur avant d'écrire le
point de rupture.** Le point de rupture est la première chose qui casse sur des données
réelles. Avant de rédiger, exécutez le niveau sur une dizaine d'entrées que votre public
produit tous les jours et notez ce qui sort. Pour un public francophone : une ville à trait
d'union, une rue au nom d'une personne, un montant au format anglais, un numéro de téléphone
étranger, un mois abrégé, une société qui commence par son métier.
*Ce qui l'a fait écrire :* `mask-personal-data-in-chat` citait l'obfuscation et laissait
passer `+32 470 12 34 56` ; `extract-dates-from-text` citait « jeudi prochain » et manquait
`3 janv. 2024`.

**R2. Une sortie fausse et silencieuse sur une entrée ordinaire se corrige, ou se dit en
premier.** Jamais en dernier, jamais pas du tout : le site reproche aux modèles de rendre une
valeur devinée qui ressemble à une valeur lue, et un niveau N0 qui fait pareil perd
l'argument. Toute ambiguïté que le code tranche seul — séparateur décimal, ordre jour-mois,
casse, fuseau — est soit déclarée par l'appelant, soit rejetée au journal.
*Ce qui l'a fait écrire :* `convert-messy-csv-to-clean-data` promettait un journal de tout ce
qui n'avait pas pu être lu, et rendait `12,500` en `12.5` sans une ligne.

**R3. Nommez l'outil standard avant d'en écrire un, et mettez-le dans l'échelle.** Le
concurrent réel d'un appel de modèle est rarement « du code à la main » : c'est une
bibliothèque, un service public, un identifiant, une donnée structurée. Répondez par écrit à
« qu'est-ce qu'un développeur expérimenté brancherait en premier ? ». Si c'est un outil
existant, il est un niveau, ou il est écarté avec une raison mesurée.
*Ce qui l'a fait écrire :* `read-text-from-a-scanned-page` écrivait un lecteur PDF de cent
quatre-vingts lignes qu'un export de traitement de texte mettait en échec, là où `pypdf` lit
juste ; `extract-fields-from-invoice` ignorait Factur-X alors que la réception électronique
est obligatoire depuis le 1er septembre 2026.

**R4. Confrontez le verdict aux données de la fiche elle-même.** Pour un verdict qui préfère
un niveau à celui du dessous, écrivez le test qui fait tourner **les deux** sur le point de
rupture du niveau recommandé, et publiez ce qu'il montre. Ne reprochez pas à un niveau un
échec que le niveau recommandé partage.
*Ce qui l'a fait écrire :* `forecast-weekly-sales` recommandait N1 « parce qu'il suit
l'activité qui bouge » quand ses propres séries donnaient N1 à +28 % et N0 à −3 % ;
`detect-language-of-text` reprochait à N1 de rendre « chat » en anglais, ce que N0 fait avec
l'écart le plus large de la fiche.

**R5. Ne présentez pas un défaut réparable comme une limite de l'approche.** Si une ligne de
code règle le cas, c'est un bogue, pas un point de rupture.
*Ce qui l'a fait écrire :* `validate-a-form-server-side` citait « un pseudonyme de deux
espaces » comme ce qu'« aucune règle ne peut dire » ; retirer les blancs de bord est la
règle, et la norme HTML le fait déjà pour un champ de courriel.

**R6. Le modèle nommé doit servir la langue et l'usage du lecteur.** Avant de nommer un point
de contrôle, lisez sa fiche : langues, licence, usage commercial, existence. Si le modèle ne
lit pas la langue de vos lecteurs, dites-le dans le nom du niveau ou son point de rupture, et
tirez-en la conséquence dans le verdict.
*Ce qui l'a fait écrire :* `moderate-user-comments` et `summarise-a-long-document` nommaient
des modèles anglais seulement ; `write-product-descriptions` pointait vers
`./models/catalogue-copy`, qui n'existe pas.

**R7. Dites les réglages par défaut en conditions d'exploitation.** Un seuil, une fenêtre, un
plafond par défaut se jugent sur ce qu'ils produisent un jour ordinaire, pas sur l'exemple
qui les illustre.
*Ce qui l'a fait écrire :* `detect-anomalies-in-metrics` mesurait dix fausses alertes par
jour et par métrique saine, et la fiche promettait d'être réveillé « et pas le reste du
temps ».

**R8. Un plafond refuse ce qui coûte, et dégrade plutôt que de lever dans un chemin de
requête.** Écrivez ce que l'appelant fait au-dessus du plafond.
*Ce qui l'a fait écrire :* `detect-language-of-text` levait au-delà de huit mille caractères
alors qu'il n'en envoyait que six cents ; `route-support-tickets` levait sur un ticket long,
et un routeur qui lève laisse le ticket nulle part.

**R9. Pensez au cycle de vie réel de la sortie avant de compter un coût.** Une description se
génère une fois et se stocke ; une table de voisins se calcule hors ligne ; une alerte se
rejoue.
*Ce qui l'a fait écrire :* `write-product-descriptions` comptait le non-déterminisme comme un
prix permanent, alors que personne ne régénère une description à chaque affichage.

**R10. Un contrôle de sécurité dit d'où vient la valeur qu'il contrôle.** Si le client peut
la fournir, le contrôle ne contrôle rien.
*Ce qui l'a fait écrire :* `detect-spam-in-contact-form` prenait le délai de soumission en
argument sans dire qu'il doit être horodaté et signé par le serveur.

**R11. `breaking_point` : deux phrases, un exemple, un témoin.** Voir plus haut.
**Ce n'est plus une consigne, c'est un contrôle** : `node
scripts/check-longueur-rupture.mjs`, enchaîné par `npm run check`, compte les
phrases et les mots de chaque point de rupture publié, dans les deux langues.
*Ce qui l'a fait écrire :* la relecture du lot 17 a trouvé la règle enfreinte
vingt-cinq fois sur vingt-cinq, à 79 mots de moyenne, et la dérive était
régulière — 66 mots sur les quatorze premières fiches, 90 sur les onze
dernières. Une règle qui porte un nombre et qu'aucun contrôle ne vérifie dérive
toujours dans le même sens, parce qu'il y a toujours une bonne raison d'ajouter
une phrase. Celle qu'on veut ajouter a presque toujours sa place dans la
docstring : c'est le renvoi, le cas voisin, ou l'alternative écartée.

**R12. Tout ce qui a été vérifié pour écrire la fiche va dans `sources`.** Voir plus haut.
Et son pendant : **tout nombre écrit dans une fiche — pourcentage, effectif,
décompte, facteur — est soit asserté à l'égalité stricte dans un test, soit
remplacé par un ordre de grandeur en toutes lettres** (« près de sept mille »,
« moins d'un demi pour cent »). Il n'y a pas de troisième forme : un générateur
à graine fixe est reproductible à l'unité, il n'y a aucune raison d'écrire une
fourchette. Contrôlé par `node scripts/check-chiffres-tenus.mjs`, qui exige que
chaque nombre publié apparaisse dans un test de la fiche.
*Ce qui l'a fait écrire :* `check-bank-details-before-a-transfer` publiait
« 0,6 % » et « 6 887 » là où ses deux suites rendent 0,450 % et 6 882, avec des
tests qui assertaient `0.002 < x < 0.02` — une fourchette large d'une décade.

**R13. Le titre anglais décrit le même besoin que `need`.** L'anglais est la version
canonique.
*Ce qui l'a fait écrire :* « Mask personal data » pour un besoin qui ne masque que le
téléphone, l'adresse électronique et l'IBAN.

**R14. Une raison rendue par le code est une affirmation, et elle se teste comme
les autres.** Elle ne dit que ce que le code a constaté, jamais la cause qu'il
suppose. « Ce texte fait moins de deux cents caractères » se teste ; « cette
page est probablement construite par son JavaScript » ne se teste pas et se
trouve faux sur la première brève venue. Deux situations que le code distingue
ont deux raisons ; deux situations qu'il ne distingue pas n'en ont qu'une, et
elle ne nomme pas de cause. Les champs visés sont ceux que l'appelant lit et
journalise : `reason`, `why`, `evidence`, `skipped`, `source`, `strategy`.
Contrôlé par `node scripts/check-raisons.mjs`, qui exige que chacune de ces
chaînes soit citée mot pour mot dans un test de la fiche.
*Ce qui l'a fait écrire :* six fiches du lot 17 ont été refusées pour une de ces
chaînes, alors que la décision prise par le code était juste — une brève de
presse déclarée « construite par son JavaScript », une réponse correctement
coupée accusée d'avoir « plus de texte sous la citation qu'au-dessus », une
famille de suivi qui « ne porte rien à vérifier » alors qu'elle porte une clé.

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
node scripts/check-longueur-rupture.mjs       # R11, deux phrases et soixante mots
node scripts/check-raisons.mjs                # R14, les raisons rendues par le code
node scripts/test-snippets.mjs <id>           # le code de votre fiche
```

Les cinq doivent être verts. Si l'un ne l'est pas, la fiche n'est pas finie.

## Vocabulaire imposé

Dans l'interface comme dans le corps des fiches, on écrit **niveau**, pas « barreau ».
Le mot « barreau » n'est conservé que dans la page méthodologie, où la métaphore de
l'échelle est expliquée. Voir `docs/DECISIONS-CLARTE.md`.
