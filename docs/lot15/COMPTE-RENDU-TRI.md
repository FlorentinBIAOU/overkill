# Lot 15 — compte rendu du tri des tests en échec

Point de départ : douze fiches en échec sur vingt-cinq, **72 tests distincts**
(110 exécutions : 45 en Python, 65 en JavaScript, un test dit dans les deux
langages comptant ici pour un). Le tri complet, test par test, est dans
`TRI-TESTS.md` ; ce document n'en donne que le résultat.

## Les chiffres

| | |
|---|---|
| Tests jugés **exigences** | **47** |
| Tests jugés **constats** | **25** |
| dont retirés, ne prouvant plus rien | 5 |
| Corrections de code | **4 extraits N3**, une règle |
| Fiches remises au vert | 12 |
| Commits | 16, un par fiche traitée plus les documents |

## Ce que le tri a montré

**Les douze fiches n'avaient pas de bug : elles avaient des tests périmés.** La
passe 2 a corrigé les vingt-cinq fiches ; douze n'ont pas eu leur
contre-épreuve, la session ayant été coupée. Les tests décrivaient donc un code
qui n'existait plus. Chaque section « À retester » de
`docs/lot15/corrections/<id>.md` annonce, ligne par ligne, exactement la rupture
qu'on observait — le travail était cadré, il n'avait pas été fait.

Corriger le code pour satisfaire ces tests aurait défait la passe 2. Aucune des
47 exigences ne demandait donc de toucher au code : elles étaient déjà tenues,
souvent mieux qu'avant, et c'est leur formulation ou leurs paramètres qui avaient
vieilli.

**Quatre divergences Python / JavaScript ont été closes par la passe 2**, à peu
de frais : plafonds comptés en points de code plutôt qu'en unités UTF-16, `[0-9]`
au lieu de `\d`, caractères de format retirés avant comparaison, `str(value)`
avant `re.fullmatch`. Les six tests qui les documentaient deviennent des
assertions de parité. Une divergence subsiste, structurelle :
`sshleifer/distilbart-cnn-12-6` en Python, sa conversion ONNX `Xenova/…` en
JavaScript. Elle est écrite dans le commentaire de `n2.js`.

## Ce que j'ai corrigé dans le code

Une seule chose, trouvée en jugeant les tests nos 41, 61 et 70, qui portent tous
sur le même chemin de code : la décision 12 du lot, reprise mot pour mot par la
charte des tests, veut qu'une réponse de modèle entièrement enveloppée dans une
seule clôture ```` ```json … ``` ```` soit décodée, et que **tout** autre écart
lève — « texte avant ou après, deux blocs, clôture non refermée ».

Trois extraits N3 l'écrivaient correctement. Quatre — `detect-spam-in-contact-form`,
`extract-fields-from-invoice`, `summarise-a-long-document`, `tag-articles-by-topic` —
retiraient préfixe et suffixe indépendamment, si bien qu'une clôture ouverte et
jamais refermée était décodée comme une réponse valide. C'est une exigence, pas
un constat : la charte dit ce que le code doit faire, et le code ne le faisait
pas.

Corrigé dans les quatre, Python et JavaScript, en recopiant la forme des trois
autres : une ligne de condition, aucun allongement de l'extrait. Chacun reçoit
son cas de test — clôture non refermée, prose autour d'une clôture — dans les
deux langages.

## Ce que j'ai retiré

Cinq tests, qui ne prouvaient plus rien :

- **Quatre décomptes de lignes** (`convert-messy-csv-to-clean-data` ×2,
  `detect-spam-in-contact-form`, `route-support-tickets`) marqués `INFIRMÉ`. Ils
  épinglaient à l'unité près la longueur d'une fonction pour contredire une
  phrase du type « ce classifieur tient en quarante lignes ». Ces phrases ont été
  retirées des docstrings à la passe 2 : le test contredisait le vide.
