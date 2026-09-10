import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anomalies, scan } from './n0.js';

const RESTING = 1200;

/**
 * A metric that is doing nothing wrong: twelve hundred requests a minute, with
 * a small repeating wobble. Built by a formula, so the numbers below are the
 * same on every machine and in both languages.
 */
function quietMetric(minute) {
  return RESTING + 40 * ((minute % 7) - 3);
}

const QUIET = Array.from({ length: 60 }, (_, minute) => quietMetric(minute));

test('flags a spike and nothing else', () => {
  const series = [...QUIET];
  series[40] = 4800;

  assert.deepEqual(anomalies(series).map((verdict) => verdict.index), [40]);
});

test('the verdict carries the reasoning, not just a boolean', () => {
  // The argument of this rung. Whoever is woken up gets the measured value,
  // what the last twenty-four minutes called usual, the gap between them, and
  // the gap that would have been tolerated. The same four numbers are asserted
  // in n0.test.py.
  const series = [...QUIET];
  series[40] = 4800;
  const verdict = anomalies(series)[0];

  assert.equal(verdict.value, 4800);
  assert.equal(verdict.usual, 1200);
  assert.equal(verdict.deviation, 3600);
  assert.ok(Math.abs(verdict.limit - 311.346) < 1e-9);
  // And the decision is nothing more than the comparison of the last two.
  assert.equal(verdict.isAnomaly, verdict.deviation > verdict.limit);
});

test('a first spike does not hide the second', () => {
  // The point of the median: one outlier already inside the window neither
  // moves the usual value nor widens the band. A mean and a standard deviation
  // would have done both.
  const series = [...QUIET];
  series[40] = 4800;
  series[41] = 4700;

  assert.deepEqual(anomalies(series).map((verdict) => verdict.index), [40, 41]);
});

test('a series shorter than the window yields no verdict', () => {
  // Judging a point against four minutes of history is worse than saying
  // nothing, because it would look like an answer.
  assert.deepEqual(scan([1, 2, 3]), []);
});

test('a constant metric is never an anomaly until it moves', () => {
  assert.deepEqual(anomalies(new Array(30).fill(500)), []);

  // On a perfectly flat window the tolerated gap is zero, so the smallest
  // change is an anomaly. That is the honest behaviour for a metric that has
  // never moved, and it is worth knowing before deploying on one.
  const moved = [...new Array(29).fill(500), 501];
  const verdict = anomalies(moved)[0];
  assert.equal(verdict.limit, 0);
  assert.equal(verdict.deviation, 1);
});

test('breaking point: a slow drift becomes the new normal', () => {
  // The breaking point claimed on the entry, built here on purpose.
  //
  // The metric leaves its resting level and climbs by forty a minute for over
  // an hour. Each step is far inside the tolerated gap, and every step the
  // window has already swallowed the ones before it. Not one point is ever
  // flagged, and the metric ends up more than three times where it started.
  //
  // The same total rise, delivered in one step, is caught immediately — for a
  // dozen minutes, until it too becomes the new normal.
  const totalRise = 40 * 72;
  const drifting = Array.from({ length: 120 }, (_, m) => (
    m < 48 ? quietMetric(m) : quietMetric(m) + 40 * (m - 47)
  ));
  const stepping = Array.from({ length: 120 }, (_, m) => (
    m < 48 ? quietMetric(m) : quietMetric(m) + totalRise
  ));

  assert.equal(drifting[119], quietMetric(119) + totalRise);
  assert.equal(stepping[119], drifting[119]);
  assert.ok(drifting[119] > 3 * RESTING);

  assert.deepEqual(anomalies(drifting), []);
  assert.equal(anomalies(stepping)[0].index, 48);
});
