/**
 * Related articles from self-hosted document embeddings.
 *
 * Rung N2. N1 compares words. Two articles that cover the same subject with two
 * vocabularies, or in two languages, share no term and score exactly zero. The
 * encoder named below is a multilingual one, trained so that a sentence and its
 * translation land close together: that is what could bring the French and the
 * English piece on sourdough together, which the test's local double does not do.
 * It reads only the start of a long article (128 tokens in Python, 512 in
 * JavaScript) and truncates the rest. That difference is a trap: the same article
 * gets two different vectors depending on which runtime encoded it, with no error
 * anywhere. Build the table and encode a new article with the same one. And for
 * articles, encoding the title and the standfirst is usually better than the whole
 * text cut off mid-paragraph: they say what the piece is about, and they fit.
 *
 * The table is still built offline, once per corpus change, and it has the same
 * shape as the one N0 and N1 return: the page-rendering code never changes.
 * What changes is what the build now runs: a model whose weights are downloaded
 * once, then loaded each time the table is built.
 *
 * The encoder is a parameter with a real default, so the reader sees the loading
 * code while the test injects a local double.
 */

export const MODEL_NAME = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';

export class EncodingFailed extends Error {}

/** One string per article. An encoder wants a sentence, not a bag of words. */
export function articleText(article) {
  return `${article.title ?? ''}. ${article.body ?? ''}`; // a NULL column is empty
}

/** Normalise once, so that a cosine is a dot product afterwards. */
export function unit(vector) {
  const values = Array.from(vector, Number);
  const norm = Math.hypot(...values);
  return norm ? values.map((value) => value / norm) : values;
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
    const { pipeline } = await import('@huggingface/transformers');
    const extract = await pipeline('feature-extraction', MODEL_NAME);
    encoder = { encode: async (batch) => (await extract(batch, { pooling: 'mean' })).tolist() };
  }

  // One batched call, over the whole corpus, every time the table is built.
  let vectors;
  try {
    vectors = (await encoder.encode(texts)).map(unit);
  } catch (error) {
    throw new EncodingFailed(String(error));
  }
  if (vectors.length !== texts.length) {
    throw new EncodingFailed(`${vectors.length} vectors returned for ${texts.length} articles`);
  }
  // A NaN would silently empty the table, a short vector would score 1.0 with anything.
  if (vectors.some((v) => v.length !== vectors[0].length || !v.every(Number.isFinite))) {
    throw new EncodingFailed('vectors of different sizes, or values that are not finite numbers');
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
