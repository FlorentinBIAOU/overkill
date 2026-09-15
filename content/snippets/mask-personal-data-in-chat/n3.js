/**
 * Mask personal data by asking a general-purpose model.
 *
 * Rung N3. It is here so you can see what it costs, not because this entry
 * recommends it.
 *
 * Note what the code has to do that N0 did not: retry on failure, cap the
 * input size, parse an answer that is only probably valid JSON, check every
 * item of it against the message, and refuse to pass the message through
 * unmasked when the answer is unusable. A prompt is only a request: nothing in
 * it holds the model to the format asked for. That plumbing is the real cost
 * of this rung, and it is the part your tests have to cover, because the model
 * itself is not testable.
 */

const PROMPT = [
  'Find every piece of personal contact information in the message below.',
  'Answer with JSON only: a list of objects with keys `text` and `kind`,',
  'where `kind` is one of email, phone, iban, address.',
  'If there is none, answer with an empty list.',
  '',
  'Message:',
].join('\n');
const KINDS = ['email', 'phone', 'iban', 'address'];

export const MAX_CHARACTERS = 8000;

// The provider named here is an example, not a recommendation: the reasoning
// holds for any general-purpose model API, and the client is swappable. Pass
// any object with a `complete({ prompt, temperature })` method.
export const MODEL = 'gpt-4.1-mini'; // an example id: check the parameters your model accepts

export class MaskingUnavailable extends Error {}

export async function providerClient(sdk, model = MODEL) {
  if (!sdk) {
    const { OpenAI } = await import('openai');
    sdk = new OpenAI();
  }
  return {
    async complete({ prompt, temperature }) {
      const response = await sdk.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature,
      });
      return response.choices[0].message.content;
    },
  };
}

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
  client ??= await providerClient();

  // The provider bills every token of the prompt. Refusing oversized input
  // before the call is a cost control; the cap counts characters (code points,
  // as Python does), not tokens.
  if ([...message].length > MAX_CHARACTERS) {
    throw new RangeError(`message longer than ${MAX_CHARACTERS} characters`);
  }

  const found = await ask(client, message, attempts);

  // Replace the longest matches first, so a substring never eats its parent.
  let out = message;
  for (const { text, kind } of [...found].sort((a, b) => b.text.length - a.text.length)) {
    out = out.split(text).join(`[${kind}]`);
  }
  return out;
}

/** A list of {text, kind}, every text found as is in the message, every kind one we asked for. */
function isUsable(parsed, message) {
  return Array.isArray(parsed) && parsed.every((item) => (
    typeof item?.text === 'string' && item.text !== '' && message.includes(item.text) && KINDS.includes(item.kind)
  ));
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
      if (answer === null || answer === undefined) {
        // A refusal carries no content: unusable, not empty.
        lastError = new Error('the model returned no content');
        continue;
      }
      const parsed = JSON.parse(answer);
      // An item the message does not contain would mask nothing, and the message would leave in clear.
      if (isUsable(parsed, message)) return parsed;
      lastError = new Error('the model answered something other than items found in the message');
    } catch (error) {
      lastError = error;
    }
  }
  throw new MaskingUnavailable(String(lastError));
}
