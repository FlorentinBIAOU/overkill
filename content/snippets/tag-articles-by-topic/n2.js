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
 * cosine rather than a probability: it can be negative, the topics of one
 * article do not add up to one, and a single threshold has to serve every
 * topic.
 */

// The ONNX conversion of sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2.
export const MODEL_NAME = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';

// The Python encoder reads 128 tokens and silently drops the rest. With this
// model's tokenizer, 400 characters of French prose come to 110 tokens, so the
// article is encoded in passages of that size, in both languages. Text the
// tokenizer cuts finer, code or a table, can still overflow.
export const PASSAGE_CHARACTERS = 400;

const SENTENCE_END = /(?<=[.!?])\s+|\s*\n\s*/;

/** The real encoder: fetched once, then held in memory and run locally. */
export async function loadEncoder(name = MODEL_NAME) {
  const { pipeline } = await import('@huggingface/transformers');
  // Full-precision weights, the ones Python loads, rather than a quantised copy.
  const extract = await pipeline('feature-extraction', name, { dtype: 'fp32' });
  return { encode: async (texts) => (await extract(texts, { pooling: 'mean' })).tolist() };
}

/**
 * Encode the topic descriptions once, and keep the encoder for the articles.
 *
 * `topics` maps a topic name to the sentence that stands for it. Write it as a
 * human would say it out loud: the model card describes an encoder of
 * sentences and paragraphs.
 *
 * `encoder` is injected so this can be tested without loading a model. Left
 * alone, it is the real one above.
 */
export async function buildLabeller(topics, encoder) {
  const model = encoder ?? (await loadEncoder());
  const names = Object.keys(topics);
  const vectors = await encode(model, names.map((name) => topics[name]));
  return { topics: names, vectors, encoder: model };
}

/** Consecutive sentences joined into pieces of at most `size` characters. */
export function passages(article, size = PASSAGE_CHARACTERS) {
  const pieces = [];
  for (const sentence of article.trim().split(SENTENCE_END).map((s) => s.trim()).filter(Boolean)) {
    if (pieces.length && pieces.at(-1).length + 1 + sentence.length <= size) {
      pieces[pieces.length - 1] = `${pieces.at(-1)} ${sentence}`;
    } else {
      pieces.push(sentence); // a sentence longer than `size` stays whole
    }
  }
  return pieces;
}

/**
 * The best cosine, over the passages of the article, with each topic
 * description: a topic covered in one paragraph counts.
 */
export async function score(labeller, article) {
  const pieces = passages(article);
  const vectors = pieces.length ? await encode(labeller.encoder, pieces) : [];
  const width = labeller.vectors[0]?.length;
  if (width !== undefined && vectors.some((vector) => vector.length !== width)) {
    throw new Error('the encoder returned vectors of another width for the article');
  }
  const scored = {};
  labeller.topics.forEach((topic, index) => {
    scored[topic] = vectors.length ? Math.max(...vectors.map((v) => dot(labeller.vectors[index], v))) : 0;
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
 * meaning, and choosing it by its effect on errors takes articles whose topics
 * are already known — a labelled corpus, the very thing this rung was supposed
 * to save you.
 */
export async function tag(labeller, article, threshold = 0.3) {
  const scored = await score(labeller, article);
  return labeller.topics
    .filter((topic) => scored[topic] >= threshold)
    .sort((a, b) => scored[b] - scored[a] || (a < b ? -1 : a > b ? 1 : 0));
}

/** One unit vector per text, or an error: a wrong count or a non-number is not a score. */
async function encode(encoder, texts) {
  const vectors = (await encoder.encode(texts)).map((vector) => Array.from(vector, Number));
  if (vectors.length !== texts.length || new Set(vectors.map((v) => v.length)).size > 1) {
    throw new Error('the encoder returned the wrong number or shape of vectors');
  }
  if (!vectors.every((vector) => vector.every(Number.isFinite))) {
    throw new Error('the encoder returned a value that is not a finite number');
  }
  return vectors.map(unit);
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
