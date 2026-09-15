/**
 * Translate with a self-hosted neural model, one pair of languages at a time.
 *
 * Rung N2. This is the rung that translates: unlike the memory of N0, it
 * returns an answer for a string that is in no memory. The price is one model
 * per language pair: this one reads English and writes French.
 *
 * Most of the code below is not about translating. It is about the
 * interpolation variables. A translation model reads `{count}` as text: run
 * against opus-mt-en-fr, `{count} items selected` comes back as
 * `{compte} éléments sélectionnés`, and the interface prints a brace where a
 * number should be.
 *
 * So each variable is swapped for a numbered marker before the model sees the
 * string, put back afterwards, and counted. Moving a marker is allowed — word
 * order is the model's job. Losing or inventing one is reported, and the
 * caller gets a flagged draft instead of a broken interface. An ICU plural or
 * select message always goes to review: its branches hold text to translate
 * next to keywords to keep, and one marker cannot separate the two.
 */

export const MODEL_NAME = 'Xenova/opus-mt-en-fr';

// The variable forms an interface uses: {{count}} (i18next), {count}, {}, the
// head of an ICU argument such as {count, plural, ...}, %s, %d, %(count)s, the
// numbered %1$s of Android, and the %@, %1$@ and %ld of iOS.
const PLACEHOLDER =
  /\{\{\s*[A-Za-z0-9_.]+\s*\}\}|\{[A-Za-z0-9_]*\}|\{\s*[A-Za-z0-9_]+\s*,\s*[A-Za-z]+|%(?:\([A-Za-z0-9_]+\)|\d+\$)?l{0,2}[sd@]/g;

// The stand-in the model sees instead of a variable. Its pieces are in the
// model's vocabulary, so the model can write it back; a marker made of
// characters the vocabulary lacks is dropped. Check again if you change model.
const mark = (index) => `[${index}]`;

export class TranslationUnavailable extends Error {}

/** The real model: weights on disk, loaded once, run locally. */
export async function loadTranslator(name = MODEL_NAME) {
  const { pipeline } = await import('@huggingface/transformers');
  const pipe = await pipeline('translation', name);
  return { generate: async (text) => (await pipe(text))[0].translation_text };
}

/** The interpolation variables, in the order they appear. */
export function placeholders(text) {
  return [...text.matchAll(PLACEHOLDER)].map((m) => m[0]);
}

/**
 * Translate one interface string, and check what came back.
 *
 * @param {string} source
 * @param {object} options
 * @param {{generate: Function}} [options.model] injected so this can be
 *   tested without loading the weights; defaults to the real one above
 * @param {number} [options.attempts]
 */
export async function translate(source, { model, attempts = 2 } = {}) {
  if (source.trim() === '') return { target: source, review: false, warnings: [] };
  const translator = model ?? (await loadTranslator());

  const variables = placeholders(source);
  let masked = source;
  variables.forEach((variable, index) => {
    masked = masked.replace(variable, mark(index));
  });

  let target = (await generate(translator, masked, attempts)).trim();
  variables.forEach((variable, index) => {
    target = target.split(mark(index)).join(variable);
  });

  const warnings = [];
  const found = placeholders(target);
  if (String([...found].sort()) !== String([...variables].sort())) {
    warnings.push(
      `variables differ from the source: expected ${variables.join(' ') || 'none'}` +
        `, got ${found.join(' ') || 'none'}`,
    );
  }
  if (variables.some((variable) => variable.includes(','))) {
    warnings.push('ICU message: check its branches by hand');
  }
  return { target, review: warnings.length > 0, warnings };
}

/** A local model still fails: out of memory, a worker that died, a batch. */
async function generate(model, text, attempts) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    let output;
    try {
      output = await model.generate(text);
    } catch (error) {
      lastError = error;
      continue;
    }
    if (typeof output === 'string' && output.trim()) return output;
    lastError = new Error('the model returned no translation text');
  }
  throw new TranslationUnavailable(String(lastError));
}
