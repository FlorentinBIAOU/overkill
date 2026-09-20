import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';

import { MAX_ERRORS, validateImport } from './n0.js';

const Ajv = Ajv2020.default ?? Ajv2020;
const addFormats = addFormatsModule.default ?? addFormatsModule;

// Le contrat d'un import de factures : ce qu'une entreprise écrit vraiment.
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

// Le même contrat, avec le montant exprimé comme un multiple d'un centime.
const SCHEMA_CENTIMES = { type: 'number', multipleOf: 0.01 };
const SCHEMA_ENTIER = { type: 'integer', minimum: 0 };
const SCHEMA_LOT = { type: 'array', items: SCHEMA };

const BANALE = {
  reference: 'FA-000123', montant: 1250.0, date: '2026-01-12', client: 'Boulangerie Martin',
};

/** Un fichier d'import : un tableau d'enregistrements, dont certains faux. */
function lot(nombre, mauvais = new Set()) {
  return Array.from({ length: nombre }, (unused, i) => ({
    ...BANALE,
    reference: `FA-${String(i).padStart(6, '0')}`,
    ...(mauvais.has(i) ? { montant: '1 250,00' } : {}),
  }));
}

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test("point de rupture : un multiple d'un centime refuse des montants justes", () => {
  const montants = Array.from({ length: 10_000 }, (unused, i) => Number((i / 100).toFixed(2)));
  const refuses = montants.filter((m) => !validateImport(m, SCHEMA_CENTIMES).valid);
  assert.equal(refuses.length, 1_363);
  for (const montant of [19.99, 4.35, 0.29, 1234.56]) {
    assert.equal(validateImport(montant, SCHEMA_CENTIMES).valid, false, String(montant));
  }
  assert.equal(validateImport(12.37, SCHEMA_CENTIMES).valid, true);
});

test('point de rupture : témoin, le même montant en centimes entiers passe', () => {
  const refuses = Array.from({ length: 10_000 }, (unused, i) => i)
    .filter((i) => !validateImport(i, SCHEMA_ENTIER).valid);
  assert.deepEqual(refuses, []);
});

// ---------------------------------------------------------------------------
// Les autres affirmations du niveau
// ---------------------------------------------------------------------------

test("le format est inerte tant qu'on ne l'allume pas", () => {
  // Docstring : « `ajv` refuses to compile the schema at all until the formats
  // are registered ». C'est sa réaction, et elle diffère de celle de
  // `jsonschema`, qui accepte en silence.
  const schemaDate = { type: 'string', format: 'date' };
  assert.throws(() => new Ajv({ allErrors: true }).compile(schemaDate), /unknown format/);
  // Contrôles stricts éteints, il ignore le format comme le fait `jsonschema`.
  const ignorant = new Ajv({ allErrors: true, strictSchema: false }).compile(schemaDate);
  const avec = new Ajv({ allErrors: true, strictSchema: false });
  addFormats(avec);
  const allume = avec.compile(schemaDate);
  for (const ecrit of ['12/01/2026', '2026-02-30']) {
    assert.equal(ignorant(ecrit), true, ecrit);
    assert.equal(allume(ecrit), false, ecrit);
    assert.equal(validateImport(ecrit, schemaDate).valid, false, ecrit);
  }
  assert.equal(validateImport('2026-01-12', schemaDate).valid, true);
});

test('toutes les erreurs sont rendues, pas seulement la première', () => {
  const rapport = validateImport(
    { reference: 'FA-12', montant: 'x', date: '12/01/2026' }, SCHEMA,
  );
  assert.equal(rapport.error_count, 3);
  assert.deepEqual(rapport.errors.map((e) => e.rule), ['format', 'type', 'pattern']);
  assert.deepEqual(rapport.errors.map((e) => e.path), ['/date', '/montant', '/reference']);
});

test("chaque erreur porte un chemin et le nom d'une règle", () => {
  const rapport = validateImport(lot(3, new Set([1])), SCHEMA_LOT);
  assert.equal(rapport.errors.length, 1);
  assert.equal(rapport.errors[0].path, '/1/montant');
  assert.equal(rapport.errors[0].rule, 'type');
});

test('les erreurs sont rangées par place dans le document', () => {
  const rapport = validateImport(lot(20, new Set([2, 10, 1])), SCHEMA_LOT);
  assert.deepEqual(
    rapport.errors.map((e) => e.path),
    ['/1/montant', '/2/montant', '/10/montant'],
  );
});

test('au-delà du plafond, le compte est rendu et le drapeau levé', () => {
  const tous = new Set(Array.from({ length: MAX_ERRORS + 50 }, (unused, i) => i));
  const rapport = validateImport(lot(MAX_ERRORS + 50, tous), SCHEMA_LOT);
  assert.equal(rapport.error_count, MAX_ERRORS + 50);
  assert.equal(rapport.errors.length, MAX_ERRORS);
  assert.equal(rapport.truncated, true);
  assert.equal(validateImport(lot(3, new Set([0])), SCHEMA_LOT).truncated, false);
});

