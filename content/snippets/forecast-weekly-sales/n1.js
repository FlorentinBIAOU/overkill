/**
 * Forecast weekly sales with a linear model on calendar features.
 *
 * Rung N1. The moving average of N0 has no notion of a trend: it can only
 * repeat the recent past, which is exactly what it gets wrong when the
 * business is growing or shrinking. Here the level, the slope and the
 * seasonal shape are estimated together, by least squares, over the whole
 * history.
 *
 * The features are calendar arithmetic and nothing else: a constant, the
 * number of cycles elapsed, and a few sine and cosine pairs whose period is
 * the season.
 *
 * Least squares is solved through the normal equations and a Gaussian
 * elimination, short enough that no dependency is worth it. Counting the
 * trend in cycles rather than in weeks keeps those equations well behaved,
 * and makes the coefficient readable on its own: it is the growth per cycle,
 * per year with the default 52-week season. Less than one full cycle of
 * history cannot tell the trend from the season, so it is refused.
 */

/** The row of the design matrix for one week. This is the whole model. */
export function calendarFeatures(week, seasonLength, harmonics) {
  const row = [1, week / seasonLength];
  for (let k = 1; k <= harmonics; k += 1) {
    const angle = (2 * Math.PI * k * week) / seasonLength;
    row.push(Math.sin(angle), Math.cos(angle));
  }
  return row;
}

/** Solve a symmetric system by Gaussian elimination with partial pivoting. */
function solve(matrix, vector) {
  const size = vector.length;
  const rows = matrix.map((row, i) => [...row, vector[i]]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    }
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = rows[row][column] / rows[column][column];
      for (let k = column; k <= size; k += 1) rows[row][k] -= factor * rows[column][k];
    }
  }
  return rows.map((row, i) => row[size] / row[i]);
}

/**
 * Least squares over the whole history. Returns a model you can inspect.
 *
 * `coefficients[1]` is the growth per cycle, in the unit of the series. That
 * number is worth reading before any forecast is: a model that has found a
 * trend nobody in the company recognises is a model to distrust.
 */
export function fit(history, { seasonLength = 52, harmonics = 2 } = {}) {
  const width = 2 + 2 * harmonics;
  if (history.length < width) throw new RangeError('fewer weeks of history than features to estimate');
  if (history.length < seasonLength) throw new RangeError('a trend cannot be told apart from the season on less than one full cycle');
  // A missing week must be refused: null would be multiplied as zero, NaN would spread.
  if (!history.every(Number.isFinite)) throw new TypeError('every week of history needs a finite number');
  const design = history.map((_, week) => calendarFeatures(week, seasonLength, harmonics));

  // Normal equations: (Xᵀ X) b = Xᵀ y.
  const square = Array.from({ length: width }, (_, i) => Array.from({ length: width }, (_, j) => (
    design.reduce((total, row) => total + row[i] * row[j], 0)
  )));
  const target = Array.from({ length: width }, (_, i) => (
    design.reduce((total, row, week) => total + row[i] * history[week], 0)
  ));

  return { coefficients: solve(square, target), seasonLength, harmonics, start: history.length };
}

/** Predict the `horizon` weeks that follow the history the model was fitted on. */
export function forecast(model, horizon = 1) {
  const weeks = [];
  for (let step = 0; step < horizon; step += 1) {
    const row = calendarFeatures(model.start + step, model.seasonLength, model.harmonics);
    weeks.push(row.reduce((total, value, i) => total + value * model.coefficients[i], 0));
  }
  return weeks;
}
