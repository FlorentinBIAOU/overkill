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

// Letters and digits, in any script. Punctuation and underscores separate.
const TOKEN = /[\p{L}\p{N}]+/gu;

/** Fold case, compatibility forms and accents, so one entry matches its spellings. */
export function normalise(text) {
  // JavaScript has no casefold. The two letters whose Python casefold differs
  // from their lowercase once NFKD has run, ß and the final ς, are done by hand.
  return text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replaceAll('ß', 'ss').replaceAll('ς', 'σ');
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
