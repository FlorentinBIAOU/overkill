/**
 * Essai interactif — classer des produits par pertinence.
 *
 * Le vrai extrait du niveau recommandé, importé tel quel : ce qui tourne dans
 * le navigateur est exactement ce que la fiche affiche au-dessus.
 *
 * Le catalogue est celui du printemps, et les poids sont ceux qu'un
 * merchandiser avait réglés à l'automne. C'est tout le sujet du niveau : les
 * quatre nombres sont posés sur la page, et le tableau dit lequel a décidé.
 */
import {
  SIGNALS,
  rank,
} from '../../snippets/rank-products-by-relevance/n0.js';

/**
 * Les poids réglés à l'automne, quand les produits populaires étaient aussi
 * les pertinents. Ils ne bougent plus : c'est la seule façon de voir ce qu'ils
 * font au printemps.
 */
const POIDS = { text: 3, availability: 2, margin: 1, popularity: 6 };

/**
 * Un catalogue par langue, parce qu'un intitulé de produit ne se cherche pas
 * dans l'autre langue. La marge et la popularité sont des parts entre zéro et
 * un, comme l'extrait les attend ; les sandales sont la nouveauté de la saison,
 * et n'ont donc encore rien vendu.
 */
const CATALOGUE = {
  fr: [
    { title: 'Sandales de randonnée Ultra', tags: ['randonnée', 'été'], inStock: true, margin: 0.40, popularity: 0.05 },
    { title: 'Chaussures de course Route 5', tags: ['running', 'bitume'], inStock: true, margin: 0.35, popularity: 0.80 },
    { title: 'Chaussures de course Trail 3', tags: ['running', 'sentier'], inStock: true, margin: 0.42, popularity: 0.30 },
    { title: 'Chaussettes de running', tags: ['running'], inStock: true, margin: 0.60, popularity: 0.55 },
    { title: 'Montre GPS Cadence', tags: ['running', 'montre'], inStock: false, margin: 0.25, popularity: 0.70 },
    { title: 'Sac à dos de randonnée', tags: ['randonnée'], inStock: true, margin: 0.48, popularity: 0.20 },
  ],
  en: [
    { title: 'Ultra hiking sandals', tags: ['hiking', 'summer'], inStock: true, margin: 0.40, popularity: 0.05 },
    { title: 'Route 5 running shoes', tags: ['running', 'tarmac'], inStock: true, margin: 0.35, popularity: 0.80 },
    { title: 'Trail 3 running shoes', tags: ['running', 'path'], inStock: true, margin: 0.42, popularity: 0.30 },
    { title: 'Running socks', tags: ['running'], inStock: true, margin: 0.60, popularity: 0.55 },
    { title: 'Cadence GPS watch', tags: ['running', 'watch'], inStock: false, margin: 0.25, popularity: 0.70 },
    { title: 'Hiking rucksack', tags: ['hiking'], inStock: true, margin: 0.48, popularity: 0.20 },
  ],
};

const T = {
  fr: {
    colonnes: ['Produit', 'Texte', 'En stock', 'Marge', 'Popularité', 'Score'],
    oui: 'oui',
    non: 'non',
    note: `Poids : texte ${POIDS.text}, stock ${POIDS.availability}, marge ${POIDS.margin}, popularité ${POIDS.popularity}. La cellule surlignée est le signal qui a le plus poussé le premier produit.`,
  },
  en: {
    colonnes: ['Product', 'Text', 'In stock', 'Margin', 'Popularity', 'Score'],
    oui: 'yes',
    non: 'no',
    note: `Weights: text ${POIDS.text}, stock ${POIDS.availability}, margin ${POIDS.margin}, popularity ${POIDS.popularity}. The highlighted cell is the signal that pushed the first product hardest.`,
  },
};

const pourcent = (part) => `${Math.round(part * 100)} %`;

/** Le signal qui a le plus pesé : sa valeur multipliée par son poids. */
function signalDecisif(mesures) {
  return SIGNALS.reduce(
    (meilleur, nom) => (POIDS[nom] * mesures[nom] > POIDS[meilleur] * mesures[meilleur] ? nom : meilleur),
    SIGNALS[0],
  );
}

export default {
  level: 'N0',

  note: {
    fr: 'Le classement rend les quatre signaux avec le score : qui veut discuter un rang voit dans le tableau ce qui l’a produit.',
    en: 'The ranking hands back the four signals along with the score: anyone arguing about a place can see in the table what produced it.',
  },

  run(requete, lang) {
    const t = T[lang];
    const classe = rank(CATALOGUE[lang], requete, POIDS);
    const decisif = signalDecisif(classe[0].signals);
    return {
      rows: {
        columns: t.colonnes,
        rows: classe.map(({ product, score, signals }, rang) => {
          const cellule = (nom, valeur) => (rang === 0 && nom === decisif ? { v: valeur, caught: true } : valeur);
          return [
            product.title,
            cellule('text', pourcent(signals.text)),
            cellule('availability', signals.availability ? t.oui : t.non),
            cellule('margin', pourcent(signals.margin)),
            cellule('popularity', pourcent(signals.popularity)),
            pourcent(score),
          ];
        }),
      },
      note: t.note,
    };
  },

  cases: [
    {
      label: { fr: 'La requête de la saison passée', en: 'Last season’s query' },
      input: { fr: 'chaussures de course', en: 'running shoes' },
    },
    {
      label: { fr: 'Un produit en rupture', en: 'A product out of stock' },
      input: { fr: 'montre', en: 'watch' },
    },
    {
      label: { fr: 'Une catégorie, sans rien taper', en: 'A category, nothing typed' },
      input: '',
      shown: { fr: '(rien : la page d’une catégorie)', en: '(nothing: a category page)' },
    },
    {
      label: { fr: 'La nouveauté du printemps', en: 'The new spring range' },
      input: { fr: 'sandales randonnée', en: 'hiking sandals' },
      fails: true,
      why: {
        fr: 'Le seul produit qui répond exactement à la requête arrive troisième, derrière une paire de chaussures de course et des chaussettes, qui n’ont rien à voir avec des sandales. Les poids ont été réglés à l’automne, quand les produits populaires étaient aussi les pertinents ; la popularité pèse deux fois le texte, et cette nouveauté n’a presque aucune popularité. Rien ne le signale : ni exception, ni test rouge, ni ligne de journal. Il faut que quelqu’un s’en aperçoive et déplace un nombre.',
        en: 'The only product that answers the query exactly comes third, behind a pair of running shoes and a pair of socks, which have nothing to do with sandals. The weights were set in autumn, when the popular products were also the relevant ones; popularity weighs twice as much as text, and this new range has next to no popularity. Nothing flags it: no exception, no failing test, no log line. Somebody has to notice, and move a number.',
      },
    },
  ],
};
