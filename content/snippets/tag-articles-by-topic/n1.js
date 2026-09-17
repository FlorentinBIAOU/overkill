/**
 * Tag articles with a one-versus-rest classifier over TF-IDF features.
 *
 * Rung N1. The controlled vocabulary of N0 sees the words an editor listed.
 * This sees the words that go with a topic in the articles you have already
 * tagged — "bureau", "visioconférence" and "domicile" end up carrying
 * the remote work topic, although no editor would ever have written them in a
 * term list.
 *
 * One classifier per topic, each answering its own yes-or-no question. That is
 * what one-versus-rest means, and it is what keeps the tagging multi-label:
 * the topics do not compete for a single winner, so an article can come back
 * with two tags, or with none.
 *
 * The article's TF-IDF vector has length one, though: the more topics it
 * covers, the less weight each gets. An article made of the training articles
 * of three topics reaches the threshold on none of them, and the most thorough
 * article of the week would come back untagged. That is what the floor is for,
 * in `tag`.
 *
 * Written out in full rather than pulled from a library, with sparse vectors
 * so that training grows with the words each article holds rather than with
 * the whole vocabulary. The cost of this rung is not the code below: it is the
 * labelled corpus someone has to tag by hand, and tag again every time the
 * taxonomy moves.
 */

const TOKEN = /[\p{L}\p{N}_]{2,}/gu;

/**
 * Unigrams and bigrams. Words of one character are dropped first, so
 * "travailler à distance" gives the pair "travailler distance".
 */
function terms(text) {
  const words = text.toLowerCase().match(TOKEN) ?? [];
  const pairs = words.slice(1).map((word, i) => `${words[i]} ${word}`);
  return [...words, ...pairs];
}

/** Sublinear term frequency times inverse document frequency, L2 normalised, as column-value pairs. */
function vectorise(termList, vocabulary, idf) {
  const counts = new Map();
  for (const term of termList) {
    const column = vocabulary.get(term);
    if (column !== undefined) counts.set(column, (counts.get(column) ?? 0) + 1);
  }
  const columns = [...counts.keys()];
  const values = columns.map((column) => (1 + Math.log(counts.get(column))) * idf[column]);
  const norm = Math.sqrt(values.reduce((sum, v) => sum + v * v, 0));
  return { columns, values: norm ? values.map((v) => v / norm) : values };
}

/** The weighted sum of an article's features: the logit of one topic. */
function logit(weights, bias, { columns, values }, scale = 1) {
  let z = bias;
  for (let k = 0; k < columns.length; k += 1) z += scale * weights[columns[k]] * values[k];
  return z;
}

/** One binary classifier, trained by gradient descent one article at a time. */
function fit(rows, labels, width, { epochs, rate, decay }) {
  const weights = new Float64Array(width);
  let bias = 0;
  // The true weights are `scale * weights`. The decay term is the L2 penalty:
  // without it a corpus this small is memorised, and every article comes back
  // scored one or zero. Applied to `scale`, it shrinks every weight in one step.
  let scale = 1;
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    for (let i = 0; i < rows.length; i += 1) {
      const error = 1 / (1 + Math.exp(-logit(weights, bias, rows[i], scale))) - labels[i];
      scale *= 1 - rate * decay;
      const { columns, values } = rows[i];
      for (let k = 0; k < columns.length; k += 1) weights[columns[k]] -= (rate * error * values[k]) / scale;
      bias -= rate * error;
      if (scale < 1e-9) {
        for (let j = 0; j < width; j += 1) weights[j] *= scale;
        scale = 1;
      }
    }
  }
  for (let j = 0; j < width; j += 1) weights[j] *= scale;
  return { weights, bias };
}

/**
 * `topicsPerArticle[i]` is the list of topics of `articles[i]`, possibly
 * empty. An untagged article is a useful negative example, not a gap.
 */
export function train(articles, topicsPerArticle, { epochs = 600, rate = 0.5, decay = 0.005 } = {}) {
  const topics = [...new Set(topicsPerArticle.flat())].sort();
  if (articles.length !== topicsPerArticle.length || topics.length === 0) {
    throw new RangeError('training needs one list of topics per article, and at least one topic');
  }
  const documents = articles.map(terms);
  const frequencies = new Map();
  for (const document of documents) {
    for (const term of new Set(document)) frequencies.set(term, (frequencies.get(term) ?? 0) + 1);
  }
  const vocabulary = new Map([...frequencies.keys()].map((term, column) => [term, column]));
  const idf = [...frequencies.values()].map((df) => Math.log((1 + documents.length) / (1 + df)) + 1);
  const rows = documents.map((document) => vectorise(document, vocabulary, idf));
  const classifiers = topics.map((topic) => {
    const labels = topicsPerArticle.map((list) => (list.includes(topic) ? 1 : 0));
    return fit(rows, labels, idf.length, { epochs, rate, decay });
  });
  return { vocabulary, idf, topics, classifiers };
}

/** One probability per topic, each independent of the others. */
export function score(model, article) {
  const vector = vectorise(terms(article), model.vocabulary, model.idf);
  const scored = {};
  model.topics.forEach((topic, index) => {
    const { weights, bias } = model.classifiers[index];
    scored[topic] = 1 / (1 + Math.exp(-logit(weights, bias, vector)));
  });
  return scored;
}

/**
 * The topics above the threshold, best first.
 *
 * The threshold is yours to set, and it is the first dial. Move it towards 1
 * when a wrong tag is worse than a missing one, towards 0 when an editor
 * reviews the list anyway and would rather see one topic too many.
 *
 * `floor` is the second, and it exists for the article that covers several
 * topics at once. Its vector has length one, so the more topics it covers the
 * less weight each one gets, and the most thorough article of the week can
 * reach the threshold on none of them.
 *
 * When nothing reaches the threshold, two things are possible: the article is
 * about none of the topics, or it is about several and they shared its weight.
 * Two topics above the floor tell the second case from the first, and then both
 * come back. One alone does not, because that is what an article about nothing
 * looks like. Set `floor` equal to `threshold` to turn the whole thing off.
 */
export function tag(model, article, threshold = 0.5, floor = 0.3) {
  const scored = score(model, article);
  const order = (a, b) => scored[b] - scored[a] || (a < b ? -1 : a > b ? 1 : 0);
  const above = model.topics.filter((topic) => scored[topic] >= threshold).sort(order);
  if (above.length > 0) return above;
  const near = model.topics.filter((topic) => scored[topic] >= floor).sort(order);
  return near.length > 1 ? near : [];
}
