# Lot 14 — Refonte de l'expérience et préparation au lancement

Rapport de fin de lot. Branche `lot14-experience`, créée depuis `main` à jour.

Ce document est écrit au fil du lot : chaque partie y est versée quand elle est
terminée, vérifiée et commitée.

---

## Les verdicts corrigés

**Aucun des vingt-cinq verdicts n'a été renversé.** Les vingt-cinq ont été
contestés un par un : chaque niveau réexécuté hors de ses tests, chaque point de
rupture reproduit, chaque « le niveau du dessous ne suffirait-il pas ? » posé et
tranché. Les vingt-cinq tiennent sur ce qu'ils affirment.

Deux ont demandé un examen plus long, et sont laissés en place avec le doute
écrit :

- **`fuzzy-match-company-names` (N0)** — le besoin annoncé, rapprocher deux
  fichiers, ressemble à l'emploi de N1. Mais N0 juge une paire, ne dépend de
  rien, et son point de rupture est exactement celui de N1 : le sigle, que N1
  manque aussi, et manque en se faisant doubler par deux sociétés sans rapport.
  Mesuré : « Menuiserie Dubois » contre « Dubois Menuiserie » donne 0,7395, sous
  le seuil de 0,85 — la faiblesse réelle est l'ordre des mots, et le champ
  `escalate_when` la nomme déjà.
- **`show-similar-articles` (N1)** — c'est la seule fiche où N0 n'est pas retenu
  alors qu'il est gratuit et déterministe. L'argument est que l'échec de N0 est
  total et non dégradé, ce que son test démontre sur deux corpus : le jumeau
  anglais de l'article ressort à **0 exactement**, pas à un score faible. Le
  doute est laissé écrit : le choix repose sur une hypothèse d'étiquetage
  relâché, et un lecteur dont les étiquettes sont tenues aura raison de rester à
  N0.

### Ce qui a été corrigé, en revanche : quinze affirmations fausses

Aucune n'était attrapable par un contrôle automatique. Toutes l'ont été en
exécutant le code et en confrontant le résultat à la phrase de la fiche.

**Des classes de latence qui surévaluaient le coût d'une décision.** Sept fiches
déclaraient `~10 ms` là où une décision se prend en moins d'une milliseconde.
Mesuré sur la régression logistique de `detect-spam-in-contact-form`, côté
Python, bibliothèque comprise : **0,227 ms par décision** sur trente-deux
exemples d'entraînement. Passées à `<1 ms`. La classe `~10 ms` reste là où elle
est vraie — `detect-anomalies-in-metrics` en N1, mesuré à 1,345 ms côté Python,
où `<1 ms` serait une promesse que le code ne tient pas.

**Une sortie de données mal déclarée.** `parse-address-into-fields` annonçait
`own-infra` sur un niveau N1 qui ne sort de nulle part : passé à `none`.

**Un niveau qui ne faisait pas ce que son nom disait.**
`moderate-user-comments` appelait son N3 « point de terminaison de modération
d'un fournisseur » alors que le code note le commentaire avec un modèle
généraliste. Renommé.

**Un chiffre inventé dans un scénario.** `mask-personal-data-in-chat` affirmait
qu'une expression régulière fait le travail « en un dixième de milliseconde ».
Personne ne l'avait mesuré : devenu « en une fraction de milliseconde ».

**« Sanofi n'a en commun qu'une première lettre avec SNCF ».** Faux : après
normalisation, les deux partagent trois caractères sur quatre dans la fenêtre de
Jaro, et c'est précisément ce qui produit le score qui les rapproche. Le point de
fond — aucun seuil ne retient la vraie paire en écartant celle-là — est intact et
reproduit. L'erreur était aussi dans un commentaire de test, qui la répétait.

**« Une gamme qui n'a encore rien vendu ».** La donnée du test lui donne une
popularité de 0,05, pas de zéro. Devenue « presque rien ».

**Un plafond toléré annoncé à 2100 là où le code en calcule 1511.** Dans la
docstring de `detect-anomalies-in-metrics`, dont les deux premiers nombres
venaient bien du test, mais pas le troisième.

**Une minute impossible mal décrite.** La même fiche parlait d'un trafic de
milieu de journée portant des erreurs de plafond ; la donnée du test est un
trafic **de nuit**. La version JavaScript de la docstring, elle, était juste :
seule la version Python mentait.

**Un point de rupture qui attribuait à un modèle réel ce que produit le double.**
`search-in-your-own-documents` affirmait qu'« la fusion présente en tête celle
des notes de frais » : c'est vrai, mais c'est l'encodeur factice des tests qui
désigne cette page. Reformulé pour dire d'où vient le classement.

**Une justification contredite par sa propre fiche.** La même disait de N1 qu'il
n'est « ni plus lent ni plus cher », quand la fiche déclare N0 à `nul` et N1 à
`négligeable`. Devenue : pas plus lent, et ce qu'il coûte de plus est un index à
reconstruire hors de la base.

