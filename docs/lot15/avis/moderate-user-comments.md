# moderate-user-comments — avis du relecteur

## Tour 1 — REFUSÉE

`node scripts/test-snippets.mjs moderate-user-comments` : vert, 4 py, 4 js.

### Raisons du refus

1. **[pertinence technique]** N2, `MODEL_NAME = "unitary/unbiased-toxic-roberta"`.
   Ce modèle est entraîné sur Civil Comments, **en anglais**, à partir de
   `roberta-base`. Le site est bilingue et son public est d'abord francophone ;
   la fiche du modèle, consultée, propose elle-même une variante
   `multilingual` (base `xlm-roberta-base`), à n'employer que sur sept langues
   dont le français. Rien dans la fiche Overkill ne dit que le niveau
   recommandé ne vaut que pour des commentaires anglais : un lecteur qui le
   branche sur un forum français obtient des notes sans valeur, sans erreur.
   Les exemples de la fiche sont tous en anglais, ce qui masque le problème.

   Ce qu'il faut faire : soit nommer la variante multilingue dans l'extrait
   (identifiant exact vérifié sur Hugging Face, liste des étiquettes vérifiée,
   car elle diffère de la version anglaise), et adapter `HARM_LABELS` ; soit
   écrire dans le `name` ou le `breaking_point` de N2 que le modèle nommé ne
   note que l'anglais, et dans le verdict ce qu'il faut prendre pour un site
   français. Citer la fiche du modèle pour la langue. C'est fait quand
   l'identifiant et la liste d'étiquettes de l'extrait correspondent à la
   langue annoncée.

2. **[solidité du verdict, pertinence technique]** N3 : `cost: élevé`, extrait
   qui fait noter quatre catégories par un modèle de conversation. Le
   fournisseur pris en exemple par tout le catalogue publie un point d'accès
   de modération **dédié et gratuit** (`omni-moderation-latest` ; la page
   « Moderation » de sa documentation : « The moderation endpoint is free to
   use »). Personne qui a ce fournisseur sous la main ne paie un modèle de
   conversation pour noter « harassment, hate, violence, self_harm », qui sont
   précisément des catégories du point d'accès gratuit. Le coût déclaré est
   donc celui d'une approche qu'on ne retiendrait pas.

   Et la seule raison valable de préférer un modèle de conversation — définir
   **sa propre** catégorie, celle qu'aucun classifieur n'a — n'est pas
   exploitée : le `breaking_point` de N2 montre la divulgation d'un domicile,
   le verdict dit que N3 « ne se défend que si le préjudice qui vous occupe n'a
   d'étiquette nulle part », et `CATEGORIES` ne contient pas cette catégorie.

   Ce qu'il faut faire, au choix :
   - N3 sur le point d'accès de modération dédié : `cost` révisé (le coût
     marginal n'est pas facturé ; garder la sortie de données et la taxonomie
     héritée comme inconvénients), `breaking_point` sur la taxonomie imposée ;
   - ou garder le modèle de conversation, et **ajouter la catégorie que N2 n'a
     pas** (divulgation d'informations personnelles d'un tiers) à
     `CATEGORIES` et au prompt, avec un test qui vérifie qu'elle est demandée,
     et écrire dans le `name` ou la docstring pourquoi on n'emploie pas le
     point d'accès dédié.
   Dans les deux cas, vérifier la page du fournisseur au moment de la
   rédaction et la citer en `sources`.

3. **[preuves]** Marquages `INFIRMÉ` / `DÉFAUT` encore actifs (`xfail(strict=True)` en Python, `assert.rejects` en JavaScript). La charte des tests et la mission sont nettes : une fiche publiée n'en garde aucun à la fin du lot. Un marquage strict passe dès que le corps du test lève, **pour n'importe quelle raison** : un marquage oublié ne prouve plus rien et peut masquer une régression.

   - `n0` (py, js), `INFIRMÉ` : l'ordre casefold / NFKD, et le commentaire de `n0.js` qui dit que « ß » et « ς » sont les deux seules lettres où les deux replis divergent. **Vivant** : parité Python / JavaScript non tenue sur les formes de compatibilité, donc une insulte écrite en lettres mathématiques est trouvée dans un langage et pas dans l'autre.
   - `n0` (py, js), `DÉFAUT` : une voyelle dépendante du devanagari coupe le mot. **Vivant**.
   - `n1.test.js`, `DÉFAUT` : un commentaire fait de trois espaces note 0,71, au-dessus du seuil. **Vivant** : un formulaire vide envoyé en modération.
   - `n3` (py, js), `DÉFAUT` : une réponse dans une seule clôture ```` ```json ```` n'est pas décodée ; trois appels puis `ModerationUnavailable`. **Vivant**, contraire à la décision 12.

   Ce qu'il faut faire : NFKD avant le repli de casse dans les deux langages ; ne retirer que les diacritiques latins ; rendre « allow » sans appel pour un commentaire blanc ; décoder la clôture unique ; démarquer.

### Remarques non bloquantes

- `verdict_rationale` : « le premier niveau qui arrive déjà entraîné sur les
  commentaires étiquetés d'un défi public » — le mot « unbiased » du modèle
  désigne le défi « Unintended Bias » ; la fiche le dit bien comme une
  réduction des biais d'identité, pas une absence de biais. Rien à changer,
  mais le relier au point 1 : ce corpus est américain.
- `MAX_CHARACTERS` de N3 lève sur un commentaire long ; un commentaire de
  4 001 caractères n'est pas une anomalie sur un forum. Le commentaire dit que
  l'appelant décide : dire dans le verdict ce qu'il décide (relecture humaine).
- N2 : `truncation=True` ne note que le début d'un commentaire long ; une
  insulte à la fin passe. Le commentaire du code le dit, le `breaking_point`
  pourrait le dire.
- La bande de relecture à deux seuils (0,6 / 0,9) : valeurs d'exemple sans
  source. Les présenter comme des valeurs à étalonner sur un échantillon
  relu, pas comme des défauts raisonnables.

### Ce qui est solide

- Le `scenario` est le meilleur des vingt-cinq sur le fond : la difficulté est
  l'emploi du mot, pas le mot, et une décision de modération doit pouvoir être
  expliquée. C'est ce que le règlement sur les services numériques exige des
  plateformes, et la fiche le cite sans en faire un conseil juridique.
- Le repli sur « review » quand le modèle ne rend rien d'utilisable, au lieu
  de « allow », est exactement le réflexe qu'on veut voir copié.
- Le `breaking_point` de N0 (le signalement signalé comme l'insulte) est
  démontré des deux côtés, et le `breaking_point` de N2 cite la fiche du
  modèle plutôt que d'inventer son comportement.
