/**
 * Detect the language of a text with a naive Bayes classifier on character
 * n-grams.
 *
 * Rung N1. Same features as N0, one to three characters, but weighed instead
 * of ranked. Each n-gram of the text votes for every language, in proportion
 * to how often that language uses it, and the votes are multiplied together.
 *
 * What this buys over the rank distance of N0 is a number the caller can act
 * on. N0 answers "French"; this answers "French, and here is how far ahead of
 * Spanish it is". A detector that can abstain is worth more than one that is
 * right slightly more often.
 *
 * Written out in full rather than pulled from a library, because multinomial
 * naive Bayes is thirty lines of counting. That is the argument of this rung:
 * the classical tool is small enough to read.
 */

// Smoothing. An n-gram a language never used should count against it, without
// ruling the language out on the strength of a single character.
const ALPHA = 0.1;

/**
 * The n-grams of one to three characters of every word, padded with spaces so
 * that an n-gram carries the information that it opens or closes a word.
 */
export function ngrams(text) {
  const grams = [];
  for (const word of text.toLowerCase().split(/\s+/).filter(Boolean)) {
    const padded = ` ${word} `;
    for (let n = 1; n <= 3; n += 1) {
      for (let i = 0; i + n <= padded.length; i += 1) grams.push(padded.slice(i, i + n));
    }
  }
  return grams;
}

/** Fit on one sample of text per language: `{ fr: "…", en: "…" }`. */
export function train(samples) {
  const vocabulary = new Set();
  const counts = new Map();
  for (const [language, sample] of Object.entries(samples)) {
    const perLanguage = new Map();
    for (const gram of ngrams(sample)) {
      perLanguage.set(gram, (perLanguage.get(gram) ?? 0) + 1);
      vocabulary.add(gram);
    }
    counts.set(language, perLanguage);
  }
  return { counts, vocabulary };
}

/**
 * How the text splits between the known languages.
 *
 * Read these as an ordering, not as a measure of truth: they always sum to
 * one, over the languages the model was trained on and no others.
 */
export function probabilities(model, text) {
  const { counts, vocabulary } = model;
  const grams = ngrams(text).filter((gram) => vocabulary.has(gram));
  const logScores = [...counts].map(([language, perLanguage]) => {
    const total = [...perLanguage.values()].reduce((a, b) => a + b, 0);
    const denominator = total + ALPHA * vocabulary.size;
    // Sum of logs rather than a product of probabilities: multiplying a few
    // thousand small numbers underflows to zero.
    let score = 0;
    for (const gram of grams) score += Math.log(((perLanguage.get(gram) ?? 0) + ALPHA) / denominator);
    return [language, score];
  });
  const highest = Math.max(...logScores.map(([, score]) => score));
  const weights = logScores.map(([language, score]) => [language, Math.exp(score - highest)]);
  const sum = weights.reduce((a, [, weight]) => a + weight, 0);
  return Object.fromEntries(weights.map(([language, weight]) => [language, weight / sum]));
}

/**
 * The most likely language, or null when the model is not sure enough.
 *
 * `minimum` is yours to set. Raise it when a wrong language costs more than no
 * answer, for instance when the answer picks the queue a message is routed to.
 * Leave it at zero to always get a name, as N0 does.
 */
export function detect(model, text, minimum = 0) {
  const scores = Object.entries(probabilities(model, text));
  const [best, score] = scores.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0];
  return score >= minimum ? best : null;
}
