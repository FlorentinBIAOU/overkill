import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findDuplicates, normalise, recordText } from './n1.js';

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

test('finds the pairs the blocking key of N0 never compares', () => {
  assert.deepEqual(indexesOf(findDuplicates(CUSTOMERS)), [[0, 1], [2, 3]]);
});

test('word order does not change the score', () => {
  assert.equal(scores(CUSTOMERS).get('0,1'), 1);
});

test('unrelated records score near zero', () => {
  assert.ok(scores(CUSTOMERS).get('0,4') < 0.1);
});

test('accents and case are not a difference', () => {
  assert.equal(normalise('Société Générale'), 'societe generale');
  const pair = [
    { name: 'Société Générale', city: 'Paris' },
    { name: 'SOCIETE GENERALE', city: 'paris' },
  ];
  assert.equal(recordText(pair[0]), recordText(pair[1]));
  assert.equal(findDuplicates(pair)[0][2], 1);
});

test('an empty file and a single record yield nothing', () => {
  assert.deepEqual(findDuplicates([]), []);
  assert.deepEqual(findDuplicates([CUSTOMERS[0]]), []);
});

test('a very long field does not drown the score', () => {
  const note = 'customer since 2019, prefers delivery in the afternoon, '.repeat(20);
  const padded = CUSTOMERS.slice(0, 2).map((record) => ({ ...record, note }));
  assert.ok(findDuplicates(padded)[0][2] > 0.9);
});

test('breaking point: character n-grams measure spelling, not identity', () => {
  // Two names for the same thing that share no letters share no n-grams, and
  // no threshold recovers them. Here SNCF and its spelled-out name are one
  // supplier, while SNEF is another company altogether. The wrong pair
  // outranks the right one, so lowering the threshold until the true
  // duplicate appears merges the two companies first.
  const pairs = scores(SUPPLIERS);
  assert.ok(pairs.get('0,2') > pairs.get('0,1'));
  assert.deepEqual(findDuplicates(SUPPLIERS), []);

  const loose = indexesOf(findDuplicates(SUPPLIERS, pairs.get('0,1')));
  assert.ok(loose.some(([i, j]) => i === 0 && j === 2));
});
