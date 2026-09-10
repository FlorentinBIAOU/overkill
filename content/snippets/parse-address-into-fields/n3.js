/**
 * Split an address by asking a general-purpose model.
 *
 * Rung N3. This is the option people reach for first. It is here so you can see
 * what it costs, not because this entry recommends it.
 *
 * Note what the code has to do that N0 did not: cap the input size, retry on
 * failure, parse an answer that is only probably valid JSON, and check that the
 * fields it hands back were actually in the address. That last point is
 * specific to extraction: a model asked for a postcode and given none will
 * happily supply a plausible one, and a plausible postcode is worse than an
 * empty field because nothing downstream will ever question it.
 *
 * That plumbing is the real cost of this rung, and it is the part your tests
 * have to cover, because the model itself is not testable.
 */

export const FIELDS = ['number', 'street', 'complement', 'postcode', 'city'];

const PROMPT = [
  'Split the postal address below into fields.',
  'Answer with JSON only: an object with the keys `number`, `street`,',
  '`complement`, `postcode` and `city`. Copy the text exactly as it is',
  'written, and leave a key empty when the address does not carry it.',
  '',
  'Address:',
].join('\n');

// An address is a short line. A cap is not an optimisation here, it is a cost
// control: a model charges by the token, on the way in as well as out.
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
  if (!client) {
    // Needs a key and a network, so it is never reached in the tests.
    const { OpenAI } = await import('openai');
    client = new OpenAI();
  }

  if (address.length > MAX_CHARACTERS) {
    throw new RangeError(`address longer than ${MAX_CHARACTERS} characters`);
  }

  const answer = await ask(client, address, attempts);
  const source = fold(address);
  const fields = Object.fromEntries(FIELDS.map((name) => [name, '']));
  for (const key of FIELDS) {
    const value = answer[key];
    if (typeof value === 'string' && value.trim() && source.includes(fold(value))) {
      // Kept only if the model copied it from the address. What it made up is
      // dropped, and an empty field is a question a human can see.
      fields[key] = value.trim();
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
      const parsed = JSON.parse(answer);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
      lastError = new Error('the model answered something that is not an object');
    } catch (error) {
      lastError = error;
    }
  }
  throw new ParsingUnavailable(String(lastError));
}

/** Case and spacing are the model's to change; the words are not. */
function fold(text) {
  return text.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}
