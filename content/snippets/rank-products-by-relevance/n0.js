/**
 * Rank products with a weighted score: text match, availability, margin, popularity.
 *
 * Rung N0. Deterministic, no dependency, and above all arguable: the four
 * weights are arguments, not constants buried in the code. That is the point
 * of the whole approach. When sales say the top result is wrong, the
 * conversation is about a number a merchandiser can read, and the answer
 * arrives in an afternoon rather than in a retraining cycle.
 *
 * Two decisions make it usable.
 *
 * Every signal sits on the same nought-to-one scale before the weights touch
 * it: text and availability by construction, margin and popularity because a
 * value outside is refused rather than left to swamp the others. A weight of
 * two really does mean twice as much, and the score, a mean over weights that
 * cannot be negative, stays inside the same scale.
 *
 * The sort is stable, so two products the score cannot separate stay in the
 * order the catalogue gave them. An unstable sort would reshuffle equal
 * results between two page loads, and nobody would be able to reproduce a
 * complaint.
 */

// The order the weights are applied in. Fixing it keeps the arithmetic
// identical everywhere, which is what makes a ranking reproducible.
export const SIGNALS = ['text', 'availability', 'margin', 'popularity'];

// A starting point, not a truth. These are the numbers to argue about.
export const DEFAULT_WEIGHTS = { text: 6, availability: 2, margin: 1, popularity: 3 };

/**
 * Lowercase and drop accents, so that "crème" finds "creme".
 *
 * Only the diacritics Latin scripts use (U+0300 to U+036F) are dropped: in
 * Devanagari or Arabic the vowel signs are marks too, and dropping them would
 * turn one word into another.
 */
export function fold(text) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Split on anything that is not a letter, a mark or a digit. */
export function terms(text) {
  return fold(text).match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
}

/**
 * Share of the query terms found at the start of a word of the product.
 *
 * Prefix matching, not equality: a shopper who types "chauss" is looking for
 * "chaussures", and "sandale" finds "sandales". Not the other way round:
 * "sandales" does not find "sandale".
 */
export function textMatch(query, product) {
  const wanted = terms(query);
  if (wanted.length === 0) return 0;
  const haystack = terms(`${product.title} ${(product.tags ?? []).join(' ')}`);
  const found = wanted.filter((term) => haystack.some((word) => word.startsWith(term)));
  return found.length / wanted.length;
}

/** The four signals, each on the same nought-to-one scale. */
export function signals(product, query) {
  for (const name of ['margin', 'popularity']) {
    // Also catches a missing field: undefined is not between 0 and 1.
    if (!(product[name] >= 0 && product[name] <= 1)) {
      throw new RangeError(`${name} must lie between 0 and 1, not ${product[name]}`);
    }
  }
  return {
    text: textMatch(query, product),
    availability: product.inStock ? 1 : 0,
    margin: product.margin,
    popularity: product.popularity,
  };
}

/** Weighted mean of the signals, so the score stays on the same scale. */
export function score(measured, weights) {
  if (SIGNALS.some((name) => weights[name] < 0)) {
    throw new RangeError('a weight cannot be negative: the score is a weighted mean');
  }
  let total = 0;
  let weighted = 0;
  for (const name of SIGNALS) {
    total += weights[name];
    weighted += weights[name] * measured[name];
  }
  return total ? weighted / total : 0;
}

/**
 * Sort the catalogue, best first, and hand back the reason for each place.
 *
 * Returning the signals alongside the score costs nothing and settles most
 * arguments before they start: whoever asks why a product came third can see
 * which signal held it back.
 */
export function rank(products, query, weights = DEFAULT_WEIGHTS) {
  const scored = products.map((product) => {
    const measured = signals(product, query);
    return { product, score: score(measured, weights), signals: measured };
  });
  // Array.prototype.sort is stable: products the score cannot separate keep
  // their catalogue order.
  scored.sort((a, b) => b.score - a.score);
  return scored;
}
