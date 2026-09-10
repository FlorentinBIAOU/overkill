/**
 * The memory below is what a project already has after one round of
 * translation. It lives here and not in the snippet: the snippet is a
 * function, not a demo.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lookup, normalise, placeholders } from './n0.js';

const MEMORY = {
  Save: 'Enregistrer',
  'Save changes': 'Enregistrer les modifications',
  'Delete this item?': 'Supprimer cet élément ?',
  '{count} items selected': '{count} éléments sélectionnés',
  'Your session has expired': 'Votre session a expiré',
};

const round3 = (value) => Number(value.toFixed(3));

test('an exact match ships as it is', () => {
  const result = lookup('Save changes', MEMORY);
  assert.equal(result.status, 'exact');
  assert.equal(result.target, 'Enregistrer les modifications');
  assert.equal(result.score, 1);
  assert.equal(result.review, false);
});

test('a fixed capital or a double space is still the same string', () => {
  assert.equal(lookup('save   changes', MEMORY).status, 'exact');
  assert.equal(normalise('Élément  SUPPRIMÉ'), 'element supprime');
});

test('an added word gives an approximate match flagged for review', () => {
  const result = lookup('Save all changes', MEMORY);
  assert.equal(result.status, 'fuzzy');
  assert.equal(result.matched, 'Save changes');
  assert.equal(result.target, 'Enregistrer les modifications');
  assert.equal(round3(result.score), 0.857);
  // The whole point of the rung: this comes back as a draft, not as a
  // finished translation.
  assert.equal(result.review, true);
});

test('the threshold decides what is worth showing at all', () => {
  assert.equal(lookup('Save all changes', MEMORY, 0.9).status, 'none');
});

test('a moved variable is not a problem but a lost one is', () => {
  assert.deepEqual(placeholders('Delete {count} of {total}'), placeholders('{total}: {count}'));
  const broken = { '{count} items selected': 'Éléments sélectionnés' };
  const result = lookup('{count} items selected', broken);
  // An exact hit, and still unusable: the interface would print a French
  // sentence with no number in it.
  assert.equal(result.status, 'exact');
  assert.equal(result.review, true);
  assert.deepEqual(result.warnings, ['interpolation variables differ from the source string']);
});

test('a variable added since last year is reported on the fuzzy hit', () => {
  const result = lookup('{count} items selected', { 'Items selected': 'Éléments sélectionnés' });
  assert.equal(result.status, 'fuzzy');
  assert.equal(round3(result.score), 0.778);
  assert.deepEqual(result.warnings, ['interpolation variables differ from the source string']);
});

test('an empty string and an empty memory return nothing rather than anything', () => {
  assert.equal(lookup('', MEMORY).status, 'none');
  assert.equal(lookup('Save', {}).status, 'none');
  assert.equal(lookup('Save', {}).target, null);
});

test('breaking point: a brand new string has no match at all', () => {
  // The breaking point claimed on the entry: a translation memory reuses, it
  // does not translate. A feature nobody has written before is a string
  // nobody has translated before, and no amount of fuzzy matching invents it.
  //
  // What matters here is what the function does *not* do. It has a French
  // sentence about sessions on hand and it could hand it back with a low
  // score. It returns nothing instead, and the string goes to a translator.
  const result = lookup('Two-factor authentication is required for administrators', MEMORY);
  assert.equal(result.status, 'none');
  assert.equal(result.target, null);
  assert.equal(result.matched, null);
  assert.ok(result.score < 0.75);
});
