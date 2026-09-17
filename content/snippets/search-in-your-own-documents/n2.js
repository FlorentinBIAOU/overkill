/**
 * Add a vector leg to the full-text search you already have.
 *
 * Rung N2. N0 and N1 match words. A reader who asks for "vacances" where the
 * handbook says "congés payés" gets nothing, and that gap is what this rung
 * exists to close: a self-hosted sentence encoder, built for semantic search,
 * maps each text to a dense vector, and texts are compared on those vectors
 * rather than on the words they share.
 *
 * It closes it in addition, not instead. Keyword search finds what shares the
 * words and stays silent otherwise; vector search ranks every document,
 * always. Fusing the two rankings keeps the first keyword result ahead of any
 * page the keywords did not find, and borrows the reach of the vectors;
 * further down the list, each leg weighs as much as the other.
 *
 * What the rung really costs is not the arithmetic below. It is the
 * deployment: weights to download and load, a process to keep warm, and
 * document vectors to recompute when a document changes — next to a full-text
 * index the database already maintains for free.
 */

// A multilingual model: its card lists French among its languages, and the
// handbook in the tests is French.
export const MODEL_NAME = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';

// Per encoder, the unit vector of each document text seen in the last search:
// a document is encoded again only once its text has changed.
const documentVectors = new WeakMap();

export class EncodingFailed extends Error {}

let defaultEncoder;

/** Loaded once per process, then kept warm. */
function loadDefaultEncoder() {
  defaultEncoder ??= (async () => {
    const { pipeline } = await import('@huggingface/transformers');
    const extract = await pipeline('feature-extraction', MODEL_NAME);
    return { encode: async (batch) => (await extract(batch, { pooling: 'mean' })).tolist() };
  })().catch((error) => {
    defaultEncoder = undefined; // a failed load is tried again on the next search
    throw error;
  });
  return defaultEncoder;
}

/** Normalise once, so that a cosine is a dot product afterwards. */
export function unit(vector) {
  const values = Array.from(vector, Number);
  const norm = Math.hypot(...values);
  return norm ? values.map((value) => value / norm) : values;
}

/** Rank every document by cosine similarity to the query. */
export async function vectorRanking(query, documents, encoder) {
  const texts = documents.map((document) => `${document.title} ${document.body}`);
  const known = documentVectors.get(encoder) ?? new Map();
  const missing = [...new Set(texts)].filter((text) => !known.has(text));
  let vectors;
  try {
    // One batched call: the query travels with the documents not yet encoded.
    vectors = (await encoder.encode([...missing, query])).map(unit);
  } catch (error) {
    throw new EncodingFailed(String(error));
  }
  if (vectors.length !== missing.length + 1) {
    throw new EncodingFailed(`${vectors.length} vectors returned for ${missing.length + 1} texts`);
  }
  const queryVector = vectors.pop();
  // A copy, not the served map: a vector that turns out to be unusable must not
  // stay behind in the cache, where it would make this page unfindable, and
  // every later search that touches it fail, until the process restarts.
  // Python writes into a new dictionary for the same reason.
  const fresh = new Map(known);
  missing.forEach((text, i) => fresh.set(text, vectors[i]));
  const kept = new Map(texts.map((text) => [text, fresh.get(text)]));
  const usable = (v) => v.length === queryVector.length && v.every(Number.isFinite);
  if (![...kept.values(), queryVector].every(usable)) {
    throw new EncodingFailed('vectors of different sizes, or values that are not finite numbers');
  }
  documentVectors.set(encoder, kept);

  const similarities = documents.map((document, i) => [
    document.id,
    kept.get(texts[i]).reduce((sum, value, d) => sum + value * queryVector[d], 0),
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
  encoder ??= await loadDefaultEncoder();

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
