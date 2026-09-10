/**
 * Catch obfuscated contact details with a light classifier.
 *
 * Rung N1. The regular expressions of N0 see one spelling of a phone number.
 * This sees the shape of one: a run of tokens that is mostly digits, mostly
 * short, sitting next to words like "call" or "reach".
 *
 * Written out in full rather than pulled from a library, because logistic
 * regression on hashed character n-grams is forty lines. That is the whole
 * argument of this rung: the classical tool is small enough to read.
 */

// Digits written as words, in English and in French.
const DIGIT_WORDS = new Set(
  ('zero one two three four five six seven eight nine ten ' +
    'zéro un deux trois quatre cinq six sept huit neuf dix').split(' '),
);

// Characters used to stand in for digits.
const LOOKALIKES = { O: '0', o: '0', I: '1', i: '1', l: '1', S: '5', s: '5' };

const BUCKETS = 512; // hashing trick: no vocabulary to build or ship

/**
 * True when folding lookalike characters turns the whole token into digits.
 * The token must already carry one real digit; folding unconditionally would
 * turn "loll" into 1011.
 */
function isDigitsInDisguise(token) {
  if (!/\d/.test(token)) return false;
  const folded = [...token].map((c) => LOOKALIKES[c] ?? c).join('');
  return /^\d+$/.test(folded);
}

/** Turn a message into the features that matter, and drop the rest. */
export function shape(text) {
  const out = [];
  for (const token of text.match(/[\p{L}\p{N}]+/gu) ?? []) {
    const lowered = token.toLowerCase();
    if (DIGIT_WORDS.has(lowered)) out.push('D');
    else if (isDigitsInDisguise(token)) out.push('D'.repeat(token.length));
    else if (lowered.length >= 2) out.push(lowered);
  }
  return out.join(' ');
}

/** Character n-grams of the shaped message, hashed into a fixed vector. */
function features(text) {
  const shaped = ` ${shape(text)} `;
  const vector = new Float64Array(BUCKETS);
  for (let n = 2; n <= 4; n += 1) {
    for (let i = 0; i + n <= shaped.length; i += 1) {
      let h = 2166136261;
      for (const c of shaped.slice(i, i + n)) h = ((h ^ c.codePointAt(0)) * 16777619) >>> 0;
      vector[h % BUCKETS] += 1;
    }
  }
  const norm = Math.hypot(...vector);
  return norm ? vector.map((v) => v / norm) : vector;
}

/** `labels` is 1 when the message hides contact details, 0 when it does not. */
export function train(messages, labels, { epochs = 400, rate = 0.5 } = {}) {
  const rows = messages.map(features);
  const weights = new Float64Array(BUCKETS);
  let bias = 0;

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    for (let i = 0; i < rows.length; i += 1) {
      let z = bias;
      for (let j = 0; j < BUCKETS; j += 1) z += weights[j] * rows[i][j];
      const error = 1 / (1 + Math.exp(-z)) - labels[i];
      for (let j = 0; j < BUCKETS; j += 1) weights[j] -= rate * error * rows[i][j];
      bias -= rate * error;
    }
  }
  return { weights, bias };
}

/**
 * Returns a decision, and the threshold is yours to set.
 *
 * Move it towards 1 if a false positive means blocking a legitimate message.
 * Move it towards 0 if letting one through is the worse outcome.
 */
export function isHidingContactDetails(model, message, threshold = 0.5) {
  const vector = features(message);
  let z = model.bias;
  for (let j = 0; j < BUCKETS; j += 1) z += model.weights[j] * vector[j];
  return 1 / (1 + Math.exp(-z)) >= threshold;
}
