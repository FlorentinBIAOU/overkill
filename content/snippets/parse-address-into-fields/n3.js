/**
 * Split an address by asking a general-purpose model.
 *
 * Rung N3. It is here so you can see what it costs, not because this entry
 * recommends it.
 *
 * Note what the code has to do that N0 did not: cap the input size, retry on
 * failure, parse an answer that is only probably valid JSON, and check that the
 * fields it hands back were actually in the address. That last point is
 * specific to extraction: a value the address does not contain is dropped,
 * because a plausible postcode is worse than an empty field — nothing
 * downstream will ever question it.
 *
 * That plumbing is the real cost of this rung, and it is the part your tests
 * have to cover, because the model itself is not testable.
 */

// The provider named here is an example, not a recommendation: the reasoning
// holds for any general-purpose model API, and the client is swappable. Pass
// any object with a `complete({ prompt, temperature })` method.
export const MODEL = 'gpt-4.1-mini'; // an example id: check the parameters your model accepts

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

export const FIELDS = ['number', 'street', 'complement', 'postcode', 'city'];

const PROMPT = [
  'Split the postal address below into fields.',
  'Answer with JSON only: an object with the keys `number`, `street`,',
  '`complement`, `postcode` and `city`. Copy the text exactly as it is',
  'written, and leave a key empty when the address does not carry it.',
  '',
  'Address:',
].join('\n');

// An address is a short line. The cap is a cost control: the provider bills the
// tokens of the prompt as well as those of the answer.
export const MAX_CHARACTERS = 300;

export class ParsingUnavailable extends Error {}

/**
 * Split an address into number, street, complement, postcode and town.
 *
 * @param {string} address
 * @param {object} options
 * @param {{complete: Function}} [options.client] injected so this can be tested
 *   without a network call; defaults to a real provider client
 * @param {number} [options.attempts]
 */
export async function parse(address, { client, attempts = 3 } = {}) {
  // Code points, as Python counts them: an emoji is one character, not two.
  if ([...address].length > MAX_CHARACTERS) {
    throw new RangeError(`address longer than ${MAX_CHARACTERS} characters`);
  }
  client ??= await providerClient();

  const answer = await ask(client, address, attempts);
  const source = words(address);
  const taken = source.map(() => false);
  const values = Object.fromEntries(FIELDS.map((key) => [key, text(answer[key])]));
  const fields = Object.fromEntries(FIELDS.map((name) => [name, '']));
  // Kept only if the model copied it from the address, as whole words not
  // already claimed by another field. Longest first, so a postcode "12" cannot
  // take its digits out of "Appartement 12". What it made up is dropped, and an empty
  // field is a question a human can see.
  for (const key of [...FIELDS].sort((a, b) => words(values[b]).length - words(values[a]).length)) {
    const wanted = words(values[key]);
    for (let start = 0; wanted.length && start + wanted.length <= source.length; start += 1) {
      const end = start + wanted.length;
      if (wanted.every((w, i) => source[start + i] === w) && !taken.slice(start, end).some(Boolean)) {
        taken.fill(true, start, end);
        fields[key] = values[key].trim();
        break;
      }
    }
  }
  return fields;
}

async function ask(client, address, attempts) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const answer = await client.complete({
        prompt: `${PROMPT}\n${address}`,
        // Temperature zero, because an address that splits differently between
        // two identical calls cannot be reconciled with anything.
        temperature: 0,
      });
      // No content (a refusal) is as unusable as prose.
      const parsed = typeof answer === 'string' ? JSON.parse(answer) : null;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
      lastError = new Error('the model answered something that is not an object');
    } catch (error) {
      lastError = error;
    }
  }
  throw new ParsingUnavailable(String(lastError));
}

/** A string as it came, a whole number as its digits (75011), anything else as nothing. */
function text(value) {
  if (Number.isInteger(value)) return String(value);
  return typeof value === 'string' ? value : '';
}

/** Case, spacing and punctuation are the model's to change; the words are not. */
function words(value) {
  return value.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}
