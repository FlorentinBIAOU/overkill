/**
 * Essai interactif — nettoyer un CSV mal formé.
 *
 * Le vrai extrait du niveau recommandé, importé tel quel. Il attend des octets,
 * puisqu'un CSV est d'abord un fichier : ce que vous tapez est donc encodé en
 * UTF-8 avant d'être lu, comme le ferait un téléversement.
 *
 * Le tableau est reconstruit ligne à ligne, dans l'ordre du fichier, parce que
 * le journal des refus est le cœur de cet extrait : une ligne refusée doit
 * rester à sa place, avec son numéro et sa raison, et pas disparaître au bas
 * d'un résultat propre. Les numéros de ligne viennent de `parseRecords`, le
 * découpeur de l'extrait lui-même.
 */
import {
  cleanCsv,
  decodeText,
  parseRecords,
} from '../../snippets/convert-messy-csv-to-clean-data/n0.js';

/* Le schéma est de la donnée d'exemple, pas du code : il décrit les colonnes
   d'un export de facturation, et vit ici comme il vit dans les tests. */
const SCHEMA = {
  id: 'integer',
  client: 'text',
  date: 'date',
  montant: 'number',
  payee: 'boolean',
};

const T = {
  fr: {
    ligne: 'Ligne',
    journal: 'Journal',
    retenue: 'retenue',
    vide: '—',
    oui: 'oui',
    non: 'non',
    dialecte: (separateur) => `Séparateur détecté : « ${separateur} ».`,
    compte: (retenues, refus) =>
      `${retenues} ligne${retenues > 1 ? 's' : ''} retenue${retenues > 1 ? 's' : ''}, ${refus} refusée${refus > 1 ? 's' : ''}.`,
    rien: 'Aucune ligne à lire',
    rienDetail: 'Le fichier n’a pas même une ligne d’en-têtes.',
  },
  en: {
    ligne: 'Line',
    journal: 'Journal',
    retenue: 'kept',
    vide: '—',
    oui: 'yes',
    non: 'no',
    dialecte: (separateur) => `Delimiter detected: “${separateur}”.`,
    compte: (retenues, refus) =>
      `${retenues} row${retenues > 1 ? 's' : ''} kept, ${refus} refused.`,
    rien: 'Nothing to read',
    rienDetail: 'The file does not even carry a header line.',
  },
};

/** Une valeur typée, rendue lisible sans perdre ce que la coercition a fait. */
function affiche(valeur, t) {
  if (valeur === null) return t.vide;
  if (valeur === true) return t.oui;
  if (valeur === false) return t.non;
  return String(valeur);
}

export default {
  level: 'N0',

  note: {
    fr: 'Les colonnes attendues sont id, client, date, montant, payee. Une ligne refusée garde sa place et sa raison : c’est ce que cet extrait fait de mieux.',
    en: 'The expected columns are id, client, date, montant, payee. A refused line keeps its place and its reason: that is what this snippet does best.',
  },

  run(texte, lang) {
    const t = T[lang];
    const octets = new TextEncoder().encode(texte);
    const { columns, delimiter, quote, rows, rejects } = cleanCsv(octets, SCHEMA);
    if (columns.length === 0) {
      return { verdict: { label: t.rien, detail: t.rienDetail } };
    }

    const refus = new Map(rejects.map((refusee) => [refusee.line, refusee]));
    const enregistrements = parseRecords(decodeText(octets), delimiter, quote)
      // Le même filtre que l'extrait applique : une ligne blanche ne porte rien.
      .filter(([, champs]) => !(champs.length === 1 && champs[0] === ''))
      .slice(1); // l'en-tête est déjà dans `columns`

    const restantes = [...rows];
    const lignes = enregistrements.map(([numero, champs]) => {
      const refusee = refus.get(numero);
      if (refusee) {
        return [
          String(numero),
          ...columns.map((nom, index) => ({
            v: champs[index] ?? t.vide,
            caught: nom === refusee.column,
          })),
          refusee.reason,
        ];
      }
      const retenue = restantes.shift() ?? {};
      return [
        String(numero),
        ...columns.map((nom) => affiche(retenue[nom], t)),
        t.retenue,
      ];
    });

    return {
      rows: { columns: [t.ligne, ...columns, t.journal], rows: lignes },
      note: `${t.dialecte(delimiter)} ${t.compte(rows.length, rejects.length)}`,
    };
  },

  cases: [
    {
      label: {
        fr: 'Un export français : points-virgules, virgules décimales',
        en: 'A French export: semicolons, decimal commas',
      },
      input:
        'id;client;date;montant;payee\n' +
        '41;Boulangerie Martin;2023-04-12;12,50;oui\n' +
        '42;Café de la Gare;01/05/2023;"1 234,56";non\n' +
        '43;Menuiserie Dubois;2023-06-30;0.99;vrai\n',
    },
    {
      label: {
        fr: 'Un export anglo-saxon, dont un nom contient une virgule',
        en: 'An English-language export, with a comma inside a name',
      },
      input:
        'id,client,date,montant,payee\n' +
        '41,Boulangerie Martin,2023-04-12,"1,234.56",yes\n' +
        '42,"Dubois, Menuiserie",2023-05-01,99,no\n',
    },
    {
      label: {
        fr: 'Trois lignes refusées, et le journal dit laquelle et pourquoi',
        en: 'Three refused lines, and the journal says which and why',
      },
      input:
        'id;client;date;montant;payee\n' +
        '41;Boulangerie Martin;2023-04-12;12,50;oui\n' +
        '42;Café de la Gare;31/02/2023;18,00;non\n' +
        '43;Menuiserie Dubois;2023-06-30;douze euros;oui\n' +
        '44;Traiteur Léon;2023-07-02;45,00\n',
    },
    {
      label: {
        fr: 'La colonne date change de sens au milieu du fichier',
        en: 'The date column changes meaning halfway down the file',
      },
      input:
        'id;client;date;montant;payee\n' +
        '41;Boulangerie Martin;07/04/2023;12,50;oui\n' +
        '42;Café de la Gare;07/04/2023;18,00;non\n' +
        '43;Menuiserie Dubois;12/25/2023;45,00;oui\n',
      fails: true,
      why: {
        fr: 'Les lignes 41 et 42 portent la même écriture et deux jours différents — l’une vient d’un export jour d’abord, l’autre mois d’abord — et ressortent toutes deux au 7 avril, sans un mot dans le journal. Seule la ligne 43 est refusée, par chance : aucun mois n’a vingt-cinq jours.',
        en: 'Lines 41 and 42 carry the same spelling and two different days — one from a day-first export, one month-first — and both come out as 7 April, with nothing in the journal. Only line 43 is refused, and that is luck: no month has twenty-five days.',
      },
    },
  ],
};
