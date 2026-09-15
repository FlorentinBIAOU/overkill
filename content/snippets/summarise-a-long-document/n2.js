/**
 * Summarise a long document with a self-hosted abstractive model.
 *
 * Rung N2. The first rung that writes. N0 and N1 choose sentences and can only
 * ever return what the author already wrote; this one produces sentences that
 * were not in the document.
 *
 * That gain has a price, and the price is in this file rather than in the
 * model. A sequence-to-sequence summariser reads a fixed-size window. A long
 * document does not fit, so it has to be cut at sentence boundaries,
 * summarised piece by piece, and the notes summarised again, in as many passes
 * as it takes to fit one window. Every one of those calls can fail or come
 * back empty, and a summary that is silently half a document is worse than no
 * summary at all.
 *
 * What this file cannot do, at any price: check that what the model wrote is
 * what the document said. Nothing in this plumbing can. See the test.
 */

// A full stop, question or exclamation mark followed by whitespace, or a line
// break: a transcript without final punctuation is still cut into lines.
const SENTENCE_END = /(?<=[.!?])\s+|\s*\n\s*/;

// The ONNX conversion of sshleifer/distilbart-cnn-12-6, the weights Python loads.
export const MODEL_NAME = 'Xenova/distilbart-cnn-12-6';

// What one call to the model is given to read. The window is 1,024 tokens, and
// characters are not tokens: with this model's tokenizer, 3,000 characters of
// French prose come to 1,091 tokens, 2,000 to 727. A piece that still
// overflows, code or a table, is refused by the model below, not truncated.
export const CHUNK_CHARACTERS = 2000;

// What the whole function is allowed to read. A self-hosted model costs
// machine time rather than money, but a document nobody meant to send is still
// better refused than churned through in silence.
export const MAX_CHARACTERS = 200_000;

export class SummaryUnavailable extends Error {}

/** The real model, loaded from local weights and run on this machine. */
export class LocalSummariser {
  #pipeline;

  async load(name = MODEL_NAME) {
    // Loads weights, so this is never reached in the tests.
    const { pipeline } = await import('@huggingface/transformers');
    this.#pipeline = await pipeline('summarization', name);
    return this;
  }

  async generate(text) {
    const { tokenizer } = this.#pipeline;
    // Refused rather than truncated: a summary of the start of a piece reads
    // exactly like a summary of all of it.
    if (tokenizer.encode(text).length > tokenizer.model_max_length) {
      throw new RangeError("this piece is longer than the model's window");
    }
    const [{ summary_text: written }] = await this.#pipeline(text);
    return written;
  }
}

let loading; // the default model, loaded once for the life of the process

function defaultModel() {
  loading ??= new LocalSummariser().load().catch((error) => {
    loading = undefined; // a failed load is tried again next time, not kept
    throw error;
  });
  return loading;
}

/** Join consecutive units into pieces of at most `size` characters. */
export function pack(units, size = CHUNK_CHARACTERS) {
  const pieces = [];
  let current = '';
  for (const unit of units) {
    if (current && current.length + 1 + unit.length > size) {
      pieces.push(current);
      current = unit;
    } else {
      current = `${current} ${unit}`.trim();
    }
  }
  if (current) pieces.push(current);
  return pieces;
}

/**
 * Cut the document into pieces that fit the model's window, at sentence
 * boundaries.
 *
 * A sentence longer than the window on its own is passed whole. Cutting
 * mid-sentence would hand the model half a clause, which is a worse thing to
 * summarise.
 */
export function chunk(text, size = CHUNK_CHARACTERS) {
  const sentences = text.trim().split(SENTENCE_END).map((part) => part.trim());
  return pack(sentences.filter(Boolean), size);
}

/**
 * @param {string} text
 * @param {object} options
 * @param {{generate: Function}} [options.model] injected so this can be tested
 *   without loading weights; defaults to the real model
 * @param {number} [options.attempts]
 */
export async function summarise(text, { model, attempts = 2 } = {}) {
  if (text.length > MAX_CHARACTERS) {
    throw new RangeError(`document longer than ${MAX_CHARACTERS} characters`);
  }
  let pieces = chunk(text);
  if (pieces.length === 0) return '';
  model ??= await defaultModel();

  for (;;) {
    const notes = [];
    for (const piece of pieces) notes.push(await generate(model, piece, attempts));
    if (notes.length === 1) return notes[0];
    // Next pass: the model reads back its own notes, packed to the window like
    // the document was. It never reads the document again.
    const packed = pack(notes);
    if (packed.length >= pieces.length) {
      throw new SummaryUnavailable('the notes are no shorter than what they summarise');
    }
    pieces = packed;
  }
}

async function generate(model, text, attempts) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const written = ((await model.generate(text)) ?? '').trim();
      if (written) return written;
      // An empty answer is a failure, not a summary. Returning it would leave
      // a hole in the middle of the document with no trace.
      lastError = new Error('the model returned an empty summary');
    } catch (error) {
      lastError = error;
    }
  }
  throw new SummaryUnavailable(String(lastError));
}
