/**
 * Detect the language with a dedicated identifier, self-hosted.
 *
 * Rung N2. N0 and N1 only know the languages you handed them a sample of.
 * CLD3, Google's Compact Language Detector, is a small neural network covering
 * a hundred-odd languages, shipped with its model inside the package: nothing
 * to sample, nothing to train, no key, no download, and no text leaving your
 * machine. `cld3-asm` in JavaScript, `gcld3` in Python, the same model
 * underneath.
 *
 * What you own on this rung is not the model. It is three things.
 *
 * The mapping from its codes to yours: CLD3 answers in BCP-47 style, and tells
 * Latin-script Hindi from Devanagari Hindi with "hi-Latn". A caller expecting
 * "hi" gets a code it has never seen.
 *
 * The refusal, and the byte floor it rests on. Below `minBytes` the library
 * answers "und" instead of guessing, and that floor — 140 bytes by default —
 * is the thing N0 and N1 do not have: it is the two-word message, the subject
 * line, the search box, refused by the library itself. Above the floor,
 * `is_reliable` and `probability` are two more handles, and this snippet turns
 * all three into null.
 *
 * And the loading. The WebAssembly module is compiled when the identifier is
 * built, and the identifier holds memory the garbage collector does not manage
 * — the library asks you to `dispose()` it. Build one, keep it, do not build
 * one per message.
 */

// The library's own defaults, read from its header: below 140 bytes it returns
// "und", and it predicts on the first 700 bytes of what it is given. Lower the
// floor and you get an answer on a two-word message; you also get the guess
// this whole entry is about.
export const MIN_BYTES = 140;
export const MAX_BYTES = 700;

// Below this probability the answer is not used. CLD3 also carries its own
// `is_reliable`, computed from the text it saw; both have to agree.
export const THRESHOLD = 0.7;

export class IdentificationUnavailable extends Error {}

/** The real identifier, and the whole surface of the library this needs. */
export async function cld3Identifier({ minBytes = MIN_BYTES, maxBytes = MAX_BYTES, load } = {}) {
  // A local install, model included, no network and no key.
  const { loadModule } = await (load ? load() : import('cld3-asm'));
  const factory = await loadModule();
  const identifier = factory.create(minBytes, maxBytes);
  return {
    /** One answer: the code, how sure the model is, and its own verdict on that. */
    find(text) {
      const found = identifier.findLanguage(text);
      return {
        language: found.language,
        probability: Number(found.probability),
        is_reliable: Boolean(found.is_reliable),
      };
    },
  };
}

let loaded;

/** The default identifier, built on first use and kept. */
export function loadedIdentifier(options) {
  loaded ??= cld3Identifier(options).catch((error) => {
    loaded = undefined; // a failed load is not a cached answer
    throw error;
  });
  return loaded;
}

/**
 * Return the language code, or null when nothing can be said.
 *
 * Null on four counts, and they are not the same thing said four times: an
 * empty text, the code CLD3 uses for "undetermined" — which is also what it
 * answers on a text below the byte floor —, its own `is_reliable` set to
 * false, and a probability below the threshold. Returning a language in any of
 * those cases would hand the caller a guess wearing the clothes of a fact,
 * which is the failure this whole entry is about.
 *
 * `identifier` is injected so this can be tested without installing the
 * library. In production it defaults to the real one above.
 */
export async function detect(text, { identifier, threshold = THRESHOLD } = {}) {
  if (!text.trim()) return null;
  const engine = identifier ?? (await loadedIdentifier());
  let found;
  try {
    found = await engine.find(text);
  } catch (error) {
    throw new IdentificationUnavailable(String(error));
  }
  if (!found || typeof found.language !== 'string') {
    throw new IdentificationUnavailable('the identifier returned no language');
  }
  if (found.language === 'und' || !found.is_reliable) return null;
  return Number(found.probability) >= threshold ? found.language : null;
}
