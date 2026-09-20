/**
 * Essai interactif — additionner une colonne, exactement.
 *
 * L'extrait du niveau recommandé ne dépend de rien : il est chargé par le
 * navigateur et s'exécute à chaque frappe. Collez-y une colonne de votre
 * fichier, une valeur par ligne.
 *
 * La somme flottante est affichée à côté de la somme exacte : c'est la même
 * colonne, lue de deux façons, et c'est tout le sujet de la fiche.
 */
import { aggregate } from '../../snippets/aggregate-a-column-of-data/n0.js';

const T = {
  fr: {
    colonnes: ['Ce que le code rend', 'Valeur'],
    compte: 'Lignes lues',
    somme: 'Somme exacte',
    flottante: 'La même somme en flottants',
    moyenne: 'Moyenne des lignes lues',
    borne: 'Plus petite et plus grande',
    lu: (n, e) => (e ? `${n} ligne(s) lue(s), ${e} écartée(s)` : `${n} ligne(s) lue(s)`),
    rien: 'Aucun nombre dans cette colonne',
    ecart: (l) => `Écartées : ${l}.`,
    raisons: {
      empty: 'ligne vide',
      'not a number': 'pas un nombre',
      'not text': 'pas du texte',
      'written with « , » as the decimal sign': 'écrite avec la virgule comme signe décimal',
      'written with « . » as the decimal sign': 'écrite avec le point comme signe décimal',
    },
  },
  en: {
    colonnes: ['What the code returns', 'Value'],
    compte: 'Rows read',
    somme: 'Exact sum',
    flottante: 'The same sum in floats',
    moyenne: 'Mean of the rows read',
    borne: 'Smallest and largest',
    lu: (n, e) => (e ? `${n} row(s) read, ${e} skipped` : `${n} row(s) read`),
    rien: 'No number in this column',
    ecart: (l) => `Skipped: ${l}.`,
    raisons: {
      empty: 'empty row',
      'not a number': 'not a number',
      'not text': 'not text',
      'written with « , » as the decimal sign': 'written with a comma as the decimal sign',
      'written with « . » as the decimal sign': 'written with a dot as the decimal sign',
    },
  },
};

export default {
  level: 'N0',

  note: {
    fr: 'Rien ne part sur le réseau : l’addition se fait dans votre navigateur, sur des entiers. La ligne « en flottants » est la même colonne additionnée comme le ferait un code ordinaire.',
    en: 'Nothing goes out on the network: the adding happens in your browser, on integers. The “in floats” line is the same column added the way ordinary code would.',
  },

  run(input, lang, cas) {
    const t = T[lang];
    const valeurs = input.split('\n');
    const rapport = aggregate(valeurs, cas?.signe ?? '.');
    if (rapport.reason) return { verdict: { label: t.rien, detail: rapport.reason } };

    const { figures, skipped } = rapport;
    if (figures.count === 0) {
      return {
        verdict: {
          label: t.rien,
          detail: t.ecart(skipped.map((e) => `${e.row + 1} (${t.raisons[e.why] ?? e.why})`).join(', ')),
        },
      };
    }

    let flottante = 0;
    for (const valeur of valeurs) {
      const nombre = Number(String(valeur).trim().replace(cas?.signe ?? '.', '.'));
      if (Number.isFinite(nombre) && String(valeur).trim() !== '') flottante += nombre;
    }

    return {
      rows: {
        columns: t.colonnes,
        rows: [
          [t.compte, String(figures.count)],
          [t.somme, { v: figures.sum, caught: true }],
          [t.flottante, String(flottante)],
          [t.moyenne, figures.mean],
          [t.borne, `${figures.minimum} … ${figures.maximum}`],
        ],
      },
      verdict: {
        label: t.lu(figures.count, skipped.length),
        detail: skipped.length
          ? t.ecart(skipped.map((e) => `${e.row + 1} (${t.raisons[e.why] ?? e.why})`).join(', '))
          : undefined,
      },
    };
  },

  cases: [
    {
      label: { fr: 'Une colonne de facture', en: 'An invoice column' },
      input: '83.87\n60.07\n12.35\n55.95\n1.38\n31.36',
    },
    {
      label: { fr: 'La même colonne avec ses trous', en: 'The same column with its gaps' },
      input: '83.87\n\nn/a\n12.35\nTotal\n31.36',
    },
    {
      label: { fr: 'Une colonne écrite à la française', en: 'A column written the French way' },
      input: '1250,00\n125,00\n1125,50',
      signe: ',',
    },
    {
      label: { fr: 'Deux cents centimes, un par ligne', en: 'Two hundred cents, one per row' },
      input: Array.from({ length: 200 }, () => '0.01').join('\n'),
      shown: {
        fr: 'deux cents lignes portant chacune un centime',
        en: 'two hundred rows, one cent each',
      },
      fails: true,
      why: {
        fr: 'La somme exacte est 2,00, et la somme flottante de la même colonne ne l’est pas : additionner deux cents fois un centime en binaire laisse une trace dans les derniers bits. L’écart ne déplace pas les centimes ici, mais il suffit à ce qu’une comparaison au total attendu échoue, et il se voit dès qu’on écrit le nombre. C’est le seul point de cette fiche : l’addition n’est pas le problème, la représentation l’est — et une somme compensée, la réponse classique, n’y change rien, comme le montre le test.',
        en: 'The exact sum is 2.00, and the float sum of the same column is not: adding one cent two hundred times in binary leaves a trace in the last bits. The gap does not move the cents here, but it is enough for a comparison against the expected total to fail, and it shows as soon as the number is written out. That is the whole point of this entry: the addition is not the problem, the representation is — and a compensated sum, the classic answer, changes nothing, as the test shows.',
      },
    },
  ],
};
