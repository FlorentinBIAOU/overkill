/**
 * Tag the lines of the invoice with a self-hosted document model.
 *
 * Rung N2. Same idea as N1 — label the lines, then read the value out of them
 * — except that the features are no longer yours. A document encoder
 * fine-tuned on invoices reads the line, its neighbours and its place on the
 * page at once, and it keeps reading them when a supplier moves its totals
 * block.
 *
 * What you own on this rung is not the model, it is everything around it: the
 * page geometry you hand it, the threshold under which a field goes to a
 * human, and the answer to "what does the code do when the model says nothing
 * usable". The weights stay on your machine, which is why an invoice never
 * leaves it.
 */

// A base encoder is a starting point, not an extractor: this rung assumes the
// checkpoint was fine-tuned on invoices, yours or someone else's.
export const MODEL_NAME = 'Xenova/layoutlmv3-base';

export const DEFAULT_THRESHOLD = 0.75;

// One pass reads one page. Beyond that the model would truncate in silence.
export const MAX_LINES = 120;

const AMOUNT = /\d{1,3}(?:[\s.]\d{3})*[,.]\d{2}/g;
const MONTHS = 'janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre';
const DATE = new RegExp(`\\d{1,2}/\\d{1,2}/\\d{2,4}|\\d{1,2}\\s+(?:${MONTHS})\\s+\\d{4}`);
const REFERENCE = /\b(?:[A-Za-z]{1,3}[-/])?\d[\dA-Za-z/-]{3,}/;

export class ExtractionUnavailable extends Error {}

/** The real model, loaded once and kept in memory for the process. */
export class LayoutModel {
  static async load(name = MODEL_NAME) {
    const { pipeline } = await import('@huggingface/transformers'); // a large download, done once
    return new LayoutModel(await pipeline('token-classification', name));
  }

  constructor(pipe) {
    this.pipe = pipe;
  }

  /** One label-to-score mapping per line, in the order given. */
  async predict(lines) {
    const rows = await this.pipe({ words: lines, boxes: boxesFor(lines) });
    return rows.map((row) => Object.fromEntries(row.map((r) => [r.entity_group, r.score])));
  }
}

/**
 * A box per line, on the thousandth-of-a-page grid these models expect.
 *
 * Extracted text keeps its geometry in two places only: how far a line is
 * indented, and how far down the page it sits. That is what the model gets,
 * and it is already more than a bag of words has.
 */
export function boxesFor(lines) {
  const height = Math.max(lines.length, 1);
  return lines.map((line, i) => [
    Math.min(line.length - line.trimStart().length, 80) * 12,
    Math.floor((i * 1000) / height),
    1000,
    Math.floor(((i + 1) * 1000) / height),
  ]);
}

/**
 * Read the fields, and say for each one whether a human should look.
 *
 * `model` is injected so this can be tested without downloading the weights.
 * In production it defaults to the real model above.
 */
export async function extractFields(text, model, { threshold = DEFAULT_THRESHOLD, attempts = 2 } = {}) {
  const tagger = model ?? (await LayoutModel.load());
  const lines = text.split('\n').filter((line) => line.trim() !== '');
  if (lines.length > MAX_LINES) throw new RangeError(`document longer than ${MAX_LINES} lines`);
  const tagged = lines.length ? await tag(tagger, lines, attempts) : [];
  if (tagged.length !== lines.length) {
    throw new ExtractionUnavailable('the model owed one row per line, and did not');
  }
  return Object.fromEntries(Object.keys(READERS).map((f) => [f, read(f, lines, tagged, threshold)]));
}

/** The whole page in one pass, and a failed pass is retried, not swallowed. */
async function tag(model, lines, attempts) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await model.predict(lines);
    } catch (error) {
      lastError = error;
    }
  }
  throw new ExtractionUnavailable(String(lastError));
}

/**
 * Keep the best-scoring line for the field, then read the value out of it.
 *
 * The model points at a line; turning that line into a date or an amount is
 * still ours, and so is deciding what happens when it cannot be done.
 */
function read(field, lines, tagged, threshold) {
  let best = { score: 0, index: -1 };
  tagged.forEach((row, index) => {
    const value = scoreOf(row, field);
    if (value >= best.score) best = { score: value, index };
  });
  if (best.score <= 0) return { value: null, score: 0, review: true };
  const value = READERS[field](lines[best.index]);
  // A doubtful field is not thrown away: it goes to a human with the score
  // that earned the doubt.
  return { value, score: best.score, review: value === null || best.score < threshold };
}

/** A number the caller can act on, rather than whatever came back. */
function scoreOf(row, field) {
  const value = (row ?? {})[field];
  return typeof value === 'number' && value >= 0 && value <= 1 ? value : 0;
}

const matching = (pattern) => (line) => line.match(pattern)?.[0] ?? null;

/** The rightmost amount: an item line carries a quantity and a unit price. */
function amount(line) {
  const amounts = line.match(AMOUNT);
  if (!amounts) return null;
  let cleaned = amounts.at(-1).replace(/[^\d,.]/g, '');
  if (cleaned.includes(',')) cleaned = cleaned.replaceAll('.', '').replace(',', '.');
  return Number(cleaned);
}

const READERS = { invoice_number: matching(REFERENCE), date: matching(DATE), total: amount };
