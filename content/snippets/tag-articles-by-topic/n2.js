/**
 * Zero-shot tagging: compare the article with the labels themselves.
 *
 * Rung N2. N1 needed a labelled corpus, and a new topic meant labelling it all
 * again. Here a topic is only a short description, encoded like any other
 * text: adding one costs a line, and the first article can be tagged the same
 * day.
 *
 * That is the whole appeal, and it is real. What it costs is a model file to
 * ship and keep in sync, a warm process to hold it, and a score that is a
 * cosine rather than a probability — see the test for what that means when you
 * have to pick one threshold for every topic.
 */

export const MODEL_NAME = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';

/** The real encoder: fetched once, then held in memory and run locally. */
export async function loadEncoder(name = MODEL_NAME) {
  const { pipeline } = await import('@xenova/transformers');
  const extract = await pipeline('feature-extraction', name);
  return { encode: async (texts) => (await extract(texts, { pooling: 'mean' })).tolist() };
}

/**
 * Encode the topic descriptions once, and keep the encoder for the articles.
 *
 * `topics` maps a topic name to the sentence that stands for it. Write it as a
 * human would say it out loud: the encoder was trained on sentences, and a
 * bare keyword gives it very little to work with.
 *
 * `encoder` is injected so this can be tested without loading a model. Left
 * alone, it is the real one above.
 */
export async function buildLabeller(topics, encoder) {
  const model = encoder ?? (await loadEncoder());
  const names = Object.keys(topics);
  const vectors = (await model.encode(names.map((name) => topics[name]))).map(unit);
  return { topics: names, vectors, encoder: model };
}

/** The cosine between the article and each topic description. */
export async function score(labeller, article) {
  const vector = unit((await labeller.encoder.encode([article]))[0]);
  const scored = {};
  labeller.topics.forEach((topic, index) => {
    scored[topic] = dot(labeller.vectors[index], vector);
  });
  return scored;
}

/**
 * Every topic whose description is close enough, best first.
 *
 * Multi-label falls out of the shape of the thing: each topic is compared with
 * the article on its own, so several can pass, or none.
 *
 * The threshold is not a probability. It is a cosine, it has no calibrated
 * meaning, and the only way to set it is to try it on articles you have
 * already tagged by hand — which is a labelled corpus, the very thing this
 * rung was supposed to save you.
 */
export async function tag(labeller, article, threshold = 0.3) {
  const scored = await score(labeller, article);
  return labeller.topics
    .filter((topic) => scored[topic] >= threshold)
    .sort((a, b) => scored[b] - scored[a] || a.localeCompare(b));
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