**Cinq points de rupture vrais mais invérifiables tels qu'ils étaient écrits.**
Ils affirmaient un échec sans donner de quoi le reproduire. Réécrits avec ce que
l'exécution montre : le 0,96 des deux fiches jamais comparées de
`find-duplicate-records` et le double échec d'un nom saisi à l'envers ; la
distinction, sur `extract-fields-from-invoice`, entre deux champs qui reviennent
vides — ce qui se voit — et un total bien formé et faux — ce qui ne se voit pas ;
le complément d'adresse écrit devant qui vide le numéro et avale l'adresse
entière ; le faux positif d'IBAN sur une référence de commande, qui manquait au
point de rupture de `mask-personal-data-in-chat` ; et le corpus aux conventions
mêlées qui remplace, sur `extract-dates-from-text`, un point de rupture N1 qui
répétait celui de N0.

**Quatre commentaires de test qui niaient leur propre fiche.** Les tests de
rupture de N1 et N2 de `show-similar-articles` s'ouvraient sur « ce n'est pas le
point de rupture de la fiche, qui est celui de N0 » — alors que la fiche déclare
bien un point de rupture pour ces deux niveaux, et que ce sont exactement ces
tests qu'elle cite.


### Onze affirmations qui attribuaient à un modèle ce qu'écrit un double local

C'est la famille de défauts la plus intéressante du lot, parce qu'elle
touchait précisément les fiches qui recommandent un modèle — celles dont la
crédibilité porte celle des vingt-trois autres.

Les extraits N2 et N3 sont testés contre un double local : le dépôt ne
télécharge aucun poids et n'appelle aucune API. Onze champs de fiche
présentaient pourtant comme une observation ce que le harnais de test écrit
lui-même : « le même document donne ceci puis cela », « il rend une facture
entière et plausible », « le modèle traduit le nom de la variable », « deux
appels sur le même produit rendent deux textes ».

Vérifié, pour l'un d'entre eux, en instrumentant le double : à ce niveau, le
modèle ne reçoit jamais `{count}` — il reçoit `⟦0⟧ items selected`. Il ne peut
donc pas traduire un nom de variable, et ce que le second test montrait était
une accolade **inventée**, ce qui n'est pas la même limite.

Les onze champs disent désormais d'où vient la réponse, et ce qui est
réellement démontré : ce que la plomberie laisse passer, l'aveuglement d'un
seuil, l'absence de garde-fou dans l'extrait. C'est moins spectaculaire, et
c'est la seule preuve qu'un dépôt sans poids ni API puisse produire.

Dans un cas, l'affirmation a été remplacée par une autre, vérifiable :
« deux appels rendent deux textes » est devenu « l'extrait demande une
température non nulle », ce qui se lit dans le code et que le test contrôle.

### Quatre autres corrections du même examen

- Un **scénario** affirmait que le niveau le plus cher « est le seul qui fasse
  le travail demandé ». Faux : le niveau du dessous reformule aussi, et son
  test le démontre.
- Une **justification de verdict** affirmait que deux niveaux « échouent
  exactement de la même manière » sur les variables d'interface, quand l'un les
  masque et l'autre non.
- Un **point de rupture** annonçait trois refus là où le code n'en a que deux.
  Vérifié : le tampon de numéro de page rend le même refus que le scan.
- Une **justification** disait d'un test qu'il « rend un résumé impeccable »
  quand il montre seulement que les contrôles l'acceptent : « laisse passer ».

### Un point de rupture complété plutôt que corrigé

`validate-a-form-server-side` annonçait une seule limite : aucune règle ne dit
si une adresse existe. Il en a une seconde, aussi reproductible et plus
courante : `min` compte des caractères, une espace en est un, donc un pseudonyme
fait de deux espaces passe un minimum de deux et le profil s'affiche vide.
Vérifié dans les deux langages, écrit dans la fiche, et démontré par un test
nouveau de chaque côté.

### Un arbitrage rendu : ce que la latence annoncée mesure

Le cahier des charges fixe cinq classes de latence sans dire ce qu'elles
mesurent. La question s'est posée sur les niveaux N1, où l'entraînement coûte
mille fois la décision. Tranché, et écrit sur la page « Comment ça marche » :
**la latence annoncée est celle d'une décision sur une entrée**, pas celle de
l'entraînement, qui n'a lieu qu'une fois, ni celle du premier chargement d'un
modèle. Quand l'entraînement pèse dans le choix d'un niveau, la fiche le dit
dans son texte, pas dans sa classe de latence.


### Ce que la relecture n'a pas pu établir, et qui reste écrit tel quel

- **Les latences des niveaux N2 et N3** (`~100 ms`, `~1 s`, `>1 s`). Aucune
  exécution ne peut les établir : les extraits sont testés contre des doubles,
  et le dépôt ne télécharge jamais de poids. Elles restent cohérentes entre
  fiches ; personne ne les a mesurées, et le rapport le dit plutôt que la fiche
  ne le prétende.
- **La qualité d'écriture attribuée à N2 et N3** sur les deux fiches qui les
  recommandent. C'est l'argument sur lequel repose leur verdict, et aucun test
  ne peut l'établir. Les fiches le disent déjà à côté de leurs extraits.
