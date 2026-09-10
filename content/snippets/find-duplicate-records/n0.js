/**
 * Find duplicate records: normalise, block, then compare inside a block only.
 *
 * Rung N0. Deterministic, no dependency, and the only rung here that stays
 * fast when the file grows, because it never compares every pair.
 *
 * Two things make this work.
 *
 * First, normalisation removes what a human ignores when reading a name:
 * case, accents, punctuation, double spaces. Two spellings that only differ
 * by those become the same string, and cost nothing to detect.
 *
 * Second, blocking. Comparing every pair of ten thousand records is fifty
 * million comparisons. Grouping them by a cheap key first, and comparing only
 * inside a group, turns that into a few thousand. The whole cost of the rung
 * is in the key you pick, and so is its blind spot.
 */

/** Lower case, strip accents and punctuation, collapse spaces. */
export function normalise(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** One comparable string per record. */
export function recordText(record) {
  return normalise(Object.values(record).join(' '));
}

/**
 * Two records that do not share this key are never compared.
 *
 * Three letters of the family name and the postcode: short enough to group
 * real duplicates together, specific enough to keep the groups small.
 */
export function blockingKey(record) {
  const words = normalise(record.name).split(' ').filter(Boolean);
  const familyName = words.at(-1) ?? '';
  return `${familyName.slice(0, 3)}:${normalise(record.postcode)}`;
}

/** Levenshtein distance, two rows at a time rather than a full matrix. */
export function editDistance(a, b) {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current.push(Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost));
    }
    previous = current;
  }
  return previous.at(-1);
}

/** 1.0 for identical strings, 0.0 for strings sharing nothing. */
export function similarity(a, b) {
  const longest = Math.max(a.length, b.length);
  return longest === 0 ? 1 : 1 - editDistance(a, b) / longest;
}

/**
 * Return the pairs `[i, j, score]` that look like the same record.
 *
 * The threshold is yours to set: towards 1.0 if merging two different
 * customers is the worse outcome, towards 0.0 if missing a duplicate is.
 */
export function findDuplicates(records, threshold = 0.85) {
  const blocks = new Map();
  records.forEach((record, index) => {
    const key = blockingKey(record);
    if (!blocks.has(key)) blocks.set(key, []);
    blocks.get(key).push(index);
  });

  const pairs = [];
  for (const indexes of blocks.values()) {
    for (let a = 0; a < indexes.length; a += 1) {
      for (let b = a + 1; b < indexes.length; b += 1) {
        const [i, j] = [indexes[a], indexes[b]];
        const score = similarity(recordText(records[i]), recordText(records[j]));
        if (score >= threshold) pairs.push([i, j, Math.round(score * 1000) / 1000]);
      }
    }
  }
  return pairs.sort((x, y) => y[2] - x[2] || x[0] - y[0] || x[1] - y[1]);
}
