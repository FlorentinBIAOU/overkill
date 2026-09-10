/**
 * Learn the ranking weights from past interactions instead of setting them by hand.
 *
 * Rung N1. The score is the one of N0, a weighted sum of the same four
 * signals. What changes is where the four numbers come from: a merchandiser's
 * judgement on N0, the click log here.
 *
 * The method is pairwise. What a log really says is never "this product
 * deserves 0.8", it is "shown these two side by side, a shopper took that
 * one". Each such pair becomes one training row, the difference between the
 * two signal vectors, and a logistic regression on those differences gives
 * back the weights of the original score. Nothing else changes: the serving
 * code, the explanation shown to the shop, the scale of the score, all stay
 * as they were.
 *
 * Every pair is added in both directions, one labelled a win and one a loss.
 * That keeps the two classes balanced, and it is why the model carries no
 * intercept: a constant would shift both directions of the same pair the same
 * way, which is meaningless when comparing two products of one result page.
 *
 * The fit is thirty lines of gradient descent rather than a dependency, which
 * is the argument of this whole rung.
 */

export const SIGNALS = ['text', 'availability', 'margin', 'popularity'];

/**
 * Turn result pages into training rows.
 *
 * `impressions` is one entry per result page shown to a shopper, each item
 * holding the signals logged at serving time and whether it was clicked.
 * Logging the signals rather than recomputing them later matters: a product
 * that has since gone out of stock must be trained on the availability it had
 * on the day, not on today's.
 */
export function pairs(impressions) {
  const rows = [];
  const labels = [];
  for (const page of impressions) {
    const clicked = page.filter((item) => item.clicked).map((item) => item.signals);
    const ignored = page.filter((item) => !item.clicked).map((item) => item.signals);
    for (const winner of clicked) {
      for (const loser of ignored) {
        const difference = SIGNALS.map((name) => winner[name] - loser[name]);
        rows.push(difference);
        labels.push(1);
        rows.push(difference.map((value) => -value));
        labels.push(0);
      }
    }
  }
  return { rows, labels };
}

/**
 * Fit the weights, and hand them back on the scale of the hand-set ones.
 *
 * Dividing by the total absolute weight makes the result readable next to the
 * numbers of N0, and comparable between two months of log. It changes no
 * ranking: scaling every weight scales every score the same way.
 */
export function learnWeights(impressions, { regularisation = 1, epochs = 600, rate = 0.5 } = {}) {
  const { rows, labels } = pairs(impressions);
  if (rows.length === 0) {
    throw new Error('no clicked and ignored pair in the log: nothing to learn from');
  }
  const learnt = new Array(SIGNALS.length).fill(0);
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const gradient = new Array(SIGNALS.length).fill(0);
    for (let i = 0; i < rows.length; i += 1) {
      const z = rows[i].reduce((sum, value, j) => sum + learnt[j] * value, 0);
      const error = 1 / (1 + Math.exp(-z)) - labels[i];
      rows[i].forEach((value, j) => { gradient[j] += (error * value) / rows.length; });
    }
    // The penalty keeps a signal the log never varied at exactly nought,
    // rather than letting it drift on noise.
    const penalty = regularisation * rows.length;
    learnt.forEach((w, j) => { learnt[j] = w - rate * (gradient[j] + w / penalty); });
  }
  const scale = learnt.reduce((sum, value) => sum + Math.abs(value), 0);
  return Object.fromEntries(SIGNALS.map((name, j) => [name, learnt[j] / scale]));
}

/**
 * Score candidates whose signals were computed by the serving pipeline.
 *
 * Same weighted sum as N0, same stable sort, same explanation returned: only
 * the provenance of the weights differs.
 */
export function rank(candidates, weights) {
  const scored = candidates.map((candidate) => ({
    candidate,
    score: SIGNALS.reduce((sum, name) => sum + weights[name] * candidate.signals[name], 0),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored;
}
