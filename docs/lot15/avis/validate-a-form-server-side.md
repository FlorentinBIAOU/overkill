# validate-a-form-server-side — avis du relecteur

## Tour 1 — REFUSÉE

`node scripts/test-snippets.mjs validate-a-form-server-side` : vert, 1 py, 1 js.

### Raisons du refus

1. **[vérité du point de rupture, pertinence technique]** `breaking_point` de N0,
   deuxième exemple : « un pseudonyme fait de deux espaces : `min` compte des
   caractères, une espace en est un, et le profil s'affiche vide ». Ce n'est
   pas une limite de l'approche, c'est une règle absente. Aucun validateur de
   production ne compte les espaces de bord : on retire les blancs en tête et
   en queue avant de contrôler — la norme HTML le fait elle-même pour la valeur
   d'un champ `type=email`. La fiche présente comme une frontière de ce que
   « aucune règle ne peut dire » ce qu'une ligne de code règle. Le même défaut
   a deux conséquences que la fiche ne dit pas :
   - un champ **obligatoire** rempli d'espaces passe `required` (seuls `None`
     et `""` sont traités comme absents) ;
   - une adresse `" ada@example.com"`, avec l'espace qu'ajoute la saisie
     semi-automatique d'un téléphone, est **refusée** par le motif, et
     l'utilisateur ne voit pas pourquoi.

   Ce qu'il faut faire : retirer les blancs de bord des chaînes avant tout
   contrôle (et traiter une chaîne vide après retrait comme absente), dans les
   deux langages, avec les trois cas ci-dessus en test ; retirer l'exemple du
   pseudonyme blanc du `breaking_point`, qui garde l'adresse bien formée et
   inexistante — celle-là est une vraie limite. Si le rédacteur veut garder un
   second exemple, un pseudonyme fait de caractères invisibles (U+200B) en
   serait un honnête, à condition de le démontrer.

2. **[preuves]** `n0.test.py` / `n0.test.js`, `DÉFAUT` : « un même motif n'a pas
   le même sens côté navigateur et côté serveur » (`\d` Python accepte
   « ١٢٣٤٥ », `\w` JavaScript refuse « Zoé »). Marquage encore actif, que la
   charte interdit à la fin du lot. La docstring a été corrigée pour
   prévenir le lecteur (« write [0-9] and [A-Za-z] ») : le défaut est donc
   désormais **documenté**, et le test doit le **démontrer** sans marquage — le
   motif `\d{5}` accepte les chiffres arabes-indiens en Python et les refuse en
   JavaScript, `[0-9]{5}` les refuse dans les deux. Au passage, `[A-Za-z]`
   refuse « Zoé » : le conseil de la docstring règle la parité en cassant les
   prénoms accentués. Il faut soit le dire, soit conseiller `\p{L}` en
   JavaScript avec le module `regex` en Python (dépendance) ou une liste de
   lettres explicite.

### Remarques non bloquantes

- `verdict_rationale`, dernière phrase : « Les trois niveaux au-dessus
  échangeraient cette propriété contre une décision qu'on ne peut ni rejouer ni
  justifier, **ce qui est exactement ce qu'on demande à une validation** ». La
  relative se rattache à « une décision qu'on ne peut ni rejouer ni justifier »
  et dit le contraire de ce qui est voulu. Écrire : « …ni justifier, alors que
  c'est exactement ce qu'on demande à une validation : pouvoir la rejouer et la
  justifier. » Même inversion en anglais (« which is precisely what a
  validation is asked for »).
- Aucune longueur maximale par défaut : un champ sans `max` accepte un texte de
  plusieurs mégaoctets, et le motif s'y applique. Le schéma est écrit par le
  développeur, donc c'est une recommandation, pas un défaut : « toute chaîne
  devrait porter un `max` » dans la docstring.
- La docstring d'en-tête affirme « a validator worth having fits in forty
  lines » : c'est la thèse du site, mais la phrase est invérifiable telle
  quelle et le lot a retiré ses sœurs dans d'autres fiches (« ce classifieur
  tient en quarante lignes »). La retirer ou la démontrer.

### Ce qui est solide

- Le cas est réel et le verdict est le seul défendable : une règle de
  formulaire se lit, se teste et se montre à qui la conteste. Refuser N1, N2 et
  N3 avec des raisons de structure (rien à apprendre, rien à rejouer, la saisie
  qui pèse sur son propre verdict) est juste.
- Les décisions de conception sont celles d'un praticien : le schéma comme
  donnée partagée avec le navigateur, un message par champ, le champ non
  déclaré refusé plutôt qu'ignoré (l'attaque par affectation de masse),
  `bool` exclu d'`integer`.
- Le point de rupture principal (adresse bien formée, boîte inexistante) est
  la vraie frontière, et l'`escalate_when` dit honnêtement qu'aucun niveau au-
  dessus n'y répond.
