/**
 * Write a product description with a small self-hosted generative model.
 *
 * Rung N2. A sequence-to-sequence checkpoint that lives on your own disk,
 * fine-tuned on the descriptions your shop has already published, so that it
 * writes in your voice rather than in the average voice of the web. Nothing
 * leaves your machines and nothing is metered.
 *
 * The prose is freer than a template's, and everything else on this rung is
 * code you now own: the source line the model was fine-tuned to read, the size
 * cap, the retry, the sentence a small model leaves half-finished when its
 * token budget runs out, and the check at the end.
 *
 * That check is the point of this file. A generative model writes what sounds
 * right. Handed a bag, it will sooner or later call it waterproof, because the
 * sentences it learnt from ended that way, and nothing inside it distinguishes
 * an attribute of this product from a plausible attribute. So the copy is read
 * back against the record, term by term, and anything the record does not
 * support is refused. A shop that promises what it does not sell has a legal
 * problem, not a style problem.
 */

// One product record, written on one line. Longer than that, it is not a
// product record, and the model only wanders further from it.
export const MAX_CHARACTERS = 600;

// Shorter than that, the model handed back a fragment and not a description.
export const MIN_CHARACTERS = 40;

export class DescriptionUnavailable extends Error {}

export class UngroundedDescription extends DescriptionUnavailable {}

/** The real model: a fine-tuned checkpoint on your disk, loaded once. */
export class LocalCopywriter {
  static async load(checkpoint = './models/catalogue-copy') {
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
  const copywriter = model ?? (await LocalCopywriter.load());
  const source = sourceLine(product);
  if (source.length > MAX_CHARACTERS) {
    throw new RangeError(`product record longer than ${MAX_CHARACTERS} characters`);
  }

  const description = wholeSentences(await generate(copywriter, source, attempts));
  if (description.length < MIN_CHARACTERS) {
    throw new DescriptionUnavailable('the model answered a fragment');
  }

  const invented = vocabulary.filter((term) => says(description, term) && !says(source, term));
  if (invented.length > 0) throw new UngroundedDescription(invented.join(', '));
  return description;
}

/** The shape the model was fine-tuned on: one line of « field: value ». */
function sourceLine(product) {
  const fields = [];
  for (const [key, value] of Object.entries(product)) {
    const joined = Array.isArray(value) ? value.join(', ') : String(value);
    if (joined.trim()) fields.push(`${key}: ${joined.trim()}`);
  }
  return fields.join(' | ');
}

/** Retry: on a machine that also serves the shop, the first call fails. */
async function generate(model, source, attempts) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await model.generate(source, { max_new_tokens: 90, num_beams: 4 });
    } catch (error) {
      lastError = error;
    }
  }
  throw new DescriptionUnavailable(String(lastError));
}

/**
 * Keep only what the model finished saying.
 *
 * A small model stops when its budget runs out, mid-sentence and sometimes
 * mid-word. Publishing that is worse than publishing nothing at all.
 */
function wholeSentences(text) {
  const tidy = String(text).split(/\s+/).filter(Boolean).join(' ');
  const end = Math.max(...['.', '!', '?'].map((mark) => tidy.lastIndexOf(mark)));
  return end >= 0 ? tidy.slice(0, end + 1) : '';
}

/** Whole-word search, case and accents set aside. */
function says(text, term) {
  const escaped = fold(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`).test(fold(text));
}

/** Lowercase and drop accents, so « Étanche » meets « etanche ». */
function fold(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}
