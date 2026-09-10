/**
 * Write the text fields of a test data set by asking a general-purpose model.
 *
 * Rung N3. This is the option people reach for first, and it does buy
 * something real: a support ticket that reads like a support ticket, with the
 * typos, the capitals and the two questions in one sentence that no template
 * produces.
 *
 * It also gives up the property the lower rungs were built on. There is no
 * seed here. Two calls with the same prompt return different rows, so the data
 * set has to be generated once and then stored, like a fixture, not rebuilt on
 * demand.
 *
 * And the model guarantees nothing: not the keys you asked for, not the number
 * of rows, not the uniqueness of an identifier. Look at how much of this file
 * is checking rather than asking. That plumbing is the real cost of the rung,
 * and it is the part the tests can cover, because the model itself is not
 * testable.
 */

// Beyond that the answer comes back truncated more often than not.
export const MAX_ROWS = 50;

export class GenerationUnavailable extends Error {}

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
 * Verify what the model was asked for. Nothing here is redundant.
 *
 * Each of these failures is one this rung produces in practice: a row short, a
 * key renamed to its plural, an empty string, the same name twice.
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
  if (!client) {
    // Needs a key and a network, so it is never reached in the tests.
    const { OpenAI } = await import('openai');
    client = new OpenAI();
  }

  // A model charges by the token. Refusing an oversized batch before calling
  // is not an optimisation, it is a cost control.
  if (!(count > 0 && count <= MAX_ROWS)) {
    throw new RangeError(`ask for between one and ${MAX_ROWS} rows at a time`);
  }

  const prompt = buildPrompt(fields, count, uniqueField);
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const rows = JSON.parse(await client.complete({ prompt, temperature }));
      check(rows, fields, count, uniqueField);
      return rows;
    } catch (error) {
      // A bad answer is retried exactly like a provider failure.
      lastError = error;
    }
  }
  throw new GenerationUnavailable(String(lastError));
}
