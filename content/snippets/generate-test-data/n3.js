/**
 * Write the text fields of a test data set by asking a general-purpose model.
 *
 * Rung N3. This is the option people reach for first, and the only rung of
 * this entry that writes free text rather than picking from values the caller
 * listed.
 *
 * It also gives up the property the lower rungs were built on. There is no
 * seed here: the request carries a prompt and a temperature, and nothing that
 * would make a second call repeat the first. The data set has to be generated
 * once and then stored, like a fixture, not rebuilt on demand.
 *
 * And a prompt is only a request: nothing in it holds the model to the keys
 * you asked for, the number of rows or the uniqueness of an identifier. Look
 * at how much of this file is checking rather than asking. That plumbing is the
 * real cost of the rung, and it is the part the tests can cover, because the
 * model itself is not testable.
 */

// A cap chosen for this snippet, not a measured limit: the whole batch has to
// fit in one answer, and a model's output is capped in tokens.
export const MAX_ROWS = 50;

// The provider named here is an example, not a recommendation: the reasoning
// holds for any general-purpose model API, and the client is swappable. Pass
// any object with a `complete({ prompt, temperature })` method.
export const MODEL = 'gpt-4.1-mini'; // an example id: check the parameters your model accepts

export class GenerationUnavailable extends Error {}

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

/** The instructions, kept next to the checks that verify they were followed. */
export function buildPrompt(fields, count, uniqueField) {
  const lines = [
    `Write ${count} rows of test data for a fictional application.`,
    'Each row is a JSON object with exactly these keys, and string values:',
    `${fields.join(', ')}.`,
    'Invent every value: it must match no real person, company or address.',
    `Answer with JSON only: a list of ${count} objects, and nothing else.`,
  ];
  if (uniqueField) {
    lines.splice(3, 0, `Every value of \`${uniqueField}\` must differ from the others.`);
  }
  return lines.join('\n');
}

/**
 * Verify what the model was asked for: the row count, exactly the keys,
 * non-empty strings, and the uniqueness requested.
 */
export function check(rows, fields, count, uniqueField) {
  if (!Array.isArray(rows) || rows.length !== count) {
    throw new TypeError(`expected a list of ${count} rows`);
  }
  for (const row of rows) {
    const keys = row && typeof row === 'object' ? Object.keys(row) : [];
    if (keys.length !== fields.length || !fields.every((field) => keys.includes(field))) {
      throw new TypeError(`a row does not carry exactly the keys ${fields.join(', ')}`);
    }
    if (!Object.values(row).every((value) => typeof value === 'string' && value.trim())) {
      throw new TypeError('a value is empty, or is not a string');
    }
  }
  if (uniqueField) {
    const values = rows.map((row) => row[uniqueField]);
    if (new Set(values).size !== values.length) {
      throw new TypeError(`the model repeated a value of ${uniqueField}`);
    }
  }
}

/**
 * Return `count` rows of invented text, or throw rather than return junk.
 *
 * The temperature is high on purpose: varied prose is the only reason to be on
 * this rung at all. It is also why the answer has to be checked, and why the
 * same call twice gives two different data sets.
 *
 * @param {string[]} fields
 * @param {number} count
 * @param {object} options
 * @param {string} [options.uniqueField] field whose values must not repeat
 * @param {{complete: Function}} [options.client] injected so this can be
 *   tested without a network call; defaults to a real provider client
 * @param {number} [options.attempts]
 * @param {number} [options.temperature]
 */
export async function writeRows(fields, count, options = {}) {
  const { uniqueField, attempts = 3, temperature = 1 } = options;
  let { client } = options;

  // A model charges by the token. Refusing a batch no answer can satisfy
  // before calling is not an optimisation, it is a cost control.
  if (!Number.isInteger(count) || !(count > 0 && count <= MAX_ROWS)) {
    throw new RangeError(`ask for a whole number of rows, between one and ${MAX_ROWS}`);
  }
  if (uniqueField !== undefined && !fields.includes(uniqueField)) {
    throw new RangeError(`the unique field ${uniqueField} is not one of the fields`);
  }
  // Needs a key and a network, so it is never reached in the tests.
  client ??= await providerClient();

  const prompt = buildPrompt(fields, count, uniqueField);
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const answer = await client.complete({ prompt, temperature });
      // A refusal comes back with no content.
      if (typeof answer !== 'string') throw new TypeError('the model returned no text');
      const rows = JSON.parse(answer);
      check(rows, fields, count, uniqueField);
      return rows;
    } catch (error) {
      // A bad answer is retried exactly like a provider failure.
      lastError = error;
    }
  }
  throw new GenerationUnavailable(String(lastError));
}
