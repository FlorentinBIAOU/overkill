/**
 * The terms that tell this document apart from the others in the same folder.
 *
 * Rung N1. Rung N0 reads one document and can only say what it repeats. Every
 * contract in a folder of contracts repeats « conditions générales de vente »,
 * and no amount of reading that one contract more carefully will reveal that
 * the phrase is worthless: the information is in the folder, not in the
 * document.
 *
 * So the candidates are the same as at rung N0 — the same cut, the same stop
 * list — and only the ranking changes. Each word gets the logarithm of how
 * many documents there are over how many contain it, and a phrase is worth the
 * average of its words, times how often the document says it. A word in every
 * document is then worth exactly nothing, which is the whole point.
 *
 * One deliberate difference from the usual formula: `scikit-learn` smooths,
 * and floors that logarithm at one, so a term in every document still weighs
 * something. That is right when the weights feed a similarity — the entry on
 * showing similar articles uses the smoothed form for that reason. It is wrong
 * here: a term in every document of your collection is not a key term of any
 * of them, and rounding it to « a little » would put it back in the list.
 *
 * The model is the collection. It is fitted in memory, in one pass, from the
 * documents you already hold; there is nothing to download and nothing to send.
 */

import { candidatesOf, extractKeyTerms } from './n0.js';

// Kept so the two rungs are told apart in a report that mixes them.
export const SOURCE = 'corpus';

/**
 * For each document, the phrases the rest of the collection does not share.
 *
 * `documents` is the collection itself: the ranking is only as good as what
 * you compare against, and two documents are not a collection.
 */
export function extractKeyTermsInCorpus(documents, stopWords, { top = 8 } = {}) {
  if (!Array.isArray(documents)) {
    return { documents: [], reason: `expected a list, not ${typeof documents}` };
  }
  if (documents.length < 2) {
    return { documents: [], reason: 'a corpus of at least two documents is required' };
  }
  const stop = [...(stopWords ?? [])];
  if (stop.length === 0) {
    return { documents: [], reason: 'a stop list is required, one per language' };
  }

  const perDocument = documents.map((text) => candidatesOf(typeof text === 'string' ? text : '', stop));
  const holders = new Map();
  for (const phrases of perDocument) {
    const words = new Set(phrases.flatMap((phrase) => phrase.split(' ')));
    for (const word of words) holders.set(word, (holders.get(word) ?? 0) + 1);
  }
  const total = documents.length;
  const idf = new Map([...holders].map(([word, count]) => [word, Math.log(total / count)]));

  const ranked = documents.map((text, index) => {
    const counted = extractKeyTerms(typeof text === 'string' ? text : '', stop,
      { top: perDocument[index].length || 1 }).terms;
    const terms = counted.map((term) => ({
      text: term.text,
      key: term.key,
      count: term.count,
      first: term.first,
      score: rounded(term.count * mean(term.key, idf)),
    }));
    // Equal scores are the ordinary case, not the exception: on a short
    // document every phrase appears once and in no other document, so every
    // one of them scores log(N). What breaks the tie has to mean something —
    // the longer phrase first, because it says more, then the one that appears
    // earliest, because a document states its subject early. The key comes
    // last, and only so that two languages answer in the same order.
    const mots = (term) => term.key.split(' ').length;
    terms.sort((a, b) => b.score - a.score || b.count - a.count
      || mots(b) - mots(a) || a.first - b.first
      || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    const kept = terms.slice(0, top);
    // How many terms outside the cut share the score of the last one kept: a
    // caller that reads « the top five » of twelve equals should know.
    const tiedAtCut = kept.length > 0 && terms.length > kept.length
      ? terms.slice(kept.length).filter((term) => term.score === kept.at(-1).score).length
      : 0;
    return { index, terms: kept, tied_at_cut: tiedAtCut };
  });
  return { documents: ranked, reason: null };
}

function mean(key, idf) {
  const words = key.split(' ');
  return words.reduce((sum, word) => sum + (idf.get(word) ?? 0), 0) / words.length;
}

/**
 * Four decimals, by the same two operations in both languages: Python and
 * JavaScript do not round a half the same way, and a ranking must not depend
 * on which one ran.
 */
function rounded(value) {
  return Math.floor(value * 10000 + 0.5) / 10000;
}
