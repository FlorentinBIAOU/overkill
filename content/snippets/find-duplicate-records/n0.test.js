import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blockingKey, findDuplicates, normalise, recordText, similarity } from './n0.js';

// A customer file as it really looks: the same person entered twice, by two
// people, on two days.
const CUSTOMERS = [
  { name: 'Jean Dupont', postcode: '75011', city: 'Paris' },
  { name: 'Jean Dupônt', postcode: '75011', city: 'PARIS' },
  { name: 'Marie Martin', postcode: '69003', city: 'Lyon' },
  { name: 'Marie Martln', postcode: '69003', city: 'Lyon' },
  { name: 'Paul Bernard', postcode: '33000', city: 'Bordeaux' },
];

const indexesOf = (pairs) => pairs.map(([i, j]) => [i, j]);

test('finds the two duplicate pairs and nothing else', () => {
  assert.deepEqual(indexesOf(findDuplicates(CUSTOMERS)), [[0, 1], [2, 3]]);
});

test('accents and case are not a difference', () => {
  assert.equal(normalise('Jean DUPÔNT'), 'jean dupont');
  assert.equal(recordText(CUSTOMERS[0]), recordText(CUSTOMERS[1]));
});

test('a single character typo still scores high', () => {
  assert.ok(similarity('marie martin', 'marie martln') > 0.9);
});

test('an empty file and a single record yield nothing', () => {
  assert.deepEqual(findDuplicates([]), []);
  assert.deepEqual(findDuplicates([CUSTOMERS[0]]), []);
});

test('a missing name does not throw', () => {
  const blank = { name: '', postcode: '75011', city: 'Paris' };
  assert.deepEqual(findDuplicates([blank, { ...blank }]), [[0, 1, 1]]);
});

test('the threshold is yours to set', () => {
  // A strict threshold drops the typo pair and keeps only the exact one.
  assert.deepEqual(indexesOf(findDuplicates(CUSTOMERS, 0.99)), [[0, 1]]);
});

test('breaking point: a pair that does not share the blocking key', () => {
  // Two spellings that do not share the blocking key are never compared,
  // whatever the threshold. A single wrong digit in the postcode, or a name
  // entered family-name first, is enough. The comparison would have
  // succeeded: the two texts score far above the threshold below. It is
  // simply never run.
  const moved = [
    { name: 'Jean Dupont', postcode: '75011', city: 'Paris' },
    { name: 'Jean Dupont', postcode: '75012', city: 'Paris' },
  ];
  assert.notEqual(blockingKey(moved[0]), blockingKey(moved[1]));
  assert.deepEqual(findDuplicates(moved, 0), []);
  assert.ok(similarity(recordText(moved[0]), recordText(moved[1])) > 0.9);

  const swapped = [
    { name: 'Jean Dupont', postcode: '75011', city: 'Paris' },
    { name: 'Dupont Jean', postcode: '75011', city: 'Paris' },
  ];
  assert.deepEqual(findDuplicates(swapped, 0), []);
});
