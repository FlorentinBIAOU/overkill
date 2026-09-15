import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { findDuplicates, normalise, recordText } from './n1.js';
import * as n0 from './n0.js';

// The same file as N0, with two pairs its blocking key cannot see: a name
// entered family-name first, and a postcode off by one digit.
const CUSTOMERS = [
  { name: 'Jean Dupont', city: 'Paris', postcode: '75011' },
  { name: 'Dupont Jean', city: 'Paris', postcode: '75011' },
  { name: 'Marie Martin', city: 'Lyon', postcode: '69003' },
  { name: 'Marie Martin', city: 'Lyon', postcode: '69004' },
  { name: 'Paul Bernard', city: 'Bordeaux', postcode: '33000' },
];

// Two records of one supplier, and a third company that merely spells like it.
const SUPPLIERS = [
  { name: 'SNCF', city: 'Paris' },
  { name: 'Société Nationale des Chemins de Fer', city: 'Paris' },
  { name: 'SNEF', city: 'Paris' },
];

const indexesOf = (pairs) => pairs.map(([i, j]) => [i, j]);

/** Every pair and its score, threshold set aside. */
const scores = (records) => new Map(findDuplicates(records, 0).map(([i, j, s]) => [`${i},${j}`, s]));

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';
const pairOf = (records, threshold) => indexesOf(findDuplicates(records, threshold));

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : « SNEF » obtient un meilleur score que la forme développée de « SNCF »', () => {
  const pairs = scores(SUPPLIERS);
  assert.ok(pairs.get('0,2') > pairs.get('0,1'));
  assert.ok(pairs.get('0,1') < 0.2);
  assert.deepEqual(findDuplicates(SUPPLIERS), []);
});

test('point de rupture : baisser le seuil jusqu’au vrai doublon fusionne d’abord les deux sociétés', () => {
  const pairs = scores(SUPPLIERS);
  const loose = pairOf(SUPPLIERS, pairs.get('0,1'));
  assert.ok(loose.some(([i, j]) => i === 0 && j === 1) && loose.some(([i, j]) => i === 0 && j === 2));
  assert.deepEqual(pairOf(SUPPLIERS, (pairs.get('0,1') + pairs.get('0,2')) / 2), [[0, 2]]);
});

// ---------------------------------------------------------------------------
// Autres affirmations du niveau
// ---------------------------------------------------------------------------

test('trouve les paires que la clé de N0 ne compare jamais', () => {
  assert.deepEqual(pairOf(CUSTOMERS), [[0, 1], [2, 3]]);
  assert.deepEqual(n0.findDuplicates(CUSTOMERS, 0), []);
});

test('l’ordre des mots ne change pas le score', () => {
  assert.equal(scores(CUSTOMERS).get('0,1'), 1);
});

test('une faute de frappe et un champ tronqué gardent un score au-dessus du seuil', () => {
  assert.deepEqual(pairOf([{ name: 'Jean Dupont', city: 'Paris' }, { name: 'Jean Dupond', city: 'Paris' }]), [[0, 1]]);
  assert.deepEqual(pairOf([{ name: 'Société Générale', city: 'Paris' }, { name: 'Société Génér', city: 'Paris' }]), [[0, 1]]);
});

test('des fiches sans rapport ont un score proche de zéro', () => {
  assert.ok(scores(CUSTOMERS).get('0,4') < 0.1);
});

test('l’IDF empêche une ville commune de rapprocher toutes les paires', () => {
  // Commentaire : « The inverse document frequency is what stops "paris" […]
  // from making every pair look alike ».
  const parisians = ['Jean Dupont', 'Marie Martin', 'Paul Bernard', 'Anne Moreau'].map((name) => ({ name, city: 'Paris' }));
  assert.ok(Math.max(...scores(parisians).values()) < 0.3);
});

test('accents et casse ne sont pas une différence', () => {
  assert.equal(normalise('Société Générale'), 'societe generale');
  const pair = [{ name: 'Société Générale', city: 'Paris' }, { name: 'SOCIETE GENERALE', city: 'paris' }];
  assert.equal(recordText(pair[0]), recordText(pair[1]));
  assert.equal(findDuplicates(pair)[0][2], 1);
});

test('un champ très long ne noie pas le score', () => {
  const note = 'customer since 2019, prefers delivery in the afternoon, '.repeat(20);
  const padded = CUSTOMERS.slice(0, 2).map((record) => ({ ...record, note }));
  assert.ok(findDuplicates(padded)[0][2] > 0.9);
});

test('rien n’est appris ni conservé d’un appel à l’autre', () => {
  const before = findDuplicates(CUSTOMERS);
  findDuplicates(Array(50).fill(SUPPLIERS).flat());
  assert.deepEqual(findDuplicates(CUSTOMERS), before);
});

test('sans clé, toutes les paires sont examinées', () => {
  const records = Array.from({ length: 40 }, (_, i) => ({ name: `Jean Dupont ${i}`, city: 'Paris' }));
  assert.equal(findDuplicates(records, 0).length, (40 * 39) / 2);
});

test('l’extrait n’importe rien et tient sans dépendance', () => {
  // docstring js : « it fits in one screen with no dependency » ; data_egress: none.
  const source = readFileSync(new URL('./n1.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import\s|\brequire\(|\bimport\(|\bfetch\(/m);
  assert.deepEqual(findDuplicates(CUSTOMERS), findDuplicates(CUSTOMERS));
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : fichier vide et fiche unique', () => {
  assert.deepEqual(findDuplicates([]), []);
  assert.deepEqual(findDuplicates([CUSTOMERS[0]]), []);
});

test('production : des fiches sans aucune lettre ne font pas lever', () => {
  // Python lève ici (voir son test DÉFAUT).
  assert.deepEqual(findDuplicates([{ name: '', city: '' }, { name: '—', city: '...' }]), []);
});

test('production : deux mille fiches dans une borne large', () => {
  const records = Array.from({ length: 2000 }, (_, i) => ({ name: `Client ${String(i).padStart(5, '0')} ${LETTERS[i % 26]}${LETTERS[(i * 7) % 26]}`, city: 'Paris' }));
  const debut = performance.now();
  findDuplicates(records);
  assert.ok(performance.now() - debut < 30_000);
});

test('production : accents décomposés, espaces insécables et largeur nulle', () => {
  assert.equal(findDuplicates([{ name: 'Jean Dupont', city: 'Paris' }, { name: 'Jean\u00a0Dupo\u0302nt', city: 'PARIS' }])[0][2], 1);
  assert.deepEqual(pairOf([{ name: 'Jean Dupont', city: 'Paris' }, { name: 'Jean Du\u200bpont', city: 'Paris' }]), [[0, 1]]);
});

test('production : au seuil zéro, toutes les paires sortent', () => {
  assert.equal(findDuplicates(CUSTOMERS, 0).length, 10);
});

test('des fiches identiques ne sortent pas au seuil un', async () => {
  // Le cosinus de deux vecteurs identiques vaut 0,9999999999999999 par
  // arrondi flottant, sous le seuil ; Python les rend.
  assert.deepEqual(findDuplicates([CUSTOMERS[0], { ...CUSTOMERS[0] }], 1), [[0, 1, 1]]);
});
