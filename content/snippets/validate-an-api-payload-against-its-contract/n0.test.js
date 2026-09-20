import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv2020 from 'ajv/dist/2020.js';

import { MAX_ERRORS, validateRequest } from './n0.js';

const Ajv = Ajv2020.default ?? Ajv2020;

// Le contrat d'une API de facturation, écrit comme on les écrit : un chemin
// exact à côté d'un chemin gabarité, des références internes, et un champ
// annulable à la façon d'OpenAPI 3.0.
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
        responses: { 201: { description: 'créée' } },
      },
    },
    '/factures/{id}': {
      get: { responses: { 200: { description: 'ok' } } },
      put: {
        requestBody: {
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Facture' } } },
        },
        responses: { 200: { description: 'ok' } },
      },
    },
    '/factures/resume': { get: { responses: { 200: { description: 'ok' } } } },
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

// Le même contrat, avec un point d'accès qui reçoit un lot de factures.
const DOCUMENT_LOT = {
  ...DOCUMENT,
  paths: {
    ...DOCUMENT.paths,
    '/factures/lot': {
      post: {
        requestBody: {
          content: {
            'application/json': {
              schema: { type: 'array', items: { $ref: '#/components/schemas/Facture' } },
            },
          },
        },
      },
    },
  },
};

const FACTURE = { reference: 'FA-000123', montant_ht: 1000, tva: 200, montant_ttc: 1200 };
const FAUSSE_ARITHMETIQUE = { ...FACTURE, montant_ttc: 999 };

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : une facture qui ne tombe pas juste est valide', () => {
  const rapport = validateRequest(DOCUMENT, 'POST', '/factures', FAUSSE_ARITHMETIQUE);
  assert.equal(rapport.valid, true);
  assert.equal(rapport.operation, 'post /factures');
  assert.notEqual(
    FAUSSE_ARITHMETIQUE.montant_ht + FAUSSE_ARITHMETIQUE.tva,
    FAUSSE_ARITHMETIQUE.montant_ttc,
  );
});

test('point de rupture : témoin, une faute de forme est bien attrapée', () => {
  // « Le témoin est dans le même test : le même montant écrit « 1 000,00 »
  // est refusé, avec son chemin et sa règle. » L'exemple est celui de la
  // fiche, mot pour mot : c'est ainsi qu'un partenaire francophone écrit mille
  // euros, et le contrat demande un nombre.
  const rapport = validateRequest(DOCUMENT, 'POST', '/factures',
    { ...FACTURE, montant_ht: '1 000,00' });
  assert.equal(rapport.valid, false);
  assert.deepEqual(rapport.errors, [{ path: '/montant_ht', rule: 'type' }]);
  assert.equal(
    validateRequest(DOCUMENT, 'POST', '/factures', { ...FACTURE, montant_ht: 1000 }).valid,
    true,
  );
});

// ---------------------------------------------------------------------------
// Les autres affirmations du niveau
// ---------------------------------------------------------------------------

test('un chemin exact gagne sur un chemin gabarité', () => {
  assert.equal(validateRequest(DOCUMENT, 'GET', '/factures/resume', null).operation,
    'get /factures/resume');
  assert.equal(validateRequest(DOCUMENT, 'GET', '/factures/42', null).operation,
    'get /factures/{id}');
  assert.equal(validateRequest(DOCUMENT, 'PUT', '/factures/42', FACTURE).operation,
    'put /factures/{id}');
});

test('une référence interne se résout, même imbriquée', () => {
  const rapport = validateRequest(DOCUMENT, 'POST', '/factures', { ...FACTURE, client: {} });
  assert.deepEqual(rapport.errors, [{ path: '/client', rule: 'required' }]);
  assert.equal(
    validateRequest(DOCUMENT, 'POST', '/factures', { ...FACTURE, client: { nom: 'Martin' } }).valid,
    true,
  );
});

