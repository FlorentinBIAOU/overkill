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

/**
 * Return the rows that were repaired, and the ones that were not.
 *
 * `rejects` is the journal returned by `cleanCsv` of rung N0. Nothing else
 * from the file is read: one call per entry of that journal, and up to
 * `attempts` for an entry whose calls fail.
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
  if (rejects.length === 0) return { rows: [], unrepairable: [] };
  client ??= await providerClient();

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
      // The answer is only a proposal. Every column has to come back as text,
      // and the refused value cannot come back empty: coercion would read an
      // empty cell as missing and let the row through.
      const fields = header.map((name) => answer[name]);
      if (!fields.every((value) => typeof value === 'string')) {
        unrepairable.push({ ...reject, reason: 'the answer does not give every column as text' });
        continue;
      }
      if (reject.column && !answer[reject.column].trim()) {
        unrepairable.push({ ...reject, reason: 'the answer empties the refused value' });
        continue;
      }
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
 * A failed call is retried; an unusable answer is not, and its row goes to
 * `unrepairable` for a person to look at.
 */
async function ask(client, prompt, attempts) {
  for (let i = 0; i < attempts; i += 1) {
    let answer;
    try {
      // The lowest temperature: the SDK documents lower values as more
      // focused and deterministic.
      answer = await client.complete({ prompt, temperature: 0 });
    } catch {
      continue; // any provider failure is worth one more try
    }
    if (typeof answer !== 'string') return null; // a refusal comes back as no content
    let text = answer.trim();
    // A JSON answer wrapped whole in one code fence is read; nothing else is.
    if (text.startsWith('```') && text.endsWith('```') && text.split('```').length === 3) {
      text = text.slice(3, -3).replace(/^json/, '');
    }
    try {
      const parsed = JSON.parse(text);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}
