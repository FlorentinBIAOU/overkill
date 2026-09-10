/**
 * Mask personal data by asking a general-purpose model.
 *
 * Rung N3. This is the option people reach for first. It is here so you can
 * see what it costs, not because this entry recommends it.
 *
 * Note what the code has to do that N0 did not: retry on failure, cap the
 * input size, parse an answer that is only probably valid JSON, and refuse to
 * pass the message through unmasked when the answer is unusable. That plumbing
 * is the real cost of this rung, and it is the part your tests have to cover,
 * because the model itself is not testable.
 */

const PROMPT = [
  'Find every piece of personal contact information in the message below.',
  'Answer with JSON only: a list of objects with keys `text` and `kind`,',
  'where `kind` is one of email, phone, iban, address.',
  'If there is none, answer with an empty list.',
  '',
  'Message:',
].join('\n');

export const MAX_CHARACTERS = 8000;

export class MaskingUnavailable extends Error {}

/**
 * Replace contact details with a label naming what was removed.
 *
 * @param {string} message
 * @param {object} options
 * @param {{complete: Function}} [options.client] injected so this can be
 *   tested without a network call; defaults to a real provider client
 * @param {number} [options.attempts]
 */
export async function mask(message, { client, attempts = 3 } = {}) {
  if (!client) {
    // Needs a key and a network, so it is never reached in the tests.
    const { OpenAI } = await import('openai');
    client = new OpenAI();
  }

  // A model charges by the token. Refusing oversized input is not an
  // optimisation, it is a cost control.
  if (message.length > MAX_CHARACTERS) {
    throw new RangeError(`message longer than ${MAX_CHARACTERS} characters`);
  }

  const found = await ask(client, message, attempts);

  // Replace the longest matches first, so a substring never eats its parent.
  let out = message;
  for (const { text, kind } of [...found].sort((a, b) => (b.text?.length ?? 0) - (a.text?.length ?? 0))) {
    if (text && kind) out = out.split(text).join(`[${kind}]`);
  }
  return out;
}

async function ask(client, message, attempts) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const answer = await client.complete({
        prompt: `${PROMPT}\n${message}`,
        // Temperature zero, because a masking decision that changes between
        // two identical calls cannot be reviewed.
        temperature: 0,
      });
      const parsed = JSON.parse(answer);
      if (Array.isArray(parsed)) return parsed;
      lastError = new Error('the model answered something that is not a list');
    } catch (error) {
      lastError = error;
    }
  }
  throw new MaskingUnavailable(String(lastError));
}
