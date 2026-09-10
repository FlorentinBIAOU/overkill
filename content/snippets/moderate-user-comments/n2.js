/**
 * Route comments with a self-hosted toxicity classifier.
 *
 * Rung N2. A distilled encoder fine-tuned on a moderation corpus, running on
 * your own machine. It reads context the n-grams of N1 cannot, and it stays
 * inside your infrastructure, which matters when the text you are sending
 * away is the abuse one of your users just received.
 *
 * What you own on this rung is not the model, it is everything around it: the
 * batching, the thresholds, and the answer to "what does the code do when the
 * model says nothing usable". The model itself is a black box with a fixed
 * list of labels, and the last function below is where that becomes your
 * problem.
 */

export const MODEL_NAME = 'Xenova/toxic-bert';

// Two thresholds, not one: between "obviously fine" and "obviously not" there
// is a band that belongs to a human, and pretending otherwise is how automated
// moderation earns its reputation.
export const DEFAULT_THRESHOLDS = { block: 0.9, review: 0.6 };

export class ModerationUnavailable extends Error {}

/** The real model, loaded once and kept in memory for the process. */
export class ToxicityModel {
  static async load(name = MODEL_NAME) {
    const { pipeline } = await import('@huggingface/transformers'); // a large download, done once
    return new ToxicityModel(await pipeline('text-classification', name));
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

/**
 * Decide what to do with each comment: block, send to review, or allow.
 *
 * `classifier` is injected so this can be tested without downloading the
 * weights. In production it defaults to the real model above.
 *
 * The whole batch goes in one call. Feeding comments one by one is the usual
 * way this rung is made slow, because a batch of a hundred is one pass through
 * the model and a hundred calls are a hundred passes.
 */
export async function moderate(comments, classifier, thresholds = DEFAULT_THRESHOLDS) {
  const model = classifier ?? (await ToxicityModel.load());
  const batch = [...comments];
  const scored = await model.predict(batch);
  if (scored.length !== batch.length) {
    throw new ModerationUnavailable('the model returned one row per comment, and did not');
  }
  return scored.map((row) => decide(row, thresholds));
}

/**
 * Keep the strongest label, and fall back to a human when nothing is usable.
 *
 * Falling back to "allow" would be the tempting shortcut, and it would mean
 * that a model failure silently publishes everything it was asked about.
 */
function decide(scores, thresholds) {
  const usable = Object.entries(scores ?? {}).filter(
    ([, v]) => typeof v === 'number' && v >= 0 && v <= 1,
  );
  if (usable.length === 0) return { action: 'review', label: null, score: null };
  const [label, score] = usable.reduce((best, row) => (row[1] > best[1] ? row : best));
  let action = 'allow';
  if (score >= thresholds.block) action = 'block';
  else if (score >= thresholds.review) action = 'review';
  return { action, label, score };
}
