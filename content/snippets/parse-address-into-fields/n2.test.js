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
import { register } from 'node:module';
import { FakeClassifier } from '../_harness/fake-model.mjs';
import { FIELDS, LibpostalParser, MAX_CHARACTERS, ParsingUnavailable, parseAddresses } from './n2.js';

// Double du paquet CommonJS « node-postal » : importé depuis un module, ses
// exportations sont sous `default`. Le module compte ses évaluations, et son
// `parser` est lu à chaque chargement dans une fonction posée par le test.
const FAUX_POSTAL = [
  'globalThis.postalEvaluations = (globalThis.postalEvaluations ?? 0) + 1;',
  'export default { get parser() { return globalThis.fauxPostal(); } };',
].join('\n');
const CROCHET = `export async function resolve(specifier, context, next) {
  if (specifier === 'node-postal') {
    return { url: 'data:text/javascript,' + encodeURIComponent(${JSON.stringify(FAUX_POSTAL)}), shortCircuit: true };
  }
  return next(specifier, context);
}`;
register(`data:text/javascript,${encodeURIComponent(CROCHET)}`);

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

test('point de rupture : libpostal rend des étiquettes, ni score ni refus', async () => {
  const parser = new LibpostalParser(() => [{ component: 'house_number', value: 'ten' }, { component: 'road', value: 'room four' }]);
  assert.deepEqual(await parser.predict(['the meeting is at ten in room four']), [{ house_number: 'ten', road: 'room four' }]);
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

test("libpostal n'a pas de lots : predict analyse les adresses l'une après l'autre", async () => {
  const calls = [];
  const parser = new LibpostalParser((address) => { calls.push(address); return [{ component: 'house_number', value: '8' }]; });
  const batch = Array.from({ length: 100 }, (_, i) => `${i} rue des Lilas`);
  assert.equal((await parseAddresses(batch, parser)).length, 100);
  assert.deepEqual(calls, batch);
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
  assert.deepEqual((await parseAddresses([FRENCH], parser))[0], { ...EMPTY, complement: 'étage 3 porte b escalier a entrée 2 résidence les ormes' });
});

test('cinq étiquettes tombent dans le complément, « house » parmi elles', async () => {
  const labels = ['house', 'unit', 'level', 'staircase', 'entrance'];
  const parser = new FakeClassifier({ [FRENCH]: Object.fromEntries(labels.map((l, i) => [l, `c${i}`])) });
  assert.equal((await parseAddresses([FRENCH], parser))[0].complement, 'c0 c1 c2 c3 c4');
  // Les autres étiquettes de libpostal tombent chacune dans un seul champ, ou nulle part.
  const others = new FakeClassifier({ [FRENCH]: { house_number: '8', road: 'r', postcode: 'p', city: 'c', suburb: 's', country: 'f' } });
  assert.deepEqual((await parseAddresses([FRENCH], others))[0], { number: '8', street: 'r', complement: '', postcode: 'p', city: 'c' });
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
  // Sans analyseur injecté non plus : le refus précède le chargement.
  globalThis.fauxPostal = () => assert.fail('chargé avant le contrôle de longueur');
  try {
    await assert.rejects(() => parseAddresses(['x'.repeat(MAX_CHARACTERS + 1)]), RangeError);
    assert.deepEqual(await parseAddresses([]), []);
  } finally {
    delete globalThis.fauxPostal;
  }
});

test('INFIRMÉ : « six lines of 38 characters. Anything longer […] is refused » ; le plafond vaut 300, une adresse de 239 caractères passe', async () => {
  const parser = new FakeClassifier({}, { city: 'paris' });
  const sixLignes = Array(6).fill('x'.repeat(38)).join(', ');
  assert.equal(sixLignes.length, 238);
  await assert.rejects(async () => {
    await assert.rejects(() => parseAddresses([`${sixLignes}x`], parser), RangeError);
  }, assert.AssertionError);
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

test("le chargement n'est pas retenté, son erreur sort telle quelle", async () => {
  let loads = 0;
  globalThis.fauxPostal = () => {
    loads += 1;
    throw new Error('data files could not be mapped');
  };
  try {
    await assert.rejects(() => parseAddresses([FRENCH]), (e) => !(e instanceof ParsingUnavailable) && e.message === 'data files could not be mapped');
  } finally {
    delete globalThis.fauxPostal;
  }
  assert.equal(loads, 1);
});

test('une réponse de mauvaise longueur lève', async () => {
  const parser = { predict: async () => [COMPONENTS[FRENCH]] };
  await assert.rejects(() => parseAddresses([FRENCH, GERMAN], parser), ParsingUnavailable);
});

test("l'analyseur est injecté ; par défaut c'est node-postal, lu sous default et chargé une fois à l'import", async () => {
  // « node-postal is CommonJS: imported from a module, its exports sit under `default` » ;
  // « a native binding and its data files, loaded once per process on import ».
  const seen = [];
  globalThis.fauxPostal = () => ({
    parse_address: (address) => {
      seen.push(address);
      return [{ component: 'house_number', value: '8' }, { component: 'road', value: 'rue des lilas' }, { component: 'house', value: 'bâtiment c' },
        { component: 'postcode', value: '75011' }, { component: 'city', value: 'paris' }];
    },
  });
  try {
    const expected = { number: '8', street: 'rue des lilas', complement: 'bâtiment c', postcode: '75011', city: 'paris' };
    assert.deepEqual(await parseAddresses([FRENCH]), [expected]);
    assert.deepEqual(await parseAddresses([FRENCH, GERMAN]), [expected, expected]);
  } finally {
    delete globalThis.fauxPostal;
  }
  assert.deepEqual(seen, [FRENCH, FRENCH, GERMAN]);
  assert.equal(globalThis.postalEvaluations, 1);
});

test("production : une ligne d'un autre type lève l'erreur nommée", async () => {
  // null reste une réponse vide ; un tableau, une chaîne, un nombre lèvent ParsingUnavailable.
  for (const row of [[{ component: 'house_number', value: '8' }], '8 rue des lilas', 8]) {
    await assert.rejects(() => parseAddresses([FRENCH], new FakeClassifier({ [FRENCH]: row })), ParsingUnavailable);
  }
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

test('production : trois cents emojis sont acceptés, trois cent un refusés', async () => {
  // « Code points, as Python counts them: an emoji is one character, not two. »
  const parser = new FakeClassifier({}, { city: 'paris' });
  assert.equal((await parseAddresses(['🏠'.repeat(MAX_CHARACTERS)], parser)).length, 1);
  await assert.rejects(() => parseAddresses(['🏠'.repeat(MAX_CHARACTERS + 1)], parser), RangeError);
});
