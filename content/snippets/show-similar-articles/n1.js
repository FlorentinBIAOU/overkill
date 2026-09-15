/**
 * Related articles from the text itself: TF-IDF, then cosine similarity.
 *
 * Rung N1. N0 only sees what someone remembered to tag. This reads the
 * article, and lets the corpus decide which words matter: the rarer a word
 * across the corpus, the more it weighs. Unlike a tag on every article at N0, a
 * word in every article still weighs something, which is why the stop list
 * below is part of the job, one per language.
 *
 * Written out rather than pulled from a library, because TF-IDF is a count, a
 * logarithm and a division. The tokens and the weighting below are
 * scikit-learn's defaults, so this ranks a corpus as the Python version does.
 */

// Runs of two or more letters, digits or underscores, as scikit-learn's
// default token pattern. A one-letter word, such as the C of "Programming in
// C", is dropped with the rest.
const TOKEN = /[\p{L}\p{N}_]{2,}/gu;

export function tokenise(text, stopWords = new Set()) {
  return (text.toLowerCase().match(TOKEN) ?? []).filter((term) => !stopWords.has(term));
}

/** The title counts twice: a word in a title is a stronger claim. */
export function articleText(article) {
  const title = article.title ?? '';
  const body = article.body ?? ''; // a NULL column is empty
  // NFC: the same accented word typed on two systems is one token, not two halves.
  return `${title} ${title} ${body}`.normalize('NFC');
}

/** One l2-normalised TF-IDF vector per document, as a Map of term to weight. */
export function vectorise(texts, stopWords = new Set()) {
  const documents = texts.map((text) => tokenise(text, stopWords));
  const appearances = new Map();
  for (const terms of documents) {
    for (const term of new Set(terms)) appearances.set(term, (appearances.get(term) ?? 0) + 1);
  }

  // Smoothed, as scikit-learn does by default: as if one extra document held
  // every term once. A term present everywhere weighs 1, the least possible.
  const idf = (term) => Math.log((1 + documents.length) / (1 + appearances.get(term))) + 1;

  return documents.map((terms) => {
    const vector = new Map();
    for (const term of terms) vector.set(term, (vector.get(term) ?? 0) + 1);
    for (const [term, count] of vector) vector.set(term, count * idf(term));
    const norm = Math.hypot(...vector.values());
    if (norm) for (const [term, weight] of vector) vector.set(term, weight / norm);
    return vector;
  });
}

/** Both vectors are unit length, so their dot product is the cosine. */
function cosine(first, second) {
  let total = 0;
  for (const [term, weight] of first) total += weight * (second.get(term) ?? 0);
  return total;
}

/**
 * Return `{ [article id]: [[neighbour id, score], ...] }`, best first.
 *
 * `stopWords` is a per-language list, so it belongs to the caller and not to
 * this function. Without one, the words every article shares still count: on
 * the test corpus, the knife-sharpening article gets the site announcement as
 * a neighbour.
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
