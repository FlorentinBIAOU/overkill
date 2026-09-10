import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractDates } from './n0.js';

/** Dates are compared as ISO days: the time of day is not part of the answer. */
const days = (text, dayFirst) => extractDates(text, dayFirst).map((d) => d.date.toISOString().slice(0, 10));

test('reads the three formats in one sentence', () => {
  const text = 'Réunion le 12/03/2024, livraison le 3 avril 2024, gel des specs 2024-03-01.';
  assert.deepEqual(
    extractDates(text).map((d) => [d.text, d.date.toISOString().slice(0, 10)]),
    [['12/03/2024', '2024-03-12'], ['3 avril 2024', '2024-04-03'], ['2024-03-01', '2024-03-01']],
  );
});

test('reads month names with and without accents', () => {
  for (const written of ['1er février 2024', '1er fevrier 2024', '1 February 2024']) {
    assert.deepEqual(days(`à compter du ${written}`), ['2024-02-01'], written);
  }
});

test('reads two-digit years on the pivot', () => {
  assert.deepEqual(days('facture du 12.03.24'), ['2024-03-12']);
  assert.deepEqual(days('archive du 12.03.97'), ['1997-03-12']);
});

test('rejects a day the calendar does not have', () => {
  // The regular expression is perfectly happy with these. The calendar is not,
  // and JavaScript would have rolled them over to 2 March and 1 May.
  assert.deepEqual(days('livraison le 31/02/2024'), []);
  assert.deepEqual(days('livraison le 31/04/2024'), []);
});

test('handles leap years including the century rule', () => {
  assert.deepEqual(days('29/02/2024'), ['2024-02-29']);
  assert.deepEqual(days('29/02/2023'), []);
  assert.deepEqual(days('29/02/2000'), ['2000-02-29']);
  // 1900 is divisible by four and is still a common year. Hand-rolled leap
  // year arithmetic is where this is usually got wrong.
  assert.deepEqual(days('29/02/1900'), []);
});

test('day first or month first is the caller\'s call', () => {
  assert.deepEqual(days('03/04/2024'), ['2024-04-03']);
  assert.deepEqual(days('03/04/2024', false), ['2024-03-04']);
  // Read the other way round, 13 is not a month, and the check catches it.
  assert.deepEqual(days('13/04/2024', false), []);
});

test('leaves ordinary numbers alone', () => {
  assert.deepEqual(days('version 1.2.3, ticket 4512, salle 4, 192.168.1.1'), []);
});

test('handles an empty string', () => {
  assert.deepEqual(days(''), []);
});

test('breaking point: relative dates', () => {
  // A date written as a relation to today has no digits to match, so nothing
  // is found at all. Worse than a wrong answer, it is a silent one: a planning
  // tool built on this rung simply never sees half of what people write.
  for (const phrase of ['on se voit jeudi prochain', 'livraison dans quinze jours',
    'à partir de demain', 'let us meet next Thursday', 'fin du mois']) {
    assert.deepEqual(days(phrase), [], phrase);
  }
});
