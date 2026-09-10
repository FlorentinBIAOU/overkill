/**
 * Summarise a long document by asking a general-purpose model.
 *
 * Rung N3. This is the option people reach for first. It is here so you can
 * see what it costs, not because this entry recommends it.
 *
 * What it buys over N2 is real: no weights to host, no machine to keep warm,
 * and an answer that follows an instruction — three sentences, or a list of
 * points, or both — without anyone fine-tuning anything.
 *
 * What it costs is in this file. Cap the input, because the provider charges
 * by the token and a document nobody meant to send is money gone. Retry,
 * because the call goes over a network. Parse an answer that is only probably
 * the JSON you asked for. Refuse an answer of the wrong shape rather than
 * passing half of one to the caller. That plumbing is what your tests can
 * cover.
 *
 * What no test here can cover: whether the summary is true of the document.
 * The model will write a fluent, plausible sentence the document never
 * supported, and nothing below can tell that sentence from a good one. See the
 * test.
 */

const PROMPT = [
  'Summarise the document below in at most {sentences} sentences.',
  'Use only what the document says, and add nothing to it.',
  'Answer with JSON only: an object with the key `summary`, a string, and',
  'the key `key_points`, a list of short strings.',
  '',
  'Document:',
].join('\n');

export const MAX_CHARACTERS = 40000;

export class SummaryUnavailable extends Error {}

/**
 * Return `{ summary, keyPoints }`.
 *
 * @param {string} document
 * @param {object} options
 * @param {{complete: Function}} [options.client] injected so this can be
 *   tested without a network call; defaults to a real provider client
 * @param {number} [options.maxSentences]
 * @param {number} [options.attempts]
 */
export async function summarise(document, { client, maxSentences = 3, attempts = 3 } = {}) {
  if (!client) {
    // Needs a key and a network, so it is never reached in the tests.
    const { OpenAI } = await import('openai');
    client = new OpenAI();
  }

  // Refusing an oversized document is not an optimisation, it is a cost
  // control: the provider bills the input whether the answer is useful or not.
  if (document.length > MAX_CHARACTERS) {
    throw new RangeError(`document longer than ${MAX_CHARACTERS} characters`);
  }

  // An empty document has no summary, and asking for one costs the same as
  // asking for a real one.
  if (!document.trim()) return { summary: '', keyPoints: [] };

  const prompt = `${PROMPT.replace('{sentences}', String(maxSentences))}\n${document}`;
  return ask(client, prompt, attempts);
}

async function ask(client, prompt, attempts) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      // Temperature zero: two identical documents that summarise differently
      // cannot be reviewed, and cannot be cached either.
      const answer = await client.complete({ prompt, temperature: 0 });
      return decode(JSON.parse(answer));
    } catch (error) {
      lastError = error;
    }
  }
  throw new SummaryUnavailable(String(lastError));
}

/**
 * Accept only the shape that was asked for.
 *
 * Returning a half-built answer would hand the caller a summary that is
 * silently empty, which reads exactly like a document with nothing in it.
 */
function decode(parsed) {
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('the model answered something that is not an object');
  }
  const { summary, key_points: points = [] } = parsed;
  if (typeof summary !== 'string' || !summary.trim()) {
    throw new Error('the model answered without a summary');
  }
  if (!Array.isArray(points)) {
    throw new Error('the model answered with key points that are not a list');
  }
  return { summary: summary.trim(), keyPoints: points.map(String) };
}
