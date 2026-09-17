/**
 * Flag a comment against a term list, after normalisation, with context.
 *
 * Rung N0. Deterministic, no dependency, and auditable: every decision can be
 * traced back to one entry in a list you control.
 *
 * Two things make it usable rather than merely simple.
 *
 * First, normalisation. Case, accents and compatibility forms (full-width
 * letters, ligatures, superscripts) are spellings of the same word, so they
 * are folded before matching. Look-alikes are not: a 0 stays a 0, which is
 * why bl0rptard walks past.
 *
 * Second, the context window. A term list cannot decide anything on its own,
 * so the function returns the words around each hit. A human reads the window
 * and decides. A moderation tool that returns a bare boolean hides the one
 * piece of evidence its reviewer needs.
 */

// Letters, digits, and the marks that spell them; anything else separates. A
// Devanagari vowel sign is a mark, and leaving it out would cut a word in two.
const TOKEN = /[\p{L}\p{N}\p{M}]+/gu;

/** Fold compatibility forms, then case, then Latin accents. */
export function normalise(text) {
  // Decomposed before folding, and again after: 𝐁𝐋𝐎𝐑𝐏𝐓𝐀𝐑𝐃 has to become
  // BLORPTARD before the case fold can see it. JavaScript has no casefold, so
  // `toLowerCase` does the work and the two letters a Latin term list meets,
  // ß and the final ς, are done by hand; there are two hundred and fifty-two
  // others, in Cherokee, Greek and Cyrillic, that this line does not cover.
  return text
    .normalize('NFKD')
    .toLowerCase()
    .normalize('NFKD')
    .replaceAll('ß', 'ss')
    .replaceAll('ς', 'σ')
    .replace(/[\u0300-\u036f]/gu, '');
}

// Composed first, so an accent typed as a separate mark stays in its word.
const words = (text) => text.normalize('NFC').match(TOKEN) ?? [];

/**
 * Return every listed term found in `text`, with the words around it.
 *
 * A term of several words matches those words in a row, whatever punctuation
 * separates them in the comment.
 *
 * `terms` is yours: the list is policy, not code, and it belongs outside the
 * function that applies it.
 *
 * `window` is a number of words on each side. Widen it when your reviewers
 * keep asking what the comment was about.
 */
export function review(text, terms, window = 3) {
  const listed = new Set([...terms].map((t) => words(t).map(normalise).join(' ')));
  const longest = [...terms].reduce((most, t) => Math.max(most, words(t).length), 0);
  const found = words(text);
  const folded = found.map(normalise);
  const matches = [];
  for (let position = 0; position < found.length; position += 1) {
    for (let size = 1; size <= Math.min(longest, found.length - position); size += 1) {
      const term = folded.slice(position, position + size).join(' ');
      if (!listed.has(term)) continue;
      matches.push({
        term,
        position,
        context: found.slice(Math.max(0, position - window), position + size + window).join(' '),
      });
    }
  }
  return { flagged: matches.length > 0, matches };
}
