/**
 * Read a product from a page that publishes nothing structured, by asking a model.
 *
 * Rung N3. This is the level for the shop that emits no JSON-LD and whose
 * rendering changes every quarter, where writing selectors means rewriting
 * them. It earns its place there, and nowhere above it: on a page that already
 * carries its JSON-LD, rung N0 reads the same values for nothing.
 *
 * Three things this code does that the model does not, and that are the real
 * work of this rung.
 *
 * It cuts. A shop page is hundreds of kilobytes of markup, almost all of it
 * menus, tracking and styles; the tags come off and what is left is capped.
 * The provider bills what is sent, so the cap is a budget, and the entry on
 * estimating a call's cost is where that budget is computed.
 *
 * It refuses an invented value. Every string the model returns is looked for
 * in the text that was sent: a name, a reference or a price that appears
 * nowhere in the page is dropped, and `invented` says which. This is the one
 * guard that separates a reading from a plausible answer, and it is worth more
 * than the prompt.
 *
 * And it treats a refusal as a refusal. A provider that cannot answer throws;
 * `content` of null is not a value, and it is not handed to the JSON decoder
 * in the hope that the exception will do.
 */

// What the model is asked for, named as schema.org names it so that a caller
// can put an N0 answer and an N3 answer in the same table.
export const FIELDS = ['name', 'sku', 'brand', 'price', 'currency', 'availability'];

// A shop page is markup; this is what is left once the tags are gone. The
// pattern carries no nested quantifier on purpose: the one that reads
// « <(script|style)...>[\s\S]*?</\1> » in a single line is the collapse the N0
// snippet of this entry was written to avoid. The blocks are scanned instead,
// in `withoutScripts`.
const TAGS = /<[^>]+>/g;
const SPACES = /[ \t\r\f\v]*\n\s*|[ \t]{2,}/g;

// The budget in characters of markup, applied before anything reads the page.
// The charte asks that an input too large be refused before the call; a cap
// applied after the cleaning protects nothing, since the cleaning is the part
// that costs.
export const MAX_HTML = 400_000;

// The budget, in characters of text. A page that does not fit is cut, not
// refused: a scraper that throws on a long page returns nothing at all.
export const MAX_CHARACTERS = 6000;

// A single code fence around the whole answer is a common shape, and refusing
// it would buy another call for nothing.
const FENCE = /^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/;

export const MODEL = 'gpt-4.1-mini'; // an example id: check the parameters your model accepts

const PROMPT = [
  'Read this shop page and return the product it is about.',
  `Answer with JSON only, with these keys: ${FIELDS.join(', ')}.`,
  'Copy each value from the page. Use null for anything the page does not say.',
  '',
  'Page:',
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
 * The markup with every script and style block removed, scanned rather than
 * matched — the same walk as `blocks` in the N0 snippet, and for the same
 * reason. An unclosed block swallows the rest of the page, which is what a
 * browser does too.
 */
function withoutScripts(html) {
  const lower = html.toLowerCase();
  const kept = [];
  let cursor = 0;
  while (cursor < html.length) {
    const starts = [lower.indexOf('<script', cursor), lower.indexOf('<style', cursor)]
      .filter((i) => i >= 0);
    if (starts.length === 0) { kept.push(html.slice(cursor)); break; }
    const start = Math.min(...starts);
    kept.push(html.slice(cursor, start));
    const tag = lower.startsWith('<script', start) ? 'script' : 'style';
    const closing = lower.indexOf(`</${tag}`, start);
    if (closing < 0) break;
    cursor = closing;
  }
  return kept.join('');
}

/** The page without its markup, collapsed, and cut to the budget. */
export function toText(html) {
  return withoutScripts(html.slice(0, MAX_HTML))
    .replace(TAGS, ' ').replace(SPACES, '\n').trim().slice(0, MAX_CHARACTERS);
}

/**
 * The product a model reads on this page, with what it made up removed.
 *
 * @param {string} html
 * @param {{client?: {complete: Function}, attempts?: number}} [options]
 */
export async function readProduct(html, { client, attempts = 3 } = {}) {
  client ??= await providerClient();
  const page = toText(html);
  const answer = await ask(client, page, attempts);

  const product = {};
  const invented = [];
  const haystack = page.toLowerCase();
  for (const field of FIELDS) {
    const value = answer && typeof answer === 'object' ? answer[field] : null;
    if (value === null || value === undefined) {
      product[field] = null;
    } else if (haystack.includes(String(value).trim().toLowerCase())) {
      product[field] = String(value).trim();
    } else {
      // The model wrote something the page does not contain. It is not a
      // reading, so it is not kept — and the caller is told.
      product[field] = null;
      invented.push(field);
    }
  }
  return { source: 'model', product, invented, characters_sent: page.length };
}

async function ask(client, page, attempts) {
  const prompt = `${PROMPT}\n${page}`;
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
