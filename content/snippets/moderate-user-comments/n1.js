/**
 * Score a comment with a linear classifier trained on a labelled corpus.
 *
 * Rung N1. The term list of N0 matches spellings. This matches shapes:
 * character n-grams, so `bl0rptard` and `blorptardd` share most of their
 * features with the form the model was shown, and a variant nobody added to a
 * list still scores.
 *
 * Written out rather than pulled from a library, because logistic regression
 * on hashed character n-grams is forty lines. The model is a vector of
 * weights: small enough to keep beside the code, trained while you read this,
 * and every weight can be printed and argued about. In moderation that last
 * property is worth more than a point of accuracy, because sooner or later
 * someone asks why their comment was hidden.
 */

// The hashing trick: no vocabulary to build, ship or keep in sync.
const BUCKETS = 1024;

/** Character n-grams of the lowercased comment, hashed into a fixed vector. */
function features(text) {
  const padded = ` ${text.toLowerCase()} `;
  const vector = new Float64Array(BUCKETS);
  for (let n = 3; n <= 5; n += 1) {
    for (let i = 0; i + n <= padded.length; i += 1) {
      let h = 2166136261;
      for (const c of padded.slice(i, i + n)) h = ((h ^ c.codePointAt(0)) * 16777619) >>> 0;
      vector[h % BUCKETS] += 1;
    }
  }
  const norm = Math.hypot(...vector);
  if (norm) for (let j = 0; j < BUCKETS; j += 1) vector[j] /= norm;
  return vector;
}

/**
 * `labels` is 1 when the comment breaks the policy, 0 when it does not.
 *
 * Each class is weighted by its rarity, because a real moderation corpus is
 * mostly ordinary comments and an unweighted model learns to allow everything.
 */
export function train(comments, labels, { epochs = 300, rate = 1 } = {}) {
  const rows = comments.map(features);
  const counts = [labels.filter((l) => l === 0).length, labels.filter((l) => l === 1).length];
  const weights = new Float64Array(BUCKETS);
  let bias = 0;
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    for (let i = 0; i < rows.length; i += 1) {
      const step = (rate * labels.length) / (2 * counts[labels[i]]);
      const error = predict(rows[i], weights, bias) - labels[i];
      for (let j = 0; j < BUCKETS; j += 1) weights[j] -= step * error * rows[i][j];
      bias -= step * error;
    }
  }
  return { weights, bias };
}

function predict(vector, weights, bias) {
  let z = bias;
  for (let j = 0; j < BUCKETS; j += 1) z += weights[j] * vector[j];
  return 1 / (1 + Math.exp(-z));
}

/** How strongly the model reads this comment as breaking the policy. */
export function score(model, comment) {
  return predict(features(comment), model.weights, model.bias);
}

/**
 * Return a decision, and keep the threshold in the caller's hands.
 *
 * Moderation has no neutral setting. Move it towards 1 and you silence fewer
 * innocent people while letting more abuse through; move it towards 0 and you
 * do the opposite. Someone has to choose, and it should not be this function.
 */
export function isAbusive(model, comment, threshold = 0.5) {
  return score(model, comment) >= threshold;
}
