/**
 * Find duplicate records with a self-hosted sentence encoder.
 *
 * Rung N2. N1 compares spellings; two records that say the same thing in
 * different words share no character n-grams and stay invisible. A sentence
 * encoder maps each record to a dense vector, the mean of the vectors of its
 * tokens, and records are compared on those vectors rather than on shared
 * letters.
 *
 * What this rung really costs is not the comparison, it is the deployment:
 * weights to download and load, and a process to keep warm.
 *
 * The encoder is a parameter with a real default, so the reader sees the
 * loading code while the test injects a local double.
 */

// A multilingual model, because a customer file is rarely in one language.
export const MODEL_NAME = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';

export class EncodingFailed extends Error {}

/** Lower case, strip accents, invisible characters and punctuation, collapse spaces. */
export function normalise(text) {
  // A zero-width space is a format character: dropped, it does not split a word.
  return String(text ?? '').toLowerCase().normalize('NFKD').replace(/\p{Cf}/gu, '')
    .replace(/\p{Diacritic}/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/** One comparable string per record; an empty cell adds nothing. */
export function recordText(record) {
  return normalise(Object.values(record).join(' '));
}

/** Normalise once, so that a cosine is a dot product afterwards. */
export function unit(vector) {
  const norm = Math.hypot(...vector);
  return norm ? vector.map((v) => v / norm) : [...vector];
}

/**
 * Return the pairs `[i, j, score]` that look like the same record.
 *
 * @param {object[]} records
 * @param {object} options
 * @param {{encode: Function}} [options.encoder] injected so this can be
 *   tested without downloading a model; defaults to a real local encoder
 * @param {number} [options.threshold]
 */
export async function findDuplicates(records, { encoder, threshold = 0.75 } = {}) {
  const texts = records.map(recordText);
  if (texts.length < 2) return [];

  if (!encoder) {
    // Downloads and loads the weights, so it is never reached in the tests.
    const { pipeline } = await import('@huggingface/transformers');
    const extract = await pipeline('feature-extraction', MODEL_NAME);
    encoder = { encode: async (batch) => (await extract(batch, { pooling: 'mean' })).tolist() };
  }

  // One batched call. Encoding record by record wastes most of the machine.
  let vectors;
  try {
    vectors = (await encoder.encode(texts)).map(unit);
  } catch (error) {
    throw new EncodingFailed(String(error));
  }
  if (vectors.length !== texts.length) {
    throw new EncodingFailed(`${vectors.length} vectors returned for ${texts.length} records`);
  }
  if (new Set(vectors.map((v) => v.length)).size !== 1 || !vectors.every((v) => v.every(Number.isFinite))) {
    throw new EncodingFailed('vectors of different sizes, or holding something other than numbers');
  }

  const pairs = [];
  for (let i = 0; i < vectors.length; i += 1) {
    for (let j = i + 1; j < vectors.length; j += 1) {
      const score = vectors[i].reduce((sum, value, d) => sum + value * vectors[j][d], 0);
      // A hair of tolerance: in floating point, two identical records can score just under 1.0.
      if (score >= threshold - 1e-9) pairs.push([i, j, Math.round(score * 1000) / 1000]);
    }
  }
  return pairs.sort((a, b) => b[2] - a[2] || a[0] - b[0] || a[1] - b[1]);
}