- **`~10 ms` pour le niveau N0 de `translate-interface-strings`** : mesuré à
  9,2 ms sur une mémoire de deux cents chaînes, mais 88 ms sur deux mille côté
  Python. La classe tient pour une mémoire moyenne, pas pour une grosse.
- **Une seconde façon de tromper le niveau N0 de
  `read-text-from-a-scanned-page`** : un scan portant un tampon de plus de
  vingt-quatre caractères lisibles est rendu « porte déjà du texte ». Le seuil
  est documenté dans le code, aucun champ ne prétend le contraire, et l'ajouter
  au point de rupture demanderait un test de plus — noté, pas fait.
- **`generate-placeholder-images` en très petite taille** : à trois pixels, la
  grille de cinq donne des rectangles de largeur nulle et l'image se réduit au
  fond. La fiche ne promet rien en dessous de la taille que son test couvre.

---

## Les codes réparés

**`read-text-from-a-scanned-page`, niveau N0 — le défaut le plus grave du
catalogue.** L'extrait répond à la question « cette page porte-t-elle déjà du
texte, ou faut-il un moteur de reconnaissance ? ». Il comptait les caractères
trouvés dans **tous** les flux du document, y compris les images et les
programmes de police. Sur une vraie page scannée — c'est-à-dire une photo — il
trouvait donc plusieurs milliers de caractères d'octets compressés et répondait
« cette page a déjà un texte », soit exactement l'inverse de la vérité, sur le
cas d'usage central de la fiche.

Réparé : les flux qui ne sont pas des instructions de page sont écartés sur leur
déclaration, la lecture ne se fait plus qu'à l'intérieur d'un objet texte, et
une chaîne n'est comptée que si un opérateur l'affiche réellement. La fonction
distingue désormais **deux façons de dire non**, qui n'appellent pas la même
suite : rien n'a été montré du tout, la page est une image et un moteur de
reconnaissance est ce qui vient après ; ou beaucoup a été montré et rien ne se
lit, le texte est là derrière une table de glyphes que ce fichier ne porte pas,
et un moteur de reconnaissance serait la mauvaise réponse.

Deux tests nouveaux le démontrent : un scan dont l'image est un JPEG, et une
couche de texte que la fonction ne sait pas décoder. Les six extraits de la
fiche passent.

**`detect-spam-in-contact-form`, niveau N0 — un plafond de liens qui comptait
double.** L'expression qui repère un lien avait deux branches qui se recouvrent :
`http://exemple.com` correspondait à la fois à `https?://` et à `\.com`, donc
comptait pour deux liens. Conséquence visible : une demande de client légitime
contenant deux liens dépassait un plafond fixé à trois. Réparé en consommant le
lien entier.

**`summarise-a-long-document`, niveau N0 — un commentaire de test qui expliquait
mal son propre résultat.** Le test démontre qu'une phrase courte et tardive est
la première écartée du résumé extractif ; son commentaire attribuait cela à son
seul vocabulaire, alors que la digression sur l'entrepôt occupe tout le
vocabulaire du document. Le fait tient, l'explication était incomplète.

---

## Ce qui est fait et vérifié

### Partie 1 — La fiche

| Fait | Preuve |
|---|---|
| Blocs de code sur fond sombre fixe, bande d'onglets d'éditeur, bouton copier | `SEL=".code-tabs" node scripts/shot.mjs /fr/fiches/mask-personal-data-in-chat 1440 light` — capture regardée en clair et en sombre, à 360 et 1440 px |
| Contraste de la coloration syntaxique mesuré contre ce fond | `npm run check:contrast` — les 149 extraits du dépôt passent par Shiki, 8 couleurs émises, la plus faible à 8,66:1 |
| Zone d'essai interactive, 16 fiches | `npm run test:tryout` au navigateur sur chaque fiche qui a un essai ; captures des 20 zones regardées une par une |
| Zone d'essai figée, 4 fiches, sorties calculées au build | même contrôle ; `npm run check:content` exécute chaque cas dans les deux langues |
| Bloc risques en langage clair | capture `SEL=".risks"` regardée ; `npm run check:a11y` au vert |
| Preuve d'exécution réintégrée dans la barre du bloc de code | capture regardée ; forme courte visible, phrase complète au survol et pour les lecteurs d'écran |
| Liens en cartes avec nature et source | capture regardée ; `npm run check:links` au vert |
| Fiches voisines au format carte du catalogue | capture regardée |
| CTA de fin en aplat jaune, grand titre, bouton sombre | capture regardée |
| Marges et espacement repris | captures 360 / 1440, clair et sombre, regardées |
| Aucun débordement horizontal | `node scripts/check-overflow.mjs /fr/fiches/mask-personal-data-in-chat /fr/fiches/summarise-a-long-document` — 4 largeurs, aucun |

### Partie 2 — Le design appliqué partout

