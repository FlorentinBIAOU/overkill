/**
 * Ask a general-purpose multimodal model to read the invoice.
 *
 * Rung N3. This is the option people reach for first, and on this task it has
 * a real argument: the model is given a picture of the page, so it sees the
 * column an amount sits in, which the extracted text has already lost.
 *
 * Note what the code has to do that N0 did not: cap the size of what it sends,
 * retry on failure, parse an answer that is only probably JSON, and check the
 * shape of what came back. That plumbing is the real cost of this rung, and it
 * is the part your tests have to cover, because the model itself is not
 * testable.
 */

const PROMPT = [
  'Read the invoice below and return its header fields.',
  'Answer with JSON only: an object with the keys `invoice_number`, `date`',
  'and `total`. `total` is the amount due, taxes included, as a number.',
  'Use null for a field the page does not carry.',
  '',
  'Extracted text:',
].join('\n');

// A model charges by the token, and a scanned page is a lot of them. Refusing
// an oversized image is not an optimisation, it is a cost control.
export const MAX_IMAGE_BYTES = 4_000_000;

const FIELDS = ['invoice_number', 'date', 'total'];

export class ExtractionUnavailable extends Error {}

/**
 * Read the invoice fields from its text and a picture of the page.
 *
 * @param {string} text the invoice, already extracted
 * @param {Uint8Array} pageImage the rendered page; this snippet opens no file
 * @param {object} options
 * @param {{complete: Function}} [options.client] injected so this can be
 *   tested without a network call; defaults to a real provider client
 * @param {number} [options.attempts]
 */
export async function extractFields(text, pageImage, { client, attempts = 3 } = {}) {
  let provider = client;
  if (!provider) {
    // Needs a key and a network, so it is never reached in the tests.
    const { OpenAI } = await import('openai');
    provider = new OpenAI();
  }

  if (pageImage.length > MAX_IMAGE_BYTES) {
    throw new RangeError(`page image larger than ${MAX_IMAGE_BYTES} bytes`);
  }

  const imageUrl = `data:image/png;base64,${Buffer.from(pageImage).toString('base64')}`;
  return decode(await ask(provider, text, imageUrl, attempts));
}

async function ask(client, text, imageUrl, attempts) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await client.complete({
        prompt: `${PROMPT}\n${text}`,
        imageUrl,
        // Temperature zero, because an amount that changes between two
        // identical calls cannot be reconciled with anything.
        temperature: 0,
      });
    } catch (error) {
      lastError = error;
    }
  }
  throw new ExtractionUnavailable(String(lastError));
}

/**
 * Turn the answer into the three fields, or refuse it.
 *
 * Models like to wrap JSON in a code fence. That is noise, not an error, and
 * stripping it is cheaper than another call.
 */
function decode(answer) {
  const stripped = answer.trim().replace(/^```(?:json)?/, '').replace(/```$/, '');
  let parsed;
  try {
    parsed = JSON.parse(stripped);
  } catch (error) {
    throw new ExtractionUnavailable(`the model did not answer with JSON: ${error.message}`);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ExtractionUnavailable('the model answered something that is not an object');
  }

  const fields = Object.fromEntries(FIELDS.map((field) => [field, parsed[field] ?? null]));
  // A total nobody can compute with is worse than no total at all: it would
  // travel down the pipeline looking like a number.
  if (fields.total !== null && typeof fields.total !== 'number') {
    throw new ExtractionUnavailable(`the model answered a total that is not a number: ${fields.total}`);
  }
  return fields;
}
