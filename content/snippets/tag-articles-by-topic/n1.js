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
 * with three tags, or with none.
 *
 * Written out in full rather than pulled from a library, because TF-IDF and
 * logistic regression fit on a page between them. The cost of this rung is not
 * the code below: it is the labelled corpus someone has to tag by hand, and
 * tag again every time the taxonomy moves.
 */

const TOKEN = /[\p{L}\p{N}_]{2,}/gu;

/** Unigrams and bigrams: "à distance" says more than "distance" alone. */
function terms(text) {
  const words = text.toLowerCase().match(TOKEN) ?? [];
  const pairs = words.slice(1).map((word, i) => `${words[i]} ${word}`);
  return [...words, ...pairs];
}

/** Sublinear term frequency times inverse document frequency, L2 normalised. */
function vectorise(termList, vocabulary, idf) {
  const counts = new Map();
  for (const term of termList) counts.set(term, (counts.get(term) ?? 0) + 1);
  const vector = new Float64Array(idf.length);
  for (const [term, count] of counts) {
    const column = vocabulary.get(term);
    if (column !== undefined) vector[column] = (1 + Math.log(count)) * idf[column];
  }
  const norm = Math.hypot(...vector);
  if (norm) for (let j = 0; j < vector.length; j += 1) vector[j] /= norm;
  return vector;
}

/** One binary classifier, trained by gradient descent one article at a time. */
function fit(rows, labels, { epochs, rate, decay }) {
  const weights = new Float64Array(rows[0].length);
  let bias = 0;
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    for (let i = 0; i < rows.length; i += 1) {
      let z = bias;
      for (let j = 0; j < weights.length; j += 1) z += weights[j] * rows[i][j];
      const error = 1 / (1 + Math.exp(-z)) - labels[i];
      // The decay term is the L2 penalty: without it a corpus this small is
      // memorised, and every article comes back scored one or zero.
      for (let j = 0; j < weights.length; j += 1) {
        weights[j] -= rate * (error * rows[i][j] + decay * weights[j]);
      }
      bias -= rate * error;
    }
  }
  return { weights, bias };
}

/**
 * `topicsPerArticle[i]` is the list of topics of `articles[i]`, possibly
 * empty. An untagged article is a useful negative example, not a gap.
 */
export function train(articles, topicsPerArticle, { epochs = 600, rate = 0.5, decay = 0.005 } = {}) {
  const documents = articles.map(terms);
  const frequencies = new Map();
  for (const document of documents) {
    for (const term of new Set(document)) frequencies.set(term, (frequencies.get(term) ?? 0) + 1);
  }
  const vocabulary = new Map([...frequencies.keys()].map((term, column) => [term, column]));
  const idf = [...frequencies.values()].map((df) => Math.log((1 + documents.length) / (1 + df)) + 1);
  const rows = documents.map((document) => vectorise(document, vocabulary, idf));
  const topics = [...new Set(topicsPerArticle.flat())].sort();
  const classifiers = topics.map((topic) => {
    const labels = topicsPerArticle.map((list) => (list.includes(topic) ? 1 : 0));
    return fit(rows, labels, { epochs, rate, decay });
  });
  return { vocabulary, idf, topics, classifiers };
}

/** One probability per topic, each independent of the others. */
export function score(model, article) {
  const vector = vectorise(terms(article), model.vocabulary, model.idf);
  const scored = {};
  model.topics.forEach((topic, index) => {
    const { weights, bias } = model.classifiers[index];
    let z = bias;
    for (let j = 0; j < weights.length; j += 1) z += weights[j] * vector[j];
    scored[topic] = 1 / (1 + Math.exp(-z));
  });
  return scored;
}

/**
 * The topics above the threshold, best first.
 *
 * The threshold is yours to set, and it is the only dial here. Move it towards
 * 1 when a wrong tag is worse than a missing one, towards 0 when an editor
 * reviews the list anyway and would rather see one topic too many.
 */
export function tag(model, article, threshold = 0.5) {
  const scored = score(model, article);
  return model.topics
    .filter((topic) => scored[topic] >= threshold)
    .sort((a, b) => scored[b] - scored[a] || a.localeCompare(b));
}
