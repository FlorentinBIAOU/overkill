import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build, normalise, suggest } from './n0.js';

// What a fortnight of search logs looks like once grouped: the term as it is
// spelled in the catalogue, and how often it was searched.
const CATALOGUE = [
  ['chaussures de running', 900],
  ['chaussettes de sport', 400],
  ['étagère murale', 300],
  ['chemise en lin', 250],
  ['écharpe en laine', 120],
  ['échelle télescopique', 60],
];

const tree = build(CATALOGUE);

test('suggests the most searched terms under a prefix', () => {
  assert.deepEqual(suggest(tree, 'cha'), ['chaussures de running', 'chaussettes de sport']);
});

test('orders by usage and honours the limit', () => {
  assert.deepEqual(suggest(tree, 'ch', 2), ['chaussures de running', 'chaussettes de sport']);
});

test('an empty prefix offers the most searched terms overall', () => {
  // What an empty search bar should show before a single key is pressed.
  assert.deepEqual(suggest(tree, '', 3), [
    'chaussures de running',
    'chaussettes de sport',
    'étagère murale',
  ]);
});

test('ignores accents and case', () => {
  assert.deepEqual(suggest(tree, 'ech'), ['écharpe en laine', 'échelle télescopique']);
  assert.deepEqual(suggest(tree, 'ÉCH'), suggest(tree, 'ech'));
});

test('an unknown prefix returns nothing', () => {
  assert.deepEqual(suggest(tree, 'zzz'), []);
});

test('two spellings of the same term both survive', () => {
  // Folding case is what makes them collide; keeping a list at the leaf is
  // what stops one from silently replacing the other.
  const both = build([['Chaussures', 5], ['chaussures', 3]]);
  assert.deepEqual(suggest(both, 'chau'), ['Chaussures', 'chaussures']);
});

test('normalisation folds accents without touching the letters', () => {
  assert.equal(normalise('Écharpe'), 'echarpe');
  assert.equal(normalise('Étagère Murale'), 'etagere murale');
});

test('breaking point: a typo on the first character', () => {
  // The breaking point claimed on the entry: the tree can only walk down the
  // characters it was given. One wrong key at the start, and the walk leaves
  // the tree on the first step, with nothing to fall back on.
  //
  // The pairs below differ by exactly one character, the first one, and the
  // correct spelling is right there in the index.
  assert.deepEqual(suggest(tree, 'echarpe'), ['écharpe en laine']);
  assert.deepEqual(suggest(tree, 'rcharpe'), []);

  assert.deepEqual(suggest(tree, 'chauss'), ['chaussures de running', 'chaussettes de sport']);
  assert.deepEqual(suggest(tree, 'vhauss'), []);
});
