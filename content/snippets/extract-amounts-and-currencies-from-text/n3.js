/**
 * Read the amounts of a document whose currency is written once, in a heading.
 *
 * Rung N3. It exists for the case rung N0 reports and cannot settle: a table
 * whose column is headed « Montant (en euros) », a contract that says once that
 * all sums are in euros, and then three pages of numbers with nothing beside
 * them. No mark touches those numbers, and attaching the heading to them is a
 * question about the layout, not about the digits.
 *
 * The guard keeps the reading verifiable, and it is worth more than the
 * prompt. The model is asked for spans, not values: each amount it returns
 * must appear in the document, character for character, and the currency it
 * gives must be named somewhere in the document. What survives is then read by
 * the same function as rung N0 — the arithmetic stays where it can be tested,
 * and the model never hands back a number nobody wrote.
 *
 * Two operating conditions. The document is cut to a budget, so a contract
 * longer than the budget is read up to it and no further. And the cost is a
 * call per document: this rung is for the documents rung N0 reports numbers it
 * could not mark, not for a mailbox of invoices that carry their symbol.
 */

import { CODES, MARK, codesOf, readNumber } from './n0.js';

// The budget, in characters. A document that does not fit is cut, not refused.
export const MAX_CHARACTERS = 6000;

// A single code fence around the whole answer is a common shape, and refusing
// it would buy another call for nothing.
const FENCE = /^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/;

export const MODEL = 'gpt-4.1-mini'; // an example id: check the parameters your model accepts

const PROMPT = [
  'Read this document and list the sums of money it quotes.',
  'Answer with JSON only: {"amounts": [{"text": "…", "currency": "…"}]}.',
  'Copy `text` from the document, character for character, and give `currency`'
  + ' as an ISO 4217 code.',
  '',
  'Document:',
].join('\n');

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

export class ReadingUnavailable extends Error {}

/**
 * The amounts a model finds, kept only where the document backs them.
 *
 * @param {string} text
 * @param {'fr'|'en'} convention
 * @param {{client?: {complete: Function}, attempts?: number}} [options]
 */
export async function readAmounts(text, convention, { client, attempts = 3 } = {}) {
  client ??= await providerClient();
  const document = text.slice(0, MAX_CHARACTERS);
  const answer = await ask(client, document, attempts);
  const named = new Set([...document.matchAll(MARK)].flatMap((m) => codesOf(m[0])));

  const amounts = [];
  const dropped = [];
  const asked = answer && typeof answer === 'object' ? answer.amounts ?? [] : [];
  for (const item of Array.isArray(asked) ? asked : []) {
    const written = item && typeof item === 'object' ? String(item.text ?? '') : '';
    const currency = item && typeof item === 'object'
      ? String(item.currency ?? '').toUpperCase() : '';
    const value = written ? readNumber(written, convention)[0] : null;
    if (!written || !document.includes(written)) {
      dropped.push({ text: written, why: 'not in the document' });
    } else if (!CODES.includes(currency)) {
      dropped.push({ text: written, why: `${currency} is not a code this rung knows` });
    } else if (!named.has(currency)) {
      dropped.push({ text: written, why: `${currency} is named nowhere in the document` });
    } else if (value === null) {
      dropped.push({ text: written, why: 'not a number this rung can read' });
    } else {
      amounts.push({ text: written, value, currency, start: document.indexOf(written) });
    }
  }
  return { source: 'model', amounts, dropped, characters_sent: document.length };
}

async function ask(client, document, attempts) {
  const prompt = `${PROMPT}\n${document}`;
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const answer = await client.complete({ prompt, temperature: 0 });
      if (typeof answer !== 'string') {
        lastError = new Error('the model answered no text'); // a refusal has no content
        continue;
      }
      const fenced = FENCE.exec(answer);
      return JSON.parse(fenced ? fenced[1] : answer);
    } catch (error) {
      lastError = error;
    }
  }
  throw new ReadingUnavailable(String(lastError));
}
