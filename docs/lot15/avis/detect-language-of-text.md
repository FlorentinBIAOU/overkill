# detect-language-of-text — avis du relecteur

## Tour 1 — REFUSÉE

`node scripts/test-snippets.mjs detect-language-of-text` : vert, 3 py, 3 js.

### Raisons du refus

1. **[solidité du verdict]** `verdict_rationale` et `escalate_when` de N0. Le
   verdict repose sur une seule idée : « N0 l'emporte sur le point qui décide de
   tout ici : savoir quand se taire. Son seul signal est l'écart entre les deux
   premières langues, et cet écart s'effondre exactement là où il le faut ». Il
   reproche ensuite à N1 de laisser passer « chat » en anglais. Or N0 fait
   pareil, **avec un écart énorme** : exécuté avec les profils du test,
   `ranked("chat")` rend `en 158, es 300, fr 300`. L'écart entre les deux
   premières vaut 142 sur une échelle de 300 : c'est un des écarts les plus
   confiants qu'on puisse obtenir, sur une réponse fausse. Le signal ne
   « s'effondre » pas sur le mot court, il s'effondre sur « ça va » et sur le
   message bilingue, et il crie victoire sur « chat ». L'`escalate_when` de N0
   (« vous voyez l'écart tomber à zéro ») ne se déclenchera donc pas sur le cas
   même que cite le `breaking_point`.

   Autres mesures, mêmes profils : « Password reset » → `fr 238, en 241` (N0 se
   trompe, écart 3, il s'abstiendrait — bien) ; allemand → `fr` écart 5 ;
   portugais → `es` écart 10. Le signal d'écart est utile, pas fiable sur les
   mots isolés.

   Ce qu'il faut faire : réécrire le verdict pour qu'il ne reproche pas à N1 ce
   que N0 fait aussi. Soit l'argument devient le message bilingue seul (là, N0
   hésite et N1 sature : c'est démontré), et « chat » est dit comme un échec
   **commun aux deux niveaux, que ni l'écart ni la probabilité ne signalent** ;
   soit le verdict change. Corriger `escalate_when` de N0 : un mot isolé peut
   sortir faux avec un grand écart, l'événement observable est donc la
   longueur du texte (« vos textes tiennent en un ou deux mots »), pas l'écart.
   Ajouter le test : `gap("chat")` est grand **et** la réponse est `en`, en
   Python et en JavaScript. C'est fait quand plus aucune phrase de la fiche ne
   présente l'écart de N0 comme un détecteur d'erreur sur les textes courts.

2. **[pertinence technique, verdict]** `N2.unavailable_reason` et
   `escalate_when` de N1. Le lecteur qui doit reconnaître une langue sans
   échantillon est envoyé directement à N3, coût `élevé`, données chez un
   tiers. En production, ce besoin se règle par une bibliothèque locale
   d'identification de langue — le modèle de fastText que la fiche cite, ou
   CLD3, ou lingua, ces deux derniers sous licence Apache 2.0. La raison
   donnée pour écarter N2 ne tient pas : la licence CC BY-SA 3.0 des poids
   fastText impose l'attribution et le partage à l'identique **des
   adaptations** ; embarquer le fichier tel quel n'est pas un obstacle, et
   d'autres modèles dédiés n'ont même pas cette contrainte. « Un artefact tiers
   à embarquer et à suivre » est vrai de `scikit-learn` en N1 aussi.

   Ce qu'il faut faire : soit rendre N2 disponible (un extrait fondé sur un
   identifiant dédié, testé contre un double si le modèle ne peut pas être
   embarqué hors ligne, `verification: stubbed`, comme les N3), soit récrire
   `unavailable_reason` avec une raison qui tient — et dans tous les cas faire
   pointer `escalate_when` de N1 vers cette solution locale avant N3. Le
   `verdict_rationale` doit alors dire en une phrase que la couverture de
   dizaines de langues relève d'un identifiant dédié local, pas d'un appel de
   modèle généraliste. Vérifier la licence et le nombre de langues de la
   bibliothèque nommée sur sa page officielle, et citer la page.

3. **[pertinence technique]** `n3.py` et `n3.js`, `MAX_CHARACTERS = 8000` et son
   commentaire « Refusing oversized input […] is a cost control ». L'extrait
   n'envoie que les 600 premiers caractères (`EXCERPT_CHARACTERS`) : le coût est
   déjà borné par l'extrait, le plafond ne contrôle rien. En revanche, il fait
   lever `ValueError` sur le premier courriel de 8 001 caractères, qui aurait
   été détecté sans surcoût. Un détecteur de langue qui plante sur les messages
   longs, c'est un incident garanti sur une file de support.

   Ce qu'il faut faire : supprimer le plafond et garder l'extrait, ou le
   remplacer par une garde sur ce qui coûte réellement (rien, ici). Retirer la
   phrase « is a cost control » pour le plafond. Remplacer
   `test_production_exactement_8000_caracteres_passent_et_8001_sont_refuses`
   par un test qui envoie cent mille caractères et vérifie que la requête ne
   contient que l'extrait. Deux langages.

### Remarques non bloquantes

- Le `scenario` affirme que le modèle entier « tient dans quelques centaines
  de chaînes de trois lettres ». Vrai du code (`PROFILE_SIZE = 300`), mais un
  profil tiré d'un paragraphe n'est pas le profil de Cavnar et Trenkle, bâti
  sur des corpus. La précision de N0 sur des textes réels dépend surtout de la
  taille de l'échantillon : une phrase dans la docstring (« un paragraphe suffit
  pour la démonstration, prenez plusieurs pages en production ») éviterait
  qu'on déploie les échantillons du test.
- `ranked` ne donne aucun ordre de grandeur de seuil d'écart, et l'échelle
  dépend de `PROFILE_SIZE`. Le lecteur ne sait pas où couper.
- La boucle de réessai N3 attrape toute exception, erreurs de programmation
  comprises (relevé par le rédacteur) : trois appels facturés pour une
  `TypeError`. Attraper les erreurs du client et de décodage suffit.

### Ce qui est solide

- Le cas est réel, et le constat « la difficulté est de savoir se taire » est
  exactement le bon angle.
- Le point de rupture de N1 (saturation sur le message bilingue, langue
  inconnue rabattue sur une langue apprise) est vrai, démontré, et c'est la
  leçon qu'on apprend en production.
- Le `breaking_point` de N3 ne prête pas au modèle ce que le double écrit :
  il dit ce que l'extrait lit et ne lit pas, et le test le prouve.
- Les sources (article de Cavnar et Trenkle, page fastText, RFC 5646) ont été
  lues et les corrections du tour précédent sont exactes.