test('nullable de la version 3.0 est traduit avant validation', () => {
  // Docstring : « `ajv` honours it, `jsonschema` ignores it ». Côté
  // JavaScript, la traduction ne change rien parce qu'ajv le gérait déjà — et
  // c'est précisément ce qui faisait diverger les deux extraits.
  const avecNull = { ...FACTURE, client: { nom: 'Martin', siren: null } };
  assert.equal(validateRequest(DOCUMENT, 'POST', '/factures', avecNull).valid, true);
  const brut = new Ajv({ allErrors: true, strictSchema: false })
    .compile({ ...DOCUMENT, $ref: '#/components/schemas/Client' });
  assert.equal(brut({ nom: 'Martin', siren: null }), true);
  assert.equal(brut({ nom: 'Martin', siren: '732829320' }), true);
});

test('un chemin ou une méthode absents sont une raison', () => {
  // R14 : quatre situations que le code distingue, quatre raisons.
  assert.equal(validateRequest(DOCUMENT, 'POST', '/clients', {}).reason,
    'no path in the document matches /clients');
  assert.equal(validateRequest(DOCUMENT, 'DELETE', '/factures/42', null).reason,
    'DELETE is not declared on /factures/{id}');
  // Un document qui n'en est pas un, et un contrat que le validateur refuse de
  // compiler : deux formes d'inutilisable, et la même raison, parce que le
  // code ne les distingue pas.
  assert.equal(validateRequest('pas un document', 'POST', '/factures', {}).reason,
    'this document is not usable');
  const casse = {
    openapi: '3.0.3',
    paths: {
      '/factures': {
        post: { requestBody: { content: { 'application/json': { schema: { type: 12 } } } } },
      },
    },
  };
  assert.equal(validateRequest(casse, 'POST', '/factures', {}).reason,
    'this document is not usable');
  assert.equal(validateRequest(DOCUMENT, 'GET', '/factures/42', { x: 1 }).reason,
    'no body is declared');
});

test('une opération sans corps déclaré refuse un corps', () => {
  assert.equal(validateRequest(DOCUMENT, 'GET', '/factures/42', null).valid, true);
  const refus = validateRequest(DOCUMENT, 'GET', '/factures/42', { a: 1 });
  assert.equal(refus.valid, false);
  assert.equal(refus.reason, 'no body is declared');
});

test('toutes les erreurs sont rendues, rangées par chemin', () => {
  const rapport = validateRequest(DOCUMENT, 'POST', '/factures', {
    reference: 'FA-12', montant_ht: -1, tva: 'x', montant_ttc: 1, extra: 1,
  });
  assert.equal(rapport.error_count, 4);
  assert.deepEqual(rapport.errors, [
    { path: '', rule: 'additionalProperties' },
    { path: '/montant_ht', rule: 'minimum' },
    { path: '/reference', rule: 'pattern' },
    { path: '/tva', rule: 'type' },
  ]);
});

test('un document inutilisable est une raison, pas une exception', () => {
  const casse = {
    paths: { '/x': { post: { requestBody: {
      content: { 'application/json': { schema: { type: 'objet' } } } } } } },
  };
  for (const mauvais of [null, 'openapi', 42, casse]) {
    const rapport = validateRequest(mauvais, 'POST', '/x', {});
    assert.equal(rapport.valid, false);
    assert.equal(typeof rapport.reason, 'string');
  }
});

