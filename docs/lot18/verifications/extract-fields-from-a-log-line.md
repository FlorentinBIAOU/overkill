# extract-fields-from-a-log-line — vérification du lot 18

Avis : `docs/lot17/avis/extract-fields-from-a-log-line.md` (REFUSÉE).

## Les motifs de refus, un par un

### 1. `syslog-3164` rejetait tout un fichier de journal — levé

Reproduit : le motif commençait par `<%{INT:priority}>`, et la priorité entre
chevrons n'existe que sur le fil — le paquet UDP 514 —, le collecteur la
retirant avant écriture.

Correction : la priorité devient facultative, dans la notation elle-même, qui
laisse passer le reste de l'expression régulière — `(?:<%{INT:priority}>)?`.
Un seul motif sert donc au fil et au fichier, et `priority` vaut `None` quand
la ligne n'en porte pas. Mesuré, dans les deux langages, sur les trois lignes
de l'avis :

```
parsed 3, rejected 0
  priority null  timestamp "Oct 10 13:55:36"  host "serveur1"  tag "sshd[1234]"
  priority null  …                            host "serveur1"  tag "systemd[1]"
  priority "34"  (la ligne du fil, qui passe toujours)
```

Le test porte trois lignes sans chevrons, copiées de la forme que produisent
`/var/log/syslog`, `/var/log/auth.log` et `journalctl`, et il vérifie que la
même ligne avec chevrons rend toujours sa priorité.

Le passage par `None` demandait un ajustement de parité : un groupe optionnel
non apparié vaut `None` en Python et `undefined` en JavaScript, et `undefined`
disparaît d'un objet sérialisé. Le côté JavaScript le ramène à `null`, avec le
commentaire qui dit pourquoi.

### 2. Le point de rupture attribuait son résultat à un autre motif — levé

Le motif exécuté relâche **deux** morceaux, l'horodatage et l'étiquette. Le
point de rupture le dit maintenant, dans les deux langues, et le test porte les
deux découpages :

| | motif de la fiche (deux `%{DATA}`) | en ne relâchant que l'horodatage |
|---|---|---|
| `timestamp` | `Oct` | `Oct 10` |
| `host` | `10` | `13:55:36` |
| `tag` | `13:55:36 serveur1 sshd[1234]` | `serveur1 sshd[1234]` |

Les deux colonnes sont assertées, de sorte que la phrase publiée et le motif
exécuté ne peuvent plus se séparer.

## Les remarques non bloquantes

### 1. `%{QUOTED}` ignorait l'échappement d'Apache — levée

`[^"]*` devient `(?:[^"\\]|\\.)*`. La ligne de l'avis —
`… "GET /a\"b HTTP/1.1" 404 512 "-" "curl/8.5.0"` — n'est plus rejetée, et son
champ `request` est rendu avec son guillemet échappé. Elle entre dans les deux
jeux de tests et dans le test de parité, avec le témoin d'une ligne ordinaire.

### 2. Le `%{DATA}` lâche méritait mieux qu'un exemple — levée

Le rapport porte `loose_pieces` : les morceaux `DATA` et `GREEDY` qui ne sont
pas en dernière position, nommés. Rien n'est rejeté à cause d'eux — c'est tout
le problème —, donc ils sont nommés. Le motif du point de rupture rend
`["timestamp", "tag"]` ; les trois motifs livrés rendent `[]`, parce que leur
morceau lâche est en dernière position, où il s'arrête là où la ligne s'arrête.

`compile_pattern` ne les **refuse** pas : la fiche existe pour montrer ce qu'un
morceau lâche fait, et un compilateur qui le refuserait supprimerait la
démonstration en même temps que le défaut.

### 3. R11 — point de rupture de 72 mots et trois phrases

Réécrit : 46 mots en français, 50 en anglais, deux phrases chacun. La fiche
sort de la dette R11.

## Preuve

```
$ node scripts/test-snippets.mjs extract-fields-from-a-log-line
  ok        extract-fields-from-a-log-line     1 py, 1 js
test-snippets : OK — 2 extrait(s) exécuté(s), aucun échec

$ npm run check:rupture && npm run check:content && npm run check:figures && npm run check:raisons && npm run check:french
check-longueur-rupture : OK — 208 point(s) de rupture, 160 encore en dette, aucun nouveau dépassement
check-content : OK … ; check-figures : OK … ; check-raisons : OK … ; check-french : OK (410 fichiers)
```

Dix-huit tests Python verts, dix-sept tests JavaScript verts. Le test de parité
gagne deux cas : les lignes de fichier syslog et la requête au guillemet
échappé.
