/**
 * Find duplicate records with a self-hosted sentence encoder.
 *
 * Rung N2. N1 compares spellings; two records that say the same thing in
 * different words share no character n-grams and stay invisible. A sentence
 * encoder maps each record to a dense vector, the mean of the vectors of its
 * tokens, and records are compared on those vectors rather than on shared
 * letters.
 *
 * Two prices, and the second is the one that grows. The fixed one is the
 * deployment: weights to download and load, and a process to keep warm. The
 * other is the comparison, and it is quadratic — every pair of the file is
 * scored, a thousand records make half a million dot products of three hundred
 * and eighty-four numbers, ten thousand make fifty million. Past a few tens of
 * thousands of records, block first with the key of rung N0, or reach for an
 * approximate index; this snippet does neither, on purpose, because it shows
 * the distance and not the search.
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

/**
 * One comparable string per record, columns in a stable order.
 *
 * Sorted by column name, so that two exports of the same data give the same
 * text whatever order their columns come in: n-grams taken across a column
 * boundary would otherwise differ. An empty cell adds nothing.
 */
export function recordText(record) {
  const keys = Object.keys(record).sort();
  return normalise(keys.filter((key) => record[key] !== null && record[key] !== undefined)
    .map((key) => String(record[key])).join(' '));
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

  // Every pair, in one flat array rather than an array of arrays: quadratic
  // all the same — one dot product per pair — but without a closure per cell.
  const width = vectors[0].length;
  const flat = new Float64Array(vectors.length * width);
  vectors.forEach((vector, i) => flat.set(vector, i * width));

  const pairs = [];
  for (let i = 0; i < vectors.length; i += 1) {
    for (let j = i + 1; j < vectors.length; j += 1) {
      let score = 0;
      for (let d = 0; d < width; d += 1) score += flat[i * width + d] * flat[j * width + d];
      // A hair of tolerance: in floating point, two identical records can score just under 1.0.
      if (score >= threshold - 1e-9) pairs.push([i, j, Math.round(score * 1000) / 1000]);
    }
  }
  return pairs.sort((a, b) => b[2] - a[2] || a[0] - b[0] || a[1] - b[1]);
}
