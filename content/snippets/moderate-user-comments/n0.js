/**
 * Flag a comment against a term list, after normalisation, with context.
 *
 * Rung N0. Deterministic, no dependency, and auditable: every decision can be
 * traced back to one word in a list you control.
 *
 * Two things make it usable rather than merely simple.
 *
 * First, normalisation. Accents and case are spellings of the same word, so
 * they are folded before matching. Nothing else is touched: folding further
 * would start inventing matches.
 *
 * Second, the context window. A term list cannot decide anything on its own,
 * so the function returns the words around each hit. A human reads the window
 * and decides. A moderation tool that returns a bare boolean hides the one
 * piece of evidence its reviewer needs.
 */

// Letters and digits, in any script. Punctuation and underscores separate.
const TOKEN = /[\p{L}\p{N}]+/gu;

/** Fold case and strip accents, so one entry matches its spellings. */
export function normalise(text) {
  return text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
}

/**
 * Return every listed term found in `text`, with the words around it.
 *
 * `terms` is yours: the list is policy, not code, and it belongs outside the
 * function that applies it.
 *
 * `window` is a number of words on each side. Widen it when your reviewers
 * keep asking what the comment was about.
 */
export function review(text, terms, window = 3) {
  const listed = new Set([...terms].map(normalise));
  const words = text.match(TOKEN) ?? [];
  const matches = [];
  for (const [position, word] of words.entries()) {
    if (!listed.has(normalise(word))) continue;
    matches.push({
      term: normalise(word),
      position,
      context: words.slice(Math.max(0, position - window), position + window + 1).join(' '),
    });
  }
  return { flagged: matches.length > 0, matches };
}
