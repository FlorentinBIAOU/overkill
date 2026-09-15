/**
 * Search your own documents with an inverted index and a BM25 you wrote.
 *
 * Rung N1. Not because the index of N0 is bad — N0 is still the
 * recommendation — but because the code below is a BM25 you can read, and
 * reading it once tells you why a document ranked where it did. It does not
 * reproduce FTS5 to the decimal: the matching rule, the idf, the length and
 * the title weight all differ, and each is a line you can change.
 *
 * Three decisions are yours here, and they were the engine's before.
 *
 * The tokenizer: what counts as a word, which accents are folded, which terms
 * are dropped. The matching rule: this one keeps any document carrying at
 * least one term, where FTS5 demands all of them. And the ranking: k1
 * saturates repetition, b corrects for document length, and the field weights
 * say how much a title is worth. Change one and the order changes; that is the
 * point of owning it.
 */

export const FIELD_WEIGHTS = { title: 3, body: 1 };

/** Lower case, strip accents, keep letters and digits. */
export function tokenise(text) {
  return String(text).toLowerCase().normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** Build the postings: for each term, the documents carrying it. */
export function buildIndex(documents, weights = FIELD_WEIGHTS) {
  const postings = new Map(); // term -> Map(document id -> weighted frequency)
  const lengths = new Map();
  for (const document of documents) {
    const counts = new Map();
    for (const [field, weight] of Object.entries(weights)) {
      for (const term of tokenise(document[field] ?? '')) {
        counts.set(term, (counts.get(term) ?? 0) + weight);
      }
    }
    for (const [term, frequency] of counts) {
      if (!postings.has(term)) postings.set(term, new Map());
      postings.get(term).set(document.id, frequency);
    }
    lengths.set(document.id, [...counts.values()].reduce((sum, v) => sum + v, 0));
  }
  const total = [...lengths.values()].reduce((sum, v) => sum + v, 0);
  return { postings, lengths, averageLength: lengths.size ? total / lengths.size : 0 };
}

/**
 * Return the best matches, best first, each with the score it was given.
 *
 * `terms` says what each query word contributed. A ranking nobody can explain
 * is a ranking nobody can fix.
 */
export function search(index, query, { limit = 5, k1 = 1.2, b = 0.75 } = {}) {
  // A negative slice would silently drop the last results: refuse it.
  if (limit < 0) throw new RangeError('limit must be zero or more');
  const scores = new Map();
  const contributions = new Map();
  // A Set keeps the order and drops repeats: a word typed twice is not twice
  // as important.
  for (const term of new Set(tokenise(query))) {
    const postings = index.postings.get(term);
    if (!postings) continue;
    // The rarer the term, the more a match on it means.
    const idf = Math.log(1 + (index.lengths.size - postings.size + 0.5) / (postings.size + 0.5));
    for (const [id, frequency] of postings) {
      const norm = 1 - b + (b * index.lengths.get(id)) / index.averageLength;
      const share = (idf * frequency * (k1 + 1)) / (frequency + k1 * norm);
      scores.set(id, (scores.get(id) ?? 0) + share);
      if (!contributions.has(id)) contributions.set(id, {});
      contributions.get(id)[term] = Math.round(share * 1e4) / 1e4;
    }
  }
  return [...scores.entries()]
    .sort((a, b2) => b2[1] - a[1] || (a[0] < b2[0] ? -1 : 1))
    .slice(0, limit)
    .map(([id, score]) => ({ id, score: Math.round(score * 1e4) / 1e4, terms: contributions.get(id) }));
}
