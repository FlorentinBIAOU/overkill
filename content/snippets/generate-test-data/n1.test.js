import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sampleRows } from './n1.js';

// The distributions live in the test, never in the snippet. These are the
// shape a `GROUP BY city` and a bucketed count would return: raw observed
// counts, not probabilities, and no need to make them sum to anything in
// particular.
//
// The figures below are invented for the example, and the postcodes are those
// of the cities they sit next to, nothing more.
const SESSIONS = {
  city: { type: 'categorical', counts: { Paris: 4120, Lyon: 980, Nantes: 410, Lille: 190 } },
  postcode: { type: 'categorical', counts: { 75011: 4120, 69003: 980, 44000: 410, 59000: 190 } },
  // Most baskets hold one item; the long tail is real but thin.
  items: { type: 'histogram', edges: [1, 2, 3, 6, 21], counts: [6900, 1800, 900, 400] },
  delay_days: { type: 'histogram', edges: [0, 1, 3, 8, 31], counts: [5200, 2400, 1600, 800] },
};

// The exact rows expected for one seed. The same literal appears in
// n1.test.py, which is what pins the two implementations to each other.
const GOLDEN = [
  { city: 'Lyon', postcode: '69003', items: 2, delay_days: 4 },
  { city: 'Paris', postcode: '75011', items: 2, delay_days: 0 },
  { city: 'Nantes', postcode: '75011', items: 1, delay_days: 0 },
];

const SEED = 'sessions-week-24';

test('produces the expected rows', () => {
  assert.deepEqual(sampleRows(SESSIONS, 3, SEED), GOLDEN);
});

test('the sampled shares follow the observed ones', () => {
  // This is what the rung is for: the common case stays common. A uniform draw
  // over the same four cities would put a quarter of the traffic in Lille, and
  // every page laid out on that data would be laid out wrong.
  const rows = sampleRows(SESSIONS, 4000, SEED);
  const total = Object.values(SESSIONS.city.counts).reduce((sum, count) => sum + count, 0);
  for (const [city, observed] of Object.entries(SESSIONS.city.counts)) {
    const seen = rows.filter((row) => row.city === city).length;
    assert.ok(Math.abs(seen / 4000 - observed / total) < 0.02, city);
  }

  // And the same for the numeric column: single-item baskets dominate.
  const oneItem = rows.filter((row) => row.items === 1).length / 4000;
  assert.ok(Math.abs(oneItem - 6900 / 10000) < 0.02);
});

test('values stay inside the observed buckets', () => {
  const rows = sampleRows(SESSIONS, 2000, SEED);
  const items = rows.map((row) => row.items);
  const delays = rows.map((row) => row.delay_days);
  // The buckets are half-open, so the last edge is never reached.
  assert.equal(Math.min(...items), 1);
  assert.ok(Math.max(...items) <= 20);
  assert.equal(Math.min(...delays), 0);
  assert.ok(Math.max(...delays) <= 30);
});

test('the same seed gives the same data, another seed does not', () => {
  assert.deepEqual(sampleRows(SESSIONS, 50, SEED), sampleRows(SESSIONS, 50, SEED));
  assert.notDeepEqual(sampleRows(SESSIONS, 50, SEED), sampleRows(SESSIONS, 50, 'sessions-week-25'));
});

test('a category observed zero times is never drawn', () => {
  // It did not happen in production, so it does not happen here either.
  const city = { type: 'categorical', counts: { Paris: 100, Ajaccio: 0 } };
  const rows = sampleRows({ city }, 200, SEED);
  assert.deepEqual([...new Set(rows.map((row) => row.city))], ['Paris']);
});

test('no distribution, and a single row', () => {
  assert.deepEqual(sampleRows({}, 2, SEED), [{}, {}]);
  assert.deepEqual(sampleRows(SESSIONS, 0, SEED), []);
  assert.equal(sampleRows(SESSIONS, 1, SEED).length, 1);
});

test('a distribution that cannot be sampled is refused', () => {
  // Nothing was observed, so there is nothing to sample from. Falling back to
  // a uniform draw here would quietly invent a distribution.
  assert.throws(
    () => sampleRows({ city: { type: 'categorical', counts: { Paris: 0 } } }, 1, SEED),
    RangeError,
  );
  assert.throws(
    () => sampleRows({ items: { type: 'histogram', edges: [1, 5], counts: [10, 2] } }, 1, SEED),
    RangeError,
  );
  assert.throws(() => sampleRows({ items: { type: 'gaussian', mean: 3 } }, 1, SEED), RangeError);
});

test('breaking point: the marginals are right and the rows are impossible', () => {
  // Each column is sampled on its own, so the joint distribution is gone.
  //
  // In production every Paris session carries a Paris postcode: the two
  // columns are one fact written twice. Sampled independently, they disagree
  // in almost half the rows, and those rows describe sessions that cannot
  // exist.
  //
  // Which means this data set proves nothing about any code that reads two
  // columns at once — a delivery-zone rule, a tax rule, a fraud rule. The
  // marginals being right is exactly what makes that easy to miss.
  const postcodeOf = { Paris: '75011', Lyon: '69003', Nantes: '44000', Lille: '59000' };
  const rows = sampleRows(SESSIONS, 2000, SEED);
  const impossible = rows.filter((row) => postcodeOf[row.city] !== row.postcode);
  assert.ok(impossible.length > 800);

  // The rule a real row always satisfies, and that this fixture cannot test.
  assert.ok(rows.some((row) => row.city === 'Nantes' && row.postcode === '75011'));
});
