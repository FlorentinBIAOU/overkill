import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SIGNALS, learnWeights, pairs, rank } from './n1.js';

// A click log, the kind two weeks of traffic leaves behind. Each row is
// [text, availability, margin, popularity, clicked], and each page is one
// result list a shopper saw.
const LOG = [
  [[1.0, 1.0, 0.30, 0.20, true], [0.5, 1.0, 0.55, 0.90, false], [0.0, 1.0, 0.60, 0.80, false]],
  [[1.0, 1.0, 0.25, 0.55, true], [0.5, 1.0, 0.50, 0.95, false], [0.0, 1.0, 0.45, 0.70, false]],
  [[0.5, 1.0, 0.35, 0.80, true], [0.5, 1.0, 0.65, 0.25, false]],
  [[1.0, 1.0, 0.20, 0.45, true], [1.0, 0.0, 0.60, 0.90, false]],
  [[1.0, 1.0, 0.40, 0.60, true], [0.5, 0.0, 0.55, 0.85, false], [0.0, 1.0, 0.50, 0.60, false]],
  [[0.5, 1.0, 0.30, 0.70, true], [0.5, 0.0, 0.45, 0.75, false]],
  [[1.0, 1.0, 0.45, 0.85, true], [1.0, 1.0, 0.30, 0.20, false]],
  [[0.5, 1.0, 0.25, 0.90, true], [0.0, 1.0, 0.70, 0.95, false]],
];

const page = (rows) => rows.map((row) => ({
  signals: Object.fromEntries(SIGNALS.map((name, i) => [name, row[i]])),
  clicked: row[4],
}));

const impressions = (log = LOG) => log.map(page);

const close = (value, expected, tolerance = 0.01) => Math.abs(value - expected) < tolerance;

test('a pair becomes two rows pointing opposite ways', () => {
  const { rows, labels } = pairs([page(LOG[3])]);
  assert.deepEqual(labels, [1, 0]);
  assert.ok(rows[0].every((value, i) => close(value, [0, 1, -0.4, -0.45][i], 1e-9)));
  assert.ok(rows[1].every((value, i) => close(value, [0, -1, 0.4, 0.45][i], 1e-9)));
});

test('learns that relevance and stock are what shoppers follow', () => {
  const weights = learnWeights(impressions());
  assert.ok(weights.text > weights.availability && weights.availability > 0);
  // Shoppers in this log follow relevance far more than popularity.
  assert.ok(weights.popularity < weights.text);
});

test('the hand-written fit agrees with the Python one', () => {
  // The same log, fitted by scikit-learn in n1.py, gives these weights. Two
  // decimals of agreement is what says the thirty lines above are the same
  // model and not a lookalike.
  const weights = learnWeights(impressions());
  assert.ok(close(weights.text, 0.44), weights.text);
  assert.ok(close(weights.availability, 0.28), weights.availability);
  assert.ok(close(weights.margin, -0.25), weights.margin);
  assert.ok(close(weights.popularity, 0.02), weights.popularity);
});

test('the log can disagree with the shop', () => {
  // In this log the profitable products are the ones shoppers skip, so the
  // learnt margin weight comes out negative. That is not a bug to silence: it
  // is the arbitration between turnover and margin, arriving as a number
  // rather than as an opinion.
  assert.ok(learnWeights(impressions()).margin < 0);
});

test('the learnt weights rank a new page the way the log would', () => {
  const weights = learnWeights(impressions());
  const candidates = page([
    [0.0, 1.0, 0.70, 0.95, false], // popular, profitable, off topic
    [1.0, 1.0, 0.20, 0.05, false], // on topic, new, thin margin
  ]);
  assert.equal(rank(candidates, weights)[0].candidate.signals.text, 1);
});

test('the weights are on a readable scale', () => {
  const weights = learnWeights(impressions());
  const total = Object.values(weights).reduce((sum, value) => sum + Math.abs(value), 0);
  assert.ok(close(total, 1, 1e-9));
});

test('a log without a single click teaches nothing', () => {
  const silent = LOG.map((rows) => page(rows.map((row) => [...row.slice(0, 4), false])));
  assert.throws(() => learnWeights(silent), /nothing to learn from/);
});

test('a page with one result makes no pair', () => {
  assert.equal(pairs([page([LOG[0][0]])]).rows.length, 0);
});

test('breaking point: the log only teaches what it varied', () => {
  // What this rung cannot do: learn about a signal the past ranking never
  // moved. Margin here is identical on every product of every page, so every
  // training row holds a nought in that column, and the fitted weight is
  // exactly nought.
  //
  // The model is not wrong, it is blind: the log holds no evidence either
  // way. At serving time a profitable product gets no credit for it, and no
  // amount of extra traffic will change that. Only a change in what gets
  // shown will, which is the awkward part of learning to rank from your own
  // ranking.
  const flatMargin = LOG.map((rows) => page(rows.map((row) => [row[0], row[1], 0.4, row[3], row[4]])));
  const weights = learnWeights(flatMargin);
  assert.equal(weights.margin, 0);
  assert.ok(weights.text > 0);

  // And so a page where margin is the only difference comes back untouched.
  const candidates = page([[0.5, 1.0, 0.10, 0.50, false], [0.5, 1.0, 0.90, 0.50, false]]);
  const scores = rank(candidates, weights).map((row) => row.score);
  assert.equal(scores[0], scores[1]);
});
