/**
 * Route a ticket by its nearest resolved tickets, with a self-hosted encoder.
 *
 * Rung N2. N1 learns the words of the archive; an encoder maps a ticket to a
 * vector by meaning, so a customer who says « je n'arrive plus à entrer dans
 * mon espace » lands next to the archived tickets about a lost password even
 * though they share no word with them.
 *
 * There is no training step here, and that is the point of the rung: the index
 * is the archive itself. A team that changes scope is a re-encoding, not a
 * retraining, and the neighbours are shown to the agent as the reason for the
 * routing — which is more than N1's weights ever explain.
 *
 * What it costs: a model file to ship and keep in sync, a warm process to hold
 * it, and a routing whose answers change the day you upgrade the model. The
 * archive also has to be re-encoded then, and the old scores are not
 * comparable to the new.
 */

export const MODEL_NAME = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';

export const DEFAULT_TEAM = 'general';

/** The real encoder: fetched once, then held in memory and run locally. */
export async function loadEncoder(name = MODEL_NAME) {
  const { pipeline } = await import('@xenova/transformers');
  const extract = await pipeline('feature-extraction', name);
  return { encode: async (texts) => (await extract(texts, { pooling: 'mean' })).tolist() };
}

/**
 * Encode the resolved archive once, and keep the encoder for the queries.
 *
 * `encoder` is injected so this can be tested without loading a model. Left
 * alone, it is the real one above.
 */
export async function buildIndex(tickets, teams, encoder) {
  const model = encoder ?? (await loadEncoder());
  const kept = [...tickets];
  return {
    tickets: kept,
    teams: [...teams],
    encoder: model,
    vectors: (await model.encode(kept)).map(unit),
  };
}

/** The k nearest resolved tickets, best first, with their cosine score. */
export async function neighbours(index, ticket, k = 3) {
  const vector = unit((await index.encoder.encode([ticket]))[0]);
  const scored = index.vectors.map((known, i) => [dot(known, vector), index.teams[i]]);
  // A stable sort, so two equally close tickets always come back in archive
  // order. A routing run has to be replayable.
  return scored.sort((a, b) => b[0] - a[0]).slice(0, k);
}

/**
 * The team of the nearest resolved tickets, each voting with its similarity.
 *
 * A vote rather than the single best neighbour: one archived ticket that
 * happens to be phrased like this one is an accident, three of them are a
 * pattern.
 *
 * The floor is what keeps the default queue of N0 alive. Below it, nothing in
 * the archive resembles this ticket, and the honest answer is that this rung
 * has never seen the problem.
 */
export async function route(index, ticket, { k = 3, minSimilarity = 0.25, defaultTeam = DEFAULT_TEAM } = {}) {
  const votes = new Map();
  for (const [similarity, team] of await neighbours(index, ticket, k)) {
    if (similarity >= minSimilarity) votes.set(team, (votes.get(team) ?? 0) + similarity);
  }
  if (votes.size === 0) return defaultTeam;
  // Ties go to the team of the closest neighbour, which is the first key
  // inserted above.
  let best = defaultTeam;
  let bestVote = -Infinity;
  for (const [team, vote] of votes) {
    if (vote > bestVote) [best, bestVote] = [team, vote];
  }
  return best;
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