| Fait | Preuve |
|---|---|
| Un seul traitement de bouton et de lien d'action pour tout le site, dans `global.css` | l'accueil, le catalogue, les familles, les fiches, le 404 et les pages éditoriales posaient chacun le leur ; captures des onze pages regardées |
| Un seul composant d'appel à l'action, `CtaBand` | employé par le catalogue, les familles, l'index des familles, la méthodologie, contribuer et les crédits |
| Les pages éditoriales reçoivent l'appel à l'action qui leur correspond, ou aucun | captures regardées page par page |
| Les liens en cartes, employables depuis un fichier MDX | crédits et à propos : les méthodologies citées et les liens de l'auteur étaient du texte nu |
| Un aplat d'en-tête sur chacune des onze pages publiques | mentions légales, confidentialité et crédits n'en avaient pas |
| Les blocs de code des pages éditoriales sur le même fond sombre que les fiches | capture de la page contribuer regardée |
| Les fiches mises en avant sur l'accueil au format carte du catalogue | capture regardée |
| Accessibilité, clair et sombre | `node scripts/check-a11y.mjs /fr/credits /fr/contribuer /fr/familles /fr/a-propos /fr/404` — aucune violation sérieuse ni critique |
| Aucun débordement horizontal, onze pages, quatre largeurs | `node scripts/check-overflow.mjs` sur les onze pages publiques |
| `npm run check` au vert | de bout en bout, trois constructions comprises |

### Défauts trouvés en regardant l'écran, et corrigés

7. **La page contribuer décrivait un bouton qui n'existait pas.** La section 7.8
   du CDC demande « le bouton proposer une fiche sans coder, qui ouvre une issue
   GitHub pré-remplie » : la page en parlait au futur depuis le lot 09 sans
   jamais le poser. Il est là, dans l'appel à l'action de fin de page.
8. **Le tableau des polices de la page crédits débordait à 360 px** et poussait
   la page entière. Tout tableau du Markdown est désormais enveloppé dans un
   conteneur qui défile, par un greffon de rendu : le contenu large défile dans
   son conteneur, jamais la page.
9. **Un appel à l'action commençait au bord de la page** sur les pages
   éditoriales, dont tout le texte est centré dans une colonne de lecture. Il
   s'aligne maintenant sur cette colonne.
10. **Les listes de liens se mettaient sur deux colonnes selon la largeur de
    l'écran**, y compris dans une colonne de lecture de 680 px où elles
    devenaient illisibles. Le calcul porte désormais sur la place réellement
    disponible.

### Défauts trouvés en regardant l'écran, et corrigés — partie 3

11. **Le message honnête s'affichait en vert**, la couleur que ce site réserve
    à la recommandation. « Le catalogue ne couvre pas encore ce besoin » n'est
    pas une réponse de niveau : il ne prend pas la teinte d'un niveau.
12. **La justification de la fiche était étiquetée « pourquoi »** même quand
    les contraintes avaient déplacé la réponse vers un autre niveau — le texte
    argumentait alors exactement le contraire de ce qui s'affichait au-dessus.
    Elle est maintenant étiquetée pour ce qu'elle est : « pourquoi la fiche
    recommande N3 par défaut ».
13. **Le message pré-rempli écrivait ses espaces en « + »**, ce qu'un client de
    messagerie n'interprète pas : le brouillon se serait ouvert criblé de plus.
### Défaut trouvé en regardant l'écran, et corrigé — partie 4

15. **Sur l'aplat de marque, l'action secondaire devenait un rectangle noir
    illisible** : la règle qui pose l'encre sombre sur le jaune gagnait sur
    celle du contour. Visible dès la première capture du hero.

14. **Le verdict ne disait rien quand rien ne bloquait.** Quelqu'un qui venait
    de répondre à six questions de contrainte voyait une réponse qui n'en
    parlait pas. Il dit maintenant ce qui tient, et sur quoi.


### Partie 3 — Le questionnaire

| Fait | Preuve |
|---|---|
| Page « Par où commencer », cinquième entrée de la navigation | captures en clair et en sombre, à 360 et 1280 px |
| Huit questions, quatre écrans, deux par écran, questions restantes affichées | `npm run test:guide` — le compte suit les réponses, contrôlé au navigateur |
| Les questions suivantes dépendent des précédentes | la liste des tâches n'affiche que celles de la famille choisie ; « je ne sais pas » sur la famille retire la question et le compte passe de huit à sept |
| « Je ne sais pas » partout, et prise en compte | elle n'écarte aucune option et fait dire au verdict ce que l'option implique sur ce point |
| Arbre déterministe, aucun appel de modèle, rien ne sort de la page | `npm run check:third-party` ; le calcul est dans `src/lib/guide-verdict.mjs`, sans réseau |
| Arbre piloté par les données des fiches | familles, tâches, niveaux, sortie de données, déterminisme et testabilité viennent du contenu ; `src/lib/guide.ts` ne fait que les extraire |
| Chaque parcours aboutit à une fiche existante ou au message honnête | `npm run test:guide` — 32 400 verdicts par langue, toutes les combinaisons de réponses pour chacune des 25 fiches, sur la charge utile réellement livrée |
| Verdict explicatif, jamais une réponse seule | trois formes capturées et regardées : fiche désignée, famille sans tâche, aucune tâche |
| Le message pré-rempli avant l'issue GitHub | contrôlé au navigateur : la première des deux voies est un `mailto:` qui porte les réponses |
| Utilisable sans JavaScript | contrôle au navigateur avec JavaScript désactivé : les quatre écrans sont lisibles et la page renvoie aux dix familles |
| Poids | 19,0 Ko transférés, dont 3,1 Ko de JavaScript |
| Accessibilité et débordement | `check-a11y` et `check-overflow` sur les deux langues, au vert |


