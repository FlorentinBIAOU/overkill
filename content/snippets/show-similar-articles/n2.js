/**
 * Related articles from self-hosted document embeddings.
 *
 * Rung N2. N1 compares words. Two articles that cover the same subject with
 * two vocabularies, or in two languages, share no term and score exactly
 * zero. An encoder maps each article to a vector where meaning, not spelling,
 * decides the distance, so the French and the English piece on sourdough can
 * land together.
 *
 * The table is still built offline, once per corpus change, and it has the
 * same shape as the one N0 and N1 return: the page-rendering code never
 * changes. What changes is what you now run — a few hundred megabytes of
 * weights, a process to keep warm, and a vector index once the corpus
 * outgrows an array.
 *
 * The encoder is a parameter with a real default, so the reader sees the
 * loading code while the test injects a local double.
 */

export const MODEL_NAME = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';

export class EncodingFailed extends Error {}

/** One string per article. An encoder wants a sentence, not a bag of words. */
export function articleText(article) {
  return `${article.title}. ${article.body}`;
}

/** Normalise once, so that a cosine is a dot product afterwards. */
export function unit(vector) {
  const norm = Math.hypot(...vector);
  return norm ? vector.map((value) => value / norm) : [...vector];
}

/**
 * Return `{ [article id]: [[neighbour id, score], ...] }`, best first.
 *
 * @param {object[]} articles
 * @param {object} options
 * @param {{encode: Function}} [options.encoder] injected so this can be
 *   tested without downloading a model; defaults to a real local encoder
 */
export async function buildNeighbourTable(articles, { encoder, k = 5, minimum = 0 } = {}) {
  if (articles.length < 2) return Object.fromEntries(articles.map((a) => [a.id, []]));
  const texts = articles.map(articleText);

  if (!encoder) {
    // Downloads and loads the weights, so it is never reached in the tests.
    const { pipeline } = await import('@xenova/transformers');
    const extract = await pipeline('feature-extraction', MODEL_NAME);
    encoder = { encode: async (batch) => (await extract(batch, { pooling: 'mean' })).tolist() };
  }

  // One batched call. Encoding article by article wastes most of the machine,
  // and this runs over the whole corpus every time an article is published.
  let vectors;
  try {
    vectors = (await encoder.encode(texts)).map(unit);
  } catch (error) {
    throw new EncodingFailed(String(error));
  }
  if (vectors.length !== texts.length) {
    throw new EncodingFailed(`${vectors.length} vectors returned for ${texts.length} articles`);
  }

  const table = {};
  articles.forEach((article, index) => {
    const neighbours = [];
    articles.forEach((other, position) => {
      if (position === index) return;
      const cosine = vectors[index].reduce((sum, value, d) => sum + value * vectors[position][d], 0);
      const score = Math.round(cosine * 1000) / 1000;
      if (score > minimum) neighbours.push([other.id, score]);
    });
    // Ties broken by identifier, so that two builds give the same page.
    neighbours.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
    table[article.id] = neighbours.slice(0, k);
  });
  return table;
}
