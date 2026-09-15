/**
 * Match company names by meaning, with a self-hosted encoder.
 *
 * Rung N2. N0 and N1 both compare characters, so both miss the pair this
 * entry keeps coming back to: an acronym and the name it stands for share
 * almost no letters. The encoder maps each name to a vector built for
 * semantic search, where closeness is meant to follow meaning rather than
 * spelling. Whether it brings that pair together, nothing here measures.
 *
 * What it costs: model weights to download and keep, a process that holds
 * them in memory, and a score that cannot be explained fragment by fragment,
 * as N1's can. The register also has to be re-encoded whenever the model
 * changes: vectors from two models are not interchangeable.
 *
 * Note what is not here: no legal form is stripped and nothing is lowercased.
 * The encoder is supposed to handle that itself. Whether it does is exactly
 * the part a local double cannot prove — see the test.
 */

export const MODEL_NAME = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';

/** The real encoder: fetched once, then held in memory and run locally. */
export async function loadEncoder(name = MODEL_NAME) {
  const { pipeline } = await import('@huggingface/transformers');
  // Full precision, the weights Python loads: a quantised default would give
  // other vectors, and other scores, than the Python snippet.
  const extract = await pipeline('feature-extraction', name, { dtype: 'fp32' });
  return { encode: async (texts) => (await extract(texts, { pooling: 'mean' })).tolist() };
}

/**
 * Encode the whole register once, and keep the encoder for the queries.
 *
 * `encoder` is injected so this can be tested without loading a model. Left
 * alone, it is the real one above.
 */
export async function buildIndex(names, encoder) {
  const model = encoder ?? (await loadEncoder());
  const kept = [...names];
  return { names: kept, encoder: model, vectors: (await model.encode(kept)).map(unit) };
}

/** The nearest names by meaning, best first, with their cosine score. */
export async function match(index, query, topK = 3) {
  const vector = unit((await index.encoder.encode([query]))[0]);
  const scored = index.names.map((name, i) => [name, dot(index.vectors[i], vector)]);
  // A stable sort, so two names with the same score always come back in
  // register order. A matching run has to be replayable.
  return scored.sort((a, b) => b[1] - a[1]).slice(0, topK);
}

/** Cosine similarity is a dot product once both sides have length one. */
function unit(vector) {
  let sum = 0;
  for (const v of vector) sum += v * v;
  const norm = Math.sqrt(sum);
  return norm ? vector.map((v) => v / norm) : [...vector];
}

function dot(a, b) {
  let total = 0;
  for (let i = 0; i < a.length; i += 1) total += a[i] * b[i];
  return total;
}
