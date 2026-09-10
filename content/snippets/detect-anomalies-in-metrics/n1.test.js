import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anomalies, score, train } from './n1.js';

// The score of a point depends on where the random cuts fell, so JavaScript
// and Python do not agree on the third decimal. They are expected to agree on
// what matters: which minutes come out above the threshold.
const THRESHOLD = 0.65;

/** A small deterministic spread, between minus a half and a half. */
function wobble(minute, metric) {
  const step = minute * (0.6180339887498949 + 0.1 * metric);
  return step - Math.floor(step) - 0.5;
}

/** Requests, errors, latency in milliseconds — the busy regime. */
function daytime(minute) {
  return [1000 + 80 * wobble(minute, 0), 10 + wobble(minute, 1), 130 + 10 * wobble(minute, 2)];
}

/** The same three metrics in the quiet regime. */
function nighttime(minute) {
  return [300 + 80 * wobble(minute, 3), 3 + wobble(minute, 4), 60 + 10 * wobble(minute, 5)];
}

/** Quiet traffic, quiet latency, and the error count of a busy hour. */
function nighttimeWithDaytimeErrors(minute) {
  return [320 + 80 * wobble(minute, 6), 9.6 + wobble(minute, 7), 62 + 10 * wobble(minute, 8)];
}

const ORDINARY = [
  ...Array.from({ length: 45 }, (_, minute) => daytime(minute)),
  ...Array.from({ length: 45 }, (_, minute) => nighttime(minute)),
];
const BROKEN_ERRORS = [320, 9.6, 62]; // night traffic, day errors
const BROKEN_LATENCY = [980, 9.8, 63]; // day traffic, night latency
const ROWS = [...ORDINARY, BROKEN_ERRORS, BROKEN_LATENCY];

test('flags the two minutes whose combination is impossible', () => {
  const model = train(ROWS);
  assert.deepEqual(anomalies(model, ROWS, THRESHOLD), [90, 91]);
});

test('every flagged minute is ordinary on every metric taken alone', () => {
  // Why this rung exists. Each of the six numbers below sits inside the range
  // the metric reaches in normal operation, so no threshold on a single series
  // — N0's included — can ever ring for these two minutes. Only the
  // combination is impossible.
  for (let metric = 0; metric < 3; metric += 1) {
    const column = ORDINARY.map((row) => row[metric]);
    for (const flagged of [BROKEN_ERRORS, BROKEN_LATENCY]) {
      assert.ok(flagged[metric] >= Math.min(...column));
      assert.ok(flagged[metric] <= Math.max(...column));
    }
  }
});

test('a fleet that never moves has no anomalies', () => {
  // Every observation identical: no cut can separate anything, every point
  // scores exactly one half, and nobody is woken up.
  const flat = Array.from({ length: 40 }, () => [100, 5, 20]);
  const model = train(flat);
  assert.ok(Math.abs(score(model, flat[0]) - 0.5) < 1e-9);
  assert.deepEqual(anomalies(model, flat, THRESHOLD), []);
});

test('the threshold is yours to set', () => {
  const model = train(ROWS);
  assert.equal(anomalies(model, ROWS, 0).length, ROWS.length);
  assert.deepEqual(anomalies(model, ROWS, 1), []);
});

test('breaking point: a pattern seen often enough becomes ordinary', () => {
  // The limit of this rung, and it is the same one as N0's, moved up a floor.
  //
  // The forest knows nothing but the crowd it was trained on. Fifteen minutes
  // of night traffic with daytime errors, inside the training data, are enough
  // for the forest to call that combination a third regime. The very pattern
  // flagged above is then flagged no longer, and nothing in the output says
  // that anything changed.
  //
  // Retraining on last month's data is not free of consequences: it is the act
  // of deciding what counts as normal.
  const habituated = [
    ...ORDINARY,
    ...Array.from({ length: 15 }, (_, minute) => nighttimeWithDaytimeErrors(minute)),
  ];
  const model = train(habituated);

  assert.deepEqual(anomalies(model, habituated, THRESHOLD), []);
  assert.ok(score(model, BROKEN_ERRORS) < THRESHOLD);
});
