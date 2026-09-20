/**
 * The terms a document keeps coming back to, taken from the document alone.
 *
 * Rung N0. The method is the one RAKE made common: the words a language uses
 * to build sentences — articles, prepositions, auxiliaries — are also what
 * separates one idea from the next, so cutting the text at every stop word
 * leaves the candidate phrases whole. Each candidate is then scored by how
 * often its words appear and how long the phrases they appear in are, which
 * favours a phrase that is repeated and specific over a word that is merely
 * frequent.
 *
 * The stop list is not shipped here, and that is the point. It is the whole
 * job, it is different in every language, and it belongs to the caller who
 * knows what language their documents are in — the same stance as the entry on
 * showing similar articles. Without one, the key terms of any French text are
 * « de », « la » and « le », so an empty list is refused rather than served.
 *
 * What this rung cannot do is in its name: it reads one document, so it can
 * tell what that document repeats, never what makes it different from the four
 * hundred others in the same folder. Every contract in a folder of contracts
 * says « conditions générales de vente », and nothing here knows that. Rung N1
 * does.
 *
 * The tools that do this in one call: `yake` in Python, whose stop lists cover
 * some forty languages, and, in JavaScript, `keyword-extractor`, whose
 * published package declares no licence.
 */

// A word starts with a letter: « 14 » is not a key term of anything, « 14
// jours » may be. The hyphen stays inside, so « porte-monnaie » is one word.
const WORD = /\p{L}[\p{L}\p{N}_-]*/gu;

// Two words belong to the same candidate only when nothing but space
// separates them. Punctuation ends a candidate, and so does anything this
// pattern does not list — the apostrophe among them, because French elides
// on it and « l'entreprise » is a stop word followed by a term.
const SPACES = /^[ \t\r\n\f\v\u00a0\u202f\u2028\u2029]+$/;

// Longer than this and it is a sentence, not a term.
export const MAX_WORDS = 4;

/**
 * The phrases this document repeats, ranked without any other document.
 *
 * `stopWords` is a per-language list, required: it is what cuts the text into
 * candidates, and no list means no language declared.
 */
export function extractKeyTerms(text, stopWords, { top = 8 } = {}) {
  if (typeof text !== 'string') {
    return { terms: [], reason: `expected text, not ${typeof text}` };
  }
  const stop = new Set((stopWords ?? []).map(fold));
  if (stop.size === 0) {
    return { terms: [], reason: 'a stop list is required, one per language' };
  }

  const candidates = phrasesOf(text, stop);
  const degree = new Map();
  const frequency = new Map();
  for (const words of candidates) {
    for (const word of words) {
      const key = fold(word);
      degree.set(key, (degree.get(key) ?? 0) + words.length);
      frequency.set(key, (frequency.get(key) ?? 0) + 1);
    }
  }

  const seen = new Map();
  for (const words of candidates) {
    const key = words.map(fold).join(' ');
    if (!seen.has(key)) {
      const score = words.reduce((sum, w) => sum + degree.get(fold(w)) / frequency.get(fold(w)), 0);
      // `first` is the rank of the phrase's first appearance in the document.
      // It is what rung N1 uses to break a tie by something that means
      // something: on a short document every phrase scores the same, and
      // ordering equals by their spelling puts the subject wherever its
      // initial falls in the alphabet.
      seen.set(key, {
        text: words.join(' '), key, count: 0, first: seen.size, score,
      });
    }
    seen.get(key).count += 1;
  }

  // Sorted on three keys so that two phrases of equal score always come back
  // in the same order, in both languages.
  const terms = [...seen.values()].sort((a, b) => b.score - a.score
    || b.count - a.count || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return { terms: terms.slice(0, top), reason: null };
}

/** The candidate phrases, keyed and deduplicated — what rung N1 ranks. */
export function candidatesOf(text, stopWords) {
  const stop = new Set((stopWords ?? []).map(fold));
  const keys = new Set(phrasesOf(text, stop).map((words) => words.map(fold).join(' ')));
  return [...keys].sort();
}

/** Runs of words with no stop word and no punctuation inside them. */
function phrasesOf(text, stop) {
  // NFC once, on the whole text: in the decomposed form the accent is a
  // character of its own, and « société » would be cut in two.
  const normalised = text.normalize('NFC');
  const phrases = [];
  let current = [];
  let end = 0;
  for (const match of normalised.matchAll(WORD)) {
    if (current.length && !SPACES.test(normalised.slice(end, match.index))) {
      phrases.push(current);
      current = [];
    }
    end = match.index + match[0].length;
    if (stop.has(match[0].toLowerCase())) {
      if (current.length) phrases.push(current);
      current = [];
    } else if (current.length < MAX_WORDS) {
      current.push(match[0]);
      if (current.length === MAX_WORDS) {
        phrases.push(current);
        current = [];
      }
    }
  }
  if (current.length) phrases.push(current);
  return phrases;
}

/** One spelling per term; the text has already been normalised to NFC. */
function fold(word) {
  return word.normalize('NFC').toLowerCase();
}
