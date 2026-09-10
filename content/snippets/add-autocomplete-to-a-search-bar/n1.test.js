import { test } from 'node:test';
import assert from 'node:assert/strict';
import { learn, rerank } from './n1.js';

const repeat = (times, event) => Array.from({ length: times }, () => event);

// A slice of a click log: what was typed, and which suggestion was chosen.
// The kind of file a search bar already writes without being asked.
const CLICKS = [
  ...repeat(4, ['cha', 'chaussettes de sport']),
  ...repeat(2, ['chau', 'chaussettes de sport']),
  ['ch', 'chemise en lin'],
  ...repeat(3, ['e', 'étagère murale']),
  ['ÉCHA', 'écharpe en laine'],
];

// What the prefix tree of the previous rung hands over: candidates already
// ordered by how often the term is searched.
const BY_FREQUENCY = ['chaussures de running', 'chaussettes de sport'];

const model = learn(CLICKS);

test('a clicked term moves above a more searched one', () => {
  assert.deepEqual(rerank(model, 'cha', BY_FREQUENCY), [
    'chaussettes de sport',
    'chaussures de running',
  ]);
});

test('a prefix never typed falls back on a shorter one', () => {
  // "chaus" is absent from the log; "chau" is not, and it carries the clicks.
  assert.deepEqual(rerank(model, 'chaus', BY_FREQUENCY), [
    'chaussettes de sport',
    'chaussures de running',
  ]);
});

test('an empty prefix ranks on the whole log', () => {
  const candidates = ['chaussures de running', 'chemise en lin', 'chaussettes de sport'];
  assert.deepEqual(rerank(model, '', candidates), [
    'chaussettes de sport',
    'chemise en lin',
    'chaussures de running',
  ]);
});

test('ignores accents and case like the prefix tree', () => {
  const candidates = ['échelle télescopique', 'écharpe en laine'];
  assert.deepEqual(rerank(model, 'echa', candidates), [
    'écharpe en laine',
    'échelle télescopique',
  ]);
  assert.deepEqual(rerank(model, 'ÉCHA', candidates), rerank(model, 'echa', candidates));
});

test('honours the limit', () => {
  assert.deepEqual(rerank(model, 'cha', BY_FREQUENCY, 1), ['chaussettes de sport']);
});

test('terms nobody ever clicked keep their incoming order', () => {
  // The cold start: on a term with no click behind it the model stays silent
  // and the frequency ordering stands.
  const untouched = ['chaussures de running', 'échelle télescopique'];
  assert.deepEqual(rerank(model, 'cha', untouched), untouched);
});

test('an empty log changes nothing', () => {
  assert.deepEqual(rerank(learn([]), 'cha', BY_FREQUENCY), BY_FREQUENCY);
});

test('breaking point: reranking cannot rescue what was never retrieved', () => {
  // This rung reorders a list; it does not lengthen one. The typo on the
  // first character that empties the prefix tree, the breaking point claimed
  // on the entry, empties this rung too, however many clicks the term has
  // behind it.
  assert.equal(model.get('echa\técharpe en laine'), 1);
  assert.deepEqual(rerank(model, 'rcharpe', []), []);
  assert.deepEqual(rerank(model, 'vhauss', []), []);
});
