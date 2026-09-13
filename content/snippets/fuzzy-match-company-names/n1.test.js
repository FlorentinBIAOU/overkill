import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex, match } from './n1.js';

// A register the size of a small trade directory. Example data lives here,
// never in the snippet.
const REGISTER = [
  'Boulangerie Martin SARL',
  'Boulangerie Dupont',
  'Menuiserie Dubois SA',
  'Dubois Menuiserie',
  'Café de la Gare',
  'SNCF',
  'Société Nationale des Chemins de fer Français',
];

const INDEX = buildIndex(REGISTER);

/** The whole register, ranked, as a name to score map. */
function ranked(query) {
  return Object.fromEntries(match(INDEX, query, REGISTER.length));
}

test('finds the right company first', () => {
  const [name, score] = match(INDEX, 'Boulangerie Martin')[0];
  assert.equal(name, 'Boulangerie Martin SARL');
  // Pinned to twelve decimals: the Python snippet returns this number.
  assert.equal(Number(score.toFixed(12)), 0.883177974427);
});

test('word order costs nothing', () => {
  // Where N0 collapses on a swap, n-grams inside word boundaries do not.
  assert.deepEqual(match(INDEX, 'MARTIN BOULANGERIE'), match(INDEX, 'Boulangerie Martin'));
});

test('a rare fragment outweighs a common one', () => {
  // "boulangerie" is shared by two entries and settles nothing; the surname
  // is what separates them.
  const scores = ranked('Boulangerie Martin');
  assert.ok(scores['Boulangerie Martin SARL'] > scores['Boulangerie Dupont']);
});

test('a plural and a swap at once', () => {
  assert.equal(match(INDEX, 'Menuiseries Dubois')[0][0], 'Dubois Menuiserie');
});

test('an empty query scores nothing anywhere', () => {
  assert.ok(match(INDEX, '', REGISTER.length).every(([, score]) => score === 0));
});

test('ties come back in register order', () => {
  // A matching run has to be replayable, so the sort is stable.
  assert.deepEqual(match(INDEX, '', REGISTER.length).map(([name]) => name), REGISTER);
});

test('a name nobody wrote still gets a ranking', () => {
  // Cosine always answers. A top hit is a candidate, not a decision: the
  // caller keeps a floor under which nothing is accepted.
  const [name, score] = match(INDEX, 'Kwyjibo')[0];
  assert.ok(REGISTER.includes(name));
  assert.ok(score > 0);
});

test('breaking point: the acronym that N0 missed is still missed', () => {
  // TF-IDF weighs fragments better than Jaro-Winkler ever did, but it still
  // only sees fragments. The expanded name shares almost no character n-gram
  // with its own acronym, so it does not even reach the top three: two
  // unrelated names beat it. That failure is the whole reason N2 exists.
  const expanded = 'Société Nationale des Chemins de fer Français';
  assert.ok(ranked('SNCF')[expanded] < 0.05);
  assert.ok(!match(INDEX, 'SNCF', 3).some(([name]) => name === expanded));
});
