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
 * value outside is brought back onto it rather than left to swamp the others. A
 * weight of two really does mean twice as much, and the score, a mean over
 * weights that cannot be negative, stays inside the same scale.
 *
 * Brought back, and not refused: a margin of -0.05 is a real thing —
 * end-of-season stock sold at a loss — and this function is called on every page
 * of results. One badly filled product must not take the whole category page
 * down with it. The products whose signals had to be moved come back named, so
 * that the fault is visible rather than silent. The weights are another matter:
 * they come from the code, and a weight that is not a finite number, zero or
 * above, is refused.
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
 *
 * It is a share, not a relevance score. On a one-word query every product that
 * holds the word scores 1.0, and the ranking is then decided entirely by stock,
 * margin and popularity. If you already run a search engine — BM25 in
 * PostgreSQL, Elasticsearch, Meilisearch — put its score here instead,
 * normalised to nought-to-one. The value of this rung is the arbitration
 * between the four weights, not this signal.
 */
export function textMatch(query, product) {
  const wanted = terms(query);
  if (wanted.length === 0) return 0;
  const haystack = terms(`${product.title} ${(product.tags ?? []).join(' ')}`);
  const found = wanted.filter((term) => haystack.some((word) => word.startsWith(term)));
  return found.length / wanted.length;
}

// The signals that come from the catalogue rather than from the query, and can
// therefore arrive out of scale.
export const FROM_DATA = ['margin', 'popularity'];

/**
 * Bring a value onto the nought-to-one scale, and say whether it had to move.
 *
 * Anything that is not a finite number reads as nought: a margin arriving as
 * null, as a string or as NaN is a data fault, not a ranking signal, and it is
 * reported rather than trusted.
 */
export function onScale(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return [0, true];
  const bounded = Math.min(Math.max(value, 0), 1);
  return [bounded, bounded !== value];
}

/** The catalogue signals `signals` had to move, named for the caller. */
export function outOfScale(product) {
  return FROM_DATA.filter((name) => onScale(product[name])[1]);
}

/** The four signals, each on the same nought-to-one scale. */
export function signals(product, query) {
  // A field the catalogue does not have at all is a schema fault, not a dirty
  // value: it is refused, as it is in Python.
  for (const name of [...FROM_DATA, 'inStock']) {
    if (!(name in product)) throw new RangeError(`the catalogue gives no ${name} for this product`);
  }
  return {
    text: textMatch(query, product),
    availability: product.inStock ? 1 : 0,
    margin: onScale(product.margin)[0],
    popularity: onScale(product.popularity)[0],
  };
}

/** Weighted mean of the signals, so the score stays on the same scale. */
export function score(measured, weights) {
  const missing = SIGNALS.filter((name) => !(name in weights));
  if (missing.length > 0) {
    throw new RangeError(`every signal needs a weight, and these have none: ${missing.join(', ')}`);
  }
  for (const name of SIGNALS) {
    const weight = weights[name];
    // Unlike a signal, a weight comes from the code, not from the catalogue:
    // it is refused rather than brought back into line.
    if (typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0) {
      throw new RangeError(`a weight must be a finite number, nought or above: ${name} is ${weight}`);
    }
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
 * which signal held it back. `outOfScale` names the catalogue signals that had
 * to be brought back onto the scale, so that a margin of -0.05 shows up in the
 * output instead of taking the page down.
 */
export function rank(products, query, weights = DEFAULT_WEIGHTS) {
  const scored = products.map((product) => {
    const measured = signals(product, query);
    return {
      product,
      score: score(measured, weights),
      signals: measured,
      outOfScale: outOfScale(product),
    };
  });
  // Array.prototype.sort is stable: products the score cannot separate keep
  // their catalogue order.
  scored.sort((a, b) => b.score - a.score);
  return scored;
}