test("les propriétés en trop ne comptent qu'une fois", () => {
  // Docstring : « `ajv` gives one failure per property, `jsonschema` a single
  // one for all of them — so `additionalProperties` failures at the same place
  // are collapsed into one ».
  const rapport = validateRequest(DOCUMENT, 'POST', '/factures',
    { ...FACTURE, a: 1, b: 2, c: 3 });
  assert.deepEqual(rapport.errors, [{ path: '', rule: 'additionalProperties' }]);
  assert.equal(rapport.error_count, 1);
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('deux gabarits qui correspondent sont départagés par une règle écrite', () => {
  // Commentaire de `matchPath` : « the one with the fewest variables wins,
  // then the one whose first concrete segment comes earliest. »
  const deux = {
    openapi: '3.0.3',
    paths: { '/factures/{id}': { get: {} }, '/{ressource}/{id}': { get: {} } },
  };
  assert.equal(validateRequest(deux, 'GET', '/factures/42', null).operation, 'get /factures/{id}');
  assert.equal(validateRequest(deux, 'GET', '/clients/42', null).operation,
    'get /{ressource}/{id}');
  const inverse = {
    openapi: '3.0.3',
    paths: { '/{ressource}/{id}': { get: {} }, '/factures/{id}': { get: {} } },
  };
  assert.equal(validateRequest(inverse, 'GET', '/factures/42', null).operation,
    'get /factures/{id}');
  const second = {
    openapi: '3.0.3',
    paths: { '/{ressource}/resume': { get: {} }, '/{ressource}/{id}': { get: {} } },
  };
  assert.equal(validateRequest(second, 'GET', '/factures/resume', null).operation,
    'get /{ressource}/resume');
});

test("error_count compte ce qui est gardé, pas ce que le validateur lève", () => {
  // Commentaire : « `error_count` counts what this function kept, not what the
  // validator raised. »
  const deuxEnTrop = { ...FACTURE, inconnu_a: 1, inconnu_b: 2 };
  const rapport = validateRequest(DOCUMENT, 'POST', '/factures', deuxEnTrop);
  assert.deepEqual(rapport.errors, [{ path: '', rule: 'additionalProperties' }]);
  assert.equal(rapport.error_count, 1);
});

test('production : entrée banale, une facture postée par un partenaire', () => {
  const rapport = validateRequest(DOCUMENT, 'POST', '/factures', {
    ...FACTURE, client: { nom: 'Boulangerie Martin', siren: '732829320' },
  });
  assert.deepEqual(rapport, {
    valid: true, operation: 'post /factures', errors: [],
    error_count: 0, truncated: false, reason: null,
  });
});

test('production : entrée vide', () => {
  const vide = validateRequest(DOCUMENT, 'POST', '/factures', {});
  assert.equal(vide.valid, false);
  assert.equal(vide.error_count, 4);
  assert.ok(validateRequest(DOCUMENT, 'POST', '', {}).reason.startsWith('no path'));
});

test('production : entrée très grande et terminaison rapide', () => {
  const enorme = { ...FACTURE };
  for (let i = 0; i < 10_000; i += 1) enorme[`champ${i}`] = i;
  const debut = performance.now();
  const rapport = validateRequest(DOCUMENT, 'POST', '/factures', enorme);
  assert.ok(performance.now() - debut < 60_000);
  assert.deepEqual(rapport.errors, [{ path: '', rule: 'additionalProperties' }]);

  const lot = Array.from({ length: 300 }, () => ({ ...FACTURE, montant_ht: 'x' }));
  const plafonne = validateRequest(DOCUMENT_LOT, 'POST', '/factures/lot', lot);
  assert.equal(plafonne.error_count, 300);
  assert.equal(plafonne.errors.length, MAX_ERRORS);
  assert.equal(plafonne.truncated, true);
});

test('production : encodages inattendus', () => {
  for (const nom of ['Boulangerie Martin', 'Café de la Gare', '🥖', '﻿Martin']) {
    assert.equal(
      validateRequest(DOCUMENT, 'POST', '/factures', { ...FACTURE, client: { nom } }).valid,
      true, nom,
    );
  }
  assert.equal(validateRequest(DOCUMENT, 'POST', '/factûres', FACTURE).operation, null);
});

test('production : valeurs aux limites', () => {
  assert.equal(validateRequest(DOCUMENT, 'POST', '/factures',
    { ...FACTURE, montant_ht: 0 }).valid, true);
  assert.equal(validateRequest(DOCUMENT, 'POST', '/factures',
    { ...FACTURE, montant_ht: -0.01 }).valid, false);
  assert.equal(validateRequest(DOCUMENT, 'GET', '/factures/42/', null).operation,
    'get /factures/{id}');
  assert.equal(validateRequest(DOCUMENT, 'GET', '/factures//42', null).operation, null);
});

test("production : une requête fausse n'empêche pas de valider les suivantes", () => {
  const lot = [['POST', '/factures', FACTURE], ['POST', '/clients', {}],
    ['PUT', '/factures/7', FACTURE], ['GET', '/factures/7', null]];
  assert.deepEqual(
    lot.map(([m, p, b]) => validateRequest(DOCUMENT, m, p, b).valid),
    [true, false, true, true],
  );
});

test('production : la validation tient la classe de latence annoncée', () => {
  validateRequest(DOCUMENT, 'POST', '/factures', FACTURE);
  const debut = performance.now();
  for (let i = 0; i < 1_000; i += 1) validateRequest(DOCUMENT, 'POST', '/factures', FACTURE);
  assert.ok(performance.now() - debut < 60_000);
});

/**
 * Un document OpenAPI de la taille d'une vraie API : quatre cents chemins,
 * deux méthodes chacun, un schéma de quarante-deux propriétés. Le chemin
 * `/factures` y est toujours, pour valider la même requête que partout.
 */
function documentDe(chemins, proprietes = 42) {
  const props = Object.fromEntries(
    Array.from({ length: proprietes }, (unused, i) => [`champ_${i}`, { type: 'string' }]),
  );
  const schema = {
    type: 'object', required: ['numero'], properties: { numero: { type: 'string' }, ...props },
  };
  const paths = {};
  for (let i = 0; i < chemins; i += 1) {
    paths[`/ressource${i}/{id}`] = Object.fromEntries(['post', 'put'].map((methode) => [
      methode,
      { requestBody: { content: { 'application/json': { schema: structuredClone(schema) } } } },
    ]));
  }
  paths['/factures'] = {
    post: {
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object', required: ['numero'], properties: { numero: { type: 'string' } },
            },
          },
        },
      },
    },
  };
  return { openapi: '3.0.3', paths };
}

