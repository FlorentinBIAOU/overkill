/**
 * Essai figé — valider un fichier importé contre son schéma.
 *
 * Figé, et non interactif : l'extrait du niveau recommandé s'appuie sur `ajv`,
 * un paquet installé que le navigateur ne résout pas. Les sorties sont
 * calculées à la construction du site, en exécutant le vrai extrait.
 *
 * Le schéma est le même pour tous les cas — un contrat d'import de factures —
 * et c'est le document qui change. Le tableau montre ce que le validateur rend
 * vraiment : un chemin, une règle, un message.
 */
import { validateImport } from '../../snippets/validate-an-imported-file-against-a-schema/n0.js';

const SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['reference', 'montant', 'date'],
  additionalProperties: false,
  properties: {
    reference: { type: 'string', pattern: '^FA-[0-9]{6}$' },
    montant: { type: 'number', minimum: 0 },
    date: { type: 'string', format: 'date' },
    client: { type: 'string' },
  },
};

// Le même contrat, avec le montant écrit comme un multiple d'un centime :
// la façon naturelle de dire « des euros et des centimes ».
const SCHEMA_CENTIMES = { type: 'number', multipleOf: 0.01 };

const DOCUMENTS = {
  correcte: { reference: 'FA-000123', montant: 1250.0, date: '2026-01-12', client: 'Boulangerie Martin' },
  faute: { reference: 'FA-000123', montnat: 1250.0, montant: 0, date: '2026-01-12' },
  date: { reference: 'FA-000123', montant: 1250.0, date: '2026-02-30' },
  tout: { reference: 'FA-12', montant: '1 250,00', date: '12/01/2026' },
  centimes: 19.99,
};

const T = {
  fr: {
    colonnes: ['Chemin', 'Règle', 'Message'],
    ok: 'Valide',
    ko: (n) => `${n} erreur(s)`,
    racine: '(la racine)',
  },
  en: {
    colonnes: ['Path', 'Rule', 'Message'],
    ok: 'Valid',
    ko: (n) => `${n} error(s)`,
    racine: '(the root)',
  },
};

export default {
  level: 'N0',

  note: {
    fr: 'Le même contrat d’import pour tous les cas, sauf le dernier qui n’a qu’un montant. Les sorties sont celles de l’extrait, exécutées à la construction du site.',
    en: 'The same import contract for every case, except the last one which is only an amount. The outputs are the snippet’s own, run when the site is built.',
  },

  run(input, lang, cas) {
    const t = T[lang];
    const document = DOCUMENTS[cas?.document ?? 'correcte'];
    const schema = cas?.document === 'centimes' ? SCHEMA_CENTIMES : SCHEMA;
    const rapport = validateImport(document, schema);
    return {
      rows: {
        columns: t.colonnes,
        rows: rapport.errors.map((e) => [
          { v: e.path || t.racine, caught: true },
          e.rule,
          e.message,
        ]),
      },
      verdict: {
        label: rapport.valid ? t.ok : t.ko(rapport.error_count),
        detail: input,
      },
      output: JSON.stringify(document, null, 2),
    };
  },

  cases: [
    {
      label: { fr: 'Une facture conforme au contrat', en: 'An invoice that follows the contract' },
      input: { fr: 'Rien à signaler : les quatre champs sont là et bien typés.', en: 'Nothing to report: the four fields are there and correctly typed.' },
      document: 'correcte',
    },
    {
      label: { fr: 'Un nom de champ mal orthographié', en: 'A field name misspelt' },
      input: { fr: '« montnat » au lieu de « montant » : le schéma fermé le nomme au lieu de le perdre.', en: '“montnat” instead of “montant”: the closed schema names it instead of losing it.' },
      document: 'faute',
    },
    {
      label: { fr: 'Une date qui n’existe pas', en: 'A date that does not exist' },
      input: { fr: 'Le 30 février : refusé, parce que le contrôle de format est allumé.', en: '30 February: refused, because format checking is switched on.' },
      document: 'date',
    },
    {
      label: { fr: 'Trois erreurs dans le même enregistrement', en: 'Three errors in one record' },
      input: { fr: 'Toutes rendues, rangées par place dans le document, pas seulement la première.', en: 'All returned, ordered by place in the document, not just the first.' },
      document: 'tout',
    },
    {
      label: { fr: 'Un montant ordinaire contre « multipleOf: 0.01 »', en: 'An ordinary amount against “multipleOf: 0.01”' },
      input: { fr: 'Le montant 19,99 : parfaitement ordinaire, et refusé.', en: 'The amount 19.99: perfectly ordinary, and refused.' },
      document: 'centimes',
      fails: true,
      why: {
        fr: '« multipleOf: 0.01 » est la façon naturelle d’écrire « des euros et des centimes », et elle refuse 1 363 des 10 000 montants de 0,00 à 99,99 — dont 19,99, 4,35 et 1 234,56 — parce qu’un nombre JSON est un flottant binaire et que 0,01 ne s’y écrit pas exactement. La réponse n’est pas un autre validateur : c’est d’écrire le montant en centimes entiers, ce que les mêmes 10 000 valeurs passent sans une erreur.',
        en: '“multipleOf: 0.01” is the natural way to write “euros and cents”, and it refuses 1,363 of the 10,000 amounts from 0.00 to 99.99 — among them 19.99, 4.35 and 1,234.56 — because a JSON number is a binary float and 0.01 has no exact form in one. The answer is not another validator: it is writing the amount as a whole number of cents, which the same 10,000 values pass without a single error.',
      },
    },
  ],
};
