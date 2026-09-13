# Les essais

Un essai fait tourner l'extrait du **niveau recommandé** d'une fiche sur des cas
concrets, et montre ce qu'il attrape et ce qu'il laisse. C'est du contenu, pas
du code de site : il vit ici, à côté des extraits qu'il met à l'épreuve.

Deux dossiers, deux formes :

| Dossier | Quand | Ce qui se passe |
|---|---|---|
| `live/<id>.js` | l'extrait du niveau recommandé existe en JavaScript et tourne sans dépendance | le module est chargé par le navigateur, l'extrait s'exécute à chaque frappe |
| `frozen/<id>.js` | l'exécution en navigateur est impossible — modèle, service externe, dépendance lourde | cinq à six cas, exécutés à la construction du site avec le double local des tests |

`<id>` est l'identifiant de la fiche. Une fiche sans fichier ici n'affiche pas
de zone d'essai, et ne dit rien à ce sujet : toutes les tâches ne se montrent
pas dans un champ de saisie.

## Ce qu'un essai ne fait jamais

- **Recopier du code.** Il importe le vrai fichier d'extrait, comme la fiche.
- **Écrire une sortie à la main.** Toute sortie affichée est calculée en
  exécutant l'extrait, dans le navigateur ou à la construction du site.
- **Prétendre à une preuve qu'il n'a pas.** Quand un service est remplacé par
  un double local, l'essai le dit, dans son `note`.

## Le contrat

```js
import { mask } from '../../snippets/mask-personal-data-in-chat/n0.js';

export default {
  /** Le niveau mis à l'essai. C'est toujours le verdict de la fiche. */
  level: 'N0',

  /** Facultatif : une phrase posée une fois sous l'intitulé de la zone. */
  note: { fr: '…', en: '…' },

  /**
   * Exécute l'extrait.
   * @param {string} input  la saisie, ou celle du cas
   * @param {'fr'|'en'} lang  pour les textes que le résultat contient
   * @param {object} cas  le cas d'origine. Forme figée seulement : la forme
   *   interactive ne peut pas s'y fier, puisqu'on y tape son propre texte.
   */
  run(input, lang) {
    return { output: mask(input), diff: true };
  },

  /** Trois ou quatre cas en interactif, cinq à six en figé. */
  cases: [
    { label: { fr: '…', en: '…' }, input: { fr: '…', en: '…' } },
    {
      label: { fr: '…', en: '…' },
      input: '…',                 // une chaîne quand l'exemple ne se traduit pas
      fails: true,                // au moins un cas échoue, toujours
      why: { fr: '…', en: '…' },  // pourquoi, en une ou deux phrases
      shown: { fr: '…', en: '…' }, // ce qu'on affiche quand l'entrée ne s'affiche pas
      simulate: { failTimes: 2 },  // forme figée : ce qu'on simule autour
    },
  ],
};
```

### Ce que `run` peut renvoyer

Les champs se combinent ; tous sont facultatifs.

| Champ | Rendu |
|---|---|
| `output: string` | un panneau de texte |
| `diff: true` | surligne, de part et d'autre, ce qui a changé entre l'entrée et la sortie |
| `spans: [{ start, end, label }]` | surligne ces portions de l'entrée, quand l'extrait sait lui-même ce qu'il a attrapé |
| `rows: { columns, rows }` | un tableau. Une cellule peut être `{ v, caught: true }` pour être surlignée |
| `verdict: { label, detail }` | une réponse en une ligne, avec un mot d'explication |
| `image: { svg, alt }` | une image produite par l'extrait, posée en URI de données |
| `note: string` | une phrase sous le résultat, déjà dans la langue |
| `error: string` | ce qui s'affiche quand l'essai ne peut pas aboutir |

### Les cas

Trois critères, dans cet ordre :

1. **prouver que ça fonctionne** — le cas ordinaire, celui pour lequel on écrit
   la fiche
2. **faire comprendre pourquoi** — une variante qui montre ce que le code
   tolère, et qu'on n'aurait pas devinée
3. **montrer quand ça cesse de fonctionner** — le point de rupture de la fiche,
   marqué `fails: true`

Ils doivent être concrets et reconnaissables. Un numéro de téléphone, une ligne
de CSV, un ticket de support : pas `foo`, pas `test123`, pas `lorem ipsum`.

## Vérification

`npm run test:tryout` ouvre chaque fiche qui a un essai, dans un navigateur, et
vérifie que la zone s'affiche, que le module prend la main, que le cas qui
échoue dit pourquoi, et que la saisie libre relance le code.
