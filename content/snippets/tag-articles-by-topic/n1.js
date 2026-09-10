/**
 * Tag articles with a one-versus-rest classifier over TF-IDF features.
 *
 * Rung N1. The controlled vocabulary of N0 sees the words an editor listed.
 * This sees the words that go with a topic in the articles you have already
 * tagged — « bureau », « visioconférence » and « domicile » end up carrying
 * the remote work topic, although no editor would ever have written them in a
 * term list.
 *
 * One classifier per topic, each answering its own yes-or-no question. That is
 * what one-versus-rest means, and it is what keeps the tagging multi-label:
 * the topics do not compete for a single winner, so an article can come back
 * with three tags, or with none.
 *
 * Written out in full rather than pulled from a library, because TF-IDF and
 * logistic regression are fifty lines between them. The cost of this rung is
 * not the code below: it is the labelled corpus someone has to tag by hand,
 * and tag again every time the taxonomy moves.
 */

const TOKEN = /[\p{L}\p{N}_]{2,}/gu;

/** Unigrams and bigrams: « à distance » says more than « distance » alone. */
function terms(text) {
  const words = text.toLowerCase().match(TOKEN) ?? [];
  const out = [...words];
  for (let i = 0; i + 1 < words.length; i += 1) out.push(`${words[i]} ${words[i + 1]}`);
  return out;
}

/** Sublinear term frequency times inverse document frequency, L2 normalised. */
function vectorise(text, vocabulary, idf) {
  const counts = new Map();
  for (const term of terms(text)) counts.set(term, (counts.get(term) ?? 0) + 1);
  const vector = new Float64Array(idf.length);
  for (const [term, count] of counts) {
    const column = vocabulary.get(term);
    if (column !== undefined) vector[column] = (1 + Math.log(count)) * idf[column];
  }
  const norm = Math.hypot(...vector);
  if (norm) for (let i = 0; i < vector.length; i += 1) vector[i] /= norm;
  return vector;
}

/** One binary classifier, trained by full-batch gradient descent. */
function fit(rows, labels, { epochs, rate, decay }) {
  const weights = new Float64Array(rows[0].length);
  let bias = 0;
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const gradient = new Float64Array(weights.length);
    let biasGradient = 0;
    for (let i = 0; i < rows.length; i += 1) {
      let z = bias;
      for (let j = 0; j < weights.length; j += 1) z += weights[j] * rows[i][j];
      const error = (1 / (1 + Math.exp(-z)) - labels[i]) / rows.length;
      for (let j = 0; j < weights.length; j += 1) gradient[j] += error * rows[i][j];
      biasGradient += error;
    }
    // The decay term is the L2 penalty: without it a corpus this small is
    // memorised, and every article scores one or zero.
    for (let j = 0; j < weights.length; j += 1) {
      weights[j] -= rate * (gradient[j] + decay * weights[j]);
    }
    bias -= rate * biasGradient;
  }
  return { weights, bias };
}

/**
 * `topicsPerArticle[i]` is the list of topics of `articles[i]`, possibly
 * empty. An untagged article is a useful negative example, not a gap.
 */
export function train(articles, topicsPerArticle, { epochs = 3000, rate = 10, decay = 0.01 } = {}) {
  const documents = articles.map(terms);
  const vocabulary = new Map();
  const frequencies = [];
  for (const document of documents) {
    for (const term of new Set(document)) {
      if (!vocabulary.has(term)) {
        vocabulary.set(term, vocabulary.size);
        frequencies.push(0);
      }
      frequencies[vocabulary.get(term)] += 1;
    }
  }
  const idf = frequencies.map((df) => Math.log((1 + documents.length) / (1 + df)) + 1);
  const rows = articles.map((article) => vectorise(article, vocabulary, idf));
  const topics = [...new Set(topicsPerArticle.flat())].sort();
  const classifiers = topics.map((topic) =>
    fit(rows, topicsPerArticle.map((list) => (list.includes(topic) ? 1 : 0)), { epochs, rate, decay }),
  );
  return { vocabulary, idf, topics, classifiers };
}

/** One probability per topic, each independent of the others. */
export function score(model, article) {
  const vector = vectorise(article, model.vocabulary, model.idf);
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
