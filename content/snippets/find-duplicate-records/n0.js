/**
 * Find duplicate records: normalise, block on several keys, compare field by
 * field.
 *
 * Rung N0. Deterministic, no dependency. It compares only the records that
 * share at least one blocking key: every pair inside a group, none across
 * groups.
 *
 * Three things make this work.
 *
 * First, normalisation removes what a human ignores when reading a name:
 * case, accents, punctuation, double spaces. Two spellings that only differ
 * by those become the same string, and cost nothing to detect.
 *
 * Second, blocking. Comparing every pair of ten thousand records is fifty
 * million comparisons. Grouping them by a cheap key first, and comparing only
 * inside a group, leaves the pairs of each group: few when the groups are
 * small, all of them when every record lands in the same group. A key that
 * misses a duplicate is answered with a second key, not with the removal of
 * the key: the pairs of several keys are unioned, and the cost stays the sum
 * of small groups.
 *
 * Third, comparison field by field, each field weighed. Two sources rarely
 * fill the same columns: one holds a phone number, the other does not. A field
 * only one of the two carries is not a difference, and a record compared as one
 * long string would count that silence as one — and would give the same weight
 * to a town shared by two million people as to an email address.
 */

// Fields compared for equality rather than by edit distance. Two different
// addresses at the same domain share most of their characters, and an edit
// distance would call them close; so would two postcodes of the same town.
export const IDENTIFYING = new Set(['email', 'phone', 'postcode', 'siret', 'siren', 'vat']);

// How much agreement on a field is worth. Agreeing on a town says almost
// nothing — thousands of people live in it — while agreeing on an email
// address says nearly everything. This is the crude end of the Fellegi-Sunter
// model, where the weight of a field comes from how often two unrelated
// records agree on it; here the numbers are declared rather than estimated,
// and they are yours to change for your file.
export const WEIGHTS = {
  email: 3, phone: 3, siret: 3, name: 3, postcode: 1, city: 0.3, country: 0.1,
};
export const DEFAULT_WEIGHT = 1;

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
 * text whatever order their columns come in. An empty cell adds nothing.
 */
export function recordText(record) {
  const keys = Object.keys(record).sort();
  return normalise(keys.filter((key) => record[key] !== null && record[key] !== undefined)
    .map((key) => String(record[key])).join(' '));
}

/**
 * Three letters of the family name and the postcode.
 *
 * Short enough to group real duplicates together, specific enough to keep the
 * groups small. A record missing either half produces no key, and is then
 * grouped by the other keys or not at all.
 */
export function blockingKey(record) {
  const words = normalise(record.name).split(' ').filter(Boolean);
  const familyName = words.at(-1) ?? '';
  const postcode = normalise(record.postcode).replace(/ /g, '');
  return familyName && postcode ? `${familyName.slice(0, 3)}:${postcode}` : '';
}

/**
 * A blocking key made of one identifying field: an email, a phone number.
 *
 * This is the second rule that answers a first one which missed: a mistyped
 * postcode breaks `blockingKey`, and the pair still comes back through the
 * email the two records share.
 */
export function fieldKey(field) {
  return (record) => {
    const value = normalise(record[field]).replace(/ /g, '');
    return value ? `${field}:${value}` : '';
  };
}

export const DEFAULT_KEYS = [blockingKey, fieldKey('email'), fieldKey('phone')];

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

/** Equal once the spaces are out, or not equal at all. */
function equal(a, b) {
  return a.replace(/ /g, '') === b.replace(/ /g, '') ? 1 : 0;
}

/**
 * Score two records on the fields both of them fill, and only those.
 *
 * A weighted mean of the per-field scores. Two things matter here, and
 * comparing the whole record as one string gets both wrong: a field only one of
 * the two carries is skipped rather than counted as a difference, and a field
 * everybody shares counts for little.
 *
 * Returns null when the two records share no filled field.
 */
export function compareRecords(a, b, weights = WEIGHTS) {
  const shared = Object.keys(a).filter((field) => field in b).sort();
  let total = 0;
  let weighed = 0;
  for (const field of shared) {
    const left = normalise(a[field]);
    const right = normalise(b[field]);
    if (!left || !right) continue;
    const score = IDENTIFYING.has(field) ? equal(left, right) : similarity(left, right);
    const weight = weights[field] ?? DEFAULT_WEIGHT;
    total += weight * score;
    weighed += weight;
  }
  return weighed === 0 ? null : total / weighed;
}

/**
 * Return the pairs `[i, j, score]` that look like the same record.
 *
 * `keys` is the list of blocking rules. A pair that any one of them groups is
 * compared, once: the pairs are unioned, not intersected, so adding a rule can
 * only find more duplicates.
 *
 * `weights` says what agreement on each field is worth; see WEIGHTS.
 *
 * The threshold is yours to set: towards 1.0 if merging two different
 * customers is the worse outcome, towards 0.0 if missing a duplicate is.
 */
export function findDuplicates(records, threshold = 0.85, keys = DEFAULT_KEYS, weights = WEIGHTS) {
  const pairs = [];
  const seen = new Set();
  for (const key of keys) {
    const blocks = new Map();
    records.forEach((record, index) => {
      const group = key(record);
      if (!group) return;
      if (!blocks.has(group)) blocks.set(group, []);
      blocks.get(group).push(index);
    });
    for (const indexes of blocks.values()) {
      for (let a = 0; a < indexes.length; a += 1) {
        for (let b = a + 1; b < indexes.length; b += 1) {
          const [i, j] = [indexes[a], indexes[b]];
          if (seen.has(`${i}:${j}`)) continue;
          seen.add(`${i}:${j}`);
          const score = compareRecords(records[i], records[j], weights);
          if (score !== null && score >= threshold) pairs.push([i, j, Math.round(score * 1000) / 1000]);
        }
      }
    }
  }
  return pairs.sort((x, y) => y[2] - x[2] || x[0] - y[0] || x[1] - y[1]);
}
