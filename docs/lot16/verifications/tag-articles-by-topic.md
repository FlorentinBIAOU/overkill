# tag-articles-by-topic — vérification du lot 16

Avis d'origine : `docs/lot15/avis/tag-articles-by-topic.md` (REFUSÉE, suite rouge).

## Motif 1 — la suite était rouge, et la borne violait la charte

**Le refus.** `test_un_article_se_traite_en_moins_d_une_milliseconde` affirmait
`best < 0.001` sur un article de cinq cents mots ; mesuré 1,08 ms. Marge de
deux, contre les dix que demande la charte, et une classe de latence
(`<1 ms` pour N0) que la mesure ne soutient pas.

**Ce qui a été fait.**

- `latency` de N0 passe à `~10 ms`, la classe que la mesure soutient.
- Le test devient `production : un article de presse termine dans une borne
  large` : borne à 100 ms, dix fois la classe déclarée, et la docstring dit sur
  quel article la classe est mesurée (cinq cents mots, le vocabulaire du test).
  Un second cas, dix fois plus long, vérifie que le temps croît sans exploser.
- Les deux autres bornes de temps de la fiche (N1, Python et JavaScript)
  passent de 1 ms à 10 ms, même règle.

**La preuve.**

```
$ node scripts/test-snippets.mjs tag-articles-by-topic   (trois fois de suite)
  ok        tag-articles-by-topic              4 py, 4 js
  ok        tag-articles-by-topic              4 py, 4 js
  ok        tag-articles-by-topic              4 py, 4 js
```

## Motif 2 — l'article à plusieurs thèmes ressortait sans étiquette

**Le refus.** Le besoin est d'attribuer à chaque article les thèmes qu'il
traite, et l'article qui en traite plusieurs — souvent le plus fouillé —
ressortait sans aucune étiquette au niveau recommandé. Le `breaking_point` de N1
n'en disait rien.

**Ce qui a été fait.** L'avis proposait deux issues ; la seconde a été prise, et
le code corrigé. `tag` gagne un plancher :

> When nothing reaches the threshold, two things are possible: the article is
> about none of the topics, or it is about several and they shared its weight.
> Two topics above the floor tell the second case from the first, and then both
> come back. One alone does not, because that is what an article about nothing
> looks like.

La condition « deux au moins » est ce qui distingue les deux cas : sans elle,
« Le restaurant du coin a changé de carte. » ressortait étiqueté « fiscalité »,
qui frôle le plancher seul. Le plancher se désarme en l'égalant au seuil, ce que
la docstring dit et que les tests emploient.

**La preuve.** Tests dans les deux langages :

- `un article qui traite trois thèmes ressort avec trois étiquettes` — aucun des
  scores n'atteint le seuil, l'article ressort étiqueté, et avec le plancher
  désarmé il ressort vide comme avant ;
- `un seul thème près du plancher ne suffit pas` — le témoin, l'article hors
  sujet, reste vide.

Le nombre exact d'étiquettes rendues dépend des scores, et les deux
implémentations ne les calculent pas au même millième : le test affirme qu'il en
revient plus d'une et qu'elles sont toutes du bon article, ce qui est vrai des
deux côtés et suffit à démontrer la phrase.

Le `breaking_point` de N1 commence désormais par ce cas, avec son témoin. Le
verdict dit ce qu'on fait — un plancher à régler sur son fonds, comme le seuil.

## Motif 3 — cinq marquages et l'adaptateur N3

| Marquage | État | Traitement |
|---|---|---|
| `n0` py/js `INFIRMÉ` « lemmatisation » | périmé | Test réécrit sur la phrase actuelle (« a plural-and-suffix stripper, not a lemmatiser »), avec son témoin ; et la fonction est renommée `strip_ending` / `stripEnding`, comme l'avis le demande |
| `n1` py/js `INFIRMÉ` « three tags » | périmé, et le code est désormais corrigé | Réécrit en démonstration du plancher |
| `n1` py/js `INFIRMÉ` « à distance » | périmé | Réécrit sur la phrase actuelle : le mot d'une lettre est jeté, « travailler distance » existe, « à distance » non |
| `n2` py/js `INFIRMÉ` « aucun seuil ne sépare les deux » | périmé | Réécrit sur la phrase actuelle du `breaking_point` : un seul seuil sert tous les thèmes — les scores voisins se tiennent dans moins de cinq centièmes, et mille seuils ne produisent qu'une poignée de réponses distinctes |
| `n3` py/js `DÉFAUT` client par défaut | périmé et décoratif | Remplacé par trois tests qui exécutent `ProviderClient(sdk=FakeSDK(...))` / `providerClient(new FakeSDK(...))` |

Huit noms de test portaient encore un préfixe `defaut` sans marquage : renommés.

```
$ grep -rn "INFIRMÉ\|DÉFAUT\|xfail" content/snippets/tag-articles-by-topic/
(aucune sortie)
```

## Remarques non bloquantes de l'avis

- **« un service à tenir chaud » pour N2.** Corrigé dans le verdict : « un
  encodeur à charger dans le processus qui publie ».

## État

**Levée.** `test-snippets` vert trois fois de suite, `check-content`,
`check-figures`, `check-french` verts, aucun marquage.
