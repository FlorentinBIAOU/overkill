/**
 * Translate by asking a general-purpose model, with the interface context.
 *
 * Rung N3. What this rung buys over a translation model is the context: a
 * translator model gets a string and nothing else, while a general-purpose
 * model can be told that `Save` is the label of a button and not the verb in
 * a sentence, that the interface is addressed to a customer rather than an
 * administrator, and that there is no room for a full sentence. That is
 * exactly the information a translation team asks for and rarely gets.
 *
 * What it costs is everything around the call: a key, a provider that answers
 * prose when JSON was asked for, retries, a cap on the input, and the same
 * variable check as the rung below, because being asked to keep `{count}`
 * verbatim is not the same as doing it.
 */

const PROMPT = [
  'Translate the user interface string below into {language}.',
  'Where it appears in the interface: {context}',
  'Keep these interpolation variables exactly as written: {variables}',
  'Keep the length of an interface label, not of a sentence.',
  'Answer with JSON only: {"translation": "..."}',
  '',
  'String:',
  '{source}',
].join('\n');

// An interface string that no longer fits on one screen is not an interface
// string. Refusing it here is a cost control, not an optimisation.
export const MAX_CHARACTERS = 2000;

// The variable forms an interface uses: {count}, {}, %s, %d, %(count)s,
// and the numbered variant of %s that Android and iOS string files carry.
const PLACEHOLDER = /\{[A-Za-z0-9_]*\}|%(?:\([A-Za-z0-9_]+\)|\d+\$)?[sd]/g;

export class TranslationUnavailable extends Error {}

/** The interpolation variables, sorted so a moved one still matches. */
export function placeholders(text) {
  return [...text.matchAll(PLACEHOLDER)].map((m) => m[0]).sort();
}

/**
 * Translate one interface string, with what the model needs to know about it.
 *
 * @param {string} source
 * @param {string} language
 * @param {object} options
 * @param {string} [options.context] where the string appears in the interface
 * @param {{complete: Function}} [options.client] injected so this can be
 *   tested without a network call; defaults to a real provider client
 * @param {number} [options.attempts]
 */
export async function translate(source, language, { context = '', client, attempts = 3 } = {}) {
  let provider = client;
  if (!provider) {
    // Needs a key and a network, so it is never reached in the tests.
    const { OpenAI } = await import('openai');
    provider = new OpenAI();
  }
  if (source.length > MAX_CHARACTERS) {
    throw new RangeError(`string longer than ${MAX_CHARACTERS} characters`);
  }

  const variables = placeholders(source);
  const prompt = fill(PROMPT, {
    language,
    context: context || 'not given',
    variables: variables.join(' ') || 'none',
    source,
  });
  const target = await ask(provider, prompt, attempts);

  const warnings = [];
  if (String(placeholders(target)) !== String(variables)) {
    warnings.push('the model did not keep the interpolation variables');
  }
  return { target, review: warnings.length > 0, warnings };
}

/**
 * Fill the prompt fields. The replacer is a function on purpose: a string
 * replacement would give a `$` inside an interface string, such as the one a
 * numbered variable carries, a meaning it does not have.
 */
function fill(template, fields) {
  return Object.entries(fields).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, () => value),
    template,
  );
}

async function ask(client, prompt, attempts) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const answer = await client.complete({
        prompt,
        // Temperature zero: two identical strings must not come back
        // translated two different ways in the same interface.
        temperature: 0,
      });
      const parsed = JSON.parse(answer);
      const target = parsed && typeof parsed === 'object' ? parsed.translation : null;
      if (typeof target === 'string' && target.trim()) return target.trim();
      lastError = new Error('the model answered without a translation');
    } catch (error) {
      lastError = error;
    }
  }
  throw new TranslationUnavailable(String(lastError));
}
