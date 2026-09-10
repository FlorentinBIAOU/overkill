/**
 * Score sentences with a classifier trained on surface features.
 *
 * Rung N1. Same extractive shape as N0 — the summary is still made of the
 * document's own sentences — but the weights are learnt instead of guessed.
 *
 * N0 fixes the trade between position and term density by hand, once, for
 * every document in the world. That constant is a guess. Here, a few dozen
 * documents whose summary sentences someone has ticked off decide it instead:
 * if, in your corpus, the wrap-up at the end matters more than the opening,
 * the model will find that out and N0 never will.
 *
 * The features are deliberately surface-level. They describe where a sentence
 * sits and what it looks like, not what it means. That is the ceiling of this
 * rung, and the reason the entry does not stop here.
 *
 * Logistic regression is written out rather than pulled from a package,
 * because on five features it is a dozen lines. The Python version of this
 * snippet calls scikit-learn; the objective minimised below is the same one,
 * so both rank a document's sentences alike.
 */

const SENTENCE_END = /(?<=[.!?])\s+/;
const WORD = /[\p{L}\p{N}]+/gu;

const STOPWORDS = new Set(
  ('a an and are as at be been but by for from had has have in into is it its ' +
    'of on or that the their there they this to was were which will with').split(' '),
);

// Words an author uses when about to state the point of what came before.
const CUES = new Set(
  ('overall therefore total conclusion result summary altogether finally ' +
    'consequently').split(' '),
);

// Sentences longer than this are already long; the feature saturates rather
// than letting one outlier stretch the scale for every other sentence.
const LONG_SENTENCE = 25;

/** Cut the document into sentences, dropping empty ones. */
export function splitSentences(text) {
  return text
    .trim()
    .split(SENTENCE_END)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Five things a reader notices before reading: where the sentence sits, how
 * long it is, whether it carries a figure, whether it announces a conclusion,
 * and how much of the opening it repeats.
 */
export function sentenceFeatures(sentences, index) {
  const sentence = sentences[index];
  const words = sentence.toLowerCase().match(WORD) ?? [];
  const opening = new Set(sentences[0].toLowerCase().match(WORD) ?? []);
  const content = words.filter((w) => w.length > 2 && !STOPWORDS.has(w));
  const shared = content.filter((word) => opening.has(word)).length;
  return [
    1 / (index + 1),
    Math.min(words.length / LONG_SENTENCE, 1),
    /[0-9]/.test(sentence) ? 1 : 0,
    words.some((word) => CUES.has(word)) ? 1 : 0,
    content.length ? shared / content.length : 0,
  ];
}

/**
 * `documents` are lists of sentences; `labels[d][i]` is 1 when sentence `i` of
 * document `d` belongs in the summary.
 *
 * Full-batch gradient descent on the mean log-loss, plus the same L2 penalty
 * scikit-learn applies by default. The bias is left unpenalised, as it is
 * there too. The objective is strictly convex, so enough steps land on the one
 * optimum whichever language walks towards it.
 */
export function train(documents, labels, { epochs = 4000, rate = 1, strength = 1 } = {}) {
  const rows = [];
  const targets = [];
  for (const [d, sentences] of documents.entries()) {
    for (let i = 0; i < sentences.length; i += 1) {
      rows.push(sentenceFeatures(sentences, i));
      targets.push(labels[d][i]);
    }
  }
  const width = rows[0].length;
  const weights = new Array(width).fill(0);
  let bias = 0;
  const penalty = 1 / (strength * rows.length);

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const gradient = new Array(width).fill(0);
    let biasGradient = 0;
    for (let i = 0; i < rows.length; i += 1) {
      let z = bias;
      for (let j = 0; j < width; j += 1) z += weights[j] * rows[i][j];
      const error = 1 / (1 + Math.exp(-z)) - targets[i];
      for (let j = 0; j < width; j += 1) gradient[j] += (error * rows[i][j]) / rows.length;
      biasGradient += error / rows.length;
    }
    for (let j = 0; j < width; j += 1) weights[j] -= rate * (gradient[j] + penalty * weights[j]);
    bias -= rate * biasGradient;
  }
  return { weights, bias };
}

/** Probability that a sentence belongs in the summary. */
function score(model, features) {
  let z = model.bias;
  for (let j = 0; j < features.length; j += 1) z += model.weights[j] * features[j];
  return 1 / (1 + Math.exp(-z));
}

/** Return the best-scored sentences, in the order the document puts them. */
export function summarise(model, text, maxSentences = 3) {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return '';
  const scores = sentences.map((_, i) => score(model, sentenceFeatures(sentences, i)));
  // Sorting is stable, so two identical scores keep their document order.
  const ranked = sentences.map((_, index) => index).sort((a, b) => scores[b] - scores[a]);
  const chosen = ranked.slice(0, maxSentences).sort((a, b) => a - b);
  return chosen.map((index) => sentences[index]).join(' ');
}