### Partie 4 — L'accueil

| Fait | Preuve |
|---|---|
| Trois portes nommées par ce que le visiteur sait déjà | captures en clair, en sombre, à 360 et 1280 px |
| Le questionnaire, les essais et le catalogue mis en avant, chacun avec son appel à l'action | hero à deux portes, trois cartes, bloc d'essai dans la démonstration |
| Le chiffre du catalogue, compté et non écrit | `Doors.astro` compte les verdicts N0 : vingt-cinq fiches, dont treize sans aucune IA |
| La démonstration raccourcie : douze lignes contre huit, le reste derrière un dépli | capture regardée ; le dépli prolonge le bloc et garde le code complet accessible |
| La phrase « Overkill n'est pas anti-IA » juste sous le hero | inchangée, capture regardée |
| Poids de l'accueil | 53,5 Ko transférés pour un budget de 250 Ko |
| Accessibilité et débordement | `check-a11y` et `check-overflow` sur les deux langues, au vert |


### Partie 5 — La page « Comment ça marche »

| Fait | Preuve |
|---|---|
| Une seule page, deux temps : l'explication simple puis la méthode | captures regardées en clair et en sombre, à 360 et 1280 px |
| Pourquoi une échelle, en trois paragraphes | la même tâche, deux solutions, et ce que le réflexe coûte |
| Les quatre niveaux, un bloc chacun : ce que c'est, ce que ça coûte, ce que ça garantit, ce qui le fait céder | capture du composant regardée |
| Un exemple tiré d'une vraie fiche pour chaque niveau | dérivé des verdicts publiés, donc impossible à périmer : `Levels.astro` prend la première fiche dont le verdict est ce niveau |
| La condition de montée entre chaque niveau | trois blocs, entre les quatre cartes ; c'est la valeur propre du site et elle n'était écrite nulle part |
| La phrase de clôture | « Le niveau le plus lourd n'est pas le mauvais choix. Il est le mauvais choix par défaut. » |
| La méthode conservée : verdict, vérification du code, prix, empreinte, couleur, réglementaire | contenu existant, repris et renuméroté en sous-sections |
| Version courte sur l'accueil : quatre blocs de deux lignes et un lien | capture de la bande regardée |
| « Barreau » retiré de la page, relu phrase par phrase | `grep -i barreau` sur les deux langues : plus aucune occurrence |
| Contrôles | `npm run check` au vert ; `check-a11y` et `check-overflow` sur les deux langues |


### Partie 6 — Le catalogue

| Fait | Preuve |
|---|---|
| Vingt-quatre cartes par page | `npm run test:catalogue` ; captures des deux pages regardées |
| L'appel à l'action jaune sur chaque page | contrôlé au navigateur sur la deuxième page |
| L'état de pagination dans l'URL, en chemin et non en paramètre | `/fr/catalogue` et `/fr/catalogue/2` sont deux vraies pages |
| Combinaison avec la recherche et les filtres | un filtre posé depuis la deuxième page retrouve les fiches de la première ; le compteur suit |
| Utilisable sans JavaScript | contrôle au navigateur avec JavaScript désactivé : la tranche demandée s'affiche, la pagination est faite de liens |
| L'architecture tient à deux cents fiches | `npm run build:fixtures` puis `test:search` : neuf pages, douze contrôles au vert, 24,6 Ko transférés par page |


### Partie 7 — Le contenu

| Fait | Preuve |
|---|---|
| Les 148 extraits exécutés | `npm run test:snippets` — 148 extraits, aucun échec ; et chaque niveau réexécuté hors de ses tests, sur des entrées choisies par le relecteur |
| Les 25 verdicts contestés | aucun renversé ; deux examinés longuement et laissés en place avec le doute écrit |
| Vingt-six affirmations fausses corrigées | détaillées plus haut, avec la mesure ou l'exécution qui les a démasquées |
| Deux extraits réparés | dont l'extrait N0 de l'OCR, qui répondait le contraire de la vérité sur le cas central de sa fiche |
| « Barreau » retiré des 25 fiches, relu phrase par phrase | `check-content` refuse désormais le mot dans une fiche, et le contrôle a été éprouvé en le réintroduisant |
| Les 74 docstrings d'en-tête traduites | `check-content` refuse une fiche publiée dont une docstring n'est pas traduite, et vérifie que la traduction ne change rien au code |
| La traduction ne touche que la docstring | comparaison caractère par caractère du corps, sur chaque extrait traduit, plus cinq contrôles unitaires |
| Les deux langues servies | capture des pages française et anglaise d'une même fiche : docstring traduite, commentaires en ligne et identifiants en anglais |
| Guillemets anglais dans les commentaires anglais | 86 fichiers repris, deux laissés à raison ; les 148 extraits compilent et passent |
| Apostrophe typographique dans la prose du contenu | 1 474 apostrophes, hors code et hors adresses ; `check-links` au vert |
| Dates de révision remontées | les 25 fiches portent la date de leur relecture |


