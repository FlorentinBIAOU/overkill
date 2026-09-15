/**
 * Route comments with a self-hosted toxicity classifier.
 *
 * Rung N2. A RoBERTa encoder fine-tuned on the Civil Comments corpus of a
 * public toxicity challenge, running on your own machine. It arrives trained
 * on labelled comments, which N1 makes you gather yourself, and it stays
 * inside your infrastructure, which matters when the text you would send away
 * is the abuse one of your users just received.
 *
 * What you own on this rung is not the model, it is everything around it: the
 * batching, the thresholds, the labels that may decide, and the answer to
 * "what does the code do when the model says nothing usable". The model itself
 * is a black box with a fixed list of labels, and the last function below is
 * where that becomes your problem.
 */

// The same model as the Python snippet, exported to ONNX with its weights at
// the root of the repository rather than in an `onnx/` folder.
export const MODEL_NAME = 'protectai/unbiased-toxic-roberta-onnx';

// The labels that name a harm. The model also scores which identities a
// comment mentions (male, muslim, black…): those say who is mentioned, not what
// is done to them, and they never decide anything here.
export const HARM_LABELS = ['toxicity', 'severe_toxicity', 'obscene', 'identity_attack', 'insult', 'threat', 'sexual_explicit'];

// Two thresholds, not one: between "obviously fine" and "obviously not" there
// is a band that belongs to a human.
export const DEFAULT_THRESHOLDS = { block: 0.9, review: 0.6 };

export class ModerationUnavailable extends Error {}

/** The real model. A large download: load it once, with `defaultModel`. */
export class ToxicityModel {
  static async load(name = MODEL_NAME) {
    const { pipeline } = await import('@huggingface/transformers');
    // Full precision, as in Python; the pipeline truncates to the length the
    // model reads, so whatever sits past it in a very long comment is not scored.
    return new ToxicityModel(await pipeline('text-classification', name, { subfolder: '', dtype: 'fp32' }));
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
 * weights. In production it defaults to the real model above.
 *
 * The whole list goes to the classifier in one call, and Transformers.js runs
 * it through the model in one pass, padded to the longest comment.
 */
export async function moderate(comments, classifier, thresholds = DEFAULT_THRESHOLDS) {
  const batch = [...comments];
  if (batch.length === 0) return [];
  const model = classifier ?? (await defaultModel());
  const scored = await model.predict(batch);
  if (scored.length !== batch.length) {
    throw new ModerationUnavailable('the model returned one row per comment, and did not');
  }
  return scored.map((row) => decide(row, thresholds));
}

/**
 * Keep the strongest harm label, and fall back to a human when nothing is usable.
 *
 * Falling back to "allow" would be the tempting shortcut, and it would mean
 * that a model failure silently publishes everything it was asked about.
 */
function decide(scores, thresholds) {
  const usable = Object.entries(scores ?? {}).filter(
    ([label, v]) => HARM_LABELS.includes(label) && typeof v === 'number' && v >= 0 && v <= 1,
  );
  if (usable.length === 0) return { action: 'review', label: null, score: null };
  const [label, score] = usable.reduce((best, row) => (row[1] > best[1] ? row : best));
  let action = 'allow';
  if (score >= thresholds.block) action = 'block';
  else if (score >= thresholds.review) action = 'review';
  return { action, label, score };
}
