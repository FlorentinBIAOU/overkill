/**
 * Ces tests injectent un double local au lieu d'installer le vrai analyseur.
 *
 * Ce qu'ils prouvent : le lot part en un appel, une adresse trop longue est
 * refusée avant toute analyse, un échec est retenté, le jeu d'étiquettes de
 * l'analyseur est ramené au nôtre. Ce qu'ils ne prouvent pas : que libpostal
 * étiquette bien.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeClassifier } from '../_harness/fake-model.mjs';
import { FIELDS, LibpostalParser, MAX_CHARACTERS, ParsingUnavailable, parseAddresses } from './n2.js';

// Adresses inventées, et les composants que libpostal rendrait, dans son propre
// vocabulaire. Les valeurs sont les nôtres.
const FRENCH = '8 rue des Lilas, Appartement 12, 75011 Paris';
const GERMAN = 'Hauptstrasse 5, 10115 Berlin';
const BRITISH = '42 Rowan Street, Bristol BS1 4TQ';

const COMPONENTS = {
  [FRENCH]: {
    house_number: '8',
    road: 'rue des lilas',
    unit: 'appartement 12',
    postcode: '75011',
    city: 'paris',
  },
  [GERMAN]: { house_number: '5', road: 'hauptstrasse', postcode: '10115', city: 'berlin' },
  [BRITISH]: { house_number: '42', road: 'rowan street', postcode: 'bs1 4tq', city: 'bristol' },
};

const EMPTY = Object.fromEntries(FIELDS.map((name) => [name, '']));

// ---------------------------------------------------------------------------
// Point de rupture (plomberie)
// ---------------------------------------------------------------------------

test("point de rupture : une ligne qui n'est pas une adresse ressort en champs", async () => {
  const nonsense = 'the meeting is at ten in room four';
  const parser = new FakeClassifier({ [nonsense]: { house_number: 'ten', road: 'room four' } });
  assert.deepEqual(await parseAddresses([nonsense], parser), [{ ...EMPTY, number: 'ten', street: 'room four' }]);
});

test("point de rupture : un code postal d'une autre ville ressort en champs propres", async () => {
  const wrongTown = '8 rue des Lilas, 75011 Lyon';
  const parser = new FakeClassifier({ [wrongTown]: { house_number: '8', road: 'rue des lilas', postcode: '75011', city: 'lyon' } });
  const [wrong] = await parseAddresses([wrongTown], parser);
  const [right] = await parseAddresses([FRENCH], new FakeClassifier(COMPONENTS));
  assert.deepEqual(Object.keys(wrong), Object.keys(right));
  assert.deepEqual(wrong, { ...EMPTY, number: '8', street: 'rue des lilas', postcode: '75011', city: 'lyon' });
});

// ---------------------------------------------------------------------------
// Autres affirmations du niveau
// ---------------------------------------------------------------------------

test('découpe une adresse dans nos champs', async () => {
  assert.deepEqual(await parseAddresses([FRENCH], new FakeClassifier(COMPONENTS)), [
    { number: '8', street: 'rue des lilas', complement: 'appartement 12', postcode: '75011', city: 'paris' },
  ]);
});

test('lit les adresses étrangères qui cassaient les niveaux du dessous', async () => {
  const [german, british] = await parseAddresses([GERMAN, BRITISH], new FakeClassifier(COMPONENTS));
  assert.equal(german.number, '5');
  assert.equal(german.street, 'hauptstrasse');
  assert.equal(british.postcode, 'bs1 4tq');
  assert.equal(british.city, 'bristol');
});

test('le lot entier part en un appel', async () => {
  const parser = new FakeClassifier(COMPONENTS);
  await parseAddresses([FRENCH, GERMAN, BRITISH], parser);
  assert.deepEqual(parser.calls, [[FRENCH, GERMAN, BRITISH]]);
});

test("INFIRMÉ : « un lot de cent est un seul passage » ; LibpostalParser.predict appelle parse_address une fois par adresse", async () => {
  const calls = [];
  const parser = new LibpostalParser((address) => { calls.push(address); return [{ component: 'house_number', value: '8' }]; });
  await parseAddresses(Array.from({ length: 100 }, (_, i) => `${i} rue des Lilas`), parser);
  assert.equal(calls.length, 100);
  await assert.rejects(async () => {
    assert.equal(calls.length, 1);
  }, assert.AssertionError);
});

test('predict fusionne les paires composant/valeur et les composants répétés', async () => {
  const parser = new LibpostalParser(() => [
    { component: 'house_number', value: '8' }, { component: 'unit', value: 'bâtiment c' }, { component: 'unit', value: 'appartement 12' },
  ]);
  assert.deepEqual(await parser.predict(['a', 'b']), [{ house_number: '8', unit: 'bâtiment c appartement 12' }, { house_number: '8', unit: 'bâtiment c appartement 12' }]);
  assert.deepEqual(await parseAddresses(['a'], parser), [{ ...EMPTY, number: '8', complement: 'bâtiment c appartement 12' }]);
});

test('les étiquettes qui partagent un champ sont jointes, le reste est écarté', async () => {
  const parser = new FakeClassifier({
    [FRENCH]: { level: 'étage 3', unit: 'porte b', staircase: 'escalier a', entrance: 'entrée 2', house: 'résidence les ormes', country: 'france', po_box: 'bp 12', suburb: 'x' },
  });
  assert.deepEqual((await parseAddresses([FRENCH], parser))[0], { ...EMPTY, complement: 'étage 3 porte b escalier a entrée 2' });
});

test('INFIRMÉ : « Two of its labels can land in one of our fields » ; quatre tombent dans complement', async () => {
  const parser = new FakeClassifier({ [FRENCH]: { level: 'a', unit: 'b', staircase: 'c', entrance: 'd' } });
  const { complement } = (await parseAddresses([FRENCH], parser))[0];
  await assert.rejects(async () => {
    assert.equal(complement.split(' ').length, 2);
  }, assert.AssertionError);
});

test('une valeur vide, blanche ou non textuelle est écartée', async () => {
  const parser = new FakeClassifier({ [FRENCH]: { house_number: 8, road: '   ', postcode: null, city: 'paris' } });
  assert.deepEqual((await parseAddresses([FRENCH], parser))[0], { ...EMPTY, city: 'paris' });
});

test("une réponse vide donne des champs vides plutôt qu'une erreur", async () => {
  assert.deepEqual(await parseAddresses([FRENCH], new FakeClassifier({ [FRENCH]: {} })), [EMPTY]);
  assert.deepEqual(await parseAddresses([FRENCH], new FakeClassifier({ [FRENCH]: null })), [EMPTY]);
});

test("un lot vide n'atteint jamais l'analyseur", async () => {
  const parser = new FakeClassifier(COMPONENTS);
  assert.deepEqual(await parseAddresses([], parser), []);
  assert.deepEqual(parser.calls, []);
});

test("refuse une adresse trop longue avant d'analyser quoi que ce soit", async () => {
  const parser = new FakeClassifier({}, { city: 'paris' });
  await assert.rejects(() => parseAddresses([FRENCH, 'x'.repeat(MAX_CHARACTERS + 1)], parser), { name: 'RangeError', message: /300/ });
  assert.deepEqual(parser.calls, []);
  assert.equal((await parseAddresses(['x'.repeat(MAX_CHARACTERS)], parser))[0].city, 'paris');
});

test('un échec est retenté une fois, pas davantage', async () => {
  const failing = (failures) => ({
    calls: 0,
    async predict(addresses) {
      this.calls += 1;
      if (this.calls <= failures) throw new Error('model not loaded');
      return addresses.map((a) => COMPONENTS[a]);
    },
  });
  const once = failing(1);
  assert.equal((await parseAddresses([FRENCH], once))[0].postcode, '75011');
  assert.equal(once.calls, 2);
  const always = failing(10);
  await assert.rejects(() => parseAddresses([FRENCH], always), (e) => e instanceof ParsingUnavailable && /model not loaded/.test(e.message));
  assert.equal(always.calls, 2);
});

test('INFIRMÉ : « loading the data files is the call that fails » ; LibpostalParser.load est hors de la boucle de réessai', async () => {
  const original = LibpostalParser.load;
  let loads = 0;
  LibpostalParser.load = async () => {
    loads += 1;
    if (loads === 1) throw new Error('data files could not be mapped');
    return { predict: async (a) => a.map((x) => COMPONENTS[x]) };
  };
  try {
    await assert.rejects(async () => {
      let rows;
      try {
        rows = await parseAddresses([FRENCH]);
      } catch (error) {
        assert.fail(`${error.name}: ${error.message}`);
      }
      assert.equal(rows[0].postcode, '75011');
    }, assert.AssertionError);
  } finally {
    LibpostalParser.load = original;
  }
});

test('une réponse de mauvaise longueur lève', async () => {
  const parser = { predict: async () => [COMPONENTS[FRENCH]] };
  await assert.rejects(() => parseAddresses([FRENCH, GERMAN], parser), ParsingUnavailable);
});

test("l'analyseur est injecté, et par défaut c'est le vrai", async () => {
  await assert.rejects(() => parseAddresses([FRENCH]), { code: 'ERR_MODULE_NOT_FOUND', message: /node-postal/ });
});

test("une ligne d'un autre type (tableau de paires) devient des champs vides, sans erreur", async () => {
  const parser = new FakeClassifier({ [FRENCH]: [{ component: 'house_number', value: '8' }, { component: 'road', value: 'rue des lilas' }] });
  await assert.rejects(() => parseAddresses([FRENCH], parser), ParsingUnavailable);
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : mille adresses en un lot', async () => {
  const parser = new FakeClassifier({}, { house_number: '8', city: 'paris' });
  const start = performance.now();
  const rows = await parseAddresses(Array.from({ length: 1000 }, (_, i) => `${i} rue des Lilas`), parser);
  assert.ok(performance.now() - start < 2000);
  assert.equal(rows.length, 1000);
  assert.equal(parser.calls.length, 1);
});

test('production : accents NFD, emoji, marque d’ordre', async () => {
  const parser = new FakeClassifier({}, { city: 'paris' });
  const batch = ['3 Allée du Château', '🏠 8 rue des Lilas', '﻿8 rue des Lilas'];
  assert.deepEqual((await parseAddresses(batch, parser)).map((r) => r.city), ['paris', 'paris', 'paris']);
  assert.deepEqual(parser.calls, [batch]);
});

test('le plafond compte des unités UTF-16 ; 300 emojis sont refusés en JavaScript, acceptés en Python', async () => {
  const parser = new FakeClassifier({}, { city: 'paris' });
  let rows;
  try {
    rows = await parseAddresses(['🏠'.repeat(MAX_CHARACTERS)], parser);
  } catch (error) {
    assert.fail(`${error.name}: ${error.message}`);
  }
  assert.equal(rows.length, 1);
});
