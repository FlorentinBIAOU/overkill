/**
 * Extract dates by asking a general-purpose model.
 *
 * Rung N3. This is the option people reach for first, and it is the only one
 * on this entry that reads "jeudi prochain". That is a real capability, and it
 * is why the rung is here.
 *
 * Note what the code has to do that N0 did not: pass a reference date, because
 * the model has no idea what day it is; cap the input size; retry on failure;
 * parse an answer that is only probably valid JSON; and check the calendar
 * itself, because a model will answer 2024-02-31 in flawless JSON without
 * blinking. That plumbing is the real cost of the rung, and it is the part the
 * tests have to cover, because the model itself is not testable.
 */

const PROMPT = [
  'Find every date mentioned in the text below. Answer with JSON only: a list',
  'of objects with keys `text` and `date`, where `text` is the words as written',
  'and `date` is the day in ISO format, YYYY-MM-DD. Resolve relative dates such',
  'as "next Thursday" against today, which is {today}. If there is no date,',
  'answer with an empty list.', '', 'Text:',
].join('\n');

export const MAX_CHARACTERS = 8000;

export class ExtractionUnavailable extends Error {}

/** The calendar check of N0, applied to the model's answer this time. */
function parseIsoDay(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
}

/**
 * Return every date the model reports, as { text: what was written, date }.
 *
 * @param {string} text
 * @param {object} options
 * @param {{complete: Function}} [options.client] injected so this can be
 *   tested without a network call; defaults to a real provider client
 * @param {Date} [options.today] the day relative dates are resolved against
 * @param {number} [options.attempts]
 */
export async function extractDates(text, { client, today = new Date(), attempts = 3 } = {}) {
  if (!client) {
    // Needs a key and a network, so it is never reached in the tests.
    const { OpenAI } = await import('openai');
    client = new OpenAI();
  }

  // A model charges by the token. Refusing oversized input is not an
  // optimisation, it is a cost control.
  if (text.length > MAX_CHARACTERS) throw new RangeError(`text longer than ${MAX_CHARACTERS} characters`);

  const items = await ask(client, text, today, attempts);
  // A day that does not exist is not a date, however fluent the answer.
  return items.map((item) => ({ text: item?.text ?? '', date: parseIsoDay(item?.date) }))
    .filter((item) => item.date);
}

async function ask(client, text, today, attempts) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      // Temperature zero: a date that changes between two identical calls
      // cannot be reviewed.
      const prompt = `${PROMPT.replace('{today}', today.toISOString().slice(0, 10))}\n${text}`;
      const answer = await client.complete({ prompt, temperature: 0 });
      const parsed = JSON.parse(answer);
      if (Array.isArray(parsed)) return parsed;
      lastError = new Error('the model answered something that is not a list');
    } catch (error) {
      lastError = error;
    }
  }
  throw new ExtractionUnavailable(String(lastError));
}
