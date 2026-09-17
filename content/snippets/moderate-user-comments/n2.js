/**
 * Route comments with a self-hosted toxicity classifier.
 *
 * Rung N2. An encoder fine-tuned on the labelled comments of a public toxicity
 * challenge, running on your own machine. It arrives trained, which N1 makes
 * you gather a corpus for, and it stays inside your infrastructure, which
 * matters when the text you would send away is the abuse one of your users
 * just received.
 *
 * The model and the labels that may decide go together, and the language of
 * your comments chooses the pair. The English one scores seven separate harms,
 * which is what you show a moderator; the multilingual one, whose card lists
 * French among fourteen languages, scores one. Picking the English model for a
 * French forum returns numbers, not errors, which is the failure this rung is
 * most likely to hand you.
 *
 * What you own on this rung is not the model, it is everything around it: the
 * batching, the thresholds, the labels that may decide, and the answer to
 * "what does the code do when the model says nothing usable". The model itself
 * is a black box with a fixed list of labels, and the last function below is
 * where that becomes your problem.
 */

// English only: its corpus is Civil Comments. Seven labels name a harm; the
// model also scores which identities a comment mentions (male, muslim,
// black…), and those say who is mentioned, not what is done to them, so they
// are left out and never decide anything here. The ONNX export of the weights
// Python loads, with its files at the root of the repository.
export const ENGLISH = ['protectai/unbiased-toxic-roberta-onnx', [
  'toxicity', 'severe_toxicity', 'obscene', 'identity_attack', 'insult', 'threat', 'sexual_explicit',
], ''];

// Fourteen languages, French among them, and one label for all of them: its
// card lists the languages and publishes a validation score per language. What
// you lose is the breakdown — "insult" or "threat" is what a moderator reads,
// "toxic 0.87" is what is left. Its licence is not the other one's either:
// read both before you ship. The ONNX export of the weights Python loads.
export const MULTILINGUAL = [
  'onnx-community/distilbert-multilingual-toxicity-classifier-ONNX', ['toxic'], 'onnx',
];

// The examples on this page are English, so this file is set to the English
// pair. A French forum swaps the line, and loses the breakdown with it.
export const [MODEL_NAME, HARM_LABELS, SUBFOLDER] = ENGLISH;

// Two thresholds, not one: between "obviously fine" and "obviously not" there
// is a band that belongs to a human. These two numbers are examples, not
// defaults to leave alone: calibrate them on a sample of your own comments that
// somebody has read by hand.
export const DEFAULT_THRESHOLDS = { block: 0.9, review: 0.6 };

export class ModerationUnavailable extends Error {}

/** The real model. A large download: load it once, with `defaultModel`. */
export class ToxicityModel {
  static async load(name = MODEL_NAME, subfolder = SUBFOLDER) {
    const { pipeline } = await import('@huggingface/transformers');
    // Full precision, as in Python; the pipeline truncates to the length the
    // model reads, so whatever sits past it in a very long comment is not scored.
    return new ToxicityModel(await pipeline('text-classification', name, { subfolder, dtype: 'fp32' }));
  }

  constructor(pipe) {
    this.pipe = pipe;
  }

  /** One label-to-score mapping per comment, in the order given. */
  async predict(comments) {
    const rows = await this.pipe(comments, { top_k: null });
    return rows.map((row) => Object.fromEntries(row.map((r) => [r.label, r.score])));
  }
}

let loading;

/** The real model, loaded on first use and kept for the process. */
export function defaultModel() {
  loading ??= ToxicityModel.load().catch((error) => {
    loading = undefined; // a failed load is not kept: the next call retries
    throw error;
  });
  return loading;
}

/**
 * Decide what to do with each comment: block, send to review, or allow.
 *
 * `classifier` is injected so this can be tested without downloading the
 * weights. In production it defaults to the real model above, and `labels` has
 * to be the label set of whichever model that is.
 *
 * The whole list goes to the classifier in one call, and Transformers.js runs
 * it through the model in one pass, padded to the longest comment.
 */
export async function moderate(comments, classifier, thresholds = DEFAULT_THRESHOLDS, labels = HARM_LABELS) {
  const batch = [...comments];
  if (batch.length === 0) return [];
  const model = classifier ?? (await defaultModel());
  const scored = await model.predict(batch);
  if (scored.length !== batch.length) {
    throw new ModerationUnavailable('the model returned one row per comment, and did not');
  }
  return scored.map((row) => decide(row, thresholds, labels));
}

/**
 * Keep the strongest harm label, and fall back to a human when nothing is usable.
 *
 * Falling back to "allow" would be the tempting shortcut, and it would mean
 * that a model failure silently publishes everything it was asked about.
 */
function decide(scores, thresholds, labels) {
  const usable = Object.entries(scores ?? {}).filter(
    ([label, v]) => labels.includes(label) && typeof v === 'number' && v >= 0 && v <= 1,
  );
  if (usable.length === 0) return { action: 'review', label: null, score: null };
  const [label, score] = usable.reduce((best, row) => (row[1] > best[1] ? row : best));
  let action = 'allow';
  if (score >= thresholds.block) action = 'block';
  else if (score >= thresholds.review) action = 'review';
  return { action, label, score };
}
