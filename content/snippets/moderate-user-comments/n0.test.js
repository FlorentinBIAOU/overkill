import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalise, review } from './n0.js';

// The list is policy, so it lives with the test, not with the code. The terms
// below are invented, which is enough to exercise a term filter.
const TERMS = ['blorptard', 'zibbernaut', 'flarnwit'];

test('flags a listed term and shows its context', () => {
  const result = review('honestly this whole update is the work of a blorptard', TERMS);
  assert.ok(result.flagged);
  assert.equal(result.matches[0].term, 'blorptard');
  assert.ok(result.matches[0].context.includes('work of a blorptard'));
});

test('normalisation folds case and accents', () => {
  assert.equal(normalise('BLÔRPTARD'), 'blorptard');
  assert.ok(review('what a ZIBBERNAUT', TERMS).flagged);
  assert.ok(review('quel flarnwît celui-là', TERMS).flagged);
});

test('leaves an ordinary comment alone', () => {
  assert.ok(!review('great write-up, the third section helped a lot', TERMS).flagged);
});

test('handles an empty comment', () => {
  assert.deepEqual(review('', TERMS), { flagged: false, matches: [] });
});

test('reports every hit, not just the first', () => {
  const result = review('one blorptard, then another blorptard', TERMS);
  assert.deepEqual(result.matches.map((m) => m.position), [1, 4]);
});

test('the window is clipped at the edges of the comment', () => {
  assert.equal(review('blorptard', TERMS, 5).matches[0].context, 'blorptard');
});

test('breaking point: a different spelling walks straight past', () => {
  // First half of the breaking point claimed on the entry: the list matches
  // spellings, and a determined commenter has an unbounded supply of them.
  // Adding each variant to the list is a losing race, and each addition
  // widens the second half of the problem below.
  for (const evasion of ['bl0rptard', 'b l o r p t a r d', 'blorp-tard', 'blorptardd']) {
    assert.ok(!review(`you are a ${evasion}`, TERMS).flagged, evasion);
  }
});

test('breaking point: quotation and irony are flagged all the same', () => {
  // The list sees the word, never the intent. A user reporting the abuse they
  // received, and two friends teasing each other, are flagged exactly like the
  // attack the list was written for.
  //
  // This is why the function returns the context window rather than a verdict.
  // The window is what lets a human close these two cases in seconds; nothing
  // in the rung itself can close them.
  const report = review('he called me a blorptard, please remove his comment', TERMS);
  const banter = review('congratulations you absolute blorptard, well played', TERMS);
  const attack = review('get off this forum you blorptard', TERMS);
  assert.ok(report.flagged && banter.flagged && attack.flagged);
  // And nothing in the result tells them apart.
  assert.equal(report.matches[0].term, attack.matches[0].term);
});