### Défauts trouvés en regardant l'écran, et corrigés — parties 1 et 2

1. **L'adresse de contact s'affichait à l'envers** (`moc.liamg@olfuoaib`) sur
   toutes les fiches et sur l'accueil. Le CSS de portée automatique d'Astro ne
   marque pas le balisage injecté par `set:html`, donc la règle qui remettait
   l'adresse à l'endroit ne s'appliquait jamais. Les règles concernées sont
   désormais globales, et le commentaire du composant dit pourquoi.
2. **Un niveau sans objet était atténué à 0,55 d'opacité**, ce qui faisait
   passer son texte sous le seuil AA (`check-a11y`, deux violations
   « serious »). Le pointillé et le trait disent la même chose sans coûter la
   lisibilité.
3. **`check-weight` ne voyait pas le module d'essai**, chargé à la demande donc
   absent des balises `script` : il mesurait 3,8 Ko de JavaScript sur une fiche
   qui en télécharge 8,1. La page nomme son essai dans `data-tryout`, le
   contrôle suit ce lien, et il mesure maintenant la fiche la plus chargée en
   JavaScript et non seulement la plus lourde.
4. **Un tableau de résultats perdait ses dernières colonnes** dans la zone
   d'essai : la grille à deux colonnes laissait le tableau serré dans une
   demie dès qu'une phrase de commentaire occupait la seconde. Passé en flex,
   et un tableau de trois colonnes ou plus prend la largeur entière.
5. **Deux panneaux voisins portaient le même intitulé** « ce qu'il renvoie ».
   Chaque panneau porte désormais le sien : ce qu'il renvoie, ce qu'il en
   conclut, le détail, l'image produite.
6. **Un lien vers un niveau replié ne montrait rien** : le sommaire pointe vers
   des sections rangées dans un `details` fermé.

---

## Les décisions prises seul

### Partie 1

**La branche part de `design/fiche` et non de `main` nu.** `design/fiche` était
`main` plus un commit de cadrage qui contenait déjà le début de la refonte de la
fiche — la réponse en toutes lettres dans le bandeau, la disparition du tableau
à sept colonnes. Repartir de `main` aurait jeté ce travail pour le réécrire à
l'identique. La branche `lot14-experience` contient donc `main` plus ce commit.
*Écarté :* repartir de `main` nu.

**Les essais vivent dans `content/tryouts/`, pas dans `src/`.** Un essai décrit
ce qu'on donne à un extrait et ce qu'on en attend : c'est du contenu, au même
titre qu'une fiche, et un contributeur doit pouvoir en écrire un sans ouvrir le
code du site. *Écarté :* un bloc `tryout` dans le frontmatter de chaque fiche —
le YAML n'accueille pas la construction d'un index ou l'entraînement d'un
modèle, et il aurait fallu un langage d'expression pour dire quelle fonction
appeler.

**La forme interactive exécute l'extrait de la fiche dans le navigateur**, ce
qui renverse la décision de `docs/DECISIONS-CLARTE.md` section 5. Cette
décision visait un bac à sable WebAssembly de plusieurs mégaoctets ; elle ne
tient plus dès lors qu'on exécute l'extrait lui-même, quelques kilooctets de
JavaScript sans dépendance, qui sont précisément ce que la fiche recommande.
Refuser de le faire tourner aurait été un aveu. Le document est mis à jour.
*Écarté :* la zone d'essai entièrement figée.

**Sans JavaScript, la zone affiche le premier exemple, calculé à la
construction du site**, et une ligne dit que la saisie libre et les autres
exemples demandent JavaScript. La zone dit donc déjà quelque chose de vrai
avant le premier octet de script. *Écarté :* rendre les six cas au build pour
les lecteurs sans JavaScript — cela doublait le contenu de la page et ajoutait
du bruit pour les lecteurs d'écran.

**Sur les niveaux N2 et N3, ce qui est calculé est la plomberie** : ce que le
code envoie, ce qu'il refuse avant de dépenser, ce qu'il réessaie, ce qu'il
accepte. La réponse du modèle est simulée par le double local des tests, et
chaque essai le dit une fois, dans son propre `note`. C'est le même partage que
la mention « testé, service simulé ». *Écarté :* ne pas mettre de zone d'essai
sur ces fiches — le cas le plus utile du catalogue est justement là, le résumé
fluide et faux que le code accepte sans broncher.

**La preuve d'exécution devient une pastille dans la barre du bloc de code**,
forme courte visible, phrase complète au survol et pour les lecteurs d'écran.
*Écarté :* une note sous le code, qui recréait le bloc explicatif que le lot
demande de retirer.

**La nature d'un lien est déduite de son hôte**, avec un `kind` facultatif dans
le frontmatter pour corriger une déduction fausse. Le repli est « page web »,
qui est vrai de n'importe quelle adresse. *Écarté :* rendre `kind` obligatoire —
cinquante liens à saisir, et un champ que les contributeurs rempliraient au
hasard.

