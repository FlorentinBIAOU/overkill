/**
 * Write a product description with a small self-hosted generative model.
 *
 * Rung N2. A sequence-to-sequence checkpoint that lives on your own disk,
 * fine-tuned on the descriptions your shop has already published. Nothing
 * leaves your machines and nothing is metered.
 *
 * The fine-tuning is not in this file, and it is the work of this rung. Start
 * from a model that already writes French: BARThez, a BART-shaped French
 * sequence-to-sequence model pretrained on raw French text, 165 M parameters
 * in its base size, Apache 2.0. The training set is one pair per
 * description your catalogue has already published — the record on one line,
 * as `source` writes it below, and the published description as the target.
 * You are not buying a corpus; you are using the one your shop wrote. What you
 * get back is a checkpoint of your own, which is what `CHECKPOINT` points at.
 *
 * Around the model, everything on this rung is code you now own: the source
 * line the model was fine-tuned to read, the size cap, the retry, the sentence
 * a small model leaves half-finished when its token budget runs out, and the
 * check at the end.
 *
 * That check is the point of this file. The E2E generation challenge found
 * that sequence-to-sequence models without a semantic control often fail to
 * express the attributes they are given correctly. So the copy is read back against the record, term by
 * term, and anything the record does not support is refused. A shop that
 * promises what it does not sell has a legal problem, not a style problem.
 */

// One product record, written on one line. Longer than that, it is not a
// product record, and the model only wanders further from it.
export const MAX_CHARACTERS = 600;

// Shorter than that, the model handed back a fragment and not a description.
export const MIN_CHARACTERS = 40;

export class DescriptionUnavailable extends Error {}

export class UngroundedDescription extends DescriptionUnavailable {}

/**
 * The real model: a fine-tuned checkpoint on your disk, loaded once.
 * Transformers.js runs ONNX weights: convert the checkpoint first, with Optimum.
 */
// What to fine-tune from, for a French catalogue. Read its card before you
// commit to it: language, licence, size. This one says French, Apache 2.0,
// 165 M parameters.
export const BASE_CHECKPOINT = 'moussaKam/barthez';

// Where your fine-tuned weights are: the output of that training, not a model
// to download.
export const CHECKPOINT = './models/catalogue-copy';

export class LocalCopywriter {
  static async load(checkpoint = CHECKPOINT) {
    const { pipeline } = await import('@huggingface/transformers'); // a large local install
    return new LocalCopywriter(await pipeline('text2text-generation', checkpoint));
  }

  constructor(write) {
    this.write = write;
  }

  async generate(source, options = {}) {
    const [answer] = await this.write(source, options);
    return answer.generated_text;
  }
}

/**
 * Write the description of one product.
 *
 * `model` is injected so this can be tested without the checkpoint; in
 * production it defaults to the real one above.
 *
 * `vocabulary` is the attribute words your catalogue uses — materials,
 * finishes, features, claims. It is what makes the grounding check possible: a
 * word of that list found in the copy and nowhere in the record is an
 * invention. An empty vocabulary switches the check off, which is a decision,
 * not a default to leave alone.
 *
 * @param {Record<string, string|string[]>} product
 * @param {{generate: Function}} [model]
 * @param {{vocabulary?: string[], attempts?: number}} [options]
 */
export async function describe(product, model, { vocabulary = [], attempts = 2 } = {}) {
  const source = sourceLine(product);
  if (source === '') throw new RangeError('empty product record: nothing to describe');
  // Characters are counted as code points, as in Python: an emoji is one.
  if ([...source].length > MAX_CHARACTERS) {
    throw new RangeError(`product record longer than ${MAX_CHARACTERS} characters`);
  }
  const copywriter = model ?? (await LocalCopywriter.load());

  const description = wholeSentences(await generate(copywriter, source, attempts));
  if (description.length < MIN_CHARACTERS) {
    throw new DescriptionUnavailable('the model answered a fragment');
  }

  const invented = vocabulary.filter((term) => states(description, term) && !states(source, term));
  if (invented.length > 0) throw new UngroundedDescription(invented.join(', '));
  return description;
}

/** The shape the model was fine-tuned on: one line of « field: value ». */
function sourceLine(product) {
  const fields = [];
  for (const [key, value] of Object.entries(product)) {
    const items = (Array.isArray(value) ? value : [value]).filter((item) => item != null); // null: a NULL column
    const joined = items.map(String).join(', ');
    if (joined.trim()) fields.push(`${key}: ${joined.trim()}`);
  }
  return fields.join(' | ');
}

/** Retry: on a machine that also serves the shop, the first call fails. */
async function generate(model, source, attempts) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    let text;
    try {
      text = await model.generate(source, { max_new_tokens: 90, num_beams: 4 });
    } catch (error) {
      lastError = error;
      continue;
    }
    if (typeof text === 'string') return text;
    lastError = new TypeError('the model returned no text');
  }
  throw new DescriptionUnavailable(String(lastError));
}

/**
 * Keep only what the model finished saying.
 *
 * A small model stops when its budget runs out, mid-sentence and sometimes
 * mid-word. Publishing that is worse than publishing nothing at all. A
 * sentence ends on a mark followed by the end of the text or by a capital, so
 * « 1.2 kg » is not an end; « M. Dupont » still is.
 */
function wholeSentences(text) {
  const tidy = text.split(/\s+/).filter(Boolean).join(' ');
  let end = 0;
  for (const mark of tidy.matchAll(/[.!?]/g)) {
    const after = tidy.slice(mark.index + 1, mark.index + 3);
    if (after === '' || /^ \p{Lu}$/u.test(after)) end = mark.index + 1;
  }
  return tidy.slice(0, end);
}

// A term right after one of these words is denied, not stated: « non étanche ».
const NEGATIONS = new Set(['non', 'pas', 'sans', 'ni', 'aucun', 'aucune']);

/**
 * Whether the text states the term: whole words, case and accents set aside,
 * each word allowed the agreement endings e, s and es (« garantie à vie »
 * states « garanti à vie »), and not right after a negation.
 */
function states(text, term) {
  const folded = fold(text);
  const words = fold(term).split(/\s+/).filter(Boolean)
    .map((word) => `${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:e|s|es)?`);
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}_])${words.join('\\s+')}(?![\\p{L}\\p{N}_])`, 'gu');
  for (const found of folded.matchAll(pattern)) {
    const before = folded.slice(0, found.index).match(/[\p{L}\p{N}_]+/gu) ?? [];
    if (!NEGATIONS.has(before.at(-1))) return true;
  }
  return false;
}

/** Lowercase and drop accents, so « Étanche » meets « etanche ». */
function fold(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}
