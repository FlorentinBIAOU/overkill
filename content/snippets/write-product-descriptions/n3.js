/**
 * Write a product description by asking a general-purpose model.
 *
 * Rung N3. On most entries of this site this rung is the expensive answer to a
 * question that did not need it. Here it is the one that wins: turning a bag
 * of attributes into prose that reads differently for every product is
 * precisely what a general-purpose model does better than anything below it,
 * and no amount of template writing closes that gap.
 *
 * What it costs is visible in the code, and none of it is the model's doing:
 * the request, the size cap, the retry, an answer that is only probably JSON,
 * and a temperature above zero — because variety is the thing being bought
 * here, so two runs on the same product will not agree, and nothing can be
 * reviewed once and trusted afterwards.
 *
 * Which is why the last check is the one from the rung below. A model that
 * writes freely also claims freely. The copy is read back against the record,
 * term by term, and anything the record does not support is refused rather
 * than published.
 */

// The instructions are written in the language of the shop: a model asked in
// English for French copy answers in French with an English cadence.
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
  if (!client) {
    // Needs a key and a network, so it is never reached in the tests.
    const { OpenAI } = await import('openai');
    client = new OpenAI();
  }

  const attributes = attributeLines(product);
  if (attributes.length > MAX_CHARACTERS) {
    throw new RangeError(`product record longer than ${MAX_CHARACTERS} characters`);
  }

  const description = await ask(client, `${PROMPT}\n${attributes}`, attempts, temperature);
  if (description.length < MIN_CHARACTERS) {
    throw new DescriptionUnavailable('the model answered a fragment');
  }

  const invented = vocabulary.filter((term) => says(description, term) && !says(attributes, term));
  if (invented.length > 0) throw new UngroundedDescription(invented.join(', '));
  return description;
}

/** One « field: value » line per attribute, which is what the model reads. */
function attributeLines(product) {
  const lines = [];
  for (const [key, value] of Object.entries(product)) {
    const joined = Array.isArray(value) ? value.join(', ') : String(value);
    if (joined.trim()) lines.push(`- ${key} : ${joined.trim()}`);
  }
  return lines.join('\n');
}

/** Call the provider, decode the answer, and retry what can be retried. */
async function ask(client, prompt, attempts, temperature) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const answer = JSON.parse(await client.complete({ prompt, temperature }));
      const written = answer && typeof answer === 'object' ? (answer.description ?? '') : '';
      if (String(written).trim()) return String(written).split(/\s+/).filter(Boolean).join(' ');
      lastError = new Error('the model answered without a description');
    } catch (error) {
      lastError = error;
    }
  }
  throw new DescriptionUnavailable(String(lastError));
}

/** Whole-word search, case and accents set aside. */
function says(text, term) {
  const escaped = fold(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`).test(fold(text));
}

/** Lowercase and drop accents, so « À vie » meets « a vie ». */
function fold(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}