**Le vert de la recommandation passe par un rôle nommé, `--recommended`.** Le
contrôle de couleur réserve `--go` au composant du badge ; la carte du niveau
recommandé en a besoin aussi. Nommer le rôle rend chaque emploi lisible et
laisse la règle serrée. *Écarté :* ajouter `EntryLayout.astro` à la liste
d'exceptions du contrôle, ce qui aurait blanchi un fichier entier.

**Un seul thème de coloration syntaxique est rendu**, puisque le fond du code
ne suit plus le thème de la page. Chaque jeton portait deux couleurs dans le
HTML, une par thème ; il n'en porte plus qu'une.


### Partie 2

**La feuille de route publique est retirée.** Le document de lot la compte
parmi les décisions périmées, la nouvelle navigation ne la porte plus, et la
partie 8.4 lui substitue une page des dernières fiches et le flux RSS. Une page
qui annonce cent soixante-quinze fiches inexistantes est une promesse, et ce
site n'en fait pas. Les deux cents intitulés restent dans `content/roadmap.yaml`
— ils servent au jeu de test à deux cents fiches et aux contributeurs. Les
liens qui y menaient, sur l'accueil, le 404 et la page contribuer, renvoient
désormais au catalogue ou aux familles. `docs/CDC.md` est mis à jour aux
sections 6.2, 7.1, 7.4 et 7.11. *Écarté :* la garder en la vidant de ses
promesses, ce qui aurait laissé une page sans lecteur.

**Les pages légales n'ont pas d'appel à l'action.** Toutes les autres pages en
portent un. Une page de mentions légales n'a rien à proposer, et un appel à
l'action creux y serait pire que son absence. Ce n'est pas un retrait de
traitement : elles ont le même aplat d'en-tête, la même colonne, les mêmes
liens et les mêmes tableaux que les autres.

**Le sous-titre visible des pages éditoriales est leur description.** Elle
existait déjà, exacte et écrite pour ces pages, et elle ne servait qu'au
référencement. *Écarté :* écrire un second texte pour l'en-tête, qui aurait
été un doublon à maintenir.

**Les liens en cartes passent par un composant employable depuis MDX.** Les
pages éditoriales sont écrites en MDX et n'ont pas accès au dictionnaire
d'interface ; `<Links lang="fr" links={[…]} />` le leur donne sans qu'un
rédacteur ait à connaître le reste. *Écarté :* transformer les listes de liens
du Markdown par un greffon de rendu — impossible d'y deviner la nature d'un
lien sans son adresse, et cela aurait transformé aussi les listes qui doivent
rester des listes.


### Partie 3

**Le questionnaire a besoin de JavaScript pour enchaîner ses écrans.** Sans
lui, les quatre écrans restent lisibles et la page renvoie aux dix familles,
qui rangent le catalogue par ce qu'on veut faire. *Écarté :* pré-calculer un
arbre de pages statiques — huit questions à trois ou onze réponses font
cinquante mille pages, pour un outil qu'on parcourt une fois.

**Les contraintes choisissent un niveau, elles ne filtrent pas les fiches.**
Écarter une fiche parce que son option recommandée envoie des données chez un
tiers aurait caché le besoin au lieu de répondre. Le questionnaire garde la
fiche, et déplace la réponse vers le niveau qui satisfait la contrainte, en le
nommant. C'est ce qui produit un verdict explicatif plutôt qu'un tri.

**Le verdict garde le niveau de la fiche quand il satisfait la contrainte**,
même si un niveau plus bas la satisfait aussi. Descendre « parce que c'est plus
frugal » reviendrait à recommander une option dont la fiche a établi qu'elle ne
fait pas le travail. La frugalité est déjà dans le verdict de la fiche ; le
questionnaire ne la surenchérit pas.

**Les cartes du verdict sont clonées depuis un gabarit rendu par le site.** Le
verdict n'écrit pas de carte à la main : `EntryCard` est rendu au build dans un
`<template>`, que le module clone. Le format reste celui du catalogue sans
duplication de balisage, et un gabarit ne s'affiche pas sans JavaScript.
*Écarté :* reconstruire la carte en JavaScript, qui aurait fait diverger les
deux formats au premier changement.

**La charge utile ne porte que ce que le verdict calcule.** Le titre et le
besoin d'une fiche sont déjà dans la page — en option de question et en carte ;
les renvoyer en JSON, c'était payer deux fois les mêmes octets. Reste la
justification, les niveaux et leurs attributs : 10,6 Ko transférés sur les 19
de la page.


### Partie 4

**Deux portes dans le hero, trois détaillées juste après.** Le critère est de
dix secondes : deux boutons nommés suffisent à trancher entre « je sais ce que
je cherche » et « je ne sais pas », et les trois cartes qui suivent donnent à
chacune son argument. *Écarté :* un seul appel à l'action vers le
questionnaire, qui aurait fait passer un développeur venu chercher une tâche
par huit questions dont il n'a pas besoin.

**Le chiffre est compté à la construction.** « Sur vingt-cinq fiches, treize se
règlent sans aucune IA » est l'argument le plus vérifiable de la page : il est
dérivé des verdicts, et il restera vrai à la fiche suivante. *Écarté :*
l'écrire dans le texte, où il serait faux au premier ajout.