test("le temps par requête ne dépend pas de la taille du document", () => {
  // Commentaire : « Keyed by the identity of the document, never by its
  // contents. »
  //
  // C'était le défaut : la clé du cache sérialisait le document entier à
  // chaque requête. Le rapport est ici borné large — la borne attrape un
  // effondrement, elle ne mesure rien.
  const petit = documentDe(2);
  const gros = documentDe(400);
  const corps = { numero: 'FA-2026-0412' };
  assert.ok(JSON.stringify(gros).length > 100_000);
  for (const document of [petit, gros]) {
    assert.equal(validateRequest(document, 'POST', '/factures', corps).valid, true);
  }
  const parAppel = (document) => {
    const debut = performance.now();
    for (let i = 0; i < 200; i += 1) validateRequest(document, 'POST', '/factures', corps);
    return (performance.now() - debut) / 200;
  };
  assert.ok(parAppel(gros) < 10 * parAppel(petit));
});

test('le document compilé est gardé, et le cache est plafonné', () => {
  // Commentaire : « compiling a document costs more than checking one body
  // against it — far more here ». Le gain est mesuré dans les deux langages et
  // il est très inégal ; le relevé donne les deux chiffres.
  validateRequest(DOCUMENT, 'POST', '/factures', FACTURE);
  let debut = performance.now();
  for (let i = 0; i < 500; i += 1) validateRequest(DOCUMENT, 'POST', '/factures', FACTURE);
  const garde = performance.now() - debut;

  debut = performance.now();
  for (let i = 0; i < 500; i += 1) {
    validateRequest({ ...DOCUMENT, info: { title: `t${i}`, version: '1' } },
      'POST', '/factures', FACTURE);
  }
  const recompile = performance.now() - debut;
  assert.ok(garde * 10 < recompile, `${garde} contre ${recompile}`);
  // Le cache reste borné : le document d'origine répond toujours juste.
  assert.equal(validateRequest(DOCUMENT, 'POST', '/factures', FACTURE).valid, true);
});
