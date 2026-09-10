/**
 * Repair the rows rung N0 refused, and only those, by asking a model.
 *
 * Rung N3. The word that makes this rung defensible on this entry is "only".
 * The file may hold a hundred thousand rows; the journal of rung N0 holds the
 * handful that did not fit. One call per refused row, and none at all for the
 * rest. Hand the whole file to a model instead and you have paid for the
 * ninety-nine per cent that a regular expression had already dealt with.
 *
 * Note what this code has to do that rung N0 did not: build a prompt, retry a
 * failed call, parse an answer that is only probably valid JSON, and put the
 * answer back through the coercion of N0 before believing a word of it. That
 * plumbing is the real cost of this rung, and it is the part the tests have to
 * cover, because the model itself is not testable.
 */

import { Rejected, coerceRow } from './n0.js';

const PROMPT = [
  'A row of a CSV file was refused by a type check. Repair it.',
  'Columns, in order, with the type each one expects:',
  '{schema}',
  'The row was refused because: {reason}',
  'Its fields, as they were read: {fields}',
  '',
  'Answer with JSON only: one object, one key per column, every value a',
  'string in the expected format. Dates are written YYYY-MM-DD. If the row',
  'cannot be repaired, answer with an empty object.',
].join('\n');

/**
 * Return the rows that were repaired, and the ones that were not.
 *
 * `rejects` is the journal returned by `cleanCsv` of rung N0. Nothing else
 * from the file is read, and the number of calls made is exactly the length of
 * that journal.
 *
 * A row that cannot be repaired comes back in `unrepairable`, carrying its
 * original line, column and fields, plus the reason the repair failed. It is
 * never dropped: this rung exists because rung N0 refused to drop it either.
 *
 * @param {string[]} header
 * @param {Array<object>} rejects the journal from rung N0
 * @param {Record<string,string>} schema
 * @param {object} options
 * @param {{complete: Function}} [options.client] injected so this can be
 *   tested without a network call; defaults to a real provider client
 * @param {number} [options.attempts]
 */
export async function repairRejectedRows(header, rejects, schema, { client, attempts = 3 } = {}) {
  if (!client) {
    // Needs a key and a network, so it is never reached in the tests.
    const { OpenAI } = await import('openai');
    client = new OpenAI();
  }

  const described = header.map((name) => `- ${name}: ${schema[name] ?? 'text'}`).join('\n');
  const rows = [];
  const unrepairable = [];

  for (const reject of rejects) {
    // The replacements are given as functions: a `$` in a field would
    // otherwise be read as a back-reference by the string form of `replace`.
    const prompt = PROMPT.replace('{schema}', () => described)
      .replace('{reason}', () => reject.reason)
      .replace('{fields}', () => JSON.stringify(reject.fields));
    const answer = await ask(client, prompt, attempts);

    if (answer === null) {
      unrepairable.push({ ...reject, reason: 'the model did not return a usable object' });
    } else if (Object.keys(answer).length === 0) {
      unrepairable.push({ ...reject, reason: 'the model could not repair the row' });
    } else {
      // The answer is only a proposal. It goes through the same coercion every
      // other row went through, and it is refused on the same terms.
      const fields = header.map((name) => String(answer[name] ?? ''));
      try {
        rows.push(coerceRow(header, fields, schema));
      } catch (refusal) {
        if (!(refusal instanceof Rejected)) throw refusal;
        unrepairable.push({
          ...reject,
          column: refusal.column,
          reason: `the repair was refused too: ${refusal.reason}`,
        });
      }
    }
  }
  return { rows, unrepairable };
}

/**
 * Return the decoded object, or null when nothing usable came back.
 *
 * A failed call is retried; an unusable answer is not. At temperature zero the
 * same prompt gives the same answer, so asking a second time buys nothing but
 * a second bill.
 */
async function ask(client, prompt, attempts) {
  for (let i = 0; i < attempts; i += 1) {
    let answer;
    try {
      answer = await client.complete({ prompt, temperature: 0 });
    } catch {
      continue; // any provider failure is worth one more try
    }
    try {
      const parsed = JSON.parse(answer);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}