**La démonstration garde tout son code, replié.** Douze lignes contre huit
suffisent à montrer l'écart ; le reste est derrière un dépli plutôt que
supprimé, pour que personne n'ait à nous croire sur le fait qu'on ne l'a pas
arrangé.


### Partie 5

**L'exemple de chaque niveau est dérivé, pas écrit.** « Une fiche qui le
recommande » prend la première fiche publiée dont le verdict est ce niveau. Un
exemple écrit à la main aurait vieilli à la première fiche ajoutée, et cette
page est justement celle qui doit rester vraie. *Écarté :* citer une fiche
nommément dans le texte.

**Le texte éditorial des quatre niveaux vit dans le composant**, à côté de ce
qu'il commente, et non dans le dictionnaire d'interface : il n'est employé
qu'ici, et il se relit mieux d'un bloc. C'est la convention que suivent déjà
les composants de l'accueil.

**La seconde moitié passe en sous-sections d'un titre « La méthode, pour qui
creuse ».** Le lot demande une page en deux temps ; la hiérarchie des titres
devait le dire, pas seulement la mise en page.

**« Barreau » disparaît aussi de cette page**, ce qui révise la section 2 des
décisions de clarté — laquelle le conservait ici pour la métaphore de
l'échelle. La métaphore reste : elle se dit « échelle » et « niveau ». Le
document est mis à jour.


### Partie 6

**Vingt-quatre par page plutôt que trente.** La fourchette demandée est de
vingt-quatre à trente ; trente aurait donné une seule page sur les
vingt-cinq fiches d'aujourd'hui, donc une pagination invisible et non
vérifiable à l'écran. Vingt-quatre en donne deux. Conséquence assumée : la
deuxième page ne porte qu'une carte, et cela disparaît à la quarante-neuvième
fiche.

**Toutes les cartes restent dans le HTML de chaque page, les autres masquées.**
C'est ce qui permet à un filtre de porter sur le catalogue entier sans
recharger : sinon il n'aurait trouvé que dans les vingt-quatre fiches sous les
yeux, et son compteur aurait menti. *Écarté :* reconstruire les cartes en
JavaScript depuis l'index de recherche — cela dupliquait le format de carte
dans du code, et les deux auraient divergé au premier changement. Le prix est
mesuré : 24,6 Ko transférés par page de catalogue à deux cents fiches, contre
environ 6 Ko si la page ne portait que sa tranche. C'est la première chose à
reprendre si le catalogue dépasse les deux cents, et elle est notée comme
telle.

**La pagination s'efface quand un filtre porte**, et seulement à ce
moment-là : tant qu'un seul caractère est tapé, la recherche ne cherche pas
encore, et la deuxième page doit rester atteignable.


### Partie 7

**La docstring traduite vit à côté du code, pas dedans.** Un fichier
`doc.fr.yaml` par dossier d'extraits, rangé par niveau — une clé pour les deux
langages — ou par fichier quand les deux docstrings anglaises disent réellement
autre chose. Le fichier sur le disque, celui que les tests exécutent, garde sa
docstring anglaise. *Écarté :* deux fichiers d'extrait par langue, qui auraient
doublé le code exécuté et laissé les deux diverger.

**Le contrôle compare le corps du code, pas la confiance.** `check-content`
substitue réellement la traduction, puis compare caractère par caractère ce qui
suit la docstring. Une traduction qui toucherait au code fait échouer la
construction : c'est ce qui permet d'affirmer que le lecteur français voit le
même code que le lecteur anglais.

**L'apostrophe typographique dans la prose, l'apostrophe droite dans le code.**
Les trois relecteurs ont signalé l'incohérence : l'interface employait ’ et le
contenu '. Les 1 474 apostrophes de la prose sont passées en ’ — hors des
portions entre accents graves et hors des adresses. Les fichiers de code gardent
l'apostrophe droite, y compris les traductions de docstring, qui s'affichent
dans un bloc de code où l'ASCII est la convention.

**Un verdict ne change que si la fiche dit faux.** La consigne donnée aux
relecteurs était explicite : contester, démontrer, et ne pas substituer son goût
à celui de l'auteur. Aucun des vingt-cinq n'est tombé, et les deux cas limites
sont écrits comme tels plutôt que tranchés en silence.

**La latence annoncée mesure une décision sur une entrée.** Le cahier des
charges fixait cinq classes sans dire ce qu'elles mesurent, et la question s'est
posée sur les niveaux N1, où l'entraînement coûte mille fois la décision.
Tranché une fois, écrit sur la page « Comment ça marche », et appliqué : sept
fiches annonçaient `~10 ms` pour une décision qui se prend en moins d'une
milliseconde.

---

## Ce que j'ai volontairement laissé de côté

*Section à compléter au fil du lot.*

---

## Les mesures

*Section à compléter à la fin du lot.*

---

## Astro 7

*Partie 10. Section à compléter.*

---

## Les documents mis à jour

*Section à compléter au fil du lot.*

---

## Ce qui cassera en premier à 200 fiches

*Section à compléter à la fin du lot.*
