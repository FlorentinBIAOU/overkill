/**
 * Summarise a long document by asking a general-purpose model.
 *
 * Rung N3. It is here so you can see what it costs, not because this entry
 * recommends it.
 *
 * What it buys over N2 is real: no weights to host, no machine to keep warm,
 * and an output shape set in the prompt — three sentences, a list of points,
 * or both — instead of trained into the weights. Whether the answer respects
 * that shape is checked below, not assumed.
 *
 * What it costs is in this file. Cap the input, because the provider charges
 * by the token and a document nobody meant to send is money gone. Retry,
 * because the call goes over a network. Parse an answer that is only probably
 * the JSON you asked for. Refuse an answer of the wrong shape rather than
 * passing half of one to the caller. That plumbing is what your tests can
 * cover.
 *
 * What no test here can cover: whether the summary is true of the document.
 * Nothing below can tell a fluent sentence the document never supported from
 * a good one. See the test.
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
  // Refusing an oversized document is not an optimisation, it is a cost
  // control: the provider bills the input whether the answer is useful or not.
  // Counted in code points, as Python counts characters.
  if ([...document].length > MAX_CHARACTERS) {
    throw new RangeError(`document longer than ${MAX_CHARACTERS} characters`);
  }
  if (!(maxSentences >= 1)) throw new RangeError('maxSentences must be at least 1');

  // An empty document has no summary, and asking for one costs the same as
  // asking for a real one.
  if (!document.trim()) return { summary: '', keyPoints: [] };

  const prompt = `${PROMPT.replace('{sentences}', String(maxSentences))}\n${document}`;
  return ask(client ?? (await providerClient()), prompt, attempts);
}

async function ask(client, prompt, attempts) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    let answer;
    try {
      // Temperature zero, the low end of the range, which the provider
      // documents as more focused and deterministic. It does not promise
      // that two identical calls agree.
      answer = await client.complete({ prompt, temperature: 0 });
    } catch (error) {
      lastError = error; // any provider failure is retried
      continue;
    }
    try {
      return decode(answer);
    } catch (error) {
      lastError = error; // an unusable answer is asked for again
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
function decode(answer) {
  if (typeof answer !== 'string') throw new Error('the model returned no text');
  // A JSON answer wrapped whole in one code fence is read; nothing else is: a
  // fence opened and never closed, or prose around it, is a failed answer.
  const trimmed = answer.trim();
  const fenced = trimmed.startsWith('```') && trimmed.endsWith('```') && trimmed.split('```').length === 3;
  const parsed = JSON.parse(fenced ? trimmed.slice(3, -3).replace(/^json/, '') : trimmed);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('the model answered something that is not an object');
  }
  const { summary, key_points: points = [] } = parsed;
  if (typeof summary !== 'string' || !summary.trim()) {
    throw new Error('the model answered without a summary');
  }
  if (!Array.isArray(points) || !points.every((point) => typeof point === 'string')) {
    throw new Error('the model answered with key points that are not a list of strings');
  }
  return { summary: summary.trim(), keyPoints: points };
}
