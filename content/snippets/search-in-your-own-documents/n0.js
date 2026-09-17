/**
 * Search your own documents with the full-text index of the database you
 * already run.
 *
 * Rung N0. The Python version of this snippet is four SQL statements against
 * SQLite's FTS5: a virtual table holding an inverted index, and a bm25()
 * ranking function. Postgres has tsvector and ts_rank, MySQL has FULLTEXT ...
 * IN NATURAL LANGUAGE MODE. Whatever is under your application already has an
 * index and a ranking: on this rung you write SQL, not an algorithm.
 *
 * Node 22 ships `node:sqlite` (behind --experimental-sqlite before 22.13.0),
 * but its bundled SQLite has no FTS5 module, so there is nothing to call from
 * a plain `node` process. This file therefore writes out what the FTS5 table
 * does: the same tokenizer (lower case, accents off Latin letters), the same
 * implicit AND between terms, the same BM25 with the same constants and column
 * weights. Read it as the documentation of the SQL, not as something to deploy.
 *
 * One thing the SQL has and this does not: prefix tokens. For a search box that
 * answers as the reader types, FTS5 matches a prefix when a `*` follows a
 * quoted string, as in `"cong"*`. Neither version uses them, because a prefix
 * on every term widens every search, not only the one being typed.
 */

// SQLite's fts5 defaults. Its bm25() is negated so that ORDER BY works
// ascending; the scores below are the plain ones, bigger being better.
const K1 = 1.2;
const B = 0.75;

// A title match counts for more than a body match.
const COLUMN_WEIGHTS = { title: 10, body: 1 };

/**
 * Lower case, strip accents from Latin letters, keep letters and digits. A
 * ligature such as "ﬁ" or a full-width letter is kept as it is, as FTS5 does.
 */
export function tokenise(text) {
  return String(text).toLowerCase().normalize('NFD')
    .replace(/(\p{Script=Latin})\p{M}+/gu, (_, letter) => letter)
    .normalize('NFC')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** The tokens a query is searched with. */
export function queryTerms(query) {
  const terms = tokenise(query);
  // A one-letter token is what an elision ("l'accord") or a possessive
  // ("manager's") leaves behind. The implicit AND would require it, and empty
  // the results: it is dropped, unless the query holds nothing else.
  const words = terms.filter((term) => [...term].length > 1); // code points, as in Python
  return words.length > 0 ? words : terms;
}

/** Documents are objects with keys id, title and body. */
export function buildIndex(documents) {
  const documentFrequency = new Map();
  const rows = documents.map((document) => {
    const counts = new Map(); // term -> frequency, weighted by column
    let length = 0;
    for (const [field, weight] of Object.entries(COLUMN_WEIGHTS)) {
      for (const term of tokenise(document[field] ?? '')) {
        counts.set(term, (counts.get(term) ?? 0) + weight);
        length += 1;
      }
    }
    for (const term of counts.keys()) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
    return { id: document.id, counts, length };
  });
  const total = rows.reduce((sum, row) => sum + row.length, 0);
  return { rows, documentFrequency, averageLength: rows.length ? total / rows.length : 0 };
}

/** Return the best matches, best first, as objects with keys id and score. */
export function search(index, query, limit = 5) {
  // A negative slice would silently drop the last results: refuse it.
  if (limit < 0) throw new RangeError('limit must be zero or more');
  const terms = queryTerms(query);
  if (terms.length === 0) return [];

  const results = [];
  for (const row of index.rows) {
    // Implicit AND: a document missing one term of the query is not a result.
    if (!terms.every((term) => row.counts.has(term))) continue;
    let score = 0;
    for (const term of terms) {
      const hits = index.documentFrequency.get(term);
      // A term carried by more than half the documents separates nothing.
      // fts5 floors its weight rather than letting it go negative.
      const idf = Math.max(Math.log((index.rows.length - hits + 0.5) / (hits + 0.5)), 1e-6);
      const frequency = row.counts.get(term);
      const norm = 1 - B + (B * row.length) / index.averageLength;
      score += (idf * frequency * (K1 + 1)) / (frequency + K1 * norm);
    }
    results.push({ id: row.id, score });
  }
  results.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
  return results.slice(0, limit).map(({ id, score }) => ({ id, score: Math.round(score * 1e4) / 1e4 }));
}
