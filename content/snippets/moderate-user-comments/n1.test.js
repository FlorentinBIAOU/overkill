import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAbusive, score, train } from './n1.js';

// A corpus the size of one afternoon of labelling. The pejoratives are
// invented, which is all a term-shape model needs to be exercised.
const ABUSIVE = [
  'you are a blorptard and everyone here knows it',
  'what a blorptard, go away',
  'typical bl0rptard behaviour on this forum',
  'shut up you zibbernaut',
  'only a zibbernaut would post that',
  'get lost you flarnwit',
  'this flarnwit ruins every thread',
  'nobody wants you here you blorptard',
  'another zibbernaut with an opinion nobody asked for',
  'you absolute flarnwit, learn to read',
  'stop posting zibbernaut nonsense',
  'the usual blorptard reply, well done',
];

// Ordinary comments also say "you". Without them the model would learn that
// the second person is an insult.
const ORDINARY = [
  'great write-up, the third section helped a lot',
  'i disagree with the conclusion but the data is solid',
  'could you add a link to the source please',
  'thank you, this saved me an afternoon of work',
  'the second example does not compile on my machine',
  'i think there is a typo in the last paragraph',
  'has anyone tried this on a large corpus',
  'the diagram is much clearer than the text',
  'i had the same problem last week and your fix works',
  'looking forward to the next part of the series',
  'did you consider the case where the list is empty',
  'you are right about the second point, i was wrong',
];

const model = train(
  [...ABUSIVE, ...ORDINARY],
  [...ABUSIVE.map(() => 1), ...ORDINARY.map(() => 0)],
);

test('separates the corpus it was trained on', () => {
  for (const comment of ABUSIVE) assert.ok(isAbusive(model, comment), comment);
  for (const comment of ORDINARY) assert.ok(!isAbusive(model, comment), comment);
});

test('catches the spellings that defeat a term list', () => {
  // The reason to move up from N0: none of these are in the corpus.
  for (const evasion of ['you are a total blorptardd', 'what an obvious bl0rptard', 'flarn-wit']) {
    assert.ok(isAbusive(model, evasion), evasion);
  }
});

test('leaves an unseen ordinary comment alone', () => {
  assert.ok(!isAbusive(model, 'thanks for the detailed explanation'));
  assert.ok(!isAbusive(model, 'i still think the benchmark is misleading'));
});

test('the score is a probability', () => {
  const empty = score(model, '');
  assert.ok(empty >= 0 && empty <= 1);
  assert.ok(score(model, ABUSIVE[0]) > score(model, ORDINARY[0]));
});

test('the threshold is the caller to set', () => {
  // At zero everything is abusive, which is exactly why the knob is exposed
  // rather than buried in the function.
  assert.ok(isAbusive(model, 'the diagram is much clearer than the text', 0));
  assert.ok(!isAbusive(model, ABUSIVE[0], 1));
});

test('breaking point: the model learns vocabulary, not intent', () => {
  // N1 solves the first half of the N0 breaking point and not the second.
  //
  // Hostility that reuses no learnt shape scores below the line, and the same
  // shape scores above it whatever the comment is doing with it: a user
  // reporting the abuse they received is flagged like the attack itself.
  //
  // A bigger corpus moves the boundary. It does not change what the model is
  // looking at, which is the surface of the comment and nothing else.
  assert.ok(!isAbusive(model, 'people like you should not be allowed to have an account here'));
  assert.ok(isAbusive(model, 'he called me a blorptard, please remove his comment'));
});
