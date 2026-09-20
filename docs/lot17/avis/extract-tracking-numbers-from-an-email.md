# extract-tracking-numbers-from-an-email — avis du relecteur

## Tour 1 — REFUSÉE

La fiche est bien construite et l'arithmétique est juste. J'ai recalculé le
chiffre de contrôle de la norme UPU S10 à la main — somme pondérée 8, 6, 4, 2,
3, 5, 9, 7, reste modulo onze — sur `12345678` : il donne bien 5, et
`RR123456785FR` ressort `checked: true` là où `RR123456784FR` ressort refusé
avec sa raison. La propriété que le test mesure est de surcroît démontrable :
onze est premier et aucun poids ne lui est congru, donc **toute** substitution
d'un chiffre est attrapée ; et aucune différence de poids voisins
(2, 2, 2, −1, −2, −4, 2) n'est congrue à zéro modulo onze, donc **toute**
transposition voisine l'est aussi. Les soixante-douze et les sept du test ne
sont pas un échantillon, ce sont tous les cas.

Le refus porte sur deux affirmations qui ne sont pas vraies.

### Raisons du refus

1. **« this family carries nothing to check » est faux pour UPS.** C'est la
   valeur de `why` rendue pour la famille `ups`, qui est dans
   `DEFAULT_FAMILIES`, et c'est repris dans le `verdict_rationale` : « Une
   famille sans chiffre de contrôle est une forme, pas une identification ».
   Un numéro UPS en porte un : le dix-huitième caractère d'un numéro `1Z` est
   une clé calculée sur les quinze précédents, lettres converties en chiffres,
   somme pondérée 1 et 2 en alternance, complément à la dizaine supérieure.
   Je l'ai vérifiée sur l'exemple canonique `1Z999AA10123456784` : la somme
   fait 96, la clé vaut donc 4, et c'est bien le dernier caractère du numéro.

   Le rapport de lot dit la chose exacte — « les calculs n'ont pas été trouvés
   dans une source publiée par les transporteurs ; l'extrait ne les invente
   pas et le dit » —, mais ce n'est pas ce que le code dit. « Cette famille ne
   porte rien à vérifier » est une affirmation sur la norme ; « cette clé n'est
   pas calculée ici, faute de source publiée par le transporteur » est une
   affirmation sur le code, et c'est celle qui est vraie. La distinction
   compte parce que la fiche est bâtie sur elle : vérifié contre
   non vérifiable. Deux `why` distincts — `not verified here` pour `ups`,
   `nothing to check` pour `ten-digits` — et la phrase du verdict corrigée.
   Mieux encore : le calcul tient en huit lignes, je viens de le faire ; rien
   n'oblige à s'en priver.

2. **Le point de rupture cite un exemple que le test ne contient pas.**
   `breaking_point`, fr et en : « demander la famille « dix chiffres » […]
   rend aussi le numéro de commande **et le numéro de téléphone** du même
   message ». Le message du test (`n0.test.py:10-18`) porte un numéro de
   commande à dix chiffres et **aucun numéro de téléphone**. L'affirmation est
   vraie — j'ai vérifié qu'un `0123456789` collé dans le message ressort en
   famille `ten-digits` —, mais elle n'est démontrée nulle part, alors que la
   charte des tests demande une assertion par cas cité. Ajouter le numéro de
   téléphone au message de test, sous la forme sans espaces qu'un courriel
   d'expédition emploie, et l'asserter.

### Remarques non bloquantes

1. **Le téléphone écrit à la française échappe à la famille.**
   `01 23 45 67 89`, avec ses espaces, n'est pas attrapé ; `0123456789` l'est.
   Cela affaiblit un peu l'argument du point de rupture pour un lecteur
   francophone, dont les courriels portent plutôt la forme espacée. Le
   remplacer par un exemple plus solide — une référence de commande, un numéro
   de client, un numéro de contrat — ou dire que c'est la forme compacte qui
   est attrapée.

2. **Le `why` de refus de la clé S10 est bon, celui de la famille est
   générique.** `the check digit does not match the serial number` dit
   exactement ce qui ne va pas. Les familles sans vérification partagent une
   seule phrase ; une par famille coûterait deux lignes et vaudrait mieux.

3. **R11 — `breaking_point` de 103 mots et trois phrases.** Voir la synthèse.

### Ce qui est solide

- Aller lire la norme à la source, reproduire son exemple, et **mesurer ce que
  le contrôle vaut** plutôt que de l'affirmer : c'est le meilleur usage d'un
  chiffre de contrôle dans tout le catalogue, et la propriété mesurée est
  exacte au sens mathématique.
- Le refus de chercher par défaut les familles sans contrôle, avec la raison :
  « un rapport où le numéro de téléphone du pied de page apparaît comme un
  colis est un rapport qu'on cesse de lire ». C'est du vécu d'exploitation.
- Les indicatifs de service réservés par la norme — J, K, S, T, W — écartés
  bien qu'ils aient la bonne forme. J'ai vérifié : `SA123456785GB` ne ressort
  pas. C'est le genre de détail qu'on ne trouve qu'en lisant la norme.
- Le champ `checked` sur chaque ligne, avec `why` quand il est faux : la
  distinction entre « trouvé » et « vérifié » est portée par la donnée, pas par
  la prose.
- L'`escalate_when` sort de l'échelle par le bon côté : savoir où est le colis
  est l'interface du transporteur, appelée avec le numéro que ce niveau a
  vérifié. La chaîne entre les deux est écrite.
- Le `regulatory` dit une chose juste et non évidente : un numéro de suivi relie
  une adresse de livraison à une personne.
