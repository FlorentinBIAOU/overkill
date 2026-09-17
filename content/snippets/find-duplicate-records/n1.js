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
 * a distance, written here with no dependency.
 *
 * The price is the search itself: no key means every pair of the file is
 * scored, so the cost grows with the square of the file. The latency class
 * shown for this rung is measured on the nominal file of its tests; twenty
 * thousand records are a matter of seconds, not of milliseconds.
 */

const NGRAM_SIZES = [2, 3, 4];

/** Lower case, strip accents, invisible characters and punctuation, collapse spaces. */
export function normalise(text) {
  // A zero-width space is a format character: dropped, it does not split a word.
  return String(text ?? '').toLowerCase().normalize('NFKD').replace(/\p{Cf}/gu, '')
    .replace(/\p{Diacritic}/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/**
 * One comparable string per record, columns in a stable order.
 *
 * Sorted by column name, so that two exports of the same data give the same
 * text whatever order their columns come in: n-grams taken across a column
 * boundary would otherwise differ. An empty cell adds nothing.
 */
export function recordText(record) {
  const keys = Object.keys(record).sort();
  return normalise(keys.filter((key) => record[key] !== null && record[key] !== undefined)
    .map((key) => String(record[key])).join(' '));
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
      // Walking the shorter vector: only the grams the two records share
      // contribute anything to a cosine.
      const [small, large] = vectors[i].size <= vectors[j].size ? [vectors[i], vectors[j]] : [vectors[j], vectors[i]];
      let score = 0;
      for (const [gram, weight] of small) score += weight * (large.get(gram) ?? 0);
      // A hair of tolerance: in floating point, two identical records can score just under 1.0.
      if (score >= threshold - 1e-9) pairs.push([i, j, Math.round(score * 1000) / 1000]);
    }
  }
  return pairs.sort((a, b) => b[2] - a[2] || a[0] - b[0] || a[1] - b[1]);
}
