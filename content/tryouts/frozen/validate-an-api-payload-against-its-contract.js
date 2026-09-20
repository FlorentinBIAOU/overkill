/**
 * Essai figé — valider une requête contre son contrat OpenAPI.
 *
 * Figé, et non interactif : l'extrait du niveau recommandé s'appuie sur `ajv`,
 * un paquet installé que le navigateur ne résout pas. Les sorties sont
 * calculées à la construction du site, en exécutant le vrai extrait sur le
 * document ci-dessous.
 *
 * Le contrat est le même pour tous les cas ; ce qui change est la requête. Le
 * verdict nomme l'opération que le code a retenue, parce qu'une requête
 * validée contre le mauvais chemin est un oui qui ne veut rien dire.
 */
import { validateRequest } from '../../snippets/validate-an-api-payload-against-its-contract/n0.js';

const DOCUMENT = {
  openapi: '3.1.0',
  info: { title: 'Facturation', version: '1.0.0' },
  paths: {
    '/factures': {
      post: {
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Facture' } } },
        },
      },
    },
    '/factures/{id}': { get: {} },
    '/factures/resume': { get: {} },
  },
  components: {
    schemas: {
      Facture: {
        type: 'object',
        required: ['reference', 'montant_ht', 'tva', 'montant_ttc'],
        additionalProperties: false,
        properties: {
          reference: { type: 'string', pattern: '^FA-[0-9]{6}$' },
          montant_ht: { type: 'number', minimum: 0 },
          tva: { type: 'number', minimum: 0 },
          montant_ttc: { type: 'number', minimum: 0 },
          client: { $ref: '#/components/schemas/Client' },
        },
      },
      Client: {
        type: 'object',
        required: ['nom'],
        properties: { nom: { type: 'string' }, siren: { type: 'string', nullable: true } },
      },
    },
  },
};

const FACTURE = { reference: 'FA-000123', montant_ht: 1000, tva: 200, montant_ttc: 1200 };

const REQUETES = {
  correcte: ['POST', '/factures', { ...FACTURE, client: { nom: 'Boulangerie Martin', siren: null } }],
  typee: ['POST', '/factures', { ...FACTURE, montant_ht: '1 000,00', reference: 'FA-12' }],
  resume: ['GET', '/factures/resume', null],
  inconnu: ['POST', '/clients', {}],
  arithmetique: ['POST', '/factures', { ...FACTURE, montant_ttc: 999 }],
};

const T = {
  fr: {
    colonnes: ['Chemin', 'Règle'],
    ok: (op) => `Conforme — ${op}`,
    ko: (n, op) => `${n} erreur(s) — ${op}`,
    hors: 'Hors contrat',
    racine: '(la racine)',
  },
  en: {
    colonnes: ['Path', 'Rule'],
    ok: (op) => `Matches — ${op}`,
    ko: (n, op) => `${n} error(s) — ${op}`,
    hors: 'Outside the contract',
    racine: '(the root)',
  },
};

export default {
  level: 'N0',

  note: {
    fr: 'Le même document OpenAPI pour tous les cas ; seule la requête change. Les sorties sont celles de l’extrait, exécutées à la construction du site.',
    en: 'The same OpenAPI document for every case; only the request changes. The outputs are the snippet’s own, run when the site is built.',
  },

  run(input, lang, cas) {
    const t = T[lang];
    const [methode, chemin, corps] = REQUETES[cas?.requete ?? 'correcte'];
    const rapport = validateRequest(DOCUMENT, methode, chemin, corps);
    const label = rapport.operation === null
      ? t.hors
      : rapport.valid ? t.ok(rapport.operation) : t.ko(rapport.error_count, rapport.operation);
    return {
      rows: {
        columns: t.colonnes,
        rows: rapport.errors.map((e) => [{ v: e.path || t.racine, caught: true }, e.rule]),
      },
      verdict: { label, detail: rapport.reason ?? input },
      output: `${methode} ${chemin}\n${JSON.stringify(corps, null, 2)}`,
    };
  },

  cases: [
    {
      label: { fr: 'Une facture conforme, avec un SIREN nul permis par le contrat', en: 'A conforming invoice, with a null company number the contract allows' },
      input: { fr: 'Le « nullable: true » d’OpenAPI 3.0 est traduit avant la validation.', en: 'OpenAPI 3.0’s “nullable: true” is translated before validation.' },
      requete: 'correcte',
    },
    {
      label: { fr: 'Un montant en texte et une référence trop courte', en: 'An amount as text and a reference too short' },
      input: { fr: 'Deux erreurs, chacune avec son chemin et la règle enfreinte.', en: 'Two errors, each with its path and the rule it broke.' },
      requete: 'typee',
    },
    {
      label: { fr: 'Le point d’accès de synthèse', en: 'The summary endpoint' },
      input: { fr: '« /factures/resume » n’est pas une facture nommée « resume » : le chemin exact gagne.', en: '“/factures/resume” is not an invoice called “resume”: the exact path wins.' },
      requete: 'resume',
    },
    {
      label: { fr: 'Un chemin que le document ne déclare pas', en: 'A path the document does not declare' },
      input: { fr: 'Nommé comme tel, et non confondu avec un corps invalide.', en: 'Named as such, and not confused with an invalid body.' },
      requete: 'inconnu',
    },
    {
      label: { fr: 'Une facture dont les montants ne tombent pas juste', en: 'An invoice whose amounts do not add up' },
      input: { fr: '1 000 et 200 de TVA, pour un total déclaré de 999.', en: '1,000 plus 200 of tax, for a declared total of 999.' },
      requete: 'arithmetique',
      fails: true,
      why: {
        fr: 'La requête est conforme, et elle est fausse. Aucun mot-clé de JSON Schema ne met deux champs en rapport : le contrat décrit la forme du corps, pas l’arithmétique qu’il doit respecter. Cette règle-là s’écrit dans votre code métier, et c’est le seul endroit où elle puisse vivre.',
        en: 'The request conforms, and it is wrong. No JSON Schema keyword relates two fields to each other: the contract describes the shape of the body, not the arithmetic it has to satisfy. That rule belongs in your business code, and it is the only place it can live.',
      },
    },
  ],
};
