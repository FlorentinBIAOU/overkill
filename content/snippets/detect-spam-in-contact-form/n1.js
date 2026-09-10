/**
 * Tell spam from a real enquiry with a linear classifier on character n-grams.
 *
 * Rung N1. The rules of N0 look for the words a spammer used last year. This
 * looks at how the message is written: a few hundred labelled submissions, the
 * kind an inbox already holds, and the model learns the register rather than
 * the vocabulary list.
 *
 * Written out in full rather than pulled from a library, because TF-IDF on
 * character n-grams and a logistic regression fit by gradient descent is forty
 * lines. That is the whole argument of this rung: the classical tool is small
 * enough to read.
 */

const BUCKETS = 1024; // hashing trick: no vocabulary to build, or to ship
const NGRAMS = [3, 4, 5]; // long enough to carry a word, short enough to survive a typo

/** Lowercase and strip accents, so casing never doubles the feature space. */
export function fold(text) {
  return text.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/** How often each hashed character n-gram occurs in the message. */
function counts(text) {
  const padded = ` ${fold(text)} `;
  const seen = new Float64Array(BUCKETS);
  for (const n of NGRAMS) {
    for (let i = 0; i + n <= padded.length; i += 1) {
      let h = 2166136261;
      for (const c of padded.slice(i, i + n)) h = ((h ^ c.codePointAt(0)) * 16777619) >>> 0;
      seen[h % BUCKETS] += 1;
    }
  }
  return seen;
}

/** Sublinear term frequency, weighted by inverse document frequency, L2 normalised. */
function vector(seen, idf) {
  const v = seen.map((count, j) => (count ? (1 + Math.log(count)) * idf[j] : 0));
  const norm = Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
  return norm ? v.map((x) => x / norm) : v;
}

/** `labels` is 1 when the submission is spam, 0 when it is a real enquiry. */
export function train(messages, labels, { epochs = 300, rate = 0.5 } = {}) {
  const raw = messages.map(counts);
  // Inverse document frequency: an n-gram every message carries says nothing.
  const idf = new Float64Array(BUCKETS).map((_, j) =>
    Math.log((1 + raw.length) / (1 + raw.filter((seen) => seen[j] > 0).length)) + 1);
  const rows = raw.map((seen) => vector(seen, idf));
  const model = { weights: new Float64Array(BUCKETS), bias: 0, idf };

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    for (let i = 0; i < rows.length; i += 1) {
      const error = probability(model, rows[i]) - labels[i];
      for (let j = 0; j < BUCKETS; j += 1) model.weights[j] -= rate * error * rows[i][j];
      model.bias -= rate * error;
    }
  }
  return model;
}

/** The logistic of the weighted sum: one number between zero and one. */
function probability(model, row) {
  let z = model.bias;
  for (let j = 0; j < BUCKETS; j += 1) z += model.weights[j] * row[j];
  return 1 / (1 + Math.exp(-z));
}

/** Probability that the submission is spam. */
export function spamScore(model, message) {
  return probability(model, vector(counts(message), model.idf));
}

/**
 * Returns a decision, and the threshold is yours to set.
 *
 * Move it towards 1 when losing a real enquiry is the expensive mistake.
 * Move it towards 0 when a spam message reaching a human is the expensive one.
 */
export function isSpam(model, message, threshold = 0.5) {
  return spamScore(model, message) >= threshold;
}
