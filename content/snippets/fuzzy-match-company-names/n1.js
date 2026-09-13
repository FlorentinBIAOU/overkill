/**
 * Match company names on character n-grams weighted by TF-IDF.
 *
 * Rung N1. N0 compares two strings. This compares one name against a whole
 * register, and it does so by looking at the fragments a name is made of.
 *
 * A rare fragment now weighs more than a common one. "boulangerie" appears
 * in half the register and tells you almost nothing; "quiquengrogne"
 * appears once and settles the question. TF-IDF is exactly that arithmetic,
 * and N0 has no equivalent: Jaro-Winkler treats every character alike.
 *
 * The n-grams are taken inside word boundaries, so a fragment never straddles
 * two words. "Martin Dubois" and "Dubois Martin" still meet, because word
 * order costs nothing here — unlike N0, where it costs almost everything.
 *
 * This is the same arithmetic scikit-learn performs, written out: raw counts,
 * an inverse document frequency smoothed on both sides, then rows brought to
 * length one so a cosine is a dot product.
 */

// Two to four characters: long enough to be a syllable, short enough to
// survive a typo somewhere else in the word.
const MIN_N = 2;
const MAX_N = 4;

/** Every n-gram of every word, each word padded with a space at both ends. */
function ngrams(text) {
  const out = [];
  for (const word of text.toLowerCase().split(/\s+/).filter(Boolean)) {
    const padded = ` ${word} `;
    for (let n = MIN_N; n <= MAX_N; n += 1) {
      // A word shorter than the window is counted once, whole, and no wider
      // window can tell you anything more about it.
      if (padded.length <= n) {
        out.push(padded);
        break;
      }
      for (let i = 0; i + n <= padded.length; i += 1) out.push(padded.slice(i, i + n));
    }
  }
  return out;
}

/** Counts times idf, brought to length one. Unknown n-grams are dropped. */
function weigh(grams, idf) {
  const counts = new Map();
  for (const g of grams) if (idf.has(g)) counts.set(g, (counts.get(g) ?? 0) + 1);
  const vector = new Map();
  let sum = 0;
  // Alphabetical order, so a name and the same name with its words swapped
  // add their weights in the same order and land on the very same float.
  for (const g of [...counts.keys()].sort()) {
    const tf = counts.get(g);
    const w = tf * idf.get(g);
    vector.set(g, w);
    sum += w * w;
  }
  const norm = Math.sqrt(sum);
  if (norm) for (const [g, w] of vector) vector.set(g, w / norm);
  return vector;
}

/** Fit the vocabulary on the register, once, and vectorise it. */
export function buildIndex(names) {
  const grams = names.map(ngrams);
  const df = new Map();
  for (const g of grams) for (const gram of new Set(g)) df.set(gram, (df.get(gram) ?? 0) + 1);
  const idf = new Map();
  for (const [gram, d] of df) idf.set(gram, Math.log((1 + names.length) / (1 + d)) + 1);
  return { names: [...names], idf, vectors: grams.map((g) => weigh(g, idf)) };
}

/** The nearest names in the register, best first, with their cosine score. */
export function match(index, query, topK = 3) {
  const vector = weigh(ngrams(query), index.idf);
  const scored = index.names.map((name, i) => {
    let dot = 0;
    for (const [gram, w] of vector) dot += w * (index.vectors[i].get(gram) ?? 0);
    return [name, dot];
  });
  // A stable sort, so two names with the same score always come back in
  // register order. A matching run has to be replayable.
  return scored.sort((a, b) => b[1] - a[1]).slice(0, topK);
}