test("un schéma inutilisable est une raison, pas une exception", () => {
  for (const mauvais of [{ type: 'objet' }, 'pas un schéma', null, { required: 'reference' }]) {
    const rapport = validateImport(BANALE, mauvais);
    assert.equal(rapport.valid, false);
    assert.equal(rapport.reason, 'this schema is not usable');
  }
  assert.equal(validateImport(BANALE, SCHEMA).reason, null);
});

test('un champ mal orthographié est attrapé parce que le schéma est fermé', () => {
  const avecFaute = { ...BANALE, montnat: 1250.0 };
  const rapport = validateImport(avecFaute, SCHEMA);
  assert.equal(rapport.valid, false);
  assert.equal(rapport.errors[0].rule, 'additionalProperties');
  const ouvert = { ...SCHEMA };
  delete ouvert.additionalProperties;
  assert.equal(validateImport(avecFaute, ouvert).valid, true);
});

test('le schéma compilé est gardé, et le cache est plafonné', () => {
  // Commentaire : « Compiling a schema costs far more than checking one
  // document against it ». Mesuré ici sur le même document et le même schéma,
  // à un titre près — ce qui suffit à en faire un autre schéma à compiler.
  validateImport(BANALE, SCHEMA); // une passe de chauffe
  let debut = performance.now();
  for (let i = 0; i < 1_000; i += 1) validateImport(BANALE, SCHEMA);
  const garde = performance.now() - debut;

  debut = performance.now();
  for (let i = 0; i < 1_000; i += 1) {
    validateImport(BANALE, { ...SCHEMA, title: `schéma ${i}` });
  }
  const recompile = performance.now() - debut;

  assert.ok(garde * 5 < recompile, `${garde} contre ${recompile}`);
  // Et après mille schémas, le cache est toujours borné : la preuve en est
  // que le premier schéma doit être recompilé.
  assert.equal(validateImport(BANALE, SCHEMA).valid, true);
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test("production : entrée banale, une facture d'un export comptable", () => {
  assert.deepEqual(validateImport(BANALE, SCHEMA), {
    valid: true, errors: [], error_count: 0, truncated: false, reason: null,
  });
});

test('production : entrée vide', () => {
  assert.equal(validateImport({}, SCHEMA).error_count, 3);
  assert.equal(validateImport([], SCHEMA_LOT).valid, true);
  assert.equal(validateImport(null, SCHEMA).valid, false);
});

test('production : entrée très grande et terminaison rapide', () => {
  const grand = lot(10_000, new Set([4_321]));
  const debut = performance.now();
  const rapport = validateImport(grand, SCHEMA_LOT);
  assert.ok(performance.now() - debut < 60_000);
  assert.equal(rapport.error_count, 1);
  assert.equal(rapport.errors[0].path, '/4321/montant');
});

test('production : encodages inattendus', () => {
  for (const client of ['Boulangerie Martin', 'Café de la Gare', '🥖', '﻿Martin', 'a​b']) {
    assert.equal(validateImport({ ...BANALE, client }, SCHEMA).valid, true, client);
  }
  assert.equal(validateImport({ ...BANALE, réference: 'x' }, SCHEMA).valid, false);
});

test('production : valeurs aux limites', () => {
  assert.equal(validateImport({ ...BANALE, montant: 0 }, SCHEMA).valid, true);
  assert.equal(validateImport({ ...BANALE, montant: -0.01 }, SCHEMA).valid, false);
  assert.equal(validateImport({ ...BANALE, montant: 1250 }, SCHEMA).valid, true);
  assert.equal(validateImport({ ...BANALE, montant: true }, SCHEMA).valid, false);
  const tous = new Set(Array.from({ length: MAX_ERRORS }, (unused, i) => i));
  const auPlafond = validateImport(lot(MAX_ERRORS, tous), SCHEMA_LOT);
  assert.deepEqual([auPlafond.error_count, auPlafond.truncated], [MAX_ERRORS, false]);
});

test("production : un enregistrement faux n'empêche pas de voir les autres", () => {
  const rapport = validateImport(lot(5, new Set([0, 4])), SCHEMA_LOT);
  assert.deepEqual(rapport.errors.map((e) => e.path), ['/0/montant', '/4/montant']);
  assert.equal(rapport.error_count, 2);
});

test('production : la validation tient la classe de latence annoncée', () => {
  const debut = performance.now();
  for (let i = 0; i < 1_000; i += 1) validateImport(BANALE, SCHEMA);
  assert.ok(performance.now() - debut < 60_000);
});
