import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forecast, seasonalCoefficients } from './n0.js';

const SEASON = 52;

/**
 * Three years of a shop whose level never moves.
 *
 * A thousand euros a week, a yearly wave that peaks in the spring, and a small
 * weekday-like ripple so the series is not a perfect sine. Every value comes
 * out of this formula: no random draw, no data file.
 */
function steadyShop(week) {
  return 1000 + 200 * Math.sin((2 * Math.PI * week) / SEASON) + 10 * ((week % 5) - 2);
}

const HISTORY = Array.from({ length: 3 * SEASON }, (_, week) => steadyShop(week));
const NEXT_WEEK_IN_TRUTH = steadyShop(3 * SEASON);

test('forecasts the next week within a couple of per cent', () => {
  const predicted = forecast(HISTORY)[0];
  assert.ok(Math.abs(predicted - NEXT_WEEK_IN_TRUTH) / NEXT_WEEK_IN_TRUTH < 0.02);
});

test('both languages agree to the sixth decimal', () => {
  // The same number is asserted in n0.test.py. The two implementations are the
  // same arithmetic in two languages, and they are expected to stay that way.
  assert.ok(Math.abs(forecast(HISTORY)[0] - 1003.624843) < 1e-6);
});

test('the seasonal shape is read off the history', () => {
  const coefficients = seasonalCoefficients(HISTORY, SEASON);
  // Week 13 is the peak of the wave, week 39 its trough.
  assert.ok(coefficients[13] > 1.15);
  assert.ok(coefficients[39] < 0.85);
  // Rescaled to average one, so putting the shape back is level-preserving.
  const average = coefficients.reduce((total, value) => total + value, 0) / SEASON;
  assert.ok(Math.abs(average - 1) < 1e-9);
});

test('a horizon returns one value per week', () => {
  assert.equal(forecast(HISTORY, { horizon: 3 }).length, 3);
});

test('a flat series forecasts the same flat value', () => {
  const flat = new Array(2 * SEASON).fill(750);
  assert.ok(Math.abs(forecast(flat)[0] - 750) < 1e-9);
});

test('refuses a history shorter than two cycles', () => {
  // One year of history gives one observation per week of the year, which is
  // not an average of anything. Refusing beats pretending.
  assert.throws(() => forecast(HISTORY.slice(0, SEASON)), RangeError);
});

test('breaking point: a trend break', () => {
  // The breaking point claimed on the entry. A competitor opens and the last
  // eight weeks fall five per cent each. A moving average has no slope to
  // extrapolate: it forecasts the average of a decline it has already seen,
  // not the decline going on.
  const declining = Array.from({ length: 156 }, (_, week) => (
    week < 148 ? steadyShop(week) : steadyShop(week) * 0.95 ** (week - 147)
  ));
  const truth = steadyShop(156) * 0.95 ** 9;

  const predicted = forecast(declining)[0];
  assert.ok(predicted > 1.25 * truth); // more than a quarter too high, and it will stay so
});

test('breaking point: an exceptional promotion', () => {
  // The other half of the same breaking point. One promotion week enters the
  // moving average as if it were ordinary trade, and lifts next week's
  // forecast by more than ten per cent. The model has no notion of an event.
  const withPromotion = [...HISTORY];
  withPromotion[withPromotion.length - 1] *= 2;

  assert.ok(forecast(withPromotion)[0] > 1.1 * forecast(HISTORY)[0]);
});
