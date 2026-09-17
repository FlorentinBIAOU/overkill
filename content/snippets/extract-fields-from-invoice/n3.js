/**
 * Ask a general-purpose multimodal model to read the invoice.
 *
 * Rung N3. The model is sent a picture of the page along with its text, and
 * the picture still holds what the extracted text has lost: the column an
 * amount sits in.
 *
 * Note what the code has to do that N0 did not: cap the size of what it sends,
 * retry on failure, parse an answer that is only probably JSON, and check the
 * shape of what came back. That plumbing is the real cost of this rung, and it
 * is the part your tests have to cover, because the model itself is not
 * testable.
 *
 * One check here is not about shape. The three amounts are asked for, not just
 * the one that is due, so that the sum EN 16931 makes a rule of — total with
 * VAT = total without VAT + VAT — can be recomputed on what the model wrote.
 * It catches nothing the model gets consistently wrong, and it catches a digit
 * read off the wrong line, which is the failure this entry is about.
 */

const PROMPT = [
  'Read the invoice below and return its header fields.',
  'Answer with JSON only: an object with the keys `invoice_number`, `date`,',
  '`total_excluding_vat`, `vat` and `total`. `total` is the amount due, taxes',
  'included, as a number.',
  'Use null for a field the page does not carry.',
  '',
  'Extracted text:',
].join('\n');

// The provider bills every token of the prompt: the text is capped before the
// call, in characters (code points, as in Python), not tokens. An image is
// billed by its dimensions, not its bytes, so its cap only bounds what is
// encoded and uploaded.
export const MAX_CHARACTERS = 8000;
export const MAX_IMAGE_BYTES = 4_000_000;

const FIELDS = ['invoice_number', 'date', 'total_excluding_vat', 'vat', 'total'];
const AMOUNTS = ['total_excluding_vat', 'vat', 'total'];

// The provider named here is an example, not a recommendation: the reasoning
// holds for any general-purpose model API, and the client is swappable. Pass
// any object with a `complete({ prompt, imageUrl, temperature })` method.
export const MODEL = 'gpt-4.1-mini'; // an example id: check the parameters your model accepts

export async function providerClient(sdk, model = MODEL) {
  if (!sdk) {
    const { OpenAI } = await import('openai');
    sdk = new OpenAI();
  }
  return {
    async complete({ prompt, imageUrl, temperature }) {
      const response = await sdk.chat.completions.create({
        model,
        // The page travels inside the message, as a data URL.
        messages: [{ role: 'user', content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageUrl } },
        ] }],
        temperature,
      });
      return response.choices[0].message.content;
    },
  };
}

export class ExtractionUnavailable extends Error {}

/**
 * Read the invoice fields from its text and a picture of the page.
 *
 * @param {string} text the invoice, already extracted
 * @param {Uint8Array} pageImage the rendered page; this snippet opens no file
 * @param {object} options
 * @param {{complete: Function}} [options.client] injected so this can be
 *   tested without a network call; defaults to a real provider client
 * @param {number} [options.attempts]
 */
export async function extractFields(text, pageImage, { client, attempts = 3 } = {}) {
  if (text.length > MAX_CHARACTERS && [...text].length > MAX_CHARACTERS) {
    throw new RangeError(`text longer than ${MAX_CHARACTERS} characters`);
  }
  if (pageImage.length === 0 || pageImage.length > MAX_IMAGE_BYTES) {
    throw new RangeError(`page image empty or larger than ${MAX_IMAGE_BYTES} bytes`);
  }
  client ??= await providerClient();

  const imageUrl = `data:image/png;base64,${Buffer.from(pageImage).toString('base64')}`;
  return decode(await ask(client, text, imageUrl, attempts));
}

async function ask(client, text, imageUrl, attempts) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const answer = await client.complete({
        prompt: `${PROMPT}\n${text}`,
        imageUrl,
        // Temperature zero, because an amount that changes between two
        // identical calls cannot be reconciled with anything.
        temperature: 0,
      });
      if (typeof answer === 'string') return answer;
      lastError = new Error('the model returned no content'); // a refusal: unusable, not empty
    } catch (error) {
      lastError = error;
    }
  }
  throw new ExtractionUnavailable(String(lastError));
}

/**
 * Turn the answer into the three fields, or refuse it.
 *
 * Models like to wrap JSON in a code fence. That is noise, not an error, and
 * stripping it is cheaper than another call.
 */
/**
 * BR-CO-15 recomputed on what the model wrote, or null if it wrote too little.
 *
 * False is not a reason to throw the answer away: it is the one reason the
 * caller has to look at this invoice rather than the other four hundred.
 */
function totalsAgree(fields) {
  const [without, vat, total] = AMOUNTS.map((field) => fields[field]);
  if (without === null || vat === null || total === null) return null;
  return Math.abs(without + vat - total) < 0.005;
}

function decode(answer) {
  const trimmed = answer.trim();
  const fenced = trimmed.startsWith('```') && trimmed.endsWith('```') && trimmed.split('```').length === 3;
  const stripped = fenced ? trimmed.slice(3, -3).replace(/^json/, '') : trimmed;
  let parsed;
  try {
    parsed = JSON.parse(stripped);
  } catch (error) {
    throw new ExtractionUnavailable(`the model did not answer with JSON: ${error.message}`);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ExtractionUnavailable('the model answered something that is not an object');
  }

  const fields = Object.fromEntries(FIELDS.map((field) => [field, parsed[field] ?? null]));
  for (const field of ['invoice_number', 'date']) {
    if (fields[field] !== null && typeof fields[field] !== 'string') {
      throw new ExtractionUnavailable(`the model answered a ${field} that is not text: ${fields[field]}`);
    }
  }
  for (const field of AMOUNTS) {
    // An amount nobody can compute with is worse than none at all: it would
    // travel down the pipeline looking like a number.
    if (fields[field] !== null && (typeof fields[field] !== 'number' || !Number.isFinite(fields[field]))) {
      throw new ExtractionUnavailable(`the model answered a ${field} that is not a number: ${fields[field]}`);
    }
  }
  return { ...fields, totals_agree: totalsAgree(fields) };
}
