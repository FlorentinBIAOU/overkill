/**
 * Forecast weekly sales with a moving average and seasonal coefficients.
 *
 * Rung N0. No dependency, and short enough to read in one sitting.
 *
 * The idea is the oldest one in forecasting, and it still carries most small
 * businesses: sales are a level that moves slowly, multiplied by a shape that
 * repeats every year. Estimate the shape over the whole history, divide it
 * out, average what is left over the last few weeks, then put the shape back.
 *
 * What this deliberately does not model is a trend. A moving average only
 * ever looks backwards, so it follows a change of regime instead of
 * anticipating it. That is the limit of this rung, and the test says so out
 * loud.
 */

function mean(values) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

/**
 * One multiplier per position in the cycle, averaged over the history.
 *
 * A coefficient of 1.2 for week 50 means that week 50 usually sells twenty
 * per cent above the year's level. The coefficients are rescaled to average
 * one, so putting the shape back neither inflates nor deflates the forecast.
 */
export function seasonalCoefficients(history, seasonLength) {
  const level = mean(history);
  if (level === 0) return new Array(seasonLength).fill(1);
  const raw = [];
  for (let phase = 0; phase < seasonLength; phase += 1) {
    const sameWeekEveryYear = history.filter((_, week) => week % seasonLength === phase);
    raw.push(mean(sameWeekEveryYear) / level);
  }
  const scale = mean(raw);
  return raw.map((coefficient) => coefficient / scale);
}

/**
 * Predict the next `horizon` weeks from `history`.
 *
 * The history and the forecast share one clock: the week after the end of the
 * history is position `history.length` in the cycle. The caller never has to
 * align the series on a January.
 *
 * `window` is the only real knob. A short window reacts fast and trusts the
 * last few weeks; a long one is steadier and slower to notice a change.
 */
export function forecast(history, { seasonLength = 52, window = 4, horizon = 1 } = {}) {
  if (history.length < 2 * seasonLength) {
    throw new RangeError('a seasonal coefficient needs two full cycles at the very least');
  }
  const coefficients = seasonalCoefficients(history, seasonLength);
  // Divide the season out, so the average below measures the level alone.
  const deseasonalised = history.map((value, week) => value / coefficients[week % seasonLength]);
  const level = mean(deseasonalised.slice(-window));
  const start = history.length;
  const weeks = [];
  for (let step = 0; step < horizon; step += 1) {
    weeks.push(level * coefficients[(start + step) % seasonLength]);
  }
  return weeks;
}
