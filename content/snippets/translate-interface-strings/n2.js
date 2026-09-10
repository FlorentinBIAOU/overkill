/**
 * Translate with a self-hosted neural model, one pair of languages at a time.
 *
 * Rung N2. This is the rung that actually translates: unlike the memory of
 * N0, it has an answer for a string nobody has ever written before. The price
 * is a model file per language pair to ship, keep in sync and hold in a warm
 * process, and an output nobody can explain.
 *
 * Most of the code below is not about translating. It is about the
 * interpolation variables, and that is the honest picture of this rung. A
 * translation model sees `{count} items selected` as text, so it happily
 * translates the word inside the braces, drops it, or repeats it. The
 * interface then prints a brace where a number should be, and the bug reaches
 * production because the string looked fine to everyone who does not read
 * that language.
 *
 * So the variables are hidden behind neutral markers before the model sees
 * the string, put back afterwards, and counted. Moving a marker is allowed —
 * word order is the model's job. Losing or inventing one is reported, and the
 * caller gets a flagged draft instead of a broken interface.
 */

export const MODEL_NAME = 'Xenova/opus-mt-en-fr';

// The variable forms an interface uses: {count}, {}, %s, %d, %(count)s,
// and the numbered variant of %s that Android and iOS string files carry.
const PLACEHOLDER = /\{[A-Za-z0-9_]*\}|%(?:\([A-Za-z0-9_]+\)|\d+\$)?[sd]/g;

// The stand-in the model sees instead of a variable. Deliberately not a word.
const mark = (index) => `⟦${index}⟧`;

export class TranslationUnavailable extends Error {}

/** The real model: weights on disk, loaded once, run locally. */
export async function loadTranslator(name = MODEL_NAME) {
  const { pipeline } = await import('@xenova/transformers');
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
  const translator = model ?? (await loadTranslator());
  if (source.trim() === '') return { target: source, review: false, warnings: [] };

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
    if (output && output.trim()) return output;
    lastError = new Error('the model returned an empty translation');
  }
  throw new TranslationUnavailable(String(lastError));
}
