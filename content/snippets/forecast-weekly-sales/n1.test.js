import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fit, forecast } from './n1.js';

const SEASON = 52;

/**
 * Three years of a shop that grows by two hundred and eight a year.
 *
 * A level, a straight trend, a yearly wave with a second harmonic, and a small
 * ripple so the series is not exactly the model's own shape. Every value comes
 * out of this formula: no random draw, no data file.
 */
function growingShop(week) {
  return (
    800
    + 4 * week
    + 150 * Math.sin((2 * Math.PI * week) / SEASON)
    + 60 * Math.cos((4 * Math.PI * week) / SEASON)
    + 20 * ((week % 7) - 3)
  );
}

const HISTORY = Array.from({ length: 3 * SEASON }, (_, week) => growingShop(week));
const NEXT_WEEK_IN_TRUTH = growingShop(3 * SEASON);

test('forecasts the next week within a couple of per cent', () => {
  const predicted = forecast(fit(HISTORY))[0];
  assert.ok(Math.abs(predicted - NEXT_WEEK_IN_TRUTH) / NEXT_WEEK_IN_TRUTH < 0.02);
});

test('both languages agree to the sixth decimal', () => {
  // The same number is asserted in n1.test.py. One side solves the least
  // squares with numpy, the other by Gaussian elimination on the normal
  // equations; they are expected to land on the same forecast anyway.
  assert.ok(Math.abs(forecast(fit(HISTORY))[0] - 1481.923623) < 1e-6);
});

test('reads the growth back out of the series', () => {
  // The series was built growing by 4 a week, so 208 a cycle. The coefficient
  // is the number to show a shopkeeper before any forecast.
  assert.ok(Math.abs(fit(HISTORY).coefficients[1] - 208) < 2);
});

test('extrapolates the trend where the moving average of N0 cannot', () => {
  // Six months ahead, a level-only model would still forecast today's level.
  const sixMonths = forecast(fit(HISTORY), 26);
  assert.ok(sixMonths[sixMonths.length - 1] - sixMonths[0] > 80);
});

test('a flat series forecasts the same flat value and no growth', () => {
  const model = fit(new Array(2 * SEASON).fill(750));
  assert.ok(Math.abs(forecast(model)[0] - 750) < 1e-6);
  assert.ok(Math.abs(model.coefficients[1]) < 1e-6);
});

test('refuses a history shorter than the number of features', () => {
  // Six features, so six weeks at the very least. Below that the fit is not
  // underdetermined by a little, it is arbitrary.
  assert.throws(() => fit(HISTORY.slice(0, 5)), RangeError);
});

test('breaking point: a regime change is averaged away', () => {
  // The limit of this rung. Least squares weighs a week from three years ago
  // exactly as much as last week. When a competitor opens and the last twenty
  // weeks settle thirty per cent lower, the fit splits the difference between
  // the old world and the new one, and forecasts a level the shop has not seen
  // in five months.
  //
  // Nothing in the model is wrong; the assumption that one straight line
  // describes the whole history is.
  const changed = HISTORY.map((value, week) => (week >= 136 ? value * 0.7 : value));
  const truth = growingShop(156) * 0.7;

  assert.ok(forecast(fit(changed))[0] > 1.25 * truth);
});
