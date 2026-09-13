/**
 * Tag articles from a controlled vocabulary, matched after simple lemmatisation.
 *
 * Rung N0. Deterministic, no dependency, and auditable: every tag can be
 * traced back to the term that produced it, which is what an editor asks for
 * the first time a tag looks wrong.
 *
 * Two things make this work.
 *
 * First, the article and the vocabulary go through the very same pipeline. A
 * stemmer that is applied to one side only will happily fail to match a word
 * with itself.
 *
 * Second, tagging is multi-label by construction. An article covers several
 * topics, or none; a function that returns one topic per article is answering
 * a question nobody asked.
 */

// Endings stripped, longest first. This is a plural-and-suffix stripper, not a
// linguist's lemmatiser. It only has to fold the spellings of one word onto
// each other, and both sides of the comparison get the same treatment.
const SUFFIXES = ['ements', 'ement', 'ations', 'ation', 'es', 's', 'x', 'e'];

const WORD = /[\p{L}\p{N}]+/gu;

/** Lowercase and drop accents, so "Fiscalité" and "FISCALITE" meet. */
export function normalise(text) {
  return text.toLowerCase().normalize('NFD').replace(/\p{M}+/gu, '');
}

/** Strip one ending, and only when a stem of three letters is left. */
export function lemmatise(word) {
  for (const suffix of SUFFIXES) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 3) {
      return word.slice(0, -suffix.length);
    }
  }
  return word;
}

/**
 * The text as a run of stems, padded with spaces at both ends.
 *
 * The padding is what lets a multi-word term be found with a plain substring
 * search: "impot" can then never match inside "impotent".
 */
export function stems(text) {
  const found = normalise(text).match(WORD) ?? [];
  return ` ${found.map(lemmatise).join(' ')} `;
}

/**
 * Every topic whose terms appear in the article, best supported first.
 *
 * `vocabulary` maps a topic name to the terms that stand for it, single or
 * multi-word. Keeping it a parameter is the point of this rung: the taxonomy
 * belongs to whoever edits the articles, not to the code.
 *
 * `minTerms` is how many distinct terms a topic needs before it is claimed.
 * Raise it when a single passing mention is not enough to file an article.
 */
export function tag(article, vocabulary, minTerms = 1) {
  const haystack = stems(article);
  const hits = new Map();
  for (const [topic, terms] of Object.entries(vocabulary)) {
    const found = terms.filter((term) => haystack.includes(stems(term))).length;
    if (found >= minTerms) hits.set(topic, found);
  }
  // Best supported first, ties in alphabetical order: a tagging run has to be
  // replayable, and a set has no order to replay.
  return [...hits.keys()].sort((a, b) => hits.get(b) - hits.get(a) || a.localeCompare(b));
}
