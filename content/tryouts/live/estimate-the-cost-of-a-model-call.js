/**
 * Essai interactif — estimer le coût d'un appel de modèle.
 *
 * L'extrait du niveau recommandé ne dépend de rien : il est chargé par le
 * navigateur et s'exécute à chaque frappe. Écrivez vos propres chiffres, un
 * par ligne, dans l'ordre indiqué par les exemples.
 *
 * Aucun prix n'est écrit nulle part : les deux tarifs sont des lignes de la
 * saisie, et tous les montants rendus sont dans l'unité que vous leur donnez.
 */
import { estimateCost } from '../../snippets/estimate-the-cost-of-a-model-call/n0.js';

const T = {
  fr: {
    colonnes: ['Ce que le calcul donne', 'Valeur'],
    jetons: 'Jetons par appel',
    origine: 'Jetons comptés ou estimés',
    parAppel: 'Coût d’un appel',
    total: 'Coût du travail entier',
    bascule: 'Appels avant d’atteindre le coût de l’alternative',
    origines: { counted: 'comptés', estimated: 'estimés', mixed: 'estimés pour une part' },
    lu: (n) => `${n} appel(s), dans l’unité de vos prix`,
    refus: 'Le calcul n’a pas pu être fait',
    aide: 'Une ligne par valeur : appels, jetons d’entrée, jetons de sortie, prix d’entrée, prix de sortie, coût de l’alternative.',
    jamais: 'sans objet : l’appel est gratuit',
  },
  en: {
    colonnes: ['What the arithmetic gives', 'Value'],
    jetons: 'Tokens per call',
    origine: 'Tokens counted or estimated',
    parAppel: 'Cost of one call',
    total: 'Cost of the whole job',
    bascule: 'Calls before the alternative’s cost is reached',
    origines: { counted: 'counted', estimated: 'estimated', mixed: 'estimated in part' },
    lu: (n) => `${n} call(s), in the unit of your prices`,
    refus: 'The arithmetic could not be done',
    aide: 'One line per value: calls, input tokens, output tokens, input price, output price, cost of the alternative.',
    jamais: 'not applicable: the call is free',
  },
};

/** Une ligne de jetons : un nombre, ou « caractères/rapport » pour une estimation. */
function jetonsDe(ligne) {
  if (ligne.includes('/')) {
    const [caracteres, rapport] = ligne.split('/').map((part) => part.trim());
    return { characters: Number.parseInt(caracteres, 10), characters_per_token: rapport };
  }
  return Number.parseInt(ligne.trim(), 10);
}

export default {
  level: 'N0',

  note: {
    fr: 'Rien ne part sur le réseau, et aucun tarif n’est écrit dans le code : les prix sont deux lignes de votre saisie. Écrivez « 4800/4 » à la place d’un nombre de jetons pour demander une estimation depuis un nombre de caractères.',
    en: 'Nothing goes out on the network, and no price is written in the code: the prices are two lines of your input. Write “4800/4” instead of a token count to ask for an estimate from a number of characters.',
  },

  run(input, lang) {
    const t = T[lang];
    const lignes = input.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lignes.length < 5) return { verdict: { label: t.refus, detail: t.aide } };

    const [appels, entree, sortie, prixEntree, prixSortie, alternative] = lignes;
    const rapport = estimateCost(
      Number.parseInt(appels, 10), jetonsDe(entree), jetonsDe(sortie),
      prixEntree, prixSortie,
      alternative ? { fixedAlternative: alternative } : {},
    );
    if (rapport.reason) return { verdict: { label: t.refus, detail: rapport.reason } };

    const lignesTableau = [
      [t.jetons, String(rapport.tokens.total)],
      [t.origine, t.origines[rapport.tokens.source]],
      [t.parAppel, rapport.cost.per_item],
      [t.total, { v: rapport.cost.total, caught: true }],
    ];
    if (alternative) {
      lignesTableau.push([t.bascule,
        rapport.break_even_items === null ? t.jamais : String(rapport.break_even_items)]);
    }
    return {
      rows: { columns: t.colonnes, rows: lignesTableau },
      verdict: { label: t.lu(Number.parseInt(appels, 10)) },
    };
  },

  cases: [
    {
      label: { fr: 'Dix mille documents, jetons comptés', en: 'Ten thousand documents, tokens counted' },
      input: '10000\n1200\n300\n0.15\n0.60',
    },
    {
      label: { fr: 'Les mêmes, avec le coût de l’alternative', en: 'The same, with the alternative’s cost' },
      input: '10000\n1200\n300\n0.15\n0.60\n800',
    },
    {
      label: { fr: 'Les jetons estimés depuis les caractères', en: 'Tokens estimated from the characters' },
      input: '10000\n4800/4\n300\n0.15\n0.60\n800',
    },
    {
      label: { fr: 'Le même texte, avec un autre rapport tout aussi plausible', en: 'The same text, with another equally plausible ratio' },
      input: '10000\n4800/2.5\n300\n0.15\n0.60\n800',
      fails: true,
      why: {
        fr: 'C’est le même texte, le même travail et les mêmes prix : seul le rapport caractères par jeton a changé, de quatre à deux et demi. Les jetons d’entrée passent de 1 200 à 1 920, et la facture du travail entier de 3,60 à 4,68 dans votre unité — un tiers de plus. Les deux rapports sont plausibles — le premier est l’ordre de grandeur souvent cité pour de l’anglais courant, le second correspond mieux à du texte accentué ou à du JSON —, et rien dans le calcul ne peut dire lequel est le vôtre. C’est pourquoi le rapport rendu indique toujours si les jetons ont été comptés ou estimés : la seule façon de sortir de cette incertitude est de compter les jetons avec le tokeniseur du fournisseur, et de passer le nombre obtenu à la place du rapport.',
        en: 'It is the same text, the same job and the same prices: only the characters-per-token ratio changed, from four to two and a half. The input tokens go from 1,200 to 1,920, and the bill for the whole job from 3.60 to 4.68 in your own unit — a third more. Both ratios are plausible — the first is the order of magnitude often quoted for ordinary English, the second fits accented text or JSON better — and nothing in the arithmetic can say which one is yours. That is why the report always says whether the tokens were counted or estimated: the only way out of that uncertainty is to count the tokens with the provider’s tokeniser and pass the number instead of the ratio.',
      },
    },
  ],
};
