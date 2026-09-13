/**
 * Essai interactif — fabriquer un jeu de données de test.
 *
 * Le vrai extrait du niveau recommandé, importé tel quel. Ce qu'on tape est la
 * graine, puisque c'est le seul paramètre qui distingue deux jeux de données :
 * le schéma, lui, est de la donnée d'exemple, et il est fixé ici comme il l'est
 * dans les tests de la fiche.
 *
 * Le tableau montre les cinq premières lignes. Le verdict, lui, est calculé sur
 * cinq cents lignes tirées de la même graine, et compte ce que les adresses
 * produites ne contiennent jamais. C'est là que se trouve le point de rupture
 * de ce barreau : non pas ce que le générateur écrit, mais ce qu'il n'écrit
 * jamais.
 */
import { generateRows } from '../../snippets/generate-test-data/n0.js';

/* Un schéma de table de commandes. Les adresses sont bâties sur un domaine
   que la norme réserve aux essais : aucun message ne peut partir vers une
   vraie boîte. */
const COMMANDES = {
  order_id: { type: 'sequence', prefix: 'ORD-', width: 5 },
  email: { type: 'sequence', prefix: 'user-', width: 4, suffix: '@example.test' },
  city: { type: 'choice', values: ['Paris', 'Lyon', 'Nantes', 'Lille'] },
  quantity: { type: 'int', min: 1, max: 9 },
  signed_up_on: { type: 'date', start: '2024-01-01', days: 365 },
  newsletter: { type: 'bool', true_percent: 30 },
};

const AFFICHEES = 5;
const TIREES = 500;

const T = {
  fr: {
    oui: 'oui',
    non: 'non',
    label: (n) => `${n} adresses tirées de cette graine, une seule forme`,
    detail: (plus, majuscule, apostrophe) =>
      `${plus} avec une étiquette après un +, ${majuscule} avec une majuscule, ${apostrophe} avec une apostrophe.`,
    note: (graine, n) =>
      `Les ${n} premières des ${TIREES} lignes. « ${graine} » les redonnera identiques, sur n’importe quelle machine et dans les deux langages de la fiche.`,
    vide: 'Aucune graine saisie',
    videDetail: 'Tapez n’importe quelle chaîne : un numéro de ticket, une date, un nom de campagne.',
  },
  en: {
    oui: 'yes',
    non: 'no',
    label: (n) => `${n} addresses drawn from this seed, one single shape`,
    detail: (plus, majuscule, apostrophe) =>
      `${plus} with a plus tag, ${majuscule} with a capital letter, ${apostrophe} with an apostrophe.`,
    note: (graine, n) =>
      `The first ${n} of ${TIREES} rows. “${graine}” will give them back identical, on any machine and in both languages of this entry.`,
    vide: 'No seed given',
    videDetail: 'Type any string: a ticket number, a date, the name of a campaign.',
  },
};

export default {
  level: 'N0',

  note: {
    fr: 'La saisie est la graine. Le schéma est fixé : un identifiant de commande, une adresse, une ville, une quantité, une date d’inscription, un consentement.',
    en: 'What you type is the seed. The schema is fixed: an order reference, an address, a town, a quantity, a sign-up date, a consent flag.',
  },

  run(graine, lang) {
    const t = T[lang];
    if (graine.trim() === '') {
      return { verdict: { label: t.vide, detail: t.videDetail } };
    }

    const lignes = generateRows(COMMANDES, TIREES, graine);
    const colonnes = Object.keys(COMMANDES);

    // Les formes qu'une vraie adresse prend, et que celle-ci ne prend jamais.
    // Comptées sur le tirage entier, parce que c'est l'absence qui compte.
    const adresses = lignes.map((ligne) => ligne.email);
    const compte = (predicat) => adresses.filter(predicat).length;

    return {
      verdict: {
        label: t.label(TIREES),
        detail: t.detail(
          compte((adresse) => adresse.includes('+')),
          compte((adresse) => adresse !== adresse.toLowerCase()),
          compte((adresse) => adresse.includes('’') || adresse.includes("'")),
        ),
      },
      rows: {
        columns: colonnes,
        rows: lignes.slice(0, AFFICHEES).map((ligne) =>
          colonnes.map((champ) => {
            const valeur = ligne[champ];
            if (valeur === true) return t.oui;
            if (valeur === false) return t.non;
            return String(valeur);
          }),
        ),
      },
      note: t.note(graine, AFFICHEES),
    };
  },

  cases: [
    {
      label: {
        fr: 'La graine d’une suite de tests',
        en: 'The seed of a test suite',
      },
      input: 'commandes-2024',
    },
    {
      label: {
        fr: 'Une autre graine : d’autres villes, d’autres quantités',
        en: 'Another seed: other towns, other quantities',
      },
      input: 'commandes-2025',
    },
    {
      label: {
        fr: 'La graine notée à côté d’une panne, pour rejouer le jeu exact',
        en: 'The seed written next to a failure, to replay the exact data',
      },
      input: 'incident-4471',
    },
    {
      label: {
        fr: 'Une quatrième graine, et toujours la même forme d’adresse',
        en: 'A fourth seed, and still the same shape of address',
      },
      input: 'inscriptions-mars',
      fails: true,
      why: {
        fr: 'Changer de graine change les villes, les quantités, les dates — jamais la forme des adresses : pas une étiquette après un +, pas une majuscule, pas une apostrophe sur cinq cents lignes. Une fonction de production qui déduit le compte de la partie gauche de l’adresse et oublie l’étiquette reste verte sur ce jeu, quelle que soit la graine et quel que soit le nombre de lignes. Le doublon de compte n’apparaît qu’en production.',
        en: 'Changing the seed changes the towns, the quantities, the dates — never the shape of the addresses: not one plus tag, not one capital, not one apostrophe in five hundred rows. A production function that derives an account from the left-hand side of an address and forgets the plus tag stays green on this data, whatever the seed and whatever the row count. The duplicate account only shows up in production.',
      },
    },
  ],
};
