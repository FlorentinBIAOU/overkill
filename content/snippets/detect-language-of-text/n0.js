/**
 * Detect the language of a text: character trigram profiles, rank distance.
 *
 * Rung N0. Deterministic, no dependency, and the whole model is a few hundred
 * short strings per language.
 *
 * The idea comes from Cavnar and Trenkle, in 1994. Each language uses some
 * trigrams far more than others: "ent", "les", "eur" in French, "the", "ing"
 * in English, "que", "los" in Spanish. Rank those trigrams by frequency in a sample of the
 * language, rank them again in the text to identify, and compare the two
 * orderings. The language whose ordering is closest wins.
 *
 * Two details make it work.
 *
 * First, words are padded with spaces before being cut, so a trigram carries
 * the information that it opens or closes a word. "les" inside a word is not
 * the article.
 *
 * Second, the comparison is on ranks, not on raw counts. A count grows with
 * the length of the text, a rank does not: the same text repeated four times
 * keeps every rank. And the distance is divided by the number of trigrams, so
 * a long text and a short one land on the same scale.
 */

export const PROFILE_SIZE = 300;

// Letters only. Digits, punctuation and symbols say nothing about a language,
// and a text full of them would drown the trigrams that do.
const WORDS = /\p{L}+/gu;

/** The padded trigrams of every word, in reading order. */
export function trigrams(text) {
  const grams = [];
  for (const word of text.normalize('NFC').toLowerCase().match(WORDS) ?? []) {
    const padded = ` ${word} `;
    for (let i = 0; i + 3 <= padded.length; i += 1) grams.push(padded.slice(i, i + 3));
  }
  return grams;
}

/**
 * Build a language profile from a sample: trigram to rank, most frequent
 * first.
 *
 * Ties are broken alphabetically, so the same sample always gives the same
 * profile. A language model you cannot reproduce is a language model you
 * cannot debug.
 */
export function profile(sample, size = PROFILE_SIZE) {
  const counts = new Map();
  for (const gram of trigrams(sample)) counts.set(gram, (counts.get(gram) ?? 0) + 1);
  const ordered = [...counts].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  return new Map(ordered.slice(0, size).map(([gram], rank) => [gram, rank]));
}

/**
 * Out-of-place distance between the text and one language profile.
 *
 * Every trigram of the text costs how far it moved in the ranking. A trigram
 * the language never uses costs the maximum, which is what makes an unrelated
 * language expensive rather than merely different.
 *
 * Dividing by the number of trigrams keeps a long text and a short one on the
 * same scale.
 */
export function distance(text, reference, size = PROFILE_SIZE) {
  const textProfile = profile(text, size);
  if (textProfile.size === 0) return size;
  let total = 0;
  for (const [gram, rank] of textProfile) {
    const referenceRank = reference.get(gram);
    total += referenceRank === undefined ? size : Math.abs(rank - referenceRank);
  }
  return total / textProfile.size;
}

/**
 * Every candidate language, closest first.
 *
 * The caller gets the gap between the first two, which is the only honest
 * measure of how sure this is.
 *
 * @param {string} text
 * @param {Map<string, Map<string, number>>} profiles
 */
export function ranked(text, profiles) {
  const scores = [...profiles].map(([name, reference]) => [name, distance(text, reference)]);
  return scores.sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1));
}

/** The closest language. It always returns one, even when it should not. */
export function detect(text, profiles) {
  return ranked(text, profiles)[0][0];
}
