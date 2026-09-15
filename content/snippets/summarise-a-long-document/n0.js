/**
 * Summarise a long document by choosing its own best sentences.
 *
 * Rung N0. Extractive: every sentence of the summary appears verbatim in the
 * source, because this code never writes a word, it only selects.
 *
 * Two classical signals, and nothing else.
 *
 * Term frequency. A word the document keeps coming back to is what the
 * document is about, so a sentence dense in such words carries more of the
 * subject than a sentence made of connectives. Dividing by the length of the
 * sentence measures density rather than volume, which stops a long sentence
 * from winning by size.
 *
 * Position. An author states the subject early. A small bonus that decays
 * with the rank of the sentence encodes that habit, without handing the
 * summary to the opening paragraph outright.
 */

// A sentence ends at a full stop, question or exclamation mark followed by
// whitespace, or at a line break, so a transcript or a list without final
// punctuation is still cut into lines. Abbreviations will fool this, and so
// will prose hard-wrapped at a fixed width, which has to be unwrapped first; a
// real corpus needs a better splitter, a separate problem from choosing.
const SENTENCE_END = /(?<=[.!?])\s+|\s*\n\s*/;

// Letters and digits only, so accented words survive and punctuation does
// not. The Python counterpart writes the same class as `[^\W_]`.
const WORD = /[\p{L}\p{N}]+/gu;

/** Lowercase words, composed first: a decomposed `é` would split the word. */
function words(sentence) {
  return sentence.normalize('NFC').toLowerCase().match(WORD) ?? [];
}

// Words too common to say anything about the subject of a document.
const STOPWORDS = new Set(
  ('a an and are as at be been but by for from had has have in into is it its ' +
    'of on or that the their there they this to was were which will with').split(' '),
);

// How much the opening of the document is worth. Large enough to break a tie
// between two equally dense sentences, too small to win on its own.
const LEAD_BONUS = 0.15;

/** Cut the document into sentences, dropping empty ones. */
export function splitSentences(text) {
  return text
    .trim()
    .split(SENTENCE_END)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Count content words, then scale so the most frequent one weighs one. */
function termWeights(sentences) {
  const counts = new Map();
  for (const sentence of sentences) {
    for (const word of words(sentence)) {
      if (word.length > 2 && !STOPWORDS.has(word)) {
        counts.set(word, (counts.get(word) ?? 0) + 1);
      }
    }
  }
  if (counts.size === 0) return new Map();
  const most = Math.max(...counts.values());
  return new Map([...counts].map(([word, count]) => [word, count / most]));
}

/** Density in the document's own vocabulary, plus the position bonus. */
export function scoreSentences(sentences) {
  const weights = termWeights(sentences);
  return sentences.map((sentence, index) => {
    const found = words(sentence);
    let total = 0;
    for (const word of found) total += weights.get(word) ?? 0;
    const density = found.length ? total / found.length : 0;
    return density + LEAD_BONUS / (index + 1);
  });
}

/**
 * Return the best sentences, in the order the document puts them.
 *
 * Ordering the summary by score would read as a list of quotations. Keeping
 * document order keeps the sequence the author chose, which is the only part
 * of the argument an extractive summary can preserve.
 */
export function summarise(text, maxSentences = 3) {
  if (maxSentences < 0) throw new RangeError('maxSentences cannot be negative');
  const sentences = splitSentences(text);
  const scores = scoreSentences(sentences);
  // Sorting is stable, so two identical scores keep their document order.
  const ranked = sentences.map((_, index) => index).sort((a, b) => scores[b] - scores[a]);
  const chosen = ranked.slice(0, maxSentences).sort((a, b) => a - b);
  return chosen.map((index) => sentences[index]).join(' ');
}