- **Les sept tests d'essai de `extract-fields-from-invoice/n2.test.js`**, qui
  importaient `content/tryouts/frozen/extract-fields-from-invoice.js`, supprimé
  quand la fiche est passée en brouillon. Le fichier ne se chargeait plus du
  tout : les vingt et un autres tests N2 JavaScript de cette fiche ne tournaient
  pas non plus, et sont revenus au vert du même coup.

Une ligne isolée, aussi : dans `validate-a-form-server-side/n0.test.js`, le test
des bornes portait deux assertions contradictoires sur la même entrée — « 🙂 »
refusé, puis accepté. Reste d'une enveloppe `assert.throws` défaite à la main.

## Le garde-fou

Aucun extrait n'a grossi. La seule correction de code remplace une ligne par
trois, dans quatre fichiers, sans toucher à la logique de l'approche.

Deux endroits où j'ai préféré documenter plutôt que corriger, et je les nomme :

1. **`detect-anomalies-in-metrics`, l'espace ordinaire de « 4 800 »** — lue comme
   deux minutes, quand l'espace fine et l'insécable sont lues comme un séparateur
   de milliers. Corriger demanderait de deviner, dans une suite de nombres
   séparés par des espaces, lesquelles séparent des chiffres et lesquelles des
   points. La limite est écrite dans la note de l'essai, et le test la démontre
   désormais au lieu de la marquer `DÉFAUT`.
2. **`summarise-a-long-document`, le nom du dépôt du modèle N2** — mêmes poids,
   deux dépôts, parce que JavaScript charge une conversion ONNX. Les aligner est
   impossible ; la divergence est dans le commentaire de `n2.js`.

## Ce dont je ne suis pas sûr

- **`search-in-your-own-documents/n3` porte une troisième variante du décodage de
  clôture**, plus permissive encore que celle que j'ai corrigée : dès que la
  réponse commence par une clôture, elle coupe la première ligne et tout ce qui
  suit la dernière clôture. La fiche est hors des douze en échec, sa
  contre-épreuve a été faite, sa suite est verte. Je ne l'ai pas touchée : il
  faudrait reprendre ses tests, qui ne me sont pas confiés. **À trancher au tour
  suivant** — soit les sept extraits N3 écrivent la même règle, soit la charte
  admet plusieurs lectures.
- **La contre-épreuve complète des douze fiches reste à faire.** Ma mission
  portait sur les tests en échec ; les sections « À retester » des relevés
  demandent en plus des dizaines de cas nouveaux (nouvelles bornes, nouveaux cas
  de production, parité py/js sur des entrées que personne n'a encore essayées).
  Ils ne sont pas écrits.
- **Des noms de tests mentent encore.** Une trentaine de tests démarqués par le
  rédacteur gardent un nom, un commentaire ou une docstring qui décrit le défaut
  d'avant (`test_defaut_…`, « le plafond compte des unités UTF-16 », « Python
  lève csv.Error »). J'ai repris ceux que je touchais ; les autres restent. La
  charte dit qu'une fiche publiée ne garde aucun marquage `INFIRMÉ` ou `DÉFAUT` à
  la fin du lot qui les a posés : ces noms-là ne font pas échouer la suite, mais
  ils la rendent fausse à la lecture.
- **Quelques marquages `xfail(strict=True)` et `assert.rejects` subsistent** dans
  les douze fiches, sur des affirmations que le rédacteur n'a pas traitées. Ils
  passent, donc la suite est verte, mais ils décrivent des défauts qu'il faudra
  lever ou assumer.
- **`extract-fields-from-invoice` est en brouillon** et le reste : son essai a été
  supprimé, et je n'ai pas eu à juger si son niveau recommandé tient. Ses tests
  N2 JavaScript tournent de nouveau, ce qui est un progrès, pas un verdict.

## État à la fin

```
npm run test:snippets   OK — 148 extraits exécutés, 25 fiches, aucun échec
npm run check:fast      OK
```
