/**
 * Learn the ranking weights from past interactions instead of setting them by hand.
 *
 * Rung N1. The score is built on the same four signals as N0, each between
 * nought and one. What changes is where the four weights come from: a
 * merchandiser's judgement on N0, the click log here.
 *
 * The method is pairwise, and only one kind of pair counts: a clicked product
 * against a product that was shown **above** it and passed over. That is the
 * "Click > Skip Above" strategy of Joachims et al., and the reason for it is the
 * position bias they measured: a product shown below the click may never have
 * been looked at, so pairing it with the click teaches nothing about the
 * products and everything about the order the previous ranking already
 * produced. The model would learn to reproduce N0, which is the opposite of why
 * one climbs here.
 *
 * Each surviving pair becomes one training row, the difference between the
 * two signal vectors, and a logistic regression on those differences gives
 * back the weights of the original score. The signals shown to the shop stay
 * the same; the score does not. Learned weights can be negative, so the score
 * is a plain sum over weights whose absolute values add up to one, between
 * minus one and one, where N0 takes a mean of weights that cannot be negative.
 *
 * Every pair is added in both directions, one labelled a win and one a loss.
 * That keeps the two classes balanced, and it is why the model carries no
 * intercept: a constant would shift both directions of the same pair the same
 * way, which is meaningless when comparing two products of one result page.
 *
 * The fit is forty lines of gradient descent rather than a dependency,
 * which is the argument of this whole rung.
 */

export const SIGNALS = ['text', 'availability', 'margin', 'popularity'];

/**
 * Every signal a finite number between 0 and 1, the scale N0 serves them on.
 *
 * The type is checked, not only the comparison: `null >= 0` is true in
 * JavaScript, and a signal logged as null or as the string "0.9" would slip
 * through and count as something. A logged signal is not a catalogue field to
 * be cleaned up here — it is what the serving pipeline wrote down, and if it is
 * not a number the log is broken.
 */
const inScale = (signals) => SIGNALS.every((name) => typeof signals[name] === 'number'
  && Number.isFinite(signals[name]) && signals[name] >= 0 && signals[name] <= 1);

/**
 * Turn result pages into training rows.
 *
 * `impressions` is one entry per result page shown to a shopper, **in the order
 * the page displayed them**, each item holding the signals logged at serving
 * time and whether it was clicked. That order is the whole point: only the
 * products above a click are paired with it.
 *
 * Logging the signals rather than recomputing them later matters too: a product
 * that has since gone out of stock must be trained on the availability it had
 * on the day, not on today's.
 *
 * A log where the first result is always clicked produces no pair at all, and
 * `learnWeights` says so rather than inventing weights.
 */
export function pairs(impressions) {
  const rows = [];
  const labels = [];
  for (const page of impressions) {
    if (!page.every((item) => inScale(item.signals))) throw new RangeError('every logged signal must lie between 0 and 1');
    page.forEach((item, position) => {
      if (!item.clicked) return;
      for (const above of page.slice(0, position)) {
        if (above.clicked) continue; // two clicks say nothing about each other
        const difference = SIGNALS.map((name) => item.signals[name] - above.signals[name]);
        rows.push(difference);
        labels.push(1);
        rows.push(difference.map((value) => -value));
        labels.push(0);
      }
    });
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
    throw new Error('no click with an ignored product above it in the log: nothing to learn from');
  }
  const learnt = new Array(SIGNALS.length).fill(0);
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const gradient = new Array(SIGNALS.length).fill(0);
    for (let i = 0; i < rows.length; i += 1) {
      const z = rows[i].reduce((sum, value, j) => sum + learnt[j] * value, 0);
      const error = 1 / (1 + Math.exp(-z)) - labels[i];
      rows[i].forEach((value, j) => { gradient[j] += (error * value) / rows.length; });
    }
    // The penalty of scikit-learn's `C`, divided by the row count because the
    // gradient above is a mean: it is what makes both versions fit one model.
    const penalty = regularisation * rows.length;
    learnt.forEach((w, j) => { learnt[j] = w - rate * (gradient[j] + w / penalty); });
  }
  const scale = learnt.reduce((sum, value) => sum + Math.abs(value), 0);
  if (!scale) throw new Error('clicked and ignored products never differ in the log: nothing to learn from');
  return Object.fromEntries(SIGNALS.map((name, j) => [name, learnt[j] / scale]));
}

/**
 * Score candidates whose signals were computed by the serving pipeline.
 *
 * A sum weighted over the same signals, the same stable sort, the signals
 * handed back with each candidate. Not N0's mean: dividing by the signed total
 * of learned weights would reverse the order when that total is negative, and
 * wipe it out when it is nought.
 */
export function rank(candidates, weights) {
  const scored = candidates.map((candidate) => ({
    candidate,
    score: SIGNALS.reduce((sum, name) => sum + weights[name] * candidate.signals[name], 0),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored;
}
