/**
 * Essai interactif — retrouver les montants cités dans un texte.
 *
 * L'extrait du niveau recommandé ne dépend de rien : il est chargé par le
 * navigateur et s'exécute à chaque frappe. Collez-y une de vos lignes.
 *
 * Ce qui est surligné dans l'entrée est ce que l'extrait a reconnu comme un
 * montant. La convention de séparateur est déclarée par le cas, jamais devinée.
 */
import { extractAmounts } from '../../snippets/extract-amounts-and-currencies-from-text/n0.js';

const T = {
  fr: {
    colonnes: ['Écrit', 'Valeur', 'Devise', 'Convention nécessaire'],
    oui: 'oui',
    non: '—',
    lu: (n, c) => `${n} montant(s), lus en convention « ${c} »`,
    rien: (u) => (u
      ? `Aucun montant : ${u} nombre(s) sans devise à côté d’eux`
      : 'Aucun montant dans ce texte'),
    montant: 'Montant',
  },
  en: {
    colonnes: ['Written', 'Value', 'Currency', 'Convention needed'],
    oui: 'yes',
    non: '—',
    lu: (n, c) => `${n} amount(s), read under the “${c}” convention`,
    rien: (u) => (u
      ? `No amount: ${u} number(s) with no currency beside them`
      : 'No amount in this text'),
    montant: 'Amount',
  },
};

export default {
  level: 'N0',

  note: {
    fr: 'Rien ne part sur le réseau : la lecture se fait dans votre navigateur. La convention de séparateur est celle que le cas déclare.',
    en: 'Nothing goes out on the network: the reading happens in your browser. The separator convention is the one the case declares.',
  },

  run(input, lang, cas) {
    const t = T[lang];
    const convention = cas?.convention ?? lang;
    const rapport = extractAmounts(input, convention);

    return {
      spans: rapport.amounts.map((a) => ({ start: a.start, end: a.end, label: t.montant })),
      rows: {
        columns: t.colonnes,
        rows: rapport.amounts.map((a) => [
          a.text,
          { v: a.value, caught: true },
          a.currency ?? a.currency_candidates.join(' / '),
          a.ambiguous ? t.oui : t.non,
        ]),
      },
      verdict: {
        label: rapport.amounts.length
          ? t.lu(rapport.amounts.length, convention)
          : t.rien(rapport.unmarked),
      },
    };
  },

  // données-fictives:début — des lignes de facture fabriquées pour cette page,
  // montants compris : ce sont les données que l'extrait lit, pas des tarifs.
  cases: [
    {
      label: { fr: 'Une ligne de facture', en: 'An invoice line' },
      input: {
        fr: 'Facture n° 2026-118 du 10 octobre 2026 — total 1 250,00 €',
        en: 'Invoice no. 2026-118 of 10 October 2026 — total £1,250.00',
      },
    },
    {
      label: { fr: 'Un devis, et un pourcentage qui n’est pas un montant', en: 'A quote, and a percentage that is not an amount' },
      input: {
        fr: 'Sous-total 1 250,00 €, remise 125,00 €, total 1 125,00 € TTC. TVA 20 % incluse.',
        en: 'Subtotal £1,250.00, discount £125.00, total £1,125.00 incl. tax. VAT 20 % included.',
      },
    },
    {
      label: { fr: 'La devise écrite une fois, en tête', en: 'The currency written once, in a heading' },
      input: {
        fr: 'Facture n° 2026-118. Montants exprimés en euros.\nSous-total : 1 250,00\nRemise : 125,00\nTotal : 1 125,00',
        en: 'Invoice no. 2026-118. Amounts are in pounds.\nSubtotal: 1,250.00\nDiscount: 125.00\nTotal: 1,125.00',
      },
    },
    {
      label: { fr: 'Trois chiffres derrière une virgule, lus en convention anglaise', en: 'Three digits behind a comma, read under the English convention' },
      input: {
        fr: 'Le carburant est affiché 1,859 € le litre.',
        en: 'Fuel is shown at 1,859 £ per litre.',
      },
      convention: 'en',
      fails: true,
      why: {
        fr: 'Le même texte, lu en convention française, donne 1,859 — trois décimales, le prix d’un litre. Lu en convention anglaise, comme ici, la virgule groupe les milliers et la valeur revient mille fois plus grande. Aucune des deux lectures n’est absurde, et c’est pourquoi le code exige que l’appelant déclare la convention de ses documents et marque le résultat « convention nécessaire » : le drapeau dit que la lecture dépend de la déclaration, il ne dit pas laquelle est juste.',
        en: 'The same text, read under the French convention, gives 1.859 — three decimals, the price of a litre. Read under the English convention, as it is here, the comma groups the thousands and the value comes back a thousand times larger. Neither reading is absurd, and that is why the code requires the caller to declare the convention their documents use and marks the result “convention needed”: the flag says the reading depends on the declaration, not which one is right.',
      },
    },
  ],
  // données-fictives:fin
};
