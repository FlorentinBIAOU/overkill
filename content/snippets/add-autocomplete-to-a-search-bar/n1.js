/**
 * Reorder the suggestions with what people actually clicked.
 *
 * Rung N1. The prefix tree of N0 ranks candidates by how often a term is
 * searched. That count says what people looked for, not what they picked once
 * the drop-down opened. Clicks say the second, and they are already in the
 * logs.
 *
 * The model is a count, not a gradient: for every prefix that was ever typed,
 * how many times each suggestion was chosen. It trains in one pass over the
 * log and is read back with map lookups, at most one per prefix length for
 * each candidate, on a query whose counted length is capped.
 *
 * The candidates come in as an argument: this rung reorders a list, it does
 * not retrieve it.
 */

// Only the first characters of a query are counted. A pasted paragraph would
// otherwise store one key per prefix, each a copy of the prefix: the memory
// grows with the square of its length, and so does the lookup.
export const MAX_TYPED = 64;

/** Same folding as the prefix tree, so both rungs agree on what was typed. */
export function normalise(text) {
  // Upper then lower case folds "ß" into "ss", the same way in both languages,
  // and the final sigma is folded by hand. \p{M} holds the accents NFKD
  // detaches, \p{Cf} the invisible characters; NFKD has already turned
  // non-breaking spaces into plain ones.
  const folded = text.normalize('NFKD').toUpperCase().toLowerCase().replace(/ς/g, 'σ');
  const kept = folded.replace(/[\p{M}\p{Cf}]/gu, '').replace(/[\t\n\v\f\r]/g, ' ');
  return kept.split(' ').filter(Boolean).join(' ');
}

// A map key has to be a single value. A tab never occurs inside a normalised
// prefix, since normalise turns it into a space, so the first tab splits the key.
const key = (prefix, term) => `${prefix}\t${term}`;

/**
 * Count clicks from pairs of [what was typed, which suggestion was clicked].
 *
 * One click teaches something about every prefix of what was typed: whoever
 * chose "chaussettes de sport" after typing "chau" also tells us what to show
 * at "c" and at "cha".
 */
export function learn(clicks) {
  const model = new Map();
  for (const [typed, term] of clicks) {
    const prefix = normalise(typed).slice(0, MAX_TYPED);
    for (let length = 0; length <= prefix.length; length += 1) {
      const at = key(prefix.slice(0, length), term);
      model.set(at, (model.get(at) ?? 0) + 1);
    }
  }
  return model;
}

/**
 * Clicks recorded for the longest prefix of the query that saw this term.
 *
 * Backing off matters: a rare prefix has too few clicks of its own, but it
 * shares its first letters with past queries that do. The longer
 * the matching prefix, the more specific the evidence, hence the weight.
 */
function evidence(model, prefix, term) {
  for (let length = prefix.length; length >= 0; length -= 1) {
    const clicked = model.get(key(prefix.slice(0, length), term)) ?? 0;
    if (clicked) return clicked * (length + 1);
  }
  return 0;
}

/**
 * Sort candidates by past clicks, keeping their incoming order as tie-break.
 *
 * Candidates arrive ordered by search frequency, as the previous rung left
 * them. A term nobody ever clicked keeps that order: the model only moves what
 * it has evidence about, which is what makes it safe to ship on a log that is
 * still thin.
 */
export function rerank(model, prefix, candidates, limit = 5) {
  const typed = normalise(prefix).slice(0, MAX_TYPED);
  const scored = candidates.map((term, rank) => [evidence(model, typed, term), rank, term]);
  scored.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  return scored.slice(0, limit).map(([, , term]) => term);
}
