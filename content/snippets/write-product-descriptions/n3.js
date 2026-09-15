/**
 * Write a product description by asking a general-purpose model.
 *
 * Rung N3. On most entries of this site this rung is the expensive answer to a
 * question that did not need it. Here it is the one that wins: the template of
 * rung N0 draws every sentence from a list written in advance, and its test
 * counts the frames that repeat, while this rung asks for new prose on every
 * call.
 *
 * What it costs is visible in the code, and none of it is the model's doing:
 * the request, the size cap, the retry, an answer that is only probably JSON,
 * and a temperature above zero — variety is the thing being bought here, and
 * the SDK documents higher temperatures as making the output more random, so
 * nothing can be reviewed once and trusted afterwards.
 *
 * Which is why the last check is the one from the rung below. A model that
 * writes freely also claims freely. The copy is read back against the record,
 * term by term, and anything the record does not support is refused rather
 * than published.
 */

// The instructions are written in the language of the shop, like the copy.
const PROMPT = [
  "Tu rédiges la présentation d'un article pour une boutique en ligne.",
  'Écris deux phrases en français, sans superlatif, et n\'affirme rien qui ne',
  'figure pas dans les caractéristiques ci-dessous.',
  'Réponds par un objet JSON et rien d\'autre : {"description": "…"}.',
  '',
  'Caractéristiques :',
].join('\n');

// A model charges by the token. Refusing an oversized record is not an
// optimisation, it is a cost control.
export const MAX_CHARACTERS = 600;

// Shorter than that, the model answered a fragment and not a description.
export const MIN_CHARACTERS = 40;

export class DescriptionUnavailable extends Error {}

export class UngroundedDescription extends DescriptionUnavailable {}

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
 * Write the description of one product.
 *
 * `client` is injected so this can be tested without a network call; in
 * production it defaults to a real provider client.
 *
 * `vocabulary` is the attribute words your catalogue uses — materials,
 * finishes, features, claims. A word of that list found in the copy and
 * nowhere in the record is an invention, and refused. An empty vocabulary
 * switches the check off, which is a decision, not a default to leave alone.
 *
 * @param {Record<string, string|string[]>} product
 * @param {{complete: Function}} [client]
 * @param {{vocabulary?: string[], attempts?: number, temperature?: number}} [options]
 */
export async function describe(
  product,
  client,
  { vocabulary = [], attempts = 3, temperature = 0.7 } = {},
) {
  const attributes = attributeLines(product);
  if (attributes === '') throw new RangeError('empty product record: nothing to describe');
  // Characters are counted as code points, as in Python: an emoji is one.
  if ([...attributes].length > MAX_CHARACTERS) {
    throw new RangeError(`product record longer than ${MAX_CHARACTERS} characters`);
  }
  client ??= await providerClient();

  const description = await ask(client, `${PROMPT}\n${attributes}`, attempts, temperature);
  if (description.length < MIN_CHARACTERS) {
    throw new DescriptionUnavailable('the model answered a fragment');
  }

  const invented = vocabulary.filter((term) => states(description, term) && !states(attributes, term));
  if (invented.length > 0) throw new UngroundedDescription(invented.join(', '));
  return description;
}

/** One « field: value » line per attribute, which is what the model reads. */
function attributeLines(product) {
  const lines = [];
  for (const [key, value] of Object.entries(product)) {
    const items = (Array.isArray(value) ? value : [value]).filter((item) => item != null); // null: a NULL column
    const joined = items.map(String).join(', ');
    if (joined.trim()) lines.push(`- ${key} : ${joined.trim()}`);
  }
  return lines.join('\n');
}

/** Call the provider, decode the answer, and retry what can be retried. */
async function ask(client, prompt, attempts, temperature) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const answer = decode(await client.complete({ prompt, temperature }));
      const written = answer && typeof answer === 'object' ? answer.description : null;
      if (typeof written === 'string' && written.trim()) return written.split(/\s+/).filter(Boolean).join(' ');
      lastError = new Error('the model answered without a description');
    } catch (error) {
      lastError = error;
    }
  }
  throw new DescriptionUnavailable(String(lastError));
}

/** JSON, or JSON wrapped whole in one code fence. No text (a refusal) is unusable. */
function decode(answer) {
  if (typeof answer !== 'string') throw new Error('the model returned no text');
  let text = answer.trim();
  if (text.startsWith('```') && text.endsWith('```') && text.split('```').length === 3) {
    text = text.slice(3, -3).replace(/^json/, '');
  }
  return JSON.parse(text);
}

// A term right after one of these words is denied, not stated: « non étanche ».
const NEGATIONS = new Set(['non', 'pas', 'sans', 'ni', 'aucun', 'aucune']);

/**
 * Whether the text states the term: whole words, case and accents set aside,
 * each word allowed the agreement endings e, s and es (« garantie à vie »
 * states « garanti à vie »), and not right after a negation.
 */
function states(text, term) {
  const folded = fold(text);
  const words = fold(term).split(/\s+/).filter(Boolean)
    .map((word) => `${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:e|s|es)?`);
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}_])${words.join('\\s+')}(?![\\p{L}\\p{N}_])`, 'gu');
  for (const found of folded.matchAll(pattern)) {
    const before = folded.slice(0, found.index).match(/[\p{L}\p{N}_]+/gu) ?? [];
    if (!NEGATIONS.has(before.at(-1))) return true;
  }
  return false;
}

/** Lowercase and drop accents, so « À vie » meets « a vie ». */
function fold(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}
