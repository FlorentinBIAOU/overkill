/**
 * Translate by asking a general-purpose model, with the interface context.
 *
 * Rung N3. What this rung buys over a translation model is the context: a
 * translator model gets a string and nothing else, while a general-purpose
 * model can be told that `Save` is the label of a button and not the verb in
 * a sentence, that the interface is addressed to a customer rather than an
 * administrator, and that there is no room for a full sentence.
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
// string. Refusing it here, and a context as long, is a cost control.
export const MAX_CHARACTERS = 2000;

// The variable forms an interface uses: {{count}} (i18next), {count}, {}, the
// head of an ICU argument such as {count, plural, ...}, %s, %d, %(count)s, the
// numbered %1$s of Android, and the %@, %1$@ and %ld of iOS.
const PLACEHOLDER =
  /\{\{\s*[A-Za-z0-9_.]+\s*\}\}|\{[A-Za-z0-9_]*\}|\{\s*[A-Za-z0-9_]+\s*,\s*[A-Za-z]+|%(?:\([A-Za-z0-9_]+\)|\d+\$)?l{0,2}[sd@]/g;

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
  // Characters are counted as code points, as in Python: an emoji is one.
  if ([...source].length > MAX_CHARACTERS || [...context].length > MAX_CHARACTERS) {
    throw new RangeError(`string or context longer than ${MAX_CHARACTERS} characters`);
  }
  // Nothing to translate is not worth a call.
  if (source.trim() === '') return { target: source, review: false, warnings: [] };
  client ??= await providerClient();

  const variables = placeholders(source);
  const prompt = fill(PROMPT, {
    language,
    context: context || 'not given',
    variables: variables.join(' ') || 'none',
    source,
  });
  const target = await ask(client, prompt, attempts);

  const warnings = [];
  if (String(placeholders(target)) !== String(variables)) {
    warnings.push('the model did not keep the interpolation variables');
  }
  if (variables.some((variable) => variable.includes(','))) {
    warnings.push('ICU message: check its branches by hand');
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
        // The lowest temperature: the SDK documents lower values as more
        // focused and deterministic.
        temperature: 0,
      });
      if (typeof answer !== 'string') {
        // A refusal comes back as no content.
        lastError = new Error('the model answered no text');
        continue;
      }
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
