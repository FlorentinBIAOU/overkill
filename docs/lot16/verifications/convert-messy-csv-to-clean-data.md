# convert-messy-csv-to-clean-data — vérification du lot 16

Avis d'origine : `docs/lot15/avis/convert-messy-csv-to-clean-data.md` (REFUSÉE).

## Motif 1 — la virgule seule lue comme marque décimale, sans journal

**Le refus.** `_to_number` / `toNumber` lisaient toujours une virgule seule
comme une marque décimale : `1,234` rendait 1,234 et `12,500` rendait 12,5, sur
un export anglophone, sans une ligne au journal. C'est le reproche même que le
`scenario` fait au modèle, commis par le niveau recommandé.

**Ce qui a été fait.** La marque décimale est traitée comme le relecteur le
demande : une convention déclarée par l'appelant.

- `clean_csv(data, schema, decimal=None)` / `cleanCsv(data, schema, decimal)` ;
  `coerce_row` et `repair_rejected_rows` de N3 la reçoivent aussi, pour qu'une
  réparation se lise sous la même convention que le reste du fichier.
- Sans convention, une valeur que les deux conventions lisent différemment —
  une marque unique suivie d'exactement trois chiffres, avec au plus trois
  devant — part au journal avec la raison
  `ambiguous decimal mark: declare decimal=',' or decimal='.'`.
- Une marque qui contredit la convention déclarée part au journal elle aussi
  (`decimal mark is not the '.' declared for the file`).
- Les cas que la forme tranche seule restent lus sans convention : deux marques
  présentes (`1.234,56`), une marque répétée (`1,234,567`), une marque que les
  groupes de trois ne peuvent pas expliquer (`12,50`).

**La preuve.**

```
$ node scripts/test-snippets.mjs convert-messy-csv-to-clean-data
  ok        convert-messy-csv-to-clean-data    3 py, 3 js
test-snippets : OK — 6 extrait(s) exécuté(s), aucun échec
```

Tests écrits dans les deux langages :
`production : une marque ambiguë sans convention va au journal`,
`production : la convention déclarée tranche la marque ambiguë`
(`1,234` → 1234 avec `decimal="."`, 1.234 avec `decimal=","`),
`production : une marque qui contredit la convention va au journal`,
`production : une marque répétée groupe les milliers`,
`la convention décimale du fichier vaut aussi pour la réparation` (N3).

**Règle T5 — l'entrée ordinaire de la population visée.** Ajoutée en Python et
en JavaScript : `production : un export de boutique en ligne ordinaire est lu ou
refusé` — quatre colonnes d'un export de commandes, `Boulogne-Billancourt`,
`Besançon`, `Le Puy-en-Velay`, `"1,234.50"`, `"12,500"`, `49.90` — lu en entier
sous `decimal="."`, et sans convention la seule valeur ambiguë est nommée au
journal, colonne comprise.

## Motif 2 — marquages actifs et adaptateur N3 non testé

**Le refus.** Six marquages, tous périmés, et aucun test ne faisait tourner
`ProviderClient` / `providerClient`.

**Ce qui a été fait.**

| Marquage | Traitement |
|---|---|
| `n0.test.js` `INFIRMÉ` « lignes 41 et 42 » | Réécrit sur la phrase actuelle de l'essai (« Les factures 41 et 42 ») : le test vérifie les deux langues du `why`, puis que 41-43 sont bien en deuxième colonne et 2-4 en première |
| `n1` py/js `INFIRMÉ` « described on the same scale » | La phrase est devenue une limite énoncée ; le test la démontre : `integer` sur 8 lignes, `boolean` sur 200, et les 100 rejets que N0 écrit alors |
| `n1` py/js `INFIRMÉ` « A couple of hundred rows » | Même traitement : `integer` sur les 200 premières lignes, `number` au-delà, et les 50 rejets de N0 |
| `n1.test.py` `INFIRMÉ (Python)` latence « ~10 ms » | La fiche déclare `<1 ms` : la borne est mesurée sur le fichier nominal, avec la marge de dix de la règle T7 (`< 10 ms`). Les deux cents colonnes deviennent un cas de production à borne large (5 s), qui attrape un effondrement sans publier de mesure |
| `n3` py/js `INFIRMÉ` « exactly the length of that journal » | Réécrit sur la phrase actuelle (« one call per entry of that journal, and up to `attempts` for an entry whose calls fail ») : 2 entrées → 2 appels ; 2 entrées et une panne → 3 |
| `n3` py/js `DÉFAUT` client par défaut | Remplacé par trois tests qui exécutent l'adaptateur sur `_harness/fake_sdk.py` / `fake-sdk.mjs` |

**Adaptateur N3, règle T2.** `l'adaptateur parle au kit du fournisseur` vérifie
`model`, `messages`, `temperature` envoyés et la lecture de
`choices[0].message.content` ; `l'adaptateur rend None quand le modèle refuse de
répondre` vérifie que `content` nul n'est jamais passé au décodeur JSON et n'est
pas retenté ; `l'adaptateur retente une panne du kit` vérifie `attempts` appels,
pas un de plus.

```
$ grep -rn "INFIRMÉ\|DÉFAUT\|xfail" content/snippets/convert-messy-csv-to-clean-data/
(aucune sortie)
```

## Remarques non bloquantes de l'avis

- **cp1252 et non Latin-1.** Dit dans la docstring de `decode_text` / `decodeText`
  et démontré : l'octet `0x80` rend `€` en cp1252, `U+0080` en Latin-1.
- **Échantillon de vingt lignes physiques.** Dit dans la docstring de
  `detect_dialect` / `detectDialect`, avec la raison (les enregistrements ne
  peuvent pas être découpés avant que le dialecte soit connu), et démontré : un
  enregistrement de vingt-deux retours à la ligne épuise l'échantillon, et le
  fichier est malgré tout lu en entier.

## Divergence assumée

L'ordre jour-mois reste deviné (`_to_date`, « Day-first is assumed outside ISO
form »). La règle R2 admet les deux issues — déclarée par l'appelant, ou dite —
et l'avis range cette ambiguïté parmi « ce qui est solide » : elle est le
`breaking_point` de N0, avec son exemple et son témoin (`12/25/2023`). Une
seconde convention déclarée aurait effacé ce point de rupture sans rien réparer
que la fiche ne disait déjà.

## État

**Levée.** `node scripts/test-snippets.mjs convert-messy-csv-to-clean-data` vert,
`check-content`, `check-figures`, `check-french` verts, aucun marquage dans le
dossier.
