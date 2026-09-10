import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_WEIGHTS, rank, textMatch } from './n0.js';

// An autumn catalogue, small enough to reason about by hand. Margin and
// popularity are shares between nought and one, as the snippet expects.
const CATALOGUE = [
  { title: 'Chaussures de course Route 5', tags: ['running', 'bitume'],
    inStock: true, margin: 0.35, popularity: 0.80 },
  { title: 'Chaussures de course Trail 3', tags: ['running', 'sentier'],
    inStock: true, margin: 0.42, popularity: 0.30 },
  { title: 'Chaussettes de running', tags: ['running'],
    inStock: true, margin: 0.60, popularity: 0.55 },
  { title: 'Montre GPS Crème', tags: ['running', 'montre'],
    inStock: false, margin: 0.25, popularity: 0.70 },
  { title: 'Sac à dos de randonnée', tags: ['randonnée'],
    inStock: true, margin: 0.48, popularity: 0.20 },
];

// The order the two language versions of the snippet must both produce. The
// same list appears in n0.test.py.
const EXPECTED_ORDER = [
  'Chaussures de course Route 5',
  'Chaussures de course Trail 3',
  'Chaussettes de running',
  'Sac à dos de randonnée',
  'Montre GPS Crème',
];

const titles = (ranked) => ranked.map((row) => row.product.title);

test('ranks the matching products first', () => {
  assert.deepEqual(titles(rank(CATALOGUE, 'chaussures de course')), EXPECTED_ORDER);
});

test('a prefix is enough', () => {
  assert.equal(textMatch('chauss', CATALOGUE[0]), 1);
  assert.equal(textMatch('chaussures course', CATALOGUE[2]), 0);
});

test('accents and case are ignored', () => {
  assert.equal(textMatch('CRÈME', CATALOGUE[3]), 1);
  assert.equal(textMatch('creme', CATALOGUE[3]), 1);
  assert.equal(textMatch('randonnee', CATALOGUE[4]), 1);
});

test('the ranking says why', () => {
  const top = rank(CATALOGUE, 'chaussures de course')[0];
  assert.deepEqual(top.signals, { text: 1, availability: 1, margin: 0.35, popularity: 0.80 });
  assert.ok(top.score >= 0 && top.score <= 1);
});

test('availability is a signal among others, not a filter', () => {
  // With the default weights the text match wins, so an exact match that
  // cannot be sold still comes first. Whether that is right is a decision for
  // the shop, and it is taken by moving a weight, not by editing code.
  assert.equal(titles(rank(CATALOGUE, 'montre'))[0], 'Montre GPS Crème');

  const stockFirst = { ...DEFAULT_WEIGHTS, availability: 20 };
  assert.equal(titles(rank(CATALOGUE, 'montre', stockFirst)).at(-1), 'Montre GPS Crème');
});

test('weights are arguments, not hidden constants', () => {
  const greedy = { text: 1, availability: 0, margin: 9, popularity: 0 };
  assert.equal(titles(rank(CATALOGUE, 'chaussures de course', greedy))[0], 'Chaussettes de running');
  // And the default puts relevance first again, on the same catalogue.
  assert.equal(titles(rank(CATALOGUE, 'chaussures de course', DEFAULT_WEIGHTS))[0], EXPECTED_ORDER[0]);
});

test('an empty query leaves the business signals in charge', () => {
  const ranked = rank(CATALOGUE, '');
  assert.ok(ranked.every((row) => row.signals.text === 0));
  // No query, so the ranking becomes the shop's own preference order.
  assert.equal(titles(ranked)[0], 'Chaussures de course Route 5');
});

test('an empty catalogue gives an empty ranking', () => {
  assert.deepEqual(rank([], 'chaussures'), []);
});

test('the sort is stable on a tie', () => {
  const twinA = { ...CATALOGUE[1], title: 'Trail 3 bleu' };
  const twinB = { ...CATALOGUE[1], title: 'Trail 3 rouge' };
  // Identical signals, so the catalogue order decides, both here and in
  // Python. Without a stable sort the two would swap between page loads.
  assert.deepEqual(titles(rank([twinA, twinB], 'trail')), ['Trail 3 bleu', 'Trail 3 rouge']);
  assert.deepEqual(titles(rank([twinB, twinA], 'trail')), ['Trail 3 rouge', 'Trail 3 bleu']);
});

test('breaking point: hand-set weights age with the catalogue', () => {
  // The breaking point claimed on the entry: the weights are set by hand and
  // grow stale without anyone noticing.
  //
  // These weights were tuned on the autumn catalogue, where the popular
  // products were also the relevant ones. They are right there. Spring brings
  // in a range that has sold nothing yet, and the very same weights, on the
  // very same unchanged code, bury it under last season's bestseller.
  //
  // Nothing raises an alarm: no exception, no failing test, no error in a
  // log. Only the sales figures of a range nobody sees, three months later.
  const tuned = { text: 3, availability: 2, margin: 1, popularity: 6 };

  // Autumn: the weights are doing their job.
  assert.equal(titles(rank(CATALOGUE, 'chaussures de course', tuned))[0], EXPECTED_ORDER[0]);

  const spring = [
    { title: 'Sandales de randonnée Ultra', tags: ['randonnée', 'été'],
      inStock: true, margin: 0.40, popularity: 0.05 },
    ...CATALOGUE,
  ];
  // Spring, same weights, same code: the new range loses to the old bestseller.
  assert.equal(
    titles(rank(spring, 'sandales randonnée', tuned))[0],
    'Chaussures de course Route 5',
  );

  // Someone has to notice, and move a number. That is the maintenance cost.
  const retuned = { ...tuned, text: 12 };
  assert.equal(
    titles(rank(spring, 'sandales randonnée', retuned))[0],
    'Sandales de randonnée Ultra',
  );
});
