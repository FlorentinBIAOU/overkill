/**
 * Essai interactif — compléter la saisie dans une barre de recherche.
 *
 * Le vrai extrait du niveau recommandé, importé tel quel : ce qui tourne dans
 * le navigateur est exactement ce que la fiche affiche au-dessus.
 *
 * L'arbre est construit ici, au chargement du module, et une seule fois : c'est
 * l'argument du barreau. Ce qui se rejoue à chaque frappe n'est que la descente
 * dans l'arbre, et c'est pour cela qu'elle tient dans l'intervalle entre deux
 * touches.
 */
import { build, suggest } from '../../snippets/add-autocomplete-to-a-search-bar/n0.js';

/**
 * Un journal de recherche par langue : le catalogue d'une épicerie ne se
 * traduit pas terme à terme, et une barre de recherche anglaise indexe des
 * termes anglais. Les préfixes des cas, en revanche, sont choisis pour valoir
 * dans les deux journaux — « cr », « creme », et la faute de frappe « vreme » —
 * et restent donc des chaînes simples.
 */
const JOURNAL = {
  fr: [
    ['crème fraîche', 900],
    ['café moulu', 540],
    ['chocolat noir', 480],
    ['crème de marrons', 260],
    ['chorizo doux', 150],
    ['thé vert en vrac', 120],
    ['confiture d’abricot', 90],
  ],
  en: [
    ['crème fraîche', 900],
    ['cream cheese', 540],
    ['chocolate spread', 480],
    ['chorizo', 260],
    ['cheddar mature', 150],
    ['green tea leaves', 120],
    ['apricot jam', 90],
  ],
};

const ARBRES = { fr: build(JOURNAL.fr), en: build(JOURNAL.en) };
const RECHERCHES = { fr: new Map(JOURNAL.fr), en: new Map(JOURNAL.en) };

const T = {
  fr: {
    colonnes: ['Suggestion', 'Recherches sur quinze jours'],
    aucune: 'Aucune suggestion',
    aucuneDetail: (p) => `Aucun terme du journal ne commence par « ${p} ».`,
    note: (n, total) => `${n} suggestion${n > 1 ? 's' : ''} sur les ${total} termes du journal.`,
    locale: 'fr-FR',
  },
  en: {
    colonnes: ['Suggestion', 'Searches over a fortnight'],
    aucune: 'No suggestion',
    aucuneDetail: (p) => `No term in the log starts with “${p}”.`,
    note: (n, total) => `${n} suggestion${n > 1 ? 's' : ''} out of the ${total} terms in the log.`,
    locale: 'en-GB',
  },
};

export default {
  level: 'N0',

  note: {
    fr: 'Le nombre de recherches est ce que l’arbre trie : c’est lui qui décide de l’ordre, et rien d’autre.',
    en: 'The search count is what the tree sorts on: it decides the order, and nothing else does.',
  },

  run(prefixe, lang) {
    const t = T[lang];
    const suggestions = suggest(ARBRES[lang], prefixe, 5);
    if (suggestions.length === 0) {
      return { verdict: { label: t.aucune, detail: t.aucuneDetail(prefixe.trim()) } };
    }
    return {
      rows: {
        columns: t.colonnes,
        rows: suggestions.map((terme, rang) => [
          terme,
          /* Le compte de la première ligne est surligné : c'est le nombre qui
             l'a mise en tête. */
          { v: RECHERCHES[lang].get(terme).toLocaleString(t.locale), caught: rang === 0 },
        ]),
      },
      note: t.note(suggestions.length, JOURNAL[lang].length),
    };
  },

  cases: [
    {
      label: { fr: 'Deux lettres frappées', en: 'Two letters typed' },
      input: 'cr',
    },
    {
      label: { fr: 'La barre encore vide', en: 'The bar still empty' },
      input: '',
      shown: { fr: '(rien, pas une touche)', en: '(nothing, not one key)' },
    },
    {
      label: { fr: 'Cherché sans accent', en: 'Searched without the accent' },
      input: 'creme',
    },
    {
      label: { fr: 'La touche d’à côté', en: 'The neighbouring key' },
      input: 'vreme',
      fails: true,
      why: {
        fr: 'Le v est collé au c sur le clavier, et l’arbre quitte la branche au premier caractère : il n’a plus rien à descendre, donc rien à proposer. « creme » remontait « crème fraîche » ; un caractère de travers, et la bonne orthographe reste dans l’index sans que personne puisse l’atteindre.',
        en: 'The v sits next to the c on the keyboard, and the tree leaves the branch on the very first character: there is nothing left to walk down, so nothing to offer. “creme” brought back “crème fraîche”; one key askew, and the correct spelling stays in the index with no way to reach it.',
      },
    },
  ],
};
