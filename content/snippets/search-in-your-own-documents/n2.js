/**
 * Add a vector leg to the full-text search you already have.
 *
 * Rung N2. N0 and N1 match words. A reader who asks for "vacances" where the
 * handbook says "congés payés" gets nothing, and that gap is what this rung
 * exists to close: a self-hosted encoder maps text to vectors where two ways
 * of saying the same thing land close together.
 *
 * It closes it in addition, not instead. Keyword search is exact when the
 * words match and silent when they do not; vector search always answers, and
 * is vague. Fusing the two rankings keeps the precision of the first and
 * borrows the reach of the second, which is why the entry calls this a
 * complement.
 *
 * What the rung really costs is not the arithmetic below. It is the
 * deployment: a few hundred megabytes of weights, a process kept warm, vectors
 * recomputed whenever a document changes, and a vector index as soon as they
 * stop fitting in an array — next to a full-text index the database already
 * maintains for free.
 */

// A multilingual model, because a handbook is rarely written in English.
export const MODEL_NAME = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';

export class EncodingFailed extends Error {}

/** Normalise once, so that a cosine is a dot product afterwards. */
export function unit(vector) {
  const norm = Math.hypot(...vector);
  return norm ? vector.map((value) => value / norm) : [...vector];
}

/** Rank every document by cosine similarity to the query. */
export async function vectorRanking(query, documents, encoder) {
  const texts = documents.map((document) => `${document.title} ${document.body}`);
  let vectors;
  try {
    // One batched call: the query travels with the documents.
    vectors = await encoder.encode([...texts, query]);
  } catch (error) {
    throw new EncodingFailed(String(error));
  }
  if (vectors.length !== texts.length + 1) {
    throw new EncodingFailed(`${vectors.length} vectors returned for ${texts.length + 1} texts`);
  }

  const normalised = vectors.map(unit);
  const queryVector = normalised.at(-1);
  const similarities = documents.map((document, i) => [
    document.id,
    normalised[i].reduce((sum, value, d) => sum + value * queryVector[d], 0),
  ]);
  // Ties are broken on the identifier, so two runs give the same order.
  similarities.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  return similarities.map(([id]) => id);
}

/**
 * Fuse the ranking your full-text search returned with a vector ranking.
 *
 * @param {string} query
 * @param {object[]} documents
 * @param {string[]} keywordIds what N0 already gave you, best first
 * @param {object} options
 * @param {{encode: Function}} [options.encoder] injected so this can be tested
 *   without downloading a model; defaults to a real local encoder
 */
export async function hybridSearch(query, documents, keywordIds, { encoder, limit = 5, k = 60 } = {}) {
  if (documents.length === 0) return [];
  if (!encoder) {
    // Downloads and loads the weights, so it is never reached in the tests.
    const { pipeline } = await import('@xenova/transformers');
    const extract = await pipeline('feature-extraction', MODEL_NAME);
    encoder = { encode: async (batch) => (await extract(batch, { pooling: 'mean' })).tolist() };
  }

  // Reciprocal rank fusion: each list votes with 1/(k + rank). Nothing has to
  // be rescaled, because a BM25 score and a cosine are never comparable, and k
  // says how much being second is worth compared with being first.
  const scores = new Map();
  const rankings = [[...keywordIds], await vectorRanking(query, documents, encoder)];
  for (const ranking of rankings) {
    ranking.forEach((id, index) => {
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + index + 1));
    });
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, limit)
    .map(([id, score]) => ({ id, score: Math.round(score * 1e6) / 1e6 }));
}
