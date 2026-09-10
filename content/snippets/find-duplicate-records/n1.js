/**
 * Find duplicate records by comparing spelling, not strings.
 *
 * Rung N1. The blocking key of N0 decides in advance which pairs deserve a
 * look, and everything it puts in two different groups stays invisible. This
 * rung drops the key: every record becomes a vector of its character n-grams,
 * and pairs are ranked by cosine.
 *
 * Why character n-grams rather than words: they survive a typo, a swapped
 * word order and a truncated field, because a misspelt word still shares most
 * of its three-letter slices with the correct one. Nothing here is learnt
 * from a corpus and there is no model to train. It is a weighting scheme and
 * a distance, which is why it fits in one screen with no dependency.
 *
 * The price is the search itself: no key means, in the worst case, every
 * pair. A neighbour index earns its place well before the file gets large.
 */

const NGRAM_SIZES = [2, 3, 4];

/** Lower case, strip accents and punctuation, collapse spaces. */
export function normalise(text) {
  return String(text).toLowerCase().normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/** One comparable string per record. */
export function recordText(record) {
  return normalise(Object.values(record).join(' '));
}

/**
 * Character n-grams, counted, taken inside word boundaries.
 *
 * Padding each word with spaces is what keeps "dupont" from borrowing an
 * n-gram from the join with the word that follows it.
 */
function ngrams(text) {
  const counts = new Map();
  for (const word of text.split(' ').filter(Boolean)) {
    const padded = ` ${word} `;
    for (const size of NGRAM_SIZES) {
      for (let i = 0; i + size <= padded.length; i += 1) {
        const gram = padded.slice(i, i + size);
        counts.set(gram, (counts.get(gram) ?? 0) + 1);
      }
    }
  }
  return counts;
}

/**
 * TF-IDF weights, L2 normalised, one sparse vector per record.
 *
 * The inverse document frequency is what stops "paris", present in every
 * record of a Paris file, from making every pair look alike.
 */
function vectorise(texts) {
  const counted = texts.map(ngrams);
  const documentFrequency = new Map();
  for (const counts of counted) {
    for (const gram of counts.keys()) {
      documentFrequency.set(gram, (documentFrequency.get(gram) ?? 0) + 1);
    }
  }
  return counted.map((counts) => {
    const vector = new Map();
    for (const [gram, count] of counts) {
      const idf = Math.log((1 + texts.length) / (1 + documentFrequency.get(gram))) + 1;
      vector.set(gram, count * idf);
    }
    const norm = Math.hypot(...vector.values());
    for (const [gram, weight] of vector) vector.set(gram, norm ? weight / norm : 0);
    return vector;
  });
}

/**
 * Return the pairs `[i, j, score]` that look like the same record.
 *
 * The threshold is yours to set: towards 1.0 if merging two different
 * customers is the worse outcome, towards 0.0 if missing a duplicate is.
 */
export function findDuplicates(records, threshold = 0.6) {
  const vectors = vectorise(records.map(recordText));
  const pairs = [];
  for (let i = 0; i < vectors.length; i += 1) {
    for (let j = i + 1; j < vectors.length; j += 1) {
      let score = 0;
      // Walking the shorter vector: only the grams the two records share
      // contribute anything to a cosine.
      for (const [gram, weight] of vectors[i]) score += weight * (vectors[j].get(gram) ?? 0);
      if (score >= threshold) pairs.push([i, j, Math.round(score * 1000) / 1000]);
    }
  }
  return pairs.sort((a, b) => b[2] - a[2] || a[0] - b[0] || a[1] - b[1]);
}
