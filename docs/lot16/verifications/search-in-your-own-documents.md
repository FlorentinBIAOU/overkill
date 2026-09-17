# search-in-your-own-documents — vérification du lot 16

Avis d'origine : `docs/lot15/avis/search-in-your-own-documents.md` (REFUSÉE).

## Motif unique — trois marquages, dont deux défauts vivants

**Le refus.** La fiche est solide sur le fond ; ce qui la retenait, ce sont
trois marquages, et deux d'entre eux portaient un vrai défaut.

### N3 — la clôture de code décodée trop largement

`_decode` coupait au dernier ` ``` ` : une réponse suivie de prose était
décodée, et une clôture jamais refermée aussi. La décision 12 du lot précédent,
reprise par la charte des tests, dit l'inverse : une seule clôture qui enveloppe
toute la réponse est lue, tout autre écart lève.

**Ce qui a été fait.** Les deux `_decode` (Python, JavaScript) appliquent
maintenant la forme stricte des autres fiches : ouverture et fermeture aux deux
bouts, exactement deux clôtures, sinon l'analyse porte sur la réponse entière et
échoue. La docstring dit pourquoi : « Salvaging those would be guessing which
part of a badly shaped answer to believe. »

**La preuve.** Deux tests par langage :
`production : une seule clôture qui enveloppe toute la réponse est lue` (avec
`json`, sans `json`, et sur une seule ligne — un appel chacun) et
`production : tout autre écart autour de la clôture lève` (prose avant, prose
après, deux blocs, clôture non refermée — deux appels chacun, puis
`AnswerUnavailable`).

### N2 — un vecteur refusé empoisonnait le cache

`vectorRanking` écrivait les vecteurs dans la `Map` gardée pour l'encodeur
**avant** de les vérifier. Un seul `NaN` passager rendait la page définitivement
introuvable et faisait lever toutes les recherches qui la contenaient, jusqu'au
redémarrage du processus. Python n'avait pas le défaut, construisant un nouveau
dictionnaire : les deux langages divergeaient.

**Ce qui a été fait.** JavaScript copie la table avant d'y écrire, et le
commentaire dit pourquoi — « a vector that turns out to be unusable must not
stay behind in the cache […] Python writes into a new dictionary for the same
reason ».

**La preuve.** Le test `production : un vecteur refusé n'empoisonne pas le cache
d'un encodeur déjà servi` existe maintenant dans les deux langages, et vérifie
que la recherche d'après ré-encode la page et répond, avec l'appel exact passé à
l'encodeur.

### Le troisième marquage

Le `DÉFAUT` de `n2.test.py` n'était qu'un renvoi vers le jumeau JavaScript dans
une docstring : il disparaît avec le défaut.

**La preuve d'ensemble.** `node scripts/test-snippets.mjs
search-in-your-own-documents` : **8 extraits, 4 py, 4 js, aucun échec**, et
`node scripts/check-marquages.mjs` ne signale plus cette fiche.

## Remarques non bloquantes de l'avis

- **La morphologie est un réglage de N0 chez PostgreSQL.** Vérifié sur les deux
  documentations avant d'être écrit : PostgreSQL dit que `to_tsvector` réduit
  les jetons en lexèmes (« `rats` became `rat` ») et écarte les mots vides
  (« Some words are recognized as stop words […] which causes them to be
  ignored ») ; SQLite dit que « The porter stemmer algorithm is designed for use
  with English language terms only ». L'`escalate_when` de N1 porte désormais
  cette phrase, dans les deux langues.
- **Le ET implicite est un choix.** Dit dans le `breaking_point` de N0 : « Ce ET
  est un choix, pas une fatalité : l'usage courant est de tenter d'abord tous les
  termes, puis de retomber sur n'importe lequel quand la première requête ne rend
  rien. »
- **La recherche par préfixe.** Une phrase dans les deux docstrings et leur
  traduction, avec la syntaxe exacte lue dans la documentation de FTS5
  (`"cong"*`, l'étoile hors des guillemets) et la raison de ne pas s'en servir
  ici.
- **Le point de rupture de N2 en cinq phrases** : ramené à deux, la première et
  la dernière, comme l'avis le demandait.
- **La position de N1 dans l'échelle** : rien changé, l'avis ne le demande pas.

## État

**Levée.** `test-snippets` vert (8 extraits) ; `check-marquages` et
`check-adaptateur` ne signalent plus cette fiche ; `check-content`,
`check-figures`, `check-french` verts (`désuffixe` ajouté au lexique).
