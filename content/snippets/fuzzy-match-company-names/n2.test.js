/**
 * These tests inject a local double instead of loading a real encoder.
 *
 * What they prove: the register is encoded once and not once per query, the
 * vectors are brought to length one, the cosine is computed and sorted the
 * way the snippet claims, ties are stable, and topK caps the answer.
 *
 * What they do not prove: that the model understands anything. The double is
 * a bag of words, so on the pair this rung exists for — an acronym against
 * the name it stands for — it scores exactly zero. That is asserted below
 * rather than hidden, and it is why the entry declares this snippet
 * `stubbed`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeEncoder } from '../_harness/fake-model.mjs';
import { buildIndex, match } from './n2.js';

// A register where two neighbours share their generic words, and where one
// company is written twice, once in full and once short.
const REGISTER = [
  'Boulangerie du Vieux Moulin',
  'Boulangerie du Vieux Port',
  'Le Vieux Moulin',
  'SNCF',
  'Société Nationale des Chemins de fer Français',
];

// The real encoder of this snippet returns 384 numbers per name; the double
// is asked for the same width so the test exercises the real shape.
const DIMENSIONS = 384;

const makeIndex = () => buildIndex(REGISTER, new FakeEncoder(DIMENSIONS));

/** The whole register, ranked, as a name to score map. */
async function ranked(query) {
  return Object.fromEntries(await match(await makeIndex(), query, REGISTER.length));
}

test('finds the company itself first', async () => {
  const [name, score] = (await match(await makeIndex(), 'Boulangerie du Vieux Moulin'))[0];
  assert.equal(name, 'Boulangerie du Vieux Moulin');
  assert.equal(Number(score.toFixed(12)), 1);
});

test('case costs nothing because the encoder folds it', async () => {
  assert.deepEqual(
    await match(await makeIndex(), 'BOULANGERIE DU VIEUX MOULIN'),
    await match(await makeIndex(), 'Boulangerie du Vieux Moulin'),
  );
});

test('the register is encoded once, not once per query', async () => {
  // The point of an index: the expensive call happens at build time.
  const encoder = new FakeEncoder(DIMENSIONS);
  const index = await buildIndex(REGISTER, encoder);
  assert.deepEqual(encoder.calls, [REGISTER]);
  await match(index, 'Le Vieux Moulin');
  assert.deepEqual(encoder.calls[1], ['Le Vieux Moulin']);
});

test('topK caps the answer', async () => {
  assert.equal((await match(await makeIndex(), 'Le Vieux Moulin', 2)).length, 2);
});

test('a name sharing nothing scores zero rather than a little', async () => {
  assert.equal((await ranked('Boulangerie du Vieux Moulin')).SNCF, 0);
});

test('ties come back in register order', async () => {
  // A matching run has to be replayable, so the sort is stable.
  const names = (await match(await makeIndex(), '', REGISTER.length)).map(([name]) => name);
  assert.deepEqual(names, REGISTER);
});

test('what the double cannot prove', async () => {
  // The reason this rung exists is the acronym pair, and the double scores it
  // at zero because it is a bag of words, exactly like N0 and N1. Only the
  // real encoder can close that gap. This test asserts the double's silence
  // instead of implying a win nobody measured.
  const scores = await ranked('SNCF');
  assert.equal(scores['Société Nationale des Chemins de fer Français'], 0);
});

test('breaking point: shared generic words beat identity', async () => {
  // A vector by meaning is not a vector by identity. « Boulangerie du Vieux
  // Port » is a different company that happens to share three ordinary words.
  // « Le Vieux Moulin » is the same company under its short name. The
  // stranger ranks above the twin, and no threshold sorts that out — which is
  // why this rung still ends in a human review queue.
  const scores = await ranked('Boulangerie du Vieux Moulin');
  assert.ok(scores['Boulangerie du Vieux Port'] > scores['Le Vieux Moulin']);
  assert.equal(Number(scores['Boulangerie du Vieux Port'].toFixed(12)), 0.75);
});
