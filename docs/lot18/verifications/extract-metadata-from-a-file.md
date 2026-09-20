# extract-metadata-from-a-file — vérification du lot 18

Avis : `docs/lot17/avis/extract-metadata-from-a-file.md` (REFUSÉE).

## Les motifs de refus, un par un

### 1. Une partie de métadonnées illisible rendait « aucune métadonnée » — levé

### 2. Même chose pour une partie écartée par le plafond — levé

Les deux ont le même correctif, celui que l'avis demande : **nommer**. Le
rapport porte un champ `unread_parts`, une liste de `{part, why}` avec deux
raisons distinctes, `malformed XML` et `over the size cap`. C'est la mécanique
déjà écrite pour `comments.xml` et `settings.xml`, appliquée cette fois à la
partie centrale.

Le critère d'acceptation de l'avis, dans les deux langages :

```
docProps/core.xml tronqué en transit
  {"format":"ooxml","fields":{"company":"Cabinet Lumière"},"other_parts":[],
   "unread_parts":[{"part":"docProps/core.xml","why":"malformed XML"}],"reason":null}

docProps/core.xml au-dessus du plafond
  {"…","unread_parts":[{"part":"docProps/core.xml","why":"over the size cap"}],"…"}
```

Les deux cas entrent dans les deux jeux de tests et dans `TOUS`, donc dans le
test de parité. Le témoin est dans le même test : un document qui ne déclare
réellement aucun auteur rend `unread_parts: []`, et les deux rapports ne se
confondent plus.

Le reste du document est lu dans les deux cas — `company` vient de `app.xml` —,
ce qui est T8 : une partie sale ne fait pas tomber le document.

**Un défaut trouvé en chemin, côté JavaScript.** `XMLParser` de
`fast-xml-parser` est indulgent : sur le `core.xml` tronqué il ne lève pas, il
rend `{coreProperties: {creator: ''}}`. Le `continue` du JavaScript n'était
donc jamais atteint, et les deux langages ne se seraient pas accordés sur
`unread_parts`. La validation passe désormais par `XMLValidator.validate`
avant l'analyse, avec le commentaire qui dit pourquoi. C'est le genre d'écart
que seul le test de parité trouve, et c'est le deuxième de cette fiche.

## Les remarques non bloquantes

### 1. `OTHER_PARTS` cherchait des sous-chaînes — levée

La marque n'est cherchée que dans les dossiers qu'ECMA-376 fixe — `word/`,
`xl/`, `ppt/`, `docProps/`. Un test porte les deux cas :
`media/settings-du-client.png` n'est plus une partie de réglages,
`word/media/settings-du-client.png` en reste une, ce qui est voulu.

### 2. `revision` manquait la prudence de `TotalTime` — levée

Le commentaire dit ce qu'OOXML en dit : le nombre d'enregistrements, pas un
numéro de version, « although it is read as one ».

### 3. Le périmètre s'arrête à OOXML et la fiche disait « un fichier » — levée

Le point de rupture le dit maintenant, avec l'exemple de l'ODT et la raison
rendue.

### 4. R11 — point de rupture de 82 mots et trois phrases

Réécrit : 57 mots en français, 59 en anglais, deux phrases. La fiche sort de la
dette R11.

## R14

`not a ZIP container, so not an OOXML document` était assertée par un
`startswith("not a ZIP")` de dix caractères. Elle est citée mot pour mot dans
les deux langages, à côté de l'autre refus, qui est une situation distincte et
a sa propre raison. La fiche sort de `dette-raisons.json`.

## Preuve

```
$ node scripts/test-snippets.mjs extract-metadata-from-a-file
  ok        extract-metadata-from-a-file       1 py, 1 js
test-snippets : OK — 2 extrait(s) exécuté(s), aucun échec

$ npm run check:rupture
check-longueur-rupture : OK — 208 point(s) de rupture, 153 encore en dette, aucun nouveau dépassement
$ npm run check:raisons
check-raisons : OK — 169 raison(s) …; 13 fiche(s) encore en dette
$ npm run check:content && npm run check:figures && npm run check:french
check-content : OK … ; check-figures : OK … ; check-french : OK (410 fichiers)
```

Dix-sept tests Python verts, seize tests JavaScript verts.
