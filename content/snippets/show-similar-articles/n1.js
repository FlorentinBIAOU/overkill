/**
 * Related articles from the text itself: TF-IDF, then cosine similarity.
 *
 * Rung N1. N0 only sees what someone remembered to tag. This reads the
 * article, and lets the corpus decide which words matter: a word appearing in
 * every article weighs almost nothing, which is the idea of N0 applied to
 * vocabulary instead of labels. Nobody has to maintain anything.
 *
 * Written out rather than pulled from a library, because TF-IDF is a count, a
 * logarithm and a division. The weighting below is the standard smoothed one,
 * so this ranks a corpus exactly as the Python version does.
 */

// Runs of two or more letters, digits or underscores. A one-letter token
// carries no subject, and dropping it costs nothing.
const TOKEN = /[\p{L}\p{N}_]{2,}/gu;

export function tokenise(text, stopWords = new Set()) {
  return (text.toLowerCase().match(TOKEN) ?? []).filter((term) => !stopWords.has(term));
}

/** The title counts twice: a word in a title is a stronger claim. */
export function articleText(article) {
  return `${article.title} ${article.title} ${article.body}`;
}

/** One l2-normalised TF-IDF vector per document, as a Map of term to weight. */
export function vectorise(texts, stopWords = new Set()) {
  const documents = texts.map((text) => tokenise(text, stopWords));
  const appearances = new Map();
  for (const terms of documents) {
    for (const term of new Set(terms)) appearances.set(term, (appearances.get(term) ?? 0) + 1);
  }

  return documents.map((terms) => {
    const vector = new Map();
    for (const term of terms) vector.set(term, (vector.get(term) ?? 0) + 1);
    for (const [term, count] of vector) {
      // Smoothed: as if one extra document held every term, so a term present
      // everywhere still has a defined weight instead of a division by zero.
      const idf = Math.log((1 + documents.length) / (1 + appearances.get(term))) + 1;
      vector.set(term, count * idf);
    }
    const norm = Math.hypot(...vector.values());
    if (norm) for (const [term, weight] of vector) vector.set(term, weight / norm);
    return vector;
  });
}

/** Both vectors are unit length, so their dot product is the cosine. */
function cosine(first, second) {
  const [small, large] = first.size < second.size ? [first, second] : [second, first];
  let total = 0;
  for (const [term, weight] of small) total += weight * (large.get(term) ?? 0);
  return total;
}

/**
 * Return `{ [article id]: [[neighbour id, score], ...] }`, best first.
 *
 * `stopWords` is a per-language list, so it belongs to the caller and not to
 * this function. Without one the ranking still works, because a word in every
 * article is downweighted anyway, but the floor has to do more of the job on
 * a small corpus.
 *
 * `minimum` is that floor, not a knob to be tweaked until the block looks
 * full: below it, two articles share ordinary words and nothing else, and
 * showing no block beats showing a wrong one.
 */
export function buildNeighbourTable(articles, { k = 5, minimum = 0.05, stopWords = [] } = {}) {
  if (articles.length < 2) return Object.fromEntries(articles.map((a) => [a.id, []]));

  const vectors = vectorise(articles.map(articleText), new Set(stopWords));
  const table = {};
  articles.forEach((article, index) => {
    const neighbours = [];
    articles.forEach((other, position) => {
      if (position === index) return;
      const score = Math.round(cosine(vectors[index], vectors[position]) * 1000) / 1000;
      if (score > minimum) neighbours.push([other.id, score]);
    });
    // Ties broken by identifier, so that two builds give the same page.
    neighbours.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
    table[article.id] = neighbours.slice(0, k);
  });
  return table;
}
