/**
 * Summarise a long document with a self-hosted abstractive model.
 *
 * Rung N2. The first rung that writes. N0 and N1 choose sentences and can only
 * ever return what the author already wrote; this one produces a sentence that
 * was not in the document, which is the only way to state a conclusion drawn
 * from two passages ten pages apart.
 *
 * That gain has a price, and the price is in this file rather than in the
 * model. A sequence-to-sequence summariser reads a fixed-size window. A long
 * document does not fit, so it has to be cut at sentence boundaries,
 * summarised piece by piece, and the pieces summarised again. Every one of
 * those calls can fail or come back empty, and a summary that is silently half
 * a document is worse than no summary at all.
 *
 * What this file cannot do, at any price: check that what the model wrote is
 * what the document said. Nothing in this plumbing can. See the test.
 */

const SENTENCE_END = /(?<=[.!?])\s+/;

export const MODEL_NAME = 'Xenova/distilbart-cnn-12-6';

// What one pass of the model is allowed to read. Beyond its window the model
// truncates without saying so, and a summary of the first half of a chunk is
// indistinguishable from a summary of all of it.
export const CHUNK_CHARACTERS = 3000;

// What the whole function is allowed to read. A self-hosted model costs
// machine time rather than money, but a document nobody meant to send is still
// better refused than churned through in silence.
export const MAX_CHARACTERS = 200_000;

export class SummaryUnavailable extends Error {}

/**
 * The real model, loaded from local weights. Loaded once and kept for the life
 * of the process: it is the loading that is slow, not the summarising.
 */
export class LocalSummariser {
  #pipeline;

  async load(name = MODEL_NAME) {
    // Loads weights, so this is never reached in the tests.
    const { pipeline } = await import('@xenova/transformers');
    this.#pipeline = await pipeline('summarization', name);
    return this;
  }

  async generate(text) {
    const [{ summary_text: written }] = await this.#pipeline(text, { truncation: true });
    return written;
  }
}

/**
 * Cut the document into pieces that fit the model's window, at sentence
 * boundaries.
 *
 * A sentence longer than the window on its own is passed whole and the model
 * will truncate it. Cutting mid-sentence to avoid that would hand the model
 * half a clause, which is a worse thing to summarise.
 */
export function chunk(text, size = CHUNK_CHARACTERS) {
  const pieces = [];
  let current = '';
  for (const raw of text.trim().split(SENTENCE_END)) {
    const sentence = raw.trim();
    if (!sentence) continue;
    if (current && current.length + 1 + sentence.length > size) {
      pieces.push(current);
      current = sentence;
    } else {
      current = `${current} ${sentence}`.trim();
    }
  }
  if (current) pieces.push(current);
  return pieces;
}

/**
 * @param {string} text
 * @param {object} options
 * @param {{generate: Function}} [options.model] injected so this can be tested
 *   without loading weights; defaults to the real model
 * @param {number} [options.attempts]
 */
export async function summarise(text, { model, attempts = 2 } = {}) {
  if (!model) {
    // Loads weights, so this is never reached in the tests.
    model = await new LocalSummariser().load();
  }

  if (text.length > MAX_CHARACTERS) {
    throw new RangeError(`document longer than ${MAX_CHARACTERS} characters`);
  }

  const pieces = chunk(text);
  if (pieces.length === 0) return '';

  const notes = [];
  for (const piece of pieces) notes.push(await generate(model, piece, attempts));
  if (notes.length === 1) return notes[0];

  // Second pass: the model reads back its own notes. Concatenating them
  // instead would give a text as long as the number of chunks, which is not a
  // summary of the document but a summary of each of its parts.
  return generate(model, notes.join(' '), attempts);
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
