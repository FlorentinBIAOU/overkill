/**
 * Reuse the translations you already paid for: a translation memory.
 *
 * Rung N0. No model, no service, no key. A string already in the memory gets
 * its translation back, and the cheapest translation is the one you do not
 * order twice.
 *
 * Three answers, and the difference between them matters more than the code.
 * An exact match ships: the same string, give or take its spacing, invisible
 * format characters and Unicode composition. A close enough string is an
 * approximate match — a word added, a capital or an accent changed — and it is
 * a draft: it comes back with its score and a review flag, never as a finished
 * translation, because "Polish" and "polish" are not the same word. Anything
 * else is new text, which this rung has nothing to say about — see the
 * breaking point in the test.
 *
 * Interpolation variables are checked apart from the score. A translation
 * whose variables do not match the source is a broken interface, however high
 * it scores, so it is flagged even on an exact hit. An ICU plural or select
 * message is checked on its argument name and type, not on the branches inside
 * it.
 *
 * A string longer than MAX_FUZZY_CHARACTERS gets exact matches only: scoring
 * two long texts costs of the order of the product of their lengths, for every
 * entry of the memory.
 */

// The variable forms an interface uses: {{count}} (i18next), {count}, {}, the
// head of an ICU argument such as {count, plural, ...}, %s, %d, %(count)s, the
// numbered %1$s of Android, and the %@, %1$@ and %ld of iOS.
const PLACEHOLDER =
  /\{\{\s*[A-Za-z0-9_.]+\s*\}\}|\{[A-Za-z0-9_]*\}|\{\s*[A-Za-z0-9_]+\s*,\s*[A-Za-z]+|%(?:\([A-Za-z0-9_]+\)|\d+\$)?l{0,2}[sd@]/g;

// Python's str.split() also splits on these; JavaScript's \s does not.
const SPACES = /[\s\x1c-\x1f\x85]+/;

export const MAX_FUZZY_CHARACTERS = 500;

/** The interpolation variables of a string, sorted so order does not count. */
export function placeholders(text) {
  return [...text.matchAll(PLACEHOLDER)].map((m) => m[0]).sort();
}

/** Fold only what cannot change the words: composition, format characters, spacing. */
export function exactKey(text) {
  return text.normalize('NFC').replace(/\p{Cf}/gu, '').split(SPACES).filter(Boolean).join(' ');
}

/** Fold case, accents and spacing for the score. A match on this alone is reviewed. */
export function normalise(text) {
  return exactKey(text).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().split(SPACES).filter(Boolean).join(' ');
}

/**
 * Look a string up in a memory of `source: target` pairs already translated.
 *
 * Returns the status (`exact`, `fuzzy` or `none`), the target when there is
 * one, the score, and whether a human has to look at it.
 */
export function lookup(source, memory, threshold = 0.75) {
  const key = exactKey(source);
  const folded = normalise(source);
  let best = { source: null, target: null, score: 0 };
  for (const [known, target] of Object.entries(memory)) {
    if (exactKey(known) === key) return decide('exact', source, known, target, 1);
    const candidate = normalise(known);
    // Lengths in code points, as in Python.
    if (Math.max([...folded].length, [...candidate].length) > MAX_FUZZY_CHARACTERS) continue;
    const score = ratio(folded, candidate);
    if (score > best.score) best = { source: known, target, score };
  }
  if (best.score >= threshold) return decide('fuzzy', source, best.source, best.target, best.score);
  return { status: 'none', target: null, score: best.score, matched: null, review: false, warnings: [] };
}

/** Assemble the answer, and never let a fuzzy hit pass as a finished one. */
function decide(status, source, matched, target, score) {
  const warnings = [];
  if (String(placeholders(target)) !== String(placeholders(source))) {
    warnings.push('interpolation variables differ from the source string');
  }
  return {
    status, target, score, matched,
    review: status === 'fuzzy' || warnings.length > 0,
    warnings,
  };
}

/**
 * Ratcliff-Obershelp similarity, the algorithm behind Python's
 * difflib.SequenceMatcher.ratio: twice the number of matching characters over
 * the total length. Ported here so both versions of this snippet return the
 * very same score on the very same pair.
 */
export function ratio(a, b) {
  const left = [...a];
  const right = [...b];
  const total = left.length + right.length;
  if (total === 0) return 1;
  return (2 * matchedCount(left, right, 0, left.length, 0, right.length)) / total;
}

/** Longest common block, then the same search left and right of it. */
function matchedCount(a, b, alo, ahi, blo, bhi) {
  let bestI = alo, bestJ = blo, bestSize = 0;
  let lengths = new Map();
  for (let i = alo; i < ahi; i += 1) {
    const next = new Map();
    for (let j = blo; j < bhi; j += 1) {
      if (a[i] !== b[j]) continue;
      const size = (lengths.get(j - 1) ?? 0) + 1;
      next.set(j, size);
      // Strictly greater: the earliest block wins a tie, as in difflib.
      if (size > bestSize) [bestI, bestJ, bestSize] = [i - size + 1, j - size + 1, size];
    }
    lengths = next;
  }
  if (bestSize === 0) return 0;
  return bestSize
    + matchedCount(a, b, alo, bestI, blo, bestJ)
    + matchedCount(a, b, bestI + bestSize, ahi, bestJ + bestSize, bhi);
}
