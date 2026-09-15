/**
 * Extract dates by asking a general-purpose model.
 *
 * Rung N3. It is the only rung on this entry whose request asks for relative
 * dates, "jeudi prochain", to be resolved: it sends today's date along with the
 * text, and asks for every date as a calendar day.
 *
 * Note what the code has to do that N0 did not: pass a reference date, because
 * the model is not told what day it is otherwise; cap the input size; retry on
 * failure; parse an answer that is only probably valid JSON; and check the
 * calendar itself, because nothing in the request stops the answer from holding
 * 2024-02-31. That plumbing is the real cost of the rung, and it is the part the
 * tests have to cover, because the model itself is not testable.
 */

const PROMPT = [
  'Find every date mentioned in the text below. Answer with JSON only: a list',
  'of objects with keys `text` and `date`, where `text` is the words as written',
  'and `date` is the day in ISO format, YYYY-MM-DD. Resolve relative dates such',
  'as "next Thursday" against today, which is {today}. If there is no date,',
  'answer with an empty list.', '', 'Text:',
].join('\n');
const ISO_DAY = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;

export const MAX_CHARACTERS = 8000;

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

export class ExtractionUnavailable extends Error {}

/** The calendar check of N0, applied to the model's answer this time. */
function parseIsoDay(value) {
  const [year, month, day] = ISO_DAY.exec(value).slice(1).map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day); // unlike Date.UTC, keeps year 24 as 24
  const real = year >= 1 && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return real ? date : null;
}

/** The caller's own calendar day, not the UTC one: past midnight in Paris, UTC is still yesterday. */
function localDay(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${String(date.getFullYear()).padStart(4, '0')}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Return every date the model reports, as { text: what was written, date }.
 *
 * @param {string} text
 * @param {object} options
 * @param {{complete: Function}} [options.client] injected so this can be
 *   tested without a network call; defaults to a real provider client
 * @param {Date} [options.today] the day relative dates are resolved against,
 *   read in the local time zone
 * @param {number} [options.attempts]
 */
export async function extractDates(text, { client, today = new Date(), attempts = 3 } = {}) {
  // The provider bills every token of the prompt. Refusing oversized input
  // before the call is a cost control; the cap counts characters, not tokens,
  // and code points, as Python does, not UTF-16 units.
  if (text.length > MAX_CHARACTERS && [...text].length > MAX_CHARACTERS) throw new RangeError(`text longer than ${MAX_CHARACTERS} characters`);
  if (!text.trim()) return []; // nothing to read, so nothing to pay for
  client ??= await providerClient();

  const items = await ask(client, text, localDay(today), attempts);
  // A day that does not exist is not a date, however fluent the answer.
  return items.map((item) => ({ text: typeof item.text === 'string' ? item.text : '', date: parseIsoDay(item.date) }))
    .filter((item) => item.date);
}

/** A list of objects, each with a `date` written YYYY-MM-DD, as the prompt asked. */
function isUsable(parsed) {
  return Array.isArray(parsed) && parsed.every((item) =>
    item !== null && typeof item === 'object' && typeof item.date === 'string' && ISO_DAY.test(item.date));
}

async function ask(client, text, today, attempts) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      // Temperature zero: a date that changes between two identical calls
      // cannot be reviewed.
      const prompt = `${PROMPT.replace('{today}', today)}\n${text}`;
      const answer = await client.complete({ prompt, temperature: 0 });
      if (answer === null || answer === undefined) { // a refusal carries no content: unusable, not empty
        lastError = new Error('the model returned no content');
        continue;
      }
      const parsed = JSON.parse(answer);
      if (isUsable(parsed)) return parsed;
      // A list of anything else would read as "no date found", which it is not.
      lastError = new Error('the model answered something other than a list of ISO days');
    } catch (error) {
      lastError = error;
    }
  }
  throw new ExtractionUnavailable(String(lastError));
}
