/**
 * Related articles from tag overlap, weighted by how rare each tag is.
 *
 * Rung N0. No dependency, deterministic, and computed once for the whole
 * corpus instead of on every page view: the neighbours of an article do not
 * depend on who is reading it, so no reader should ever wait for this.
 *
 * Counting shared tags is the obvious version, and it is the wrong one. A tag
 * every article carries says nothing about any of them; a tag three articles
 * carry says almost everything about those three. Weighting each tag by its
 * rarity is the whole difference between a useful block and one that files
 * the site announcement next to every article on the site.
 */

/**
 * Inverse document frequency of every tag in the corpus.
 *
 * log(corpus size / tag count) is exactly zero for a tag carried by every
 * article. That is the point, not a rounding accident: such a tag must not
 * create any similarity at all.
 */
export function tagWeights(articles) {
  const counts = new Map();
  for (const article of articles) {
    for (const tag of new Set(article.tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  const weights = new Map();
  for (const [tag, count] of counts) weights.set(tag, Math.log(articles.length / count));
  return weights;
}

function norm(vector) {
  return Math.hypot(...vector.values());
}

/** Cosine between two tag sets, each weighted by tag rarity. */
export function similarity(firstTags, secondTags, weights) {
  const vector = (tags) => new Map([...new Set(tags)].map((t) => [t, weights.get(t) ?? 0]));
  const first = vector(firstTags);
  const second = vector(secondTags);

  let shared = 0;
  for (const [tag, weight] of first) shared += weight * (second.get(tag) ?? 0);
  const norms = norm(first) * norm(second);
  // An article carrying only universal tags has a null vector, and no
  // neighbours. Saying nothing is the honest answer here.
  return norms ? shared / norms : 0;
}

/**
 * Return `{ [article id]: [[neighbour id, score], ...] }`, best first.
 *
 * Built offline, for the whole corpus at once, when an article is published
 * or retagged. Rendering the block on a page is then a lookup in this table,
 * never a search.
 */
export function buildNeighbourTable(articles, { k = 5, minimum = 0 } = {}) {
  const weights = tagWeights(articles);
  const table = {};
  for (const article of articles) {
    const neighbours = [];
    for (const other of articles) {
      if (other.id === article.id) continue;
      const score = Math.round(similarity(article.tags, other.tags, weights) * 1000) / 1000;
      if (score > minimum) neighbours.push([other.id, score]);
    }
    // Ties broken by identifier, so that two builds give the same page.
    neighbours.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
    table[article.id] = neighbours.slice(0, k);
  }
  return table;
}
